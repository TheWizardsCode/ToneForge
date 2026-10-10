/**
 * Recipe Registry
 *
 * Stores recipe metadata plus deterministic offline graph builders.
 */

import type { OfflineAudioContext } from "../audio/web-audio.js";
import { createRng } from "./rng.js";
import type { Rng } from "./rng.js";
import { normalizeCategory as normalizeCategoryFn } from "./normalize-category.js";
import type { ToneGraphDocument } from "./tonegraph-schema.js";
import {
  applyFileBackedMappings,
  parseFileBackedMappings,
  validateFileBackedMappings,
} from "./recipe-overrides.js";

export interface ParamDescriptor {
  name: string;
  min: number;
  max: number;
  unit: string;
}

export interface RecipeRegistration {
  getDuration: (rng: Rng, overrides?: Record<string, number>) => number;
  /**
   * Build the recipe's offline audio graph.
   *
   * `overrides` replace the seed-derived value for named declared parameters.
   * File-backed recipes resolve them in this order: seed-derived values, base
   * overrides, the generic name/default-value injection heuristic, then any
   * explicit declarative mappings declared in `meta.parameters[].overrides`
   * (see `recipe-overrides.ts`). Mappings therefore win over the heuristic and
   * can express computed relationships such as
   * `modulator.frequency = carrier.frequency * modRatio`.
   */
  buildOfflineGraph: (
    rng: Rng,
    ctx: OfflineAudioContext,
    duration: number,
    overrides?: Record<string, number>,
  ) => void | Promise<void>;
  description: string;
  category: string;
  tags?: string[];
  signalChain: string;
  params: ParamDescriptor[];
  getParams: (rng: Rng) => Record<string, number>;
  /**
   * Derive the parameter values actually applied when rendering `seed`.
   *
   * Unlike {@link getParams}, which may surface suggested/default values for
   * interactive UIs, this returns the seed-derived values the render path
   * uses. It is optional: callers fall back to `getParams(createRng(seed))`
   * when a recipe does not implement it, which is faithful for built-in
   * recipes because their graph builders and `getParams` share one RNG
   * sequence. File-backed recipes implement it because their declared
   * defaults differ from the rendered values.
   */
  getRenderParams?: (seed: number) => Record<string, number>;
  /**
   * Absolute filesystem directory the recipe was discovered from.
   *
   * Only set for file-backed ToneGraph recipes loaded from disk; built-in
   * TypeScript recipes leave this undefined. Used by `tf library list` to
   * surface where an externally registered recipe lives.
   */
  sourceDirectory?: string;
  /**
   * True when the recipe was discovered from a directory outside the
   * repository's baked-in `presets/recipes/` directory (i.e. an externally
   * registered recipe). Built-in and baked-in recipes set this to false or
   * leave it undefined.
   */
  external?: boolean;
}

/**
 * Merge preset overrides on top of seed-derived parameter values.
 *
 * Only keys already present in `params` are applied, so an override can never
 * introduce a parameter the recipe does not declare; unknown or non-finite
 * values are ignored. Returns `params` unchanged when there is nothing to
 * apply, keeping the baseline path allocation-free and byte-identical.
 */
export function applyOverrides<T>(
  params: T,
  overrides?: Record<string, number>,
): T {
  if (!overrides) {
    return params;
  }
  const keys = Object.keys(overrides);
  if (keys.length === 0) {
    return params;
  }
  const merged = { ...(params as Record<string, number>) };
  for (const name of keys) {
    const value = overrides[name];
    if (name in merged && typeof value === "number" && Number.isFinite(value)) {
      merged[name] = value;
    }
  }
  return merged as T;
}

export interface RecipeFilterQuery {
  search?: string;
  category?: string;
  tags?: string[];
}

export interface RecipeDetailedSummary {
  name: string;
  description: string;
  category: string;
  tags: string[];
  matchedTags: string[];
}

export class RecipeRegistry {
  private readonly entries = new Map<string, RecipeRegistration>();

  register(name: string, entry: RecipeRegistration): void {
    this.entries.set(name, entry);
  }

  getRegistration(name: string): RecipeRegistration | undefined {
    return this.entries.get(name);
  }

  list(): string[] {
    return [...this.entries.keys()];
  }

  listSummaries(): Array<{ name: string; description: string }> {
    return [...this.entries.entries()].map(([name, entry]) => ({
      name,
      description: entry.description,
    }));
  }

  listDetailed(filter?: RecipeFilterQuery): RecipeDetailedSummary[] {
    const results: RecipeDetailedSummary[] = [];

    const searchTerm =
      filter?.search?.trim() ? filter.search.trim().toLowerCase() : undefined;
    const categoryTerm =
      filter?.category?.trim()
        ? normalizeCategory(filter.category.trim())
        : undefined;
    const tagTerms =
      filter?.tags && filter.tags.filter((t) => t.trim().length > 0).length > 0
        ? filter.tags
            .filter((t) => t.trim().length > 0)
            .map((t) => t.trim().toLowerCase())
        : undefined;

    for (const [name, entry] of this.entries) {
      const description = entry.description;
      const category = entry.category ?? "";
      const tags = entry.tags ?? [];

      if (searchTerm !== undefined) {
        const nameLower = name.toLowerCase();
        const descLower = description.toLowerCase();
        const catLower = category.toLowerCase();
        const tagsLower = tags.map((t) => t.toLowerCase());
        const matchesSearch =
          nameLower.includes(searchTerm)
          || descLower.includes(searchTerm)
          || catLower.includes(searchTerm)
          || tagsLower.some((t) => t.includes(searchTerm));
        if (!matchesSearch) continue;
      }

      if (categoryTerm !== undefined) {
        if (normalizeCategory(category) !== categoryTerm) continue;
      }

      if (tagTerms !== undefined) {
        const entryTagsLower = tags.map((t) => t.toLowerCase());
        const allPresent = tagTerms.every((tag) => entryTagsLower.includes(tag));
        if (!allPresent) continue;
      }

      const matchedTags: string[] = [];
      if (searchTerm !== undefined || tagTerms !== undefined) {
        const seen = new Set<string>();
        for (const tag of tags) {
          const tagLower = tag.toLowerCase();
          let matched = false;
          if (tagTerms !== undefined && tagTerms.includes(tagLower)) {
            matched = true;
          }
          if (searchTerm !== undefined && tagLower.includes(searchTerm)) {
            matched = true;
          }
          if (matched && !seen.has(tagLower)) {
            seen.add(tagLower);
            matchedTags.push(tag);
          }
        }
      }

      results.push({ name, description, category, tags, matchedTags });
    }

    return results;
  }
}

interface FileBackedRecipeParam {
  name: string;
  min: number;
  max: number;
  unit: string;
  defaultValue?: number;
  integer?: boolean;
}

export interface DiscoverFileBackedRecipesOptions {
  /**
   * Override the single directory to scan. When provided, the baked-in
   * `presets/recipes/` directory and any `additionalRecipeDirectories` are
   * not scanned (legacy single-directory behaviour).
   */
  recipeDirectory?: string;
  /**
   * Extra directories to scan after the baked-in `presets/recipes/`
   * directory (e.g. the persistent external recipe directory). Directories
   * that do not exist are skipped silently; recipes from later directories
   * override same-named recipes from earlier ones.
   */
  additionalRecipeDirectories?: string[];
  logger?: {
    warn: (message: string) => void;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function computeDurationHint(graph: ToneGraphDocument): number {
  if (typeof graph.meta?.duration === "number" && Number.isFinite(graph.meta.duration) && graph.meta.duration > 0) {
    return graph.meta.duration;
  }

  let duration = 0;
  for (const def of Object.values(graph.nodes)) {
    if (def.kind === "envelope") {
      const attack = def.params?.attack ?? 0.01;
      const decay = def.params?.decay ?? 0.1;
      const release = def.params?.release ?? 0;
      duration = Math.max(duration, attack + decay + release);
    }
  }

  return duration > 0 ? duration : 1;
}

function extractParamsFromMeta(graph: ToneGraphDocument): FileBackedRecipeParam[] {
  const declarations = graph.meta?.parameters ?? [];
  const result: FileBackedRecipeParam[] = [];

  for (const declaration of declarations) {
    if ((declaration.type !== "number" && declaration.type !== "integer")
      || typeof declaration.min !== "number"
      || typeof declaration.max !== "number"
      || declaration.max <= declaration.min) {
      continue;
    }

    const defaultValue = typeof declaration.default === "number"
      ? declaration.default
      : undefined;

    result.push({
      name: declaration.name,
      min: declaration.min,
      max: declaration.max,
      unit: declaration.unit ?? (declaration.type === "integer" ? "int" : "value"),
      defaultValue,
      integer: declaration.type === "integer",
    });
  }

  return result;
}

function parseNodeParamDeclaration(name: string, value: unknown): FileBackedRecipeParam | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const type = value.type;
  if (type !== undefined && type !== "number" && type !== "integer") {
    return undefined;
  }

  const min = value.min;
  const max = value.max;
  if (typeof min !== "number" || typeof max !== "number" || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return undefined;
  }

  const declaredName = typeof value.name === "string" && value.name.trim().length > 0
    ? value.name
    : name;
  const unit = typeof value.unit === "string" && value.unit.trim().length > 0
    ? value.unit
    : (type === "integer" ? "int" : "value");
  const defaultValue = typeof value.default === "number" && Number.isFinite(value.default)
    ? value.default
    : undefined;

  return {
    name: declaredName,
    min,
    max,
    unit,
    defaultValue,
    integer: type === "integer",
  };
}

function extractParamsFromNodeDeclarations(rawDoc: unknown): FileBackedRecipeParam[] {
  if (!isRecord(rawDoc) || !isRecord(rawDoc.nodes)) {
    return [];
  }

  const declarations: FileBackedRecipeParam[] = [];

  for (const node of Object.values(rawDoc.nodes)) {
    if (!isRecord(node)) {
      continue;
    }

    const directParameters = node.parameters;
    if (isRecord(directParameters)) {
      for (const [name, value] of Object.entries(directParameters)) {
        const parsed = parseNodeParamDeclaration(name, value);
        if (parsed) {
          declarations.push(parsed);
        }
      }
    }

    const nestedParameters = isRecord(node.params) ? node.params.parameters : undefined;
    if (isRecord(nestedParameters)) {
      for (const [name, value] of Object.entries(nestedParameters)) {
        const parsed = parseNodeParamDeclaration(name, value);
        if (parsed) {
          declarations.push(parsed);
        }
      }
    }
  }

  return declarations;
}

function extractFileBackedParams(graph: ToneGraphDocument, rawDoc: unknown): FileBackedRecipeParam[] {
  const byName = new Map<string, FileBackedRecipeParam>();

  for (const entry of extractParamsFromNodeDeclarations(rawDoc)) {
    if (!byName.has(entry.name)) {
      byName.set(entry.name, entry);
    }
  }

  for (const entry of extractParamsFromMeta(graph)) {
    if (!byName.has(entry.name)) {
      byName.set(entry.name, entry);
    }
  }

  return [...byName.values()];
}

function buildSignalChain(graph: ToneGraphDocument): string {
  if (graph.routing.length === 0) {
    return "ToneGraph (no routes)";
  }

  const toEndpointList = (value: string | string[] | undefined): string[] =>
    value === undefined ? [] : Array.isArray(value) ? value : [value];

  const parts = graph.routing.map((entry) => {
    if ("chain" in entry) {
      return entry.chain.join(" -> ");
    }
    if ("bus" in entry) {
      const inputs = toEndpointList(entry.from);
      const outputs = toEndpointList(entry.to);
      return `[${inputs.join(", ")}] -> bus:${entry.bus} -> [${outputs.join(", ")}]`;
    }
    return `${entry.from} -> ${entry.to}`;
  });
  return parts.join(" | ");
}

/**
 * Whether the optional `TF_DIAG` render diagnostics are enabled.
 *
 * Browser-safe: the browser bundle has no `process` global, so a bare
 * `process.env.TF_DIAG` read throws `ReferenceError: process is not defined`
 * and aborts audio rendering before it starts (TF-0MV1GGPSY00773DT). The
 * guard mirrors the runtime checks elsewhere in this module.
 */
export function isTfDiagnosticsEnabled(): boolean {
  return typeof process !== "undefined" && process.env?.TF_DIAG === "1";
}

export function createFileBackedRegistration(
  recipeName: string,
  graph: ToneGraphDocument,
  rawDoc: unknown,
): RecipeRegistration {
  const extractedParams = extractFileBackedParams(graph, rawDoc);
  const overrideMappings = parseFileBackedMappings(rawDoc);

  // Validate the declarative mappings once, at registration/discovery time, so
  // an invalid recipe is skipped with a warning instead of failing a render.
  validateFileBackedMappings(
    overrideMappings,
    new Set(extractedParams.map((param) => param.name)),
    graph,
  );

  return {
    getDuration: () => computeDurationHint(graph),
    buildOfflineGraph: async (rng, ctx, duration, overrides) => {
      const { loadToneGraph } = await import("./tonegraph.js");

      // Create a shallow-cloned graph to avoid mutating the canonical
      // file-backed ToneGraph loaded from disk. We then inject RNG-derived
      // parameter values into the cloned graph so that renders vary with
      // the provided seed while keeping the on-disk representation stable.
      // JSON round-trip is acceptable here since ToneGraph is JSON-compatible
      // (numbers and simple objects).
      const cloned = JSON.parse(JSON.stringify(graph)) as ToneGraphDocument;

      // Derive parameter values from the provided RNG. The extractedParams
      // list describes parameter names and ranges discovered from the file.
      const derived = {} as Record<string, number>;
      for (const p of extractedParams) {
        // Use rng to derive a value within declared min/max.
        const value = p.min + ((p.max - p.min) * rng());
        derived[p.name] = p.integer ? Math.round(value) : value;
      }

      // Apply preset overrides on top of the seed-derived values. Values for
      // integer-declared parameters are rounded so the graph stays consistent
      // with the declared parameter type.
      if (overrides) {
        for (const p of extractedParams) {
          const value = overrides[p.name];
          if (typeof value === "number" && Number.isFinite(value)) {
            derived[p.name] = p.integer ? Math.round(value) : value;
          }
        }
      }

      // Apply derived parameters to node params and automation values.
      // Strategy:
      // 1) If a key exactly matches a declared parameter name, set it.
      // 2) Otherwise, if the declared parameter included a defaultValue and the
      //    current value equals that defaultValue, assume they're the same
      //    logical parameter and replace it.
      const applyDerived = (
        container: Record<string, unknown>,
        key: string,
      ): boolean => {
        const current = container[key];
        if (typeof current !== "number") return false;
        for (const p of extractedParams) {
          if (p.defaultValue === undefined) continue;
          if (Math.abs(current - p.defaultValue) < 1e-6) {
            container[key] = derived[p.name];
            return true;
          }
        }
        if (Object.prototype.hasOwnProperty.call(derived, key)) {
          container[key] = derived[key];
          return true;
        }
        return false;
      };

      const automationFields = [
        "value",
        "rate",
        "depth",
        "offset",
        "start",
        "end",
        "step",
      ];

      for (const node of Object.values(cloned.nodes)) {
        // ToneGraphNodeDefinition is a discriminated union where not all
        // variants declare a `params` field (e.g. destination). Use a
        // runtime check and narrow aliases typed as any to avoid TypeScript
        // union property errors while preserving runtime behavior.
        const nodeParams = (node as any).params;
        if (nodeParams && typeof nodeParams === "object") {
          for (const k of Object.keys(nodeParams)) {
            applyDerived(nodeParams as Record<string, unknown>, k);
          }
        }

        // Automation curves (LFO rate/depth, ramps) hold numeric values that
        // declared parameters may map onto (e.g. modDepthEnd, lfoRate).
        const automation = (node as any).automation;
        if (automation && typeof automation === "object") {
          for (const events of Object.values(automation)) {
            if (!Array.isArray(events)) continue;
            for (const event of events) {
              if (!event || typeof event !== "object") continue;
              for (const field of automationFields) {
                if (field in (event as Record<string, unknown>)) {
                  applyDerived(event as Record<string, unknown>, field);
                }
              }
            }
          }
        }
      }

      // Explicit declarative mappings win over the name/default-value
      // heuristic above. They are applied last so a computed mapping sees the
      // post-override parameter values and any node fields written by a
      // direct mapping (see `recipe-overrides.ts`).
      applyFileBackedMappings(overrideMappings, derived, cloned);

      // Optional diagnostics: set TF_DIAG=1 to print derived params and
      // cloned node parameter values before rendering. This is intentionally
      // gated by an env var to avoid noisy output in normal runs.
      if (isTfDiagnosticsEnabled()) {
        try {
          // Print derived params mapping and example node param values
          // (only a few common node ids are shown for readability).
          // Also sample a few RNG values to show RNG is being consumed.
          const sampleRngValues: number[] = [];
          for (let i = 0; i < 5; i++) {
            sampleRngValues.push(rng());
          }

          console.log("TF_DIAG: derivedParams=", derived);
          const oscParams = (cloned.nodes as Record<string, any>)?.osc?.params;
          const filterParams = (cloned.nodes as Record<string, any>)?.filter?.params;
          const envParams = (cloned.nodes as Record<string, any>)?.env?.params;
          console.log("TF_DIAG: cloned node params: osc=", oscParams, "filter=", filterParams, "env=", envParams);
          console.log("TF_DIAG: sampled graphRng values (5):", sampleRngValues);
        } catch (e) {
          // swallow diagnostics errors to avoid affecting rendering
          // in case of unexpected graph shapes
          // eslint-disable-next-line no-console
          console.warn("TF_DIAG: diagnostics error:", e);
        }
      }

      const handle = await loadToneGraph(cloned, ctx as unknown as BaseAudioContext, rng);
      const stopTime = duration > 0 ? duration : handle.duration;
      handle.start(0);
      handle.stop(stopTime);
    },
    description: graph.meta?.description
      ?? `File-backed ToneGraph recipe loaded from ${recipeName}.`,
    category: graph.meta?.category ?? "File-backed",
    tags: graph.meta?.tags ?? ["file-backed"],
    signalChain: buildSignalChain(graph),
    params: extractedParams.map((param) => ({
      name: param.name,
      min: param.min,
      max: param.max,
      unit: param.unit,
    })),
    getParams: (rng) => {
      const values: Record<string, number> = {};
      for (const param of extractedParams) {
        // Prefer the declared default value when present: getParams is
        // primarily used by interactive UIs to show the recipe's suggested
        // defaults. If no default is declared, derive a deterministic value
        // from the provided RNG so the recipe can still vary by seed.
        if (typeof param.defaultValue === "number") {
          values[param.name] = param.defaultValue;
        } else {
          const value = param.min + ((param.max - param.min) * rng());
          values[param.name] = param.integer ? Math.round(value) : value;
        }
      }
      return values;
    },
    // Mirror the derivation `buildOfflineGraph` performs so callers can report
    // the exact values used for a render. Declared defaults are placeholders
    // that the graph builder replaces with RNG-derived values, so they must be
    // ignored here to stay consistent with the rendered audio.
    getRenderParams: (seed) => {
      const rng = createRng(seed);
      const values: Record<string, number> = {};
      for (const param of extractedParams) {
        const value = param.min + ((param.max - param.min) * rng());
        values[param.name] = param.integer ? Math.round(value) : value;
      }
      return values;
    },
  };
}

function isNodeRuntime(): boolean {
  return typeof process !== "undefined"
    && process.versions !== undefined
    && typeof process.versions.node === "string";
}

/**
 * Options for {@link resolveExternalRecipeDirectory}.
 */
export interface ResolveExternalRecipeDirectoryOptions {
  /** Explicit destination directory. Takes precedence over the env var. */
  destination?: string;
  /** Environment map to read `TONEFORGE_RECIPE_DIR` from (defaults to `process.env`). */
  env?: Record<string, string | undefined>;
  /** Home directory override (defaults to `os.homedir()`). */
  homeDirectory?: string;
}

/** Default external recipe directory relative to the OS home directory. */
export const DEFAULT_EXTERNAL_RECIPE_SUBDIR = [".toneforge", "recipes"];

/**
 * Resolve the directory that holds externally registered recipes.
 *
 * Precedence (AC2, AC6):
 * 1. `options.destination` (the CLI `--destination` flag).
 * 2. The `TONEFORGE_RECIPE_DIR` environment variable.
 * 3. `~/.toneforge/recipes/` (the platform-agnostic default).
 *
 * Relative paths are resolved against the current working directory and
 * absolute paths are returned unchanged.
 *
 * Node-only: guarded by {@link isNodeRuntime}. Throws a clear error when
 * called outside Node so callers never silently fall back to a wrong location.
 */
export async function resolveExternalRecipeDirectory(
  options: ResolveExternalRecipeDirectoryOptions = {},
): Promise<string> {
  if (!isNodeRuntime()) {
    throw new Error(
      "External recipe directories are only supported in Node.js runtimes.",
    );
  }

  const [{ resolve }, osModule] = await Promise.all([
    import("node:path"),
    import("node:os"),
  ]);

  const destination = options.destination?.trim();
  if (destination) {
    return resolve(destination);
  }

  const env = options.env ?? process.env;
  const envDirectory = env["TONEFORGE_RECIPE_DIR"]?.trim();
  if (envDirectory) {
    return resolve(envDirectory);
  }

  const home = options.homeDirectory ?? osModule.homedir();
  return resolve(home, ...DEFAULT_EXTERNAL_RECIPE_SUBDIR);
}

/**
 * Validate that a recipe name is safe to use as a file name.
 *
 * Rejects empty names, path separators, parent-directory segments and NUL
 * bytes so persistence can never escape the destination directory.
 */
export function assertSafeRecipeName(name: string): void {
  const isUnsafe = name.length === 0
    || name === "."
    || name === ".."
    || name.includes("/")
    || name.includes("\\")
    || name.includes("\0");
  if (isUnsafe) {
    throw new Error(
      `Invalid recipe name '${name}': names must not be empty or contain path separators.`,
    );
  }
}

/**
 * Options for {@link persistRecipeDocument}.
 */
export interface PersistRecipeDocumentOptions {
  /** Raw recipe document text (YAML or JSON) to write. */
  contents: string;
  /** Destination directory (relative paths resolve against the CWD). */
  destinationDirectory: string;
  /** File name to store the recipe as (e.g. `game-weapon.yaml`). */
  fileName: string;
}

/**
 * Result of {@link persistRecipeDocument}.
 */
export interface PersistRecipeDocumentResult {
  /** Absolute path of the written recipe file. */
  destinationPath: string;
  /** Absolute destination directory. */
  destinationDirectory: string;
  /** File name the recipe was written as. */
  fileName: string;
}

/**
 * Persist a recipe document to the external recipe directory.
 *
 * The write is atomic: the contents are written to a temporary file in the
 * destination directory and then renamed into place, so a concurrent reader
 * (e.g. a separate `tf generate` process) never observes a partial file
 * (AC1, AC3). Re-persisting the same file overwrites it cleanly with no
 * duplicate.
 *
 * The destination directory is created recursively when missing. A missing
 * or unreadable source is the caller's responsibility; this function writes
 * the supplied `contents` verbatim.
 */
export async function persistRecipeDocument(
  options: PersistRecipeDocumentOptions,
): Promise<PersistRecipeDocumentResult> {
  if (!isNodeRuntime()) {
    throw new Error(
      "Persisting recipes is only supported in Node.js runtimes.",
    );
  }

  if (options.fileName.includes("/") || options.fileName.includes("\\") || options.fileName.includes("\0")) {
    throw new Error(
      `Invalid recipe file name '${options.fileName}': names must not contain path separators.`,
    );
  }
  assertSafeRecipeName(options.fileName.replace(/\.[^.]+$/, ""));

  const [{ mkdir, writeFile, rename, rm }, { resolve, join }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);

  const destinationDirectory = resolve(options.destinationDirectory);
  const destinationPath = join(destinationDirectory, options.fileName);
  const tempPath = join(
    destinationDirectory,
    `.${options.fileName}.${process.pid}.${Date.now()}.tmp`,
  );

  await mkdir(destinationDirectory, { recursive: true });

  try {
    await writeFile(tempPath, options.contents, "utf-8");
    await rename(tempPath, destinationPath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {
      /* best-effort cleanup */
    });
    throw error;
  }

  return {
    destinationPath,
    destinationDirectory,
    fileName: options.fileName,
  };
}

export async function discoverFileBackedRecipes(
  registry: RecipeRegistry,
  options: DiscoverFileBackedRecipesOptions = {},
): Promise<string[]> {
  if (!isNodeRuntime()) {
    return [];
  }

  const logger = options.logger ?? console;

  const [{ readdir, readFile }, pathModule, urlModule, yamlModule, schemaModule] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
    import("node:url"),
    import("js-yaml"),
    import("./tonegraph-schema.js"),
  ]);

  const { resolve, dirname, extname, basename } = pathModule;
  const { fileURLToPath } = urlModule;
  const { validateToneGraph } = schemaModule;
  const yamlLoad = (yamlModule as { load?: (input: string) => unknown; default?: { load?: (input: string) => unknown } }).load
    ?? (yamlModule as { default?: { load?: (input: string) => unknown } }).default?.load;
  if (yamlLoad === undefined) {
    throw new Error("js-yaml load function is unavailable.");
  }

  const defaultRecipeDirectory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "presets",
    "recipes",
  );

  // When an explicit single directory is supplied, honour the legacy
  // behaviour and ignore the baked-in directory and any additional dirs.
  // Otherwise scan the baked-in presets directory first, followed by the
  // externally registered directories, so externally registered recipes
  // override same-named baked-in ones.
  const recipeDirectories = options.recipeDirectory !== undefined
    ? [options.recipeDirectory]
    : [defaultRecipeDirectory, ...(options.additionalRecipeDirectories ?? [])];

  const discovered: string[] = [];
  const seen = new Set<string>();

  for (const rawDirectory of recipeDirectories) {
    const recipeDirectory = resolve(rawDirectory);
    const isExternal = recipeDirectory !== defaultRecipeDirectory;

    let entries: Array<{ name: string; isFile: () => boolean }> = [];
    try {
      entries = await readdir(recipeDirectory, { withFileTypes: true });
    } catch (error) {
      const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
      if (code === "ENOENT") {
        continue;
      }
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const ext = extname(entry.name).toLowerCase();
      if (ext !== ".json" && ext !== ".yaml" && ext !== ".yml") {
        continue;
      }

      const filePath = resolve(recipeDirectory, entry.name);

      try {
        const source = await readFile(filePath, "utf-8");
        const rawDoc = ext === ".json"
          ? JSON.parse(source)
          : yamlLoad(source);
        const graph = validateToneGraph(rawDoc);

        const recipeName = basename(entry.name, ext);
        registry.register(recipeName, {
          ...createFileBackedRegistration(recipeName, graph, rawDoc),
          sourceDirectory: recipeDirectory,
          external: isExternal,
        });
        if (!seen.has(recipeName)) {
          seen.add(recipeName);
          discovered.push(recipeName);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Skipping invalid ToneGraph recipe file ${entry.name}: ${message}`);
      }
    }
  }

  return discovered;
}

function normalizeCategory(category: string): string {
  return normalizeCategoryFn(category);
}
