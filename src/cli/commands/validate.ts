/**
 * `toneforge validate` command.
 *
 * Wires the Validator core (`src/validator`) into a usable CLI: it loads
 * a library from disk, runs the platform ruleset against every entry, and
 * emits the structured {@link ValidationReport} either as JSON (`--json`)
 * or as a human-readable summary.
 *
 * The command is strictly read-only — validation never mutates the library
 * and never writes to disk.
 *
 * Reference: docs/prd/VALIDATOR_PRD.md Sections 7.4, 8.
 */

import {
  STRICTNESS_LEVELS,
  isRulesetName,
  listRulesets,
  validateLibraryDir,
  type RulesetName,
  type StrictnessLevel,
  type ValidationReport,
} from "../../validator/index.js";
import { DEFAULT_LIBRARY_DIR } from "../../library/index.js";
import {
  outputError,
  outputInfo,
  outputSuccess,
  outputWarning,
  outputTable,
} from "../../output.js";

export const command = "validate";
export const desc = "Validate library assets against platform quality rules";

export function builder(yargs: any) {
  return yargs
    .option("library", {
      type: "string",
      describe: `Library directory to validate (default: ${DEFAULT_LIBRARY_DIR})`,
    })
    .option("ruleset", {
      type: "string",
      describe: `Platform ruleset: ${listRulesets().join(", ")} (default: web)`,
    })
    .option("strictness", {
      type: "string",
      describe: "Severity assigned to violations: info, warning, error (default: warning)",
    })
    .option("json", { type: "boolean", describe: "Output JSON" });
}

/** Fully-resolved, validated arguments for a `validate` run. */
export interface ValidateArgs {
  /** Library root directory. */
  libraryDir: string;
  /** Built-in ruleset name. */
  ruleset: RulesetName;
  /** Severity applied to rule violations. */
  strictness: StrictnessLevel;
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
 * Validate and normalise the CLI arguments for a `validate` run.
 *
 * Defaults: `--library .toneforge-library`, `--ruleset web`,
 * `--strictness warning`.
 *
 * @throws On an unknown ruleset, invalid strictness, or missing flag value.
 */
export function parseValidateArgs(argv: Record<string, unknown>): ValidateArgs {
  const libraryDir = readStringFlag(argv, "library") ?? DEFAULT_LIBRARY_DIR;
  const rulesetRaw = readStringFlag(argv, "ruleset") ?? "web";

  if (!isRulesetName(rulesetRaw)) {
    throw new Error(
      `Unknown ruleset '${rulesetRaw}'. Supported rulesets: ${listRulesets().join(", ")}.`,
    );
  }

  const strictnessRaw = readStringFlag(argv, "strictness") ?? "warning";
  if (!(STRICTNESS_LEVELS as readonly string[]).includes(strictnessRaw)) {
    throw new Error(
      `Invalid strictness '${strictnessRaw}'. Expected one of: ${STRICTNESS_LEVELS.join(", ")}.`,
    );
  }

  return { libraryDir, ruleset: rulesetRaw, strictness: strictnessRaw as StrictnessLevel };
}

/** Emit a machine-parseable error object on stderr. */
function writeJsonError(message: string): void {
  process.stderr.write(JSON.stringify({ error: message }) + "\n");
}

/** Render the report as a human-readable summary. */
function renderReport(report: ValidationReport, libraryDir: string): void {
  outputInfo(`Validation — ${libraryDir}`);
  outputInfo(`Ruleset: ${report.ruleset} (strictness: ${report.strictness})`);

  if (report.entryCount === 0) {
    outputInfo("No library entries found to validate.");
    return;
  }

  outputInfo(
    `${report.entryCount} entr${report.entryCount === 1 ? "y" : "ies"} validated: ` +
      `${report.counts.pass} pass, ${report.counts.info} info, ` +
      `${report.counts.warning} warning, ${report.counts.error} error, ` +
      `${report.counts.skipped} skipped`,
  );

  const flagged = report.assets.filter((asset) => asset.status !== "pass");
  if (flagged.length === 0) {
    outputSuccess("All checks passed.");
  } else {
    outputTable(
      [
        { header: "Asset", width: 32 },
        { header: "Category", width: 14 },
        { header: "Status", width: 10 },
        { header: "Findings", width: 60 },
      ],
      flagged.map((asset) => {
        const findings = asset.checks
          .filter((c) => c.status !== "pass" && c.status !== "skipped")
          .map((c) => `${c.check}: ${c.message}`)
          .join("; ");
        return [asset.assetId, asset.category, asset.status, findings];
      }),
    );
  }

  if (report.blocking) {
    outputError("Validation failed: error-level findings block the build.");
  } else if (report.counts.warning > 0) {
    outputWarning("Validation passed with warnings.");
  }
}

/**
 * Execute the `validate` command.
 *
 * @returns `0` on success; `1` on a usage/IO error or when the report is
 *          build-blocking (an error-level finding is present).
 */
export async function handler(argv: Record<string, unknown>): Promise<number> {
  const jsonMode = argv["json"] === true;

  let args: ValidateArgs;
  try {
    args = parseValidateArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) writeJsonError(message);
    else outputError(`Error: ${message}`);
    return 1;
  }

  try {
    const report = await validateLibraryDir(args.libraryDir, {
      ruleset: args.ruleset,
      strictness: args.strictness,
    });

    if (jsonMode) {
      process.stdout.write(
        JSON.stringify({
          command: "validate",
          library: args.libraryDir,
          ...report,
        }) + "\n",
      );
    } else {
      renderReport(report, args.libraryDir);
    }

    return report.blocking ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) writeJsonError(message);
    else outputError(`Error: ${message}`);
    return 1;
  }
}
