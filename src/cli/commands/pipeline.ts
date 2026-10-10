/**
 * `toneforge pipeline` command.
 *
 * Runs the Integrations CI pipeline — generate → validate → compile →
 * export — in a single non-interactive invocation. Every stage reuses the
 * shipped Library, Validator and Compiler APIs; the command only sequences
 * them, emits a structured (JSON) per-stage log, and exits non-zero the
 * moment a stage fails.
 *
 * Reference: docs/prd/INTEGRATIONS_PRD.md Sections 4.2 (Build Systems &
 * CI), 7 (Deterministic Build Integration), 10 (Validation & Compliance).
 *
 * Work item: TF-0MUZYS3IX008OIF5.
 */

import {
  defaultCompileDir,
  runCiPipeline,
  type PipelineRunResult,
  type PipelineStageLog,
} from "../../integrations/index.js";
import { loadFixture } from "../../integrations/harness.js";
import { DEFAULT_LIBRARY_DIR } from "../../library/index.js";
import { STRICTNESS_LEVELS, isRulesetName, listRulesets } from "../../validator/index.js";
import {
  outputError,
  outputInfo,
  outputSuccess,
  outputWarning,
} from "../../output.js";
import type { RulesetName, StrictnessLevel } from "../../validator/index.js";

export const command = "pipeline";
export const desc = "Run the generate → validate → compile → export CI pipeline";

export function builder(yargs: any) {
  return yargs
    .option("sounds", {
      type: "string",
      describe: "Sounds manifest (JSON) describing the entries to generate (required)",
    })
    .option("library", {
      type: "string",
      describe: `Library directory written by generate (default: ${DEFAULT_LIBRARY_DIR})`,
    })
    .option("output", {
      type: "string",
      describe: "Export output directory (required)",
    })
    .option("compile-dir", {
      type: "string",
      describe: "Compiled-artifact directory (default: <output>/compile)",
    })
    .option("ruleset", {
      type: "string",
      describe: `Validation ruleset override: ${listRulesets().join(", ")}`,
    })
    .option("strictness", {
      type: "string",
      describe: `Validation strictness override: ${STRICTNESS_LEVELS.join(", ")}`,
    })
    .option("json", { type: "boolean", describe: "Output the structured run result as JSON" });
}

/** Fully-resolved, validated arguments for a `pipeline` run. */
export interface PipelineArgs {
  /** Path to the sounds manifest (fixture). */
  soundsFile: string;
  /** Library root written by the generate stage. */
  libraryDir: string;
  /** Export output directory. */
  outputDir: string;
  /** Compiled-artifact directory. */
  compileDir: string;
  /** Validation ruleset override. */
  ruleset?: RulesetName;
  /** Validation strictness override. */
  strictness?: StrictnessLevel;
}

/**
 * Read a string-valued flag, rejecting a flag supplied without a value.
 *
 * @throws If the flag is present but not a string (e.g. bare `--library`).
 */
function readStringFlag(argv: Record<string, unknown>, name: string): string | undefined {
  const value = argv[name];
  if (value === undefined) return undefined;
  if (typeof value === "string" && value.trim().length > 0) return value;
  throw new Error(`--${name} requires a value.`);
}

/**
 * Validate and normalise the CLI arguments for a `pipeline` run.
 *
 * @throws On a missing `--sounds`/`--output`, an unknown ruleset, or an
 *         invalid strictness level.
 */
export function parsePipelineArgs(argv: Record<string, unknown>): PipelineArgs {
  const soundsFile = readStringFlag(argv, "sounds");
  if (soundsFile === undefined) {
    throw new Error(
      "pipeline requires --sounds <file>. Run 'toneforge pipeline --help' for usage.",
    );
  }

  const outputDir = readStringFlag(argv, "output");
  if (outputDir === undefined) {
    throw new Error(
      "pipeline requires --output <dir>. Run 'toneforge pipeline --help' for usage.",
    );
  }

  const rulesetRaw = readStringFlag(argv, "ruleset");
  if (rulesetRaw !== undefined && !isRulesetName(rulesetRaw)) {
    throw new Error(
      `Unknown ruleset '${rulesetRaw}'. Supported rulesets: ${listRulesets().join(", ")}.`,
    );
  }

  const strictnessRaw = readStringFlag(argv, "strictness");
  if (
    strictnessRaw !== undefined &&
    !(STRICTNESS_LEVELS as readonly string[]).includes(strictnessRaw)
  ) {
    throw new Error(
      `Invalid strictness '${strictnessRaw}'. Expected one of: ${STRICTNESS_LEVELS.join(", ")}.`,
    );
  }

  const libraryDir = readStringFlag(argv, "library") ?? DEFAULT_LIBRARY_DIR;
  const compileDir = readStringFlag(argv, "compile-dir") ?? defaultCompileDir(outputDir);

  const args: PipelineArgs = { soundsFile, libraryDir, outputDir, compileDir };
  if (rulesetRaw !== undefined) args.ruleset = rulesetRaw;
  if (strictnessRaw !== undefined) args.strictness = strictnessRaw as StrictnessLevel;
  return args;
}

/** Emit a machine-parseable error object on stderr. */
function writeJsonError(message: string): void {
  process.stderr.write(JSON.stringify({ error: message }) + "\n");
}

/** Render one stage log as a human-readable progress line. */
function renderStageLog(log: PipelineStageLog, index: number, total: number): void {
  const label = `[${index + 1}/${total}] ${log.stage}`;
  if (log.status === "ok") {
    outputInfo(`${label} ... ok (${log.durationMs}ms)`);
  } else {
    outputError(`${label} ... failed (${log.durationMs}ms): ${log.error?.message ?? "unknown error"}`);
  }
}

/** Render the final run as a human-readable summary. */
function renderResult(result: PipelineRunResult): void {
  if (result.status === "ok") {
    const count = result.exported?.count ?? 0;
    outputSuccess(
      `Pipeline succeeded: exported ${count} asset${count === 1 ? "" : "s"} ` +
        `to ${result.exportDir}.`,
    );
    return;
  }

  outputError(
    `Pipeline failed at the '${result.failedStage}' stage; later stages were not run.`,
  );
  if (result.failedStage === "validate" && result.validation) {
    outputWarning(
      `Validation reported ${result.validation.counts.error} error-level ` +
        `finding${result.validation.counts.error === 1 ? "" : "s"}.`,
    );
  }
}

/**
 * Execute the `pipeline` command.
 *
 * @returns `0` when every stage succeeds; `1` on a usage/IO error or when
 *          any stage fails.
 */
export async function handler(argv: Record<string, unknown>): Promise<number> {
  const jsonMode = argv["json"] === true;

  let args: PipelineArgs;
  try {
    args = parsePipelineArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) writeJsonError(message);
    else outputError(`Error: ${message}`);
    return 1;
  }

  let fixture;
  try {
    fixture = loadFixture(args.soundsFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) writeJsonError(`Failed to load sounds manifest: ${message}`);
    else outputError(`Error: failed to load sounds manifest: ${message}`);
    return 1;
  }

  const runOptions = {
    fixture,
    libraryDir: args.libraryDir,
    compileDir: args.compileDir,
    exportDir: args.outputDir,
    ...(args.ruleset !== undefined ? { ruleset: args.ruleset } : {}),
    ...(args.strictness !== undefined ? { strictness: args.strictness } : {}),
  };

  let result: PipelineRunResult;
  try {
    result = await runCiPipeline(runOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) writeJsonError(message);
    else outputError(`Error: ${message}`);
    return 1;
  }

  if (jsonMode) {
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    result.stageLogs.forEach((log, index) =>
      renderStageLog(log, index, result.stageLogs.length),
    );
    renderResult(result);
  }

  return result.status === "ok" ? 0 : 1;
}
