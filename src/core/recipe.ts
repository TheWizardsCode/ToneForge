/**
 * Recipe Registry
 *
 * Stores recipe metadata plus deterministic offline graph builders.
 */

import type { OfflineAudioContext } from "node-web-audio-api";
import type { Rng } from "./rng.js";
import { normalizeCategory as normalizeCategoryFn } from "./normalize-category.js";
import type { ToneGraphDocument } from "./tonegraph-schema.js";

export interface ParamDescriptor {
  name: string;
  min: number;
  max: number;
  unit: string;
}

export interface RecipeRegistration {
  getDuration: (rng: Rng) => number;
  buildOfflineGraph: (
    rng: Rng,
    ctx: OfflineAudioContext,
    duration: number,
  ) => void | Promise<void>;
  description: string;
  category: string;
  tags?: string[];
  signalChain: string;
  params: ParamDescriptor[];
  getParams: (rng: Rng) => Record<string, number>;
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

interface DiscoverFileBackedRecipesOptions {
  recipeDirectory?: string;
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

  const parts = graph.routing.map((entry) => {
    if ("chain" in entry) {
      return entry.chain.join(" -> ");
    }
    return `${entry.from} -> ${entry.to}`;
  });
  return parts.join(" | ");
}

function createFileBackedRegistration(
  recipeName: string,
  graph: ToneGraphDocument,
  rawDoc: unknown,
): RecipeRegistration {
  const extractedParams = extractFileBackedParams(graph, rawDoc);

  return {
    getDuration: () => computeDurationHint(graph),
    buildOfflineGraph: async (rng, ctx, duration) => {
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

      // Apply derived parameters to node params.
      // Strategy:
      // 1) If a node.params key exactly matches a declared parameter name, set it.
      // 2) Otherwise, if the declared parameter included a defaultValue and a node
      //    param currently equals that defaultValue, assume they're the same logical
      //    parameter and replace it.
      for (const node of Object.values(cloned.nodes)) {
        if (!node.params || typeof node.params !== "object") continue;
        for (const [k, v] of Object.entries(node.params)) {
          let applied = false;

          // Prefer mapping by matching defaultValue where available. This
          // disambiguates nodes that share a generic param name like
          // "frequency" (oscillator vs filter) by using the default values
          // declared in meta.parameters.
          if (typeof v === "number") {
            for (const p of extractedParams) {
              if (p.defaultValue === undefined) continue;
              if (Math.abs(v - p.defaultValue) < 1e-6) {
                (node.params as Record<string, unknown>)[k] = derived[p.name];
                applied = true;
                break;
              }
            }
          }

          if (applied) continue;

          // Fallback: exact name match between node param key and declared param name
          if (Object.prototype.hasOwnProperty.call(derived, k)) {
            (node.params as Record<string, unknown>)[k] = derived[k];
            continue;
          }
        }
      }

      // Optional diagnostics: set TF_DIAG=1 to print derived params and
      // cloned node parameter values before rendering. This is intentionally
      // gated by an env var to avoid noisy output in normal runs.
      if (process.env.TF_DIAG === "1") {
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
  };
}

function isNodeRuntime(): boolean {
  return typeof process !== "undefined"
    && process.versions !== undefined
    && typeof process.versions.node === "string";
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
  const recipeDirectory = options.recipeDirectory ?? defaultRecipeDirectory;

  let entries: Array<{ name: string; isFile: () => boolean }> = [];
  try {
    entries = await readdir(recipeDirectory, { withFileTypes: true });
  } catch (error) {
    const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const discovered: string[] = [];
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
      registry.register(
        recipeName,
        createFileBackedRegistration(recipeName, graph, rawDoc),
      );
      discovered.push(recipeName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Skipping invalid ToneGraph recipe file ${entry.name}: ${message}`);
    }
  }

  return discovered;
}

function normalizeCategory(category: string): string {
  return normalizeCategoryFn(category);
}
