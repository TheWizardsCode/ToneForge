/**
 * ToneForge Intent — deterministic goal-to-intent parsing.
 *
 * The freeform `--goal` string is mapped to a structured {@link Intent} by a
 * deterministic keyword/rule match over the controlled vocabulary
 * ({@link INTENT_VOCABULARY}). No NLP or LLM is involved (PRD §3, §8): the
 * same goal always yields the same intent.
 *
 * An explicit `--intent <id>` override bypasses goal parsing and is validated
 * against the vocabulary.
 */

import {
  INTENT_VOCABULARY,
  findIntentDefinition,
  intentVocabularyIds,
} from "./types.js";
import type {
  Intent,
  IntentConstraints,
  IntentDefinition,
  IntentPriority,
} from "./types.js";

/** Thrown when a goal cannot be mapped to a supported intent. */
export class UnknownIntentError extends Error {
  readonly supported: string[];

  constructor(goal: string) {
    const supported = intentVocabularyIds();
    super(
      `Unknown goal '${goal}'. No controlled intent matched. ` +
        `Supported intents: ${supported.join(", ")}. ` +
        `Pass --intent <id> to select one explicitly.`,
    );
    this.name = "UnknownIntentError";
    this.supported = supported;
  }
}

/** Thrown when an explicit `--intent` id is not in the vocabulary. */
export class UnknownIntentIdError extends Error {
  readonly supported: string[];

  constructor(id: string) {
    const supported = intentVocabularyIds();
    super(
      `Unknown intent '${id}'. Supported intents: ${supported.join(", ")}.`,
    );
    this.name = "UnknownIntentIdError";
    this.supported = supported;
  }
}

/** Tokenise freeform text into lowercased alphanumeric tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/** Score a vocabulary entry against the goal tokens. */
function scoreDefinition(definition: IntentDefinition, tokens: Set<string>): number {
  let score = 0;
  for (const keyword of definition.keywords) {
    if (tokens.has(keyword)) score++;
  }
  return score;
}

/** Options for {@link parseGoalToIntent}. */
export interface ParseGoalOptions {
  /** Explicit scope; falls back to the matched definition's default scope. */
  scope?: string;

  /** Explicit priority; falls back to the definition default. */
  priority?: IntentPriority;

  /** Optional constraints. */
  constraints?: IntentConstraints;
}

/**
 * Map a freeform goal to a structured intent (pure, deterministic).
 *
 * @throws {UnknownIntentError} when no vocabulary entry matches.
 */
export function parseGoalToIntent(goal: string, options: ParseGoalOptions = {}): Intent {
  const tokens = new Set(tokenize(goal));

  let best: IntentDefinition | undefined;
  let bestScore = 0;
  // Stable tie-break: first definition in vocabulary order wins.
  for (const definition of INTENT_VOCABULARY) {
    const score = scoreDefinition(definition, tokens);
    if (score > bestScore) {
      best = definition;
      bestScore = score;
    }
  }

  if (!best || bestScore === 0) {
    throw new UnknownIntentError(goal);
  }

  return {
    intent: best.id,
    scope: options.scope ?? best.defaultScope,
    priority: options.priority ?? best.defaultPriority,
    constraints: options.constraints ?? {},
    goal,
  };
}

/** Options for {@link resolveIntent}. */
export interface ResolveIntentOptions {
  /** Freeform goal (used when `intent` is not supplied). */
  goal?: string;

  /** Explicit intent id override. */
  intent?: string;

  /** Explicit scope. */
  scope: string;

  /** Optional priority. */
  priority?: IntentPriority;

  /** Optional constraints. */
  constraints?: IntentConstraints;
}

/**
 * Resolve an Intent from either an explicit id or a freeform goal.
 *
 * @throws {UnknownIntentIdError|UnknownIntentError}
 */
export function resolveIntent(options: ResolveIntentOptions): Intent {
  if (options.intent !== undefined) {
    const definition = findIntentDefinition(options.intent);
    if (!definition) throw new UnknownIntentIdError(options.intent);
    return {
      intent: definition.id,
      scope: options.scope,
      priority: options.priority ?? definition.defaultPriority,
      constraints: options.constraints ?? {},
      ...(options.goal !== undefined ? { goal: options.goal } : {}),
    };
  }

  if (options.goal === undefined || options.goal.trim().length === 0) {
    throw new UnknownIntentError("");
  }

  const parsed = parseGoalToIntent(options.goal, {
    scope: options.scope,
    ...(options.priority !== undefined ? { priority: options.priority } : {}),
    ...(options.constraints !== undefined ? { constraints: options.constraints } : {}),
  });
  return parsed;
}
