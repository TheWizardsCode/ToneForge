/**
 * Integrations Conformance Harness
 *
 * Runs the four-stage Integrations pipeline — **generate → validate →
 * compile → export** — against a declarative, offline fixture library and
 * returns a structured result for golden/conformance assertions.
 *
 * The harness is deliberately the *test-first foundation* for the
 * Integrations module (work item TF-0MUZYS1UF0071NLP): it composes the
 * already-shipped Library, Validator and Compiler APIs rather than
 * re-implementing any stage, so a failure here is a real contract
 * failure in the underlying stage. Engine-specific (Unity/Unreal) export
 * mapping is a later work item and is intentionally out of scope.
 *
 * Everything is offline and deterministic: fixtures render through the
 * project's offline renderer (`renderRecipe`), all writes go to a
 * caller-supplied workspace directory, and no live sockets or system
 * audio players are touched.
 *
 * Reference: docs/prd/INTEGRATIONS_PRD.md Sections 4.2 (Build Systems &
 * CI), 7 (Deterministic Build Integration), 9 (Library Synchronization).
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderRecipe } from "../core/renderer.js";
import { encodeWav } from "../audio/wav-encoder.js";
import {
  addEntry,
  clearIndexCache,
  exportEntries,
  type ExportResult,
  type LibraryEntry,
} from "../library/index.js";
import type { ExploreCandidate } from "../explore/types.js";
import {
  validateLibraryDir,
  type RulesetName,
  type StrictnessLevel,
  type ValidationReport,
} from "../validator/index.js";
import {
  compileLibraryDir,
  MANIFEST_FILE,
  type BuildManifest,
  type CompileResult,
  type CompileRuleset,
} from "../compiler/index.js";

/** The individual stages of the Integrations pipeline. */
export type PipelineStage = "generate" | "validate" | "compile" | "export";

/** Canonical stage order. */
export const PIPELINE_STAGES: readonly PipelineStage[] = [
  "generate",
  "validate",
  "compile",
  "export",
] as const;

/** A single fixture library entry (the *input* to the generate stage). */
export interface IntegrationFixtureEntry {
  /** Candidate id; the stored library entry id is `lib-<candidateId>`. */
  candidateId: string;
  /** Registered recipe used for deterministic generation. */
  recipe: string;
  /** Deterministic integer seed. */
  seed: number;
  /** Declared duration in seconds (drives validation metadata). */
  duration: number;
  /**
   * Optional render-only duration override; defaults to {@link duration}.
   *
   * Kept separate so a metadata-only violation (for example an
   * out-of-bounds declared duration) can still use a cheap, short render.
   */
  renderDuration?: number;
  /** Library category (drives the compile/export directory layout). */
  category: string;
  /** Searchable tags. */
  tags?: string[];
  /** Declared peak amplitude (drives the peak-clipping check). */
  peak?: number;
  /** Declared RMS amplitude. */
  rms?: number;
}

/** Validation configuration stored in a fixture. */
export interface FixtureValidationConfig {
  ruleset?: RulesetName;
  strictness?: StrictnessLevel;
}

/** Compile configuration stored in a fixture. */
export interface FixtureCompileConfig {
  ruleset?: CompileRuleset;
}

/** Declarative Integrations fixture library. */
export interface IntegrationFixture {
  name: string;
  version: string;
  description?: string;
  compile?: FixtureCompileConfig;
  validation?: FixtureValidationConfig;
  entries: IntegrationFixtureEntry[];
}

/** Result of the generate stage. */
export interface GenerateStageResult {
  /** Library root directory that received the generated entries. */
  libraryDir: string;
  /** Number of generated entries. */
  entryCount: number;
  /** Stored library entry ids, in fixture order. */
  entryIds: string[];
}

/** Options for {@link runPipelineFromFixture}. */
export interface PipelineRunOptions {
  /** Directory that receives the generated library and stage outputs. */
  workspaceDir: string;
  /** Stages to run; defaults to all four in canonical order. */
  stages?: readonly PipelineStage[];
}

/** Structured result of a full pipeline run. */
export interface PipelineResult {
  /** Fixture name. */
  name: string;
  /** Fixture version. */
  version: string;
  /** Stages that were executed. */
  stages: PipelineStage[];
  /** Generate stage output. */
  generated: GenerateStageResult;
  /** Validate stage output (absent when the stage was not run). */
  validation?: ValidationReport;
  /** Compile stage output (absent when the stage was not run). */
  compilation?: CompileResult;
  /** Export stage output (absent when the stage was not run). */
  exported?: ExportResult;
  /** Compile output directory (`<workspaceDir>/compile`). */
  compileDir: string;
  /** Export output directory (`<workspaceDir>/export`). */
  exportDir: string;
}

/** Default validation settings when a fixture omits them. */
const DEFAULT_VALIDATION: Required<FixtureValidationConfig> = {
  ruleset: "web",
  strictness: "warning",
};

/** Default compile ruleset when a fixture omits one. */
const DEFAULT_RULESET: CompileRuleset = { target: "web" };

/** Resolve the module directory so fixture paths work under ESM and Vitest. */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to a bundled integration fixture.
 *
 * @param kind - `"valid"` for the conformant library, `"invalid"` for the
 *               negative fixture.
 */
export function fixturePath(kind: "valid" | "invalid"): string {
  return resolve(
    MODULE_DIR,
    "..",
    "test-utils",
    "fixtures",
    "integrations",
    `${kind}-library`,
    "library.json",
  );
}

/** Assert a value is a non-empty string, returning it. */
function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Integrations fixture is missing a non-empty '${field}'.`);
  }
  return value;
}

/** Assert a value is a finite number, returning it. */
function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Integrations fixture field '${field}' must be a finite number.`);
  }
  return value;
}

/** Parse and shape-check one fixture entry. */
function parseEntry(raw: unknown, index: number): IntegrationFixtureEntry {
  if (raw === null || typeof raw !== "object") {
    throw new Error(`Integrations fixture entry ${index} must be an object.`);
  }
  const entry = raw as Record<string, unknown>;
  const parsed: IntegrationFixtureEntry = {
    candidateId: requireString(entry["candidateId"], `entries[${index}].candidateId`),
    recipe: requireString(entry["recipe"], `entries[${index}].recipe`),
    seed: requireNumber(entry["seed"], `entries[${index}].seed`),
    duration: requireNumber(entry["duration"], `entries[${index}].duration`),
    category: requireString(entry["category"], `entries[${index}].category`),
  };
  if (entry["renderDuration"] !== undefined) {
    parsed.renderDuration = requireNumber(
      entry["renderDuration"],
      `entries[${index}].renderDuration`,
    );
  }
  if (entry["tags"] !== undefined) {
    if (
      !Array.isArray(entry["tags"]) ||
      entry["tags"].some((tag) => typeof tag !== "string")
    ) {
      throw new Error(`Integrations fixture 'entries[${index}].tags' must be a string array.`);
    }
    parsed.tags = [...(entry["tags"] as string[])];
  }
  if (entry["peak"] !== undefined) {
    parsed.peak = requireNumber(entry["peak"], `entries[${index}].peak`);
  }
  if (entry["rms"] !== undefined) {
    parsed.rms = requireNumber(entry["rms"], `entries[${index}].rms`);
  }
  return parsed;
}

/** Parse a raw JSON value into a validated {@link IntegrationFixture}. */
export function parseFixture(raw: unknown): IntegrationFixture {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Integrations fixture must be a JSON object.");
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj["entries"]) || obj["entries"].length === 0) {
    throw new Error("Integrations fixture must declare a non-empty 'entries' array.");
  }
  const fixture: IntegrationFixture = {
    name: requireString(obj["name"], "name"),
    version: requireString(obj["version"], "version"),
    entries: obj["entries"].map((entry, index) => parseEntry(entry, index)),
  };
  if (typeof obj["description"] === "string") {
    fixture.description = obj["description"];
  }
  if (obj["compile"] !== undefined) {
    if (obj["compile"] === null || typeof obj["compile"] !== "object") {
      throw new Error("Integrations fixture 'compile' must be an object.");
    }
    fixture.compile = obj["compile"] as FixtureCompileConfig;
  }
  if (obj["validation"] !== undefined) {
    if (obj["validation"] === null || typeof obj["validation"] !== "object") {
      throw new Error("Integrations fixture 'validation' must be an object.");
    }
    fixture.validation = obj["validation"] as FixtureValidationConfig;
  }
  return fixture;
}

/** Load and validate an Integrations fixture from a JSON file. */
export function loadFixture(path: string): IntegrationFixture {
  return parseFixture(JSON.parse(readFileSync(path, "utf-8")) as unknown);
}

/** Build the deterministic {@link ExploreCandidate} for a fixture entry. */
function toCandidate(entry: IntegrationFixtureEntry): ExploreCandidate {
  const sampleRate = 44100;
  const sampleCount = Math.max(1, Math.round(entry.duration * sampleRate));
  return {
    id: entry.candidateId,
    recipe: entry.recipe,
    seed: entry.seed,
    duration: entry.duration,
    sampleRate,
    sampleCount,
    analysis: {
      analysisVersion: "1.0",
      sampleRate,
      sampleCount,
      metrics: {
        time: {
          duration: entry.duration,
          peak: entry.peak ?? 0.6,
          rms: entry.rms ?? 0.3,
        },
      },
    },
    score: 0.5,
    metricScores: {},
    cluster: -1,
    promoted: false,
    libraryId: null,
    params: {},
  };
}

/**
 * Generate stage: render each fixture entry offline and store it in a
 * real on-disk library (index + WAV + metadata), exactly as the CLI
 * `generate`/promotion path would.
 *
 * @returns The stored {@link LibraryEntry} records, in fixture order.
 */
export async function generateLibrary(
  fixture: IntegrationFixture,
  libraryDir: string,
): Promise<LibraryEntry[]> {
  const entries: LibraryEntry[] = [];
  for (const fixtureEntry of fixture.entries) {
    const renderDuration = fixtureEntry.renderDuration ?? fixtureEntry.duration;
    const rendered = await renderRecipe(
      fixtureEntry.recipe,
      fixtureEntry.seed,
      renderDuration,
    );
    const wav = encodeWav(rendered.samples, { sampleRate: rendered.sampleRate });
    entries.push(
      await addEntry(toCandidate(fixtureEntry), wav, libraryDir, {
        categoryOverride: fixtureEntry.category,
      }),
    );
  }
  return entries;
}

/**
 * Run the pipeline against an in-memory fixture.
 *
 * Stages run in canonical order; `stages` can restrict the run (for
 * example the negative fixture only needs generate + validate).
 */
export async function runPipelineFromFixture(
  fixture: IntegrationFixture,
  options: PipelineRunOptions,
): Promise<PipelineResult> {
  const requested = options.stages ?? PIPELINE_STAGES;
  // De-duplicate and normalise to canonical order.
  const stages = PIPELINE_STAGES.filter((stage) => requested.includes(stage));
  const libraryDir = join(options.workspaceDir, "library");
  const compileDir = join(options.workspaceDir, "compile");
  const exportDir = join(options.workspaceDir, "export");

  clearIndexCache();
  const entries = await generateLibrary(fixture, libraryDir);

  const result: PipelineResult = {
    name: fixture.name,
    version: fixture.version,
    stages: [...stages],
    generated: {
      libraryDir,
      entryCount: entries.length,
      entryIds: entries.map((entry) => entry.id),
    },
    compileDir,
    exportDir,
  };

  if (stages.includes("validate")) {
    const validation = { ...DEFAULT_VALIDATION, ...fixture.validation };
    result.validation = await validateLibraryDir(libraryDir, {
      ruleset: validation.ruleset,
      strictness: validation.strictness,
    });
  }

  if (stages.includes("compile")) {
    result.compilation = await compileLibraryDir(libraryDir, {
      ruleset: fixture.compile?.ruleset ?? DEFAULT_RULESET,
      outputDir: compileDir,
    });
  }

  if (stages.includes("export")) {
    result.exported = await exportEntries(
      { outputDir: exportDir, format: "wav" },
      libraryDir,
    );
  }

  return result;
}

/** Load a fixture from disk and run the pipeline. */
export async function runPipeline(
  path: string,
  options: PipelineRunOptions,
): Promise<PipelineResult> {
  return runPipelineFromFixture(loadFixture(path), options);
}

/** Read the compile manifest written by the compile stage. */
export function readCompiledManifest(compileDir: string): BuildManifest {
  return JSON.parse(
    readFileSync(resolve(compileDir, MANIFEST_FILE), "utf-8"),
  ) as BuildManifest;
}
