/**
 * ToneForge Intent — submission and human approval gate.
 *
 * `submitIntent` routes a structured {@link Intent} through Intelligence
 * (it never mutates systems directly — PRD §7) and presents the resulting
 * suggestions behind an explicit human approval gate:
 *
 * - `--dry-run` never executes anything;
 * - non-interactive / `--json` runs print suggestions only unless `--approve`;
 * - interactive runs prompt for each suggestion and execute only confirmed
 *   ones.
 *
 * Every suggestion references an actionable, runnable `toneforge` command
 * (validated against the Intelligence command registry).
 */

import { recommendSounds } from "../intelligence/recommend.js";
import { validateActionableCommand } from "../intelligence/commands.js";
import { INTENT_VERSION } from "./types.js";
import type { Intent } from "./types.js";

/** A single actionable suggestion produced for an intent. */
export interface IntentSuggestion {
  /** Stable suggestion id. */
  id: string;

  /** Confidence in [0, 1]. */
  confidence: number;

  /** Human-readable rationale. */
  rationale: string;

  /** Actionable, runnable `toneforge` command. */
  suggestedCommand: string;
}

/** Structured result of `toneforge intent submit`. */
export interface IntentSubmissionReport {
  /** Command discriminator. */
  command: "intent submit";

  /** Schema version. */
  version: string;

  /** Intent submission never mutates systems directly. */
  readOnly: true;

  /** Whether execution was suppressed by `--dry-run`. */
  dryRun: boolean;

  /** The structured intent that was submitted. */
  intent: Intent;

  /** The use case string routed to Intelligence. */
  useCase: string;

  /** Actionable suggestions. */
  suggestions: IntentSuggestion[];

  /** Explicit approval gate marker. */
  approvalRequired: true;

  /** Whether the human approved execution. */
  approved: boolean;

  /** Commands that were actually executed (empty unless approved). */
  executed: string[];
}

/** Executes an approved command. */
export type CommandExecutor = (command: string) => Promise<void> | void;

/** Options for {@link submitIntent}. */
export interface SubmitIntentOptions {
  /** Library directory Intelligence reads. */
  libraryDir?: string;

  /** Maximum suggestions. Default: 5. */
  maxResults?: number;

  /** Explicit approval flag. */
  approve?: boolean;

  /** Dry-run: never execute. */
  dryRun?: boolean;

  /** Interactive gate. Defaults to whether stdout is a TTY. */
  interactive?: boolean;

  /** Confirmation callback used by the interactive gate. */
  confirm?: (suggestion: IntentSuggestion) => Promise<boolean> | boolean;

  /** Executor invoked for approved suggestions. Default: no-op. */
  executor?: CommandExecutor;
}

/** Derive the Intelligence use-case string from an intent. */
export function intentToUseCase(intent: Intent): string {
  const action = intent.intent.replace(/_/g, " ");
  const constraints = Object.entries(intent.constraints)
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(" ");
  return [action, "in", intent.scope, constraints].filter((part) => part.length > 0).join(" ");
}

/** Build the always-present routing suggestion. */
function routingSuggestion(intent: Intent): IntentSuggestion {
  const command = `toneforge intelligence recommend --use-case "${intentToUseCase(intent)}" --use-memory`;
  const fallback = `toneforge intelligence recommend --use-case "${intent.scope}"`;
  return {
    id: "intent-route",
    confidence: 0.6,
    rationale: `Route the '${intent.intent}' intent through Intelligence with historical memory context.`,
    suggestedCommand: validateActionableCommand(command).valid ? command : fallback,
  };
}

/**
 * Submit an intent: route it through Intelligence and apply the approval gate.
 *
 * Read-only with respect to library/asset data unless an approved command is
 * executed through the injected executor.
 */
export async function submitIntent(
  intent: Intent,
  options: SubmitIntentOptions = {},
): Promise<IntentSubmissionReport> {
  const libraryDir = options.libraryDir ?? ".toneforge-library";
  const useCase = intentToUseCase(intent);

  const report = await recommendSounds(libraryDir, useCase, {
    maxResults: options.maxResults ?? 5,
  });

  const suggestions: IntentSuggestion[] = [routingSuggestion(intent)];
  for (const rec of report.recommendations) {
    suggestions.push({
      id: `recommend-${rec.rank}`,
      confidence: rec.confidence,
      rationale: rec.rationale,
      suggestedCommand: rec.suggestedCommand,
    });
  }

  const dryRun = options.dryRun ?? false;
  const interactive = options.interactive ?? Boolean(process.stdout.isTTY);
  const executor = options.executor ?? (() => {});

  const executed: string[] = [];
  let approved = false;

  if (dryRun) {
    approved = false;
  } else if (options.approve === true) {
    approved = true;
    for (const suggestion of suggestions) {
      await executor(suggestion.suggestedCommand);
      executed.push(suggestion.suggestedCommand);
    }
  } else if (interactive && options.confirm) {
    for (const suggestion of suggestions) {
      const ok = await options.confirm(suggestion);
      if (ok) {
        approved = true;
        await executor(suggestion.suggestedCommand);
        executed.push(suggestion.suggestedCommand);
      }
    }
  }

  return {
    command: "intent submit",
    version: INTENT_VERSION,
    readOnly: true,
    dryRun,
    intent,
    useCase,
    suggestions,
    approvalRequired: true,
    approved,
    executed,
  };
}
