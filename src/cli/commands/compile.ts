/**
 * `toneforge compile` command.
 *
 * Wires the Compiler core (`src/compiler`) into a usable CLI: it loads a
 * library from disk, applies a declarative compilation ruleset, and either
 * writes baked/hybrid WAVs plus a deterministic `manifest.json`
 * (`--output <dir>`) or reports the per-asset decisions without touching
 * disk (`--dry-run`).
 *
 * A ruleset may be referenced by built-in name (`web_defaults`,
 * `mobile_aggressive`) or by the path to a JSON file matching the
 * {@link CompileRuleset} schema.
 *
 * Reference: docs/prd/COMPILER_PRD.md Sections 13, 15.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  compileLibraryDir,
  getCompileRuleset,
  listCompileRulesets,
  type AssetMatchRule,
  type CompileResult,
  type CompileRuleset,
} from "../../compiler/index.js";
import { DEFAULT_LIBRARY_DIR } from "../../library/index.js";
import {
  outputError,
  outputInfo,
  outputSuccess,
  outputTable,
} from "../../output.js";

export const command = "compile";
export const desc = "Compile library assets into platform-ready artifacts";

export function builder(yargs: any) {
  return yargs
    .option("library", {
      type: "string",
      describe: `Library directory to compile (default: ${DEFAULT_LIBRARY_DIR})`,
    })
    .option("target", {
      type: "string",
      describe: "Platform target (web, mobile, console, desktop)",
    })
    .option("rules", {
      type: "string",
      describe:
        `Compile ruleset: a built-in name (${listCompileRulesets().join(", ")}) ` +
        "or a path to a JSON ruleset file",
    })
    .option("output", {
      type: "string",
      describe: "Output directory for compiled artifacts (required unless --dry-run)",
    })
    .option("dry-run", {
      type: "boolean",
      default: false,
      describe: "Show decisions without writing any files",
    })
    .option("json", { type: "boolean", describe: "Output JSON" });
}

/** Fully-resolved, validated arguments for a `compile` run. */
export interface CompileArgs {
  /** Library root directory. */
  libraryDir: string;
  /** Resolved compilation ruleset. */
  ruleset: CompileRuleset;
  /** Build output directory. */
  outputDir: string;
  /** Whether to compute the plan without writing files. */
  dryRun: boolean;
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
 * Parse and validate an {@link AssetMatchRule} from untrusted JSON.
 *
 * @throws If a field has the wrong shape.
 */
export function parseMatchRule(
  value: unknown,
  source: string,
  field: string,
): AssetMatchRule | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Compile ruleset '${source}': '${field}' must be an object.`);
  }

  const obj = value as Record<string, unknown>;
  const rule: AssetMatchRule = {};

  if (obj.category !== undefined) {
    if (!Array.isArray(obj.category) || !obj.category.every((c) => typeof c === "string")) {
      throw new Error(
        `Compile ruleset '${source}': '${field}.category' must be an array of strings.`,
      );
    }
    rule.category = obj.category as string[];
  }

  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags) || !obj.tags.every((t) => typeof t === "string")) {
      throw new Error(
        `Compile ruleset '${source}': '${field}.tags' must be an array of strings.`,
      );
    }
    rule.tags = obj.tags as string[];
  }

  for (const bound of ["durationAbove", "durationBelow"] as const) {
    const boundValue = obj[bound];
    if (boundValue !== undefined) {
      if (typeof boundValue !== "number" || Number.isNaN(boundValue)) {
        throw new Error(
          `Compile ruleset '${source}': '${field}.${bound}' must be a number.`,
        );
      }
      rule[bound] = boundValue;
    }
  }

  return rule;
}

/**
 * Parse and validate a {@link CompileRuleset} from untrusted JSON.
 *
 * @param json   - Parsed JSON value.
 * @param source - Human-readable source (built-in name or file path) for errors.
 * @throws If the value is not an object, `target` is missing, or a rule field
 *         has the wrong shape.
 */
export function parseCompileRuleset(json: unknown, source: string): CompileRuleset {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error(`Compile ruleset '${source}' must be a JSON object.`);
  }

  const obj = json as Record<string, unknown>;
  if (typeof obj.target !== "string" || obj.target.trim().length === 0) {
    throw new Error(
      `Compile ruleset '${source}' is missing a non-empty 'target' string.`,
    );
  }

  const ruleset: CompileRuleset = { target: obj.target };

  if (obj.maxVoices !== undefined) {
    if (typeof obj.maxVoices !== "number" || Number.isNaN(obj.maxVoices)) {
      throw new Error(`Compile ruleset '${source}': 'maxVoices' must be a number.`);
    }
    ruleset.maxVoices = obj.maxVoices;
  }

  const bake = parseMatchRule(obj.bake, source, "bake");
  if (bake) ruleset.bake = bake;

  const hybrid = parseMatchRule(obj.hybrid, source, "hybrid");
  if (hybrid) ruleset.hybrid = hybrid;

  return ruleset;
}

/**
 * Resolve a `--rules` reference to a concrete ruleset.
 *
 * A reference matching a built-in name resolves directly; anything else is
 * treated as a path to a JSON ruleset file. When `targetOverride` is set it
 * replaces the ruleset's `target`.
 *
 * @throws If the file cannot be read/parsed or the ruleset is malformed.
 */
export async function resolveCompileRuleset(
  rulesRef: string | undefined,
  targetOverride: string | undefined,
  cwd: string = process.cwd(),
): Promise<CompileRuleset> {
  let ruleset: CompileRuleset | undefined;

  if (rulesRef !== undefined) {
    if (listCompileRulesets().includes(rulesRef)) {
      ruleset = getCompileRuleset(rulesRef);
    } else {
      const filePath = resolve(cwd, rulesRef);
      let raw: string;
      try {
        raw = await readFile(filePath, "utf8");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read compile ruleset '${rulesRef}': ${message}`);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Compile ruleset '${rulesRef}' is not valid JSON: ${message}`);
      }

      ruleset = parseCompileRuleset(parsed, rulesRef);
    }
  }

  if (targetOverride !== undefined) {
    return ruleset ? { ...ruleset, target: targetOverride } : { target: targetOverride };
  }

  if (!ruleset) {
    throw new Error(
      "compile requires --target <platform> and/or --rules <name|file>. " +
        "Run 'toneforge compile --help' for usage.",
    );
  }

  return ruleset;
}

/**
 * Validate and normalise the CLI arguments for a `compile` run.
 *
 * @throws On a missing `--output` (non-dry-run), missing rules/target, or a
 *         malformed ruleset file.
 */
export async function parseCompileArgs(
  argv: Record<string, unknown>,
  cwd: string = process.cwd(),
): Promise<CompileArgs> {
  const libraryDir = readStringFlag(argv, "library") ?? DEFAULT_LIBRARY_DIR;
  const rulesRef = readStringFlag(argv, "rules");
  const target = readStringFlag(argv, "target");
  const outputFlag = readStringFlag(argv, "output");
  const dryRun = argv["dry-run"] === true;

  const ruleset = await resolveCompileRuleset(rulesRef, target, cwd);

  if (!dryRun && outputFlag === undefined) {
    throw new Error(
      "--output <dir> is required unless --dry-run is set. " +
        "Run 'toneforge compile --help' for usage.",
    );
  }

  const outputDir = outputFlag ?? `dist/${ruleset.target}`;

  return { libraryDir, ruleset, outputDir, dryRun };
}

/** Emit a machine-parseable error object on stderr. */
function writeJsonError(message: string): void {
  process.stderr.write(JSON.stringify({ error: message }) + "\n");
}

/** Render a compilation result as a human-readable summary. */
function renderResult(result: CompileResult, libraryDir: string): void {
  outputInfo(`Compilation — ${libraryDir}`);
  outputInfo(`Target: ${result.target}${result.dryRun ? " (dry run)" : ""}`);

  const decisions = result.plan.decisions;
  if (decisions.length === 0) {
    outputInfo("No library entries found to compile.");
    return;
  }

  outputTable(
    [
      { header: "Asset", width: 32 },
      { header: "Category", width: 14 },
      { header: "Decision", width: 12 },
      { header: "Reason", width: 60 },
    ],
    decisions.map((d) => [d.assetId, d.category, d.decision, d.reason]),
  );

  outputInfo(
    `${decisions.length} asset${decisions.length === 1 ? "" : "s"}: ` +
      `${result.plan.proceduralAssets} procedural, ` +
      `${result.plan.hybridAssets} hybrid, ${result.plan.bakedAssets} baked`,
  );

  if (result.dryRun) {
    outputInfo("Dry run: no files written.");
  } else {
    outputInfo(
      `Wrote ${result.written.length} WAV file${result.written.length === 1 ? "" : "s"} ` +
        `and manifest.json to ${result.outputDir}`,
    );
    outputInfo(`Build id: ${result.manifest.buildId}`);
  }
}

/**
 * Execute the `compile` command.
 *
 * @returns `0` on success; `1` on a usage/IO/render error.
 */
export async function handler(argv: Record<string, unknown>): Promise<number> {
  const jsonMode = argv["json"] === true;

  let args: CompileArgs;
  try {
    args = await parseCompileArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) writeJsonError(message);
    else outputError(`Error: ${message}`);
    return 1;
  }

  try {
    const result = await compileLibraryDir(args.libraryDir, {
      ruleset: args.ruleset,
      outputDir: args.outputDir,
      dryRun: args.dryRun,
    });

    if (jsonMode) {
      process.stdout.write(
        JSON.stringify({
          command: "compile",
          library: args.libraryDir,
          ...result,
        }) + "\n",
      );
    } else {
      renderResult(result, args.libraryDir);
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) writeJsonError(message);
    else outputError(`Error: ${message}`);
    return 1;
  }
}
