/**
 * Integrations — engine adapter interface, registry, and sync engine.
 *
 * An {@link EngineAdapter} maps ToneForge metadata onto a target engine's
 * audio system (category → audio group, tags → mixer bus) and declares the
 * on-disk layout for synced assets. Adapters are registered by target name,
 * so new engines can be added without modifying core modules.
 *
 * {@link syncLibrary} is the single orchestration entry point: it reuses the
 * shipped Validator (quality gate) and Compiler (deterministic WAV output),
 * maps the compiled assets through the selected adapter, and writes an
 * idempotent engine manifest plus the target-specific file layout. It never
 * re-implements compile or validate.
 *
 * Reference: docs/prd/INTEGRATIONS_PRD.md Sections 4.1 (Game Engines),
 * 6 (Asset Mapping), 7 (Deterministic Build Integration), 9 (Library
 * Synchronization), 13 (Configuration & Extensibility).
 *
 * Work item: TF-0MUZYS2VP007O99D.
 */

import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import {
  canonicalStringify,
  compileLibrary,
  hashBytes,
  type CompileResult,
  type CompileRuleset,
} from "../compiler/index.js";
import { listEntries } from "../library/index.js";
import type { LibraryEntry } from "../library/types.js";
import {
  validateLibraryDir,
  type ValidationReport,
} from "../validator/index.js";

/** Manifest file written into every engine output directory. */
export const ENGINE_MANIFEST_FILE = "manifest.json";

/** Prefix for engine sync build identifiers. */
export const ENGINE_BUILD_ID_PREFIX = "tfs_";

/**
 * A single mapped asset in an {@link EngineManifest}.
 *
 * Mirrors the compiled asset (id, recipe, duration, byte count, hash) and
 * adds the engine-specific mapping and destination path.
 */
export interface EngineAsset {
  /** Library entry id. */
  assetId: string;
  /** ToneForge category. */
  category: string;
  /** Recipe that generated the asset. */
  recipe: string;
  /** Rendered duration in seconds. */
  duration: number;
  /** Engine audio group the category maps to. */
  audioGroup: string;
  /** Engine mixer bus the entry's tags map to. */
  mixerBus: string;
  /** Entry tags, in stored order. */
  tags: string[];
  /** Output path relative to the engine output directory (POSIX). */
  file: string;
  /** SHA-256 hex digest of the emitted WAV bytes. */
  hash: string;
  /** Size of the emitted WAV in bytes. */
  bytes: number;
}

/** Deterministic manifest describing a synced engine asset tree. */
export interface EngineManifest {
  /** Registered target name. */
  target: string;
  /** Hash-derived engine build id (`tfs_<16 hex chars>`). */
  buildId: string;
  /** Category → engine audio group, sorted by category. */
  audioGroups: Record<string, string>;
  /** Tag → engine mixer bus, sorted by tag. */
  mixerBuses: Record<string, string>;
  /** Per-asset mappings, sorted by `assetId`. */
  assets: EngineAsset[];
}

/**
 * A game-engine integration adapter.
 *
 * Implementations are pure mapping/layout providers: the shared
 * {@link syncLibrary} engine performs all IO and compiler/validator reuse.
 */
export interface EngineAdapter {
  /** Unique, case-insensitive target name (e.g. `"unity"`). */
  readonly target: string;
  /** Map a ToneForge category to an engine audio group. */
  audioGroupFor(category: string): string;
  /** Map an entry's tags to an engine mixer bus. */
  mixerBusFor(tags: readonly string[]): string;
  /** Output path (relative, POSIX) for an entry's synced WAV. */
  assetPath(entry: LibraryEntry): string;
  /**
   * Compilation ruleset used to materialise assets for this target.
   *
   * Sync always bakes every asset, so an empty (match-all) bake rule is
   * expected unless a target intentionally emits procedural entries.
   */
  compileRuleset(): CompileRuleset;
}

/** Raised when a sync target is not registered. */
export class UnsupportedTargetError extends Error {
  /** Stable machine-readable error code. */
  readonly code = "unsupported_target";
  /** The unrecognised target that was requested. */
  readonly target: string;
  /** Sorted names of the targets that are registered. */
  readonly supportedTargets: string[];

  constructor(target: string) {
    const supported = listTargets();
    super(
      `Unsupported sync target '${target}'. Supported targets: ${supported.join(", ")}.`,
    );
    this.name = "UnsupportedTargetError";
    this.target = target;
    this.supportedTargets = supported;
  }
}

/** Raised when the library fails the pre-sync validation gate. */
export class SyncValidationError extends Error {
  /** Stable machine-readable error code. */
  readonly code = "validation_failed";
  /** The blocking validation report. */
  readonly report: ValidationReport;

  constructor(report: ValidationReport) {
    super(
      `Library validation failed with ${report.counts.error} error-level ` +
        `finding${report.counts.error === 1 ? "" : "s"}; sync aborted.`,
    );
    this.name = "SyncValidationError";
    this.report = report;
  }
}

/** Registry of engine adapters, keyed by normalised target name. */
const REGISTRY = new Map<string, EngineAdapter>();

/** Normalise a target name for case-insensitive registry lookups. */
function normaliseTarget(target: string): string {
  return target.trim().toLowerCase();
}

/**
 * Register (or replace) an engine adapter.
 *
 * @throws If the adapter's target name is empty.
 */
export function registerAdapter(adapter: EngineAdapter): void {
  const key = normaliseTarget(adapter.target);
  if (key.length === 0) {
    throw new Error("Engine adapter target must be a non-empty string.");
  }
  REGISTRY.set(key, adapter);
}

/**
 * Remove a previously registered adapter.
 *
 * @returns `true` when an adapter was removed.
 */
export function unregisterAdapter(target: string): boolean {
  return REGISTRY.delete(normaliseTarget(target));
}

/**
 * Resolve the adapter for a target.
 *
 * @throws {UnsupportedTargetError} If no adapter is registered.
 */
export function getAdapter(target: string): EngineAdapter {
  const adapter = REGISTRY.get(normaliseTarget(target));
  if (!adapter) throw new UnsupportedTargetError(target);
  return adapter;
}

/** Sorted names of every registered target. */
export function listTargets(): string[] {
  return [...REGISTRY.keys()].sort();
}

/** Replace path separators and control characters in a path segment. */
function safeSegment(value: string): string {
  const cleaned = value.replace(/[\\/\u0000-\u001f]/g, "_").trim();
  return cleaned.length > 0 && cleaned !== ".." && cleaned !== "." ? cleaned : "uncategorized";
}

/** Assert a resolved destination stays inside the output root. */
function assertInside(root: string, destination: string): void {
  const rel = relative(root, destination);
  if (rel === "" || rel.startsWith("..") || resolve(root, rel) !== destination) {
    throw new Error(
      `Refusing to write outside the sync output directory: ${destination}`,
    );
  }
}

/**
 * Build the deterministic engine manifest for a compilation run.
 *
 * Only compiled assets that emitted a file (baked/hybrid) are mapped.
 * Categories and tags are collected into sorted mapping tables; assets are
 * sorted by `assetId`. `buildId` is derived from the canonical manifest
 * content, so the same inputs always yield the same id.
 */
export function buildEngineManifest(
  adapter: EngineAdapter,
  entries: readonly LibraryEntry[],
  compilation: CompileResult,
): EngineManifest {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const categories = new Set<string>();
  const tags = new Set<string>();
  const assets: EngineAsset[] = [];

  for (const compiled of compilation.manifest.assets) {
    if (compiled.file === null) continue;
    const entry = entryById.get(compiled.assetId);
    if (!entry) continue;

    categories.add(entry.category);
    for (const tag of entry.tags) tags.add(tag);

    assets.push({
      assetId: entry.id,
      category: entry.category,
      recipe: entry.recipe,
      duration: entry.duration,
      audioGroup: adapter.audioGroupFor(entry.category),
      mixerBus: adapter.mixerBusFor(entry.tags),
      tags: [...entry.tags],
      file: adapter.assetPath(entry),
      hash: compiled.hash ?? "",
      bytes: compiled.bytes ?? 0,
    });
  }

  assets.sort((a, b) => (a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0));

  const audioGroups: Record<string, string> = {};
  for (const category of [...categories].sort()) {
    audioGroups[category] = adapter.audioGroupFor(category);
  }

  const mixerBuses: Record<string, string> = {};
  for (const tag of [...tags].sort()) {
    mixerBuses[tag] = adapter.mixerBusFor([tag]);
  }

  const buildId =
    ENGINE_BUILD_ID_PREFIX +
    hashBytes(
      new TextEncoder().encode(
        canonicalStringify({
          target: adapter.target,
          audioGroups,
          mixerBuses,
          assets,
        }),
      ),
    ).slice(0, 16);

  return { target: adapter.target, buildId, audioGroups, mixerBuses, assets };
}

/** Options for {@link syncLibrary}. */
export interface SyncOptions {
  /** Registered target name. */
  target: string;
  /** Library root directory. */
  libraryDir: string;
  /** Engine output directory. */
  outputDir: string;
}

/** Structured result of a sync run. */
export interface SyncResult {
  command: "sync";
  target: string;
  libraryDir: string;
  outputDir: string;
  /** Manifest file path relative to `outputDir`. */
  manifestFile: string;
  /** Deterministic engine manifest. */
  manifest: EngineManifest;
  /** Written asset paths relative to `outputDir`, sorted. */
  written: string[];
  /** Build id from the reused compiler manifest (`tfc_...`). */
  compilerBuildId: string;
  /** Pre-sync validation report. */
  validation: ValidationReport;
}

/**
 * Sync a library into a target engine's asset layout.
 *
 * Pipeline, in order:
 * 1. Resolve the adapter (unsupported targets fail before any IO).
 * 2. Validate the library; error-level findings abort the sync.
 * 3. Compile every entry to WAV via the shared Compiler into a private
 *    staging directory.
 * 4. Map the compiled assets through the adapter and copy the WAVs into
 *    the target layout, then write the deterministic engine manifest.
 *
 * The output depends only on the library inputs, so repeated runs are
 * byte-identical (idempotent).
 *
 * @throws {UnsupportedTargetError} If the target is not registered.
 * @throws {SyncValidationError} If validation is build-blocking.
 */
export async function syncLibrary(options: SyncOptions): Promise<SyncResult> {
  const adapter = getAdapter(options.target);
  const libraryDir = resolve(options.libraryDir);
  const outputDir = resolve(options.outputDir);

  const entries = await listEntries(undefined, libraryDir);

  const validation = await validateLibraryDir(libraryDir, {
    ruleset: "web",
    strictness: "error",
  });
  if (validation.blocking) throw new SyncValidationError(validation);

  const stagingDir = await mkdtemp(join(tmpdir(), "toneforge-sync-"));
  try {
    const compilation = await compileLibrary(entries, {
      ruleset: adapter.compileRuleset(),
      outputDir: stagingDir,
    });

    const manifest = buildEngineManifest(adapter, entries, compilation);
    const compiledById = new Map(
      compilation.manifest.assets.map((asset) => [asset.assetId, asset]),
    );

    const written: string[] = [];
    for (const asset of manifest.assets) {
      const compiled = compiledById.get(asset.assetId);
      if (!compiled || compiled.file === null) continue;

      const source = resolve(stagingDir, compiled.file);
      const destination = resolve(outputDir, asset.file);
      assertInside(outputDir, destination);

      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
      written.push(asset.file);
    }
    written.sort();

    await mkdir(outputDir, { recursive: true });
    await writeFile(
      resolve(outputDir, ENGINE_MANIFEST_FILE),
      canonicalStringify(manifest) + "\n",
      "utf8",
    );

    return {
      command: "sync",
      target: adapter.target,
      libraryDir: options.libraryDir,
      outputDir: options.outputDir,
      manifestFile: ENGINE_MANIFEST_FILE,
      manifest,
      written,
      compilerBuildId: compilation.manifest.buildId,
      validation,
    };
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }
}

/** Export the path-segment sanitiser for adapters. */
export { safeSegment };
