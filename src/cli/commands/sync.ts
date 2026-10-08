/**
 * `toneforge sync` command.
 *
 * Syncs a curated library into a game-engine target's asset layout. The
 * command reuses the shipped Validator (pre-sync quality gate) and Compiler
 * (deterministic WAV output), maps categories to engine audio groups and
 * tags to mixer buses, and writes the target layout plus an idempotent
 * `manifest.json`.
 *
 * Reference: docs/prd/INTEGRATIONS_PRD.md Sections 5.1 (CLI), 6 (Mapping),
 * 9 (Library Synchronization).
 *
 * Work item: TF-0MUZYS2VP007O99D.
 */

import {
  SyncValidationError,
  UnsupportedTargetError,
  getAdapter,
  listTargets,
  syncLibrary,
  type SyncResult,
} from "../../integrations/index.js";
import { DEFAULT_LIBRARY_DIR } from "../../library/index.js";
import {
  outputError,
  outputInfo,
  outputSuccess,
  outputTable,
} from "../../output.js";

export const command = "sync";
export const desc = "Sync library assets to a game-engine target";

export function builder(yargs: any) {
  return yargs
    .option("target", {
      type: "string",
      describe: `Engine target: ${listTargets().join(", ")} (required)`,
    })
    .option("library", {
      type: "string",
      describe: `Library directory to sync (default: ${DEFAULT_LIBRARY_DIR})`,
    })
    .option("output", {
      type: "string",
      describe: "Output directory for engine assets (required)",
    })
    .option("json", { type: "boolean", describe: "Output JSON" });
}

/** Fully-resolved, validated arguments for a `sync` run. */
export interface SyncArgs {
  /** Registered engine target. */
  target: string;
  /** Library root directory. */
  libraryDir: string;
  /** Engine output directory. */
  outputDir: string;
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
 * Validate and normalise the CLI arguments for a `sync` run.
 *
 * @throws On a missing `--target`/`--output`, or an unsupported target.
 */
export function parseSyncArgs(argv: Record<string, unknown>): SyncArgs {
  const target = readStringFlag(argv, "target");
  if (target === undefined) {
    throw new Error(
      `sync requires --target <engine>. Supported targets: ${listTargets().join(", ")}. ` +
        "Run 'toneforge sync --help' for usage.",
    );
  }
  // Validate the target early so unsupported targets fail before any IO.
  getAdapter(target);

  const outputDir = readStringFlag(argv, "output");
  if (outputDir === undefined) {
    throw new Error(
      "sync requires --output <dir>. Run 'toneforge sync --help' for usage.",
    );
  }

  const libraryDir = readStringFlag(argv, "library") ?? DEFAULT_LIBRARY_DIR;
  return { target, libraryDir, outputDir };
}

/** Emit a structured (JSON) or human-readable error. */
function emitError(error: unknown, jsonMode: boolean): void {
  const message = error instanceof Error ? error.message : String(error);

  if (jsonMode) {
    if (error instanceof UnsupportedTargetError) {
      process.stderr.write(
        JSON.stringify({
          error: message,
          code: error.code,
          target: error.target,
          supportedTargets: error.supportedTargets,
        }) + "\n",
      );
      return;
    }
    if (error instanceof SyncValidationError) {
      process.stderr.write(
        JSON.stringify({ error: message, code: error.code, validation: error.report }) + "\n",
      );
      return;
    }
    process.stderr.write(JSON.stringify({ error: message }) + "\n");
    return;
  }

  outputError(`Error: ${message}`);
  if (error instanceof UnsupportedTargetError) {
    outputInfo(`Supported targets: ${error.supportedTargets.join(", ")}`);
  }
}

/** Render a sync result as a human-readable summary. */
function renderResult(result: SyncResult): void {
  outputInfo(`Sync — ${result.libraryDir} → ${result.outputDir}`);
  outputInfo(`Target: ${result.target} (${result.manifest.assets.length} asset(s))`);

  if (result.manifest.assets.length === 0) {
    outputInfo("No library entries found to sync.");
    return;
  }

  outputTable(
    [
      { header: "Asset", width: 32 },
      { header: "Category", width: 14 },
      { header: "Audio Group", width: 14 },
      { header: "Mixer Bus", width: 12 },
      { header: "File", width: 44 },
    ],
    result.manifest.assets.map((asset) => [
      asset.assetId,
      asset.category,
      asset.audioGroup,
      asset.mixerBus,
      asset.file,
    ]),
  );

  outputSuccess(
    `Wrote ${result.written.length} WAV file${result.written.length === 1 ? "" : "s"} ` +
      `and ${result.manifestFile} to ${result.outputDir}`,
  );
  outputInfo(`Build id: ${result.manifest.buildId}`);
}

/**
 * Execute the `sync` command.
 *
 * @returns `0` on success; `1` on a usage, unsupported-target, validation,
 *          or IO error.
 */
export async function handler(argv: Record<string, unknown>): Promise<number> {
  const jsonMode = argv["json"] === true;

  let args: SyncArgs;
  try {
    args = parseSyncArgs(argv);
  } catch (error) {
    emitError(error, jsonMode);
    return 1;
  }

  try {
    const result = await syncLibrary(args);
    if (jsonMode) {
      process.stdout.write(JSON.stringify(result) + "\n");
    } else {
      renderResult(result);
    }
    return 0;
  } catch (error) {
    emitError(error, jsonMode);
    return 1;
  }
}
