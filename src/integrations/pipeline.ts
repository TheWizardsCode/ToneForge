/**
 * CI pipeline orchestration — generate → validate → compile → export.
 *
 * Runs the four Integrations stages as a single, non-interactive,
 * deterministic run suitable for CI. Every stage reuses the shipped
 * Library, Validator and Compiler APIs; this module only sequences them,
 * fails fast, and emits a structured per-stage log.
 *
 * The `generate` stage consumes the same declarative sounds manifest
 * (fixture) format used by the Integrations conformance harness, so the
 * exact inputs a CI run uses can be version-controlled and replayed
 * offline.
 *
 * Reference: docs/prd/INTEGRATIONS_PRD.md Sections 4.2 (Build Systems &
 * CI), 7 (Deterministic Build Integration), 10 (Validation & Compliance).
 *
 * Work item: TF-0MUZYS3IX008OIF5.
 */

import { join } from "node:path";

import {
  compileLibraryDir,
  type CompileResult,
  type CompileRuleset,
} from "../compiler/index.js";
import {
  clearIndexCache,
  exportEntries,
  type ExportResult,
} from "../library/index.js";
import {
  validateLibraryDir,
  type RulesetName,
  type StrictnessLevel,
  type ValidationReport,
} from "../validator/index.js";
import {
  generateLibrary,
  PIPELINE_STAGES,
  type IntegrationFixture,
  type PipelineStage,
} from "./harness.js";

/** Outcome of a single pipeline stage. */
export type PipelineStageStatus = "ok" | "failed";

/** Structured log entry for one executed stage. */
export interface PipelineStageLog {
  /** Stage identifier. */
  stage: PipelineStage;
  /** Whether the stage succeeded. */
  status: PipelineStageStatus;
  /** ISO-8601 timestamp captured when the stage started. */
  startedAt: string;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** Stage-specific, JSON-serialisable summary. */
  summary: Record<string, unknown>;
  /** Present only when the stage failed. */
  error?: { message: string; code?: string };
}

/** Options for {@link runCiPipeline}. */
export interface PipelineOptions {
  /** Sounds manifest describing the entries to generate (the stage input). */
  fixture: IntegrationFixture;
  /** Library root: generate output, and the input to validate/compile/export. */
  libraryDir: string;
  /** Directory that receives compiled artifacts. */
  compileDir: string;
  /** Directory that receives exported assets. */
  exportDir: string;
  /** Validation ruleset override (defaults to the fixture's, then `web`). */
  ruleset?: RulesetName;
  /** Validation strictness override (defaults to the fixture's, then `warning`). */
  strictness?: StrictnessLevel;
  /** Compile ruleset override (defaults to the fixture's, then `{ target: "web" }`). */
  compileRuleset?: CompileRuleset;
  /** Stages to run; defaults to all four in canonical order. */
  stages?: readonly PipelineStage[];
  /** Invoked once per executed stage, in order, with its structured log. */
  onStage?: (entry: PipelineStageLog) => void;
}

/** Structured result of a full pipeline run. */
export interface PipelineRunResult {
  /** Stable command discriminator. */
  command: "pipeline";
  /** `"ok"` when every requested stage succeeded, else `"failed"`. */
  status: PipelineStageStatus;
  /** Stages requested, in canonical order. */
  stages: PipelineStage[];
  /** Per-stage structured logs, in execution order. */
  stageLogs: PipelineStageLog[];
  /** The first stage that failed, or `null` when all succeeded. */
  failedStage: PipelineStage | null;
  /** Library root used by the run. */
  libraryDir: string;
  /** Compile output directory. */
  compileDir: string;
  /** Export output directory. */
  exportDir: string;
  /** Generate stage summary (empty when the stage did not run). */
  generated: { entryCount: number; entryIds: string[] };
  /** Validation report, or `null` when the stage did not run. */
  validation: ValidationReport | null;
  /** Compilation result, or `null` when the stage did not run. */
  compilation: CompileResult | null;
  /** Export result, or `null` when the stage did not run. */
  exported: ExportResult | null;
}

/** Default validation settings when neither the fixture nor caller overrides them. */
const DEFAULT_RULESET: RulesetName = "web";
/** Default strictness when neither the fixture nor caller overrides it. */
const DEFAULT_STRICTNESS: StrictnessLevel = "warning";
/** Default compile ruleset when the fixture omits one. */
const DEFAULT_COMPILE_RULESET: CompileRuleset = { target: "web" };

/** Error raised internally to fail a stage while preserving its summary. */
class PipelineStageError extends Error {
  readonly code: string;
  readonly summary: Record<string, unknown>;

  constructor(message: string, code: string, summary: Record<string, unknown> = {}) {
    super(message);
    this.name = "PipelineStageError";
    this.code = code;
    this.summary = summary;
  }
}

/** Extract a stable machine-readable code from an arbitrary thrown value. */
function errorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

/** Extract a human-readable message from an arbitrary thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Run the Integrations pipeline.
 *
 * Stages execute in canonical order and the run fails fast: the first
 * failing stage stops the pipeline, and later stages are not attempted.
 * Each executed stage produces a {@link PipelineStageLog}; when `onStage`
 * is supplied it is invoked as stages complete, enabling incremental
 * (streamed) reporting for CI.
 *
 * The run never prompts and performs no network access — all inputs are
 * the library/manifest paths supplied by the caller.
 */
export async function runCiPipeline(
  options: PipelineOptions,
): Promise<PipelineRunResult> {
  const requested = options.stages ?? PIPELINE_STAGES;
  const stages = PIPELINE_STAGES.filter((stage) => requested.includes(stage));

  const libraryDir = options.libraryDir;
  const compileDir = options.compileDir;
  const exportDir = options.exportDir;
  const ruleset = options.ruleset ?? options.fixture.validation?.ruleset ?? DEFAULT_RULESET;
  const strictness =
    options.strictness ?? options.fixture.validation?.strictness ?? DEFAULT_STRICTNESS;
  const compileRuleset =
    options.compileRuleset ?? options.fixture.compile?.ruleset ?? DEFAULT_COMPILE_RULESET;

  // Ensure the generate stage starts from a clean library index.
  clearIndexCache();

  let generated: { entryCount: number; entryIds: string[] } = {
    entryCount: 0,
    entryIds: [],
  };
  let validation: ValidationReport | null = null;
  let compilation: CompileResult | null = null;
  let exported: ExportResult | null = null;

  const stageLogs: PipelineStageLog[] = [];
  let failedStage: PipelineStage | null = null;

  for (const stage of stages) {
    const startedAt = new Date().toISOString();
    const start = performance.now();

    const execute = async (): Promise<Record<string, unknown>> => {
      switch (stage) {
        case "generate": {
          const entries = await generateLibrary(options.fixture, libraryDir);
          generated = {
            entryCount: entries.length,
            entryIds: entries.map((entry) => entry.id),
          };
          return generated;
        }
        case "validate": {
          const report = await validateLibraryDir(libraryDir, {
            ruleset,
            strictness,
          });
          validation = report;
          const summary = {
            ruleset: report.ruleset,
            strictness: report.strictness,
            entryCount: report.entryCount,
            status: report.status,
            blocking: report.blocking,
            counts: report.counts,
          };
          if (report.blocking) {
            throw new PipelineStageError(
              `Validation failed with ${report.counts.error} error-level ` +
                `finding${report.counts.error === 1 ? "" : "s"}; pipeline aborted.`,
              "validation_failed",
              summary,
            );
          }
          return summary;
        }
        case "compile": {
          const result = await compileLibraryDir(libraryDir, {
            ruleset: compileRuleset,
            outputDir: compileDir,
          });
          compilation = result;
          return {
            target: result.target,
            buildId: result.manifest.buildId,
            written: result.written.length,
            assets: result.manifest.assets.length,
          };
        }
        case "export": {
          const result = await exportEntries(
            { outputDir: exportDir, format: "wav" },
            libraryDir,
          );
          exported = result;
          return { count: result.count, files: result.files.length, skipped: result.skipped };
        }
        /* c8 ignore next 2 -- exhaustive over PipelineStage */
        default:
          throw new Error(`Unknown pipeline stage: ${String(stage)}`);
      }
    };

    try {
      const summary = await execute();
      const log: PipelineStageLog = {
        stage,
        status: "ok",
        startedAt,
        durationMs: Math.round(performance.now() - start),
        summary,
      };
      stageLogs.push(log);
      options.onStage?.(log);
    } catch (error) {
      const summary =
        error instanceof PipelineStageError ? error.summary : {};
      const code = errorCode(error);
      const log: PipelineStageLog = {
        stage,
        status: "failed",
        startedAt,
        durationMs: Math.round(performance.now() - start),
        summary,
        error: {
          message: errorMessage(error),
          ...(code ? { code } : {}),
        },
      };
      stageLogs.push(log);
      options.onStage?.(log);
      failedStage = stage;
      break;
    }
  }

  return {
    command: "pipeline",
    status: failedStage === null ? "ok" : "failed",
    stages,
    stageLogs,
    failedStage,
    libraryDir,
    compileDir,
    exportDir,
    generated,
    validation,
    compilation,
    exported,
  };
}

/** Default compile directory under an export root. */
export function defaultCompileDir(exportDir: string): string {
  return join(exportDir, "compile");
}
