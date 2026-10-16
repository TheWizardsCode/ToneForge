/**
 * Instrument preset family: an in-memory registry plus a Node-only loader for
 * the YAML preset files in `presets/instruments/`.
 *
 * The starter family is authored as schema-valid YAML preset files (mirroring
 * the recipe-preset convention in `presets/recipes/`) and registered into a
 * small in-memory registry that the public API exposes via
 * {@link listInstruments} / {@link getInstrument}.
 *
 * Browser safety: the YAML loader statically imports nothing from Node — it
 * resolves `node:fs/promises`, `node:path`, `node:url` and `js-yaml` lazily
 * inside a runtime guard, so importing this module (via
 * `src/instruments/index.ts`) never pulls Node built-ins into the web bundle.
 */

import type { InstrumentDefinition } from "./schema.js";
import { validateInstrumentDefinition } from "./schema.js";
import { isNodeRuntime } from "../audio/web-audio.js";

/** A registered instrument preset: a valid definition plus its family label. */
export interface InstrumentPreset {
  /** The schema-valid instrument definition. */
  readonly definition: InstrumentDefinition;
  /** Family/category label (mirrors the YAML `category` field). */
  readonly category: string;
}

/** A lightweight summary of a preset for discovery/listing. */
export interface InstrumentSummary {
  /** The preset id (== `definition.id`). */
  readonly id: string;
  /** The display name. */
  readonly name: string;
  /** The family/category label. */
  readonly category: string;
}

/**
 * An in-memory registry of instrument presets, keyed by id.
 *
 * Registration validates the definition and rejects duplicates loudly so a
 * malformed preset can never silently shadow a valid one.
 */
export class InstrumentRegistry {
  private readonly entries = new Map<string, InstrumentPreset>();

  /**
   * Register a preset (validates the definition first).
   *
   * @param preset - The preset to register.
   * @throws {Error} If the definition is invalid or the id is already taken.
   */
  register(preset: InstrumentPreset): void {
    const definition = validateInstrumentDefinition(preset.definition);
    const category = preset.category.trim();
    if (category.length === 0) {
      throw new Error(`Instrument preset "${definition.id}" must declare a category.`);
    }
    if (this.entries.has(definition.id)) {
      throw new Error(`Instrument preset "${definition.id}" is already registered.`);
    }
    this.entries.set(definition.id, { definition, category });
  }

  /** Look up a preset by id, or undefined. */
  get(id: string): InstrumentPreset | undefined {
    return this.entries.get(id);
  }

  /** Whether a preset id is registered. */
  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** All registered preset ids, in registration order. */
  list(): string[] {
    return [...this.entries.keys()];
  }

  /** Summaries of every registered preset, in registration order. */
  listSummaries(): InstrumentSummary[] {
    return [...this.entries.values()].map(({ definition, category }) => ({
      id: definition.id,
      name: definition.name,
      category,
    }));
  }

  /** Remove every registered preset (used by tests). */
  clear(): void {
    this.entries.clear();
  }
}

/** The process-wide instrument registry. */
export const instrumentRegistry = new InstrumentRegistry();

/** Register a preset into the process-wide registry. */
export function registerInstrumentPreset(preset: InstrumentPreset): void {
  instrumentRegistry.register(preset);
}

/** All registered instrument ids, discoverable via the public API. */
export function listInstruments(): string[] {
  return instrumentRegistry.list();
}

/** Summaries of all registered instruments, discoverable via the public API. */
export function listInstrumentSummaries(): InstrumentSummary[] {
  return instrumentRegistry.listSummaries();
}

/** Look up a registered instrument preset by id. */
export function getInstrument(id: string): InstrumentPreset | undefined {
  return instrumentRegistry.get(id);
}

/** Options for {@link loadInstrumentPresetsFromDirectory}. */
export interface LoadInstrumentPresetsOptions {
  /** Directory holding the preset YAML files. */
  directory: string;
  /** Optional logger for skipped invalid files (default: console). */
  logger?: Pick<Console, "warn">;
}

/**
 * Load and register every `*.yaml` / `*.yml` / `*.json` instrument preset in a
 * directory.
 *
 * Node-only: returns `[]` in the browser (there is no filesystem). Invalid
 * preset files are skipped with a warning so one malformed preset never blocks
 * the rest of the family. Already-registered ids are left untouched
 * (idempotent).
 *
 * @param options - Directory + optional logger.
 * @returns The ids newly registered.
 */
export async function loadInstrumentPresetsFromDirectory(
  options: LoadInstrumentPresetsOptions,
): Promise<string[]> {
  if (!isNodeRuntime()) {
    return [];
  }
  const logger = options.logger ?? console;

  const [{ readdir, readFile }, pathModule, yamlModule] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
    import("js-yaml"),
  ]);
  const { resolve, extname, basename } = pathModule;
  const yamlLoad =
    (yamlModule as { load?: (input: string) => unknown }).load
    ?? (yamlModule as { default?: { load?: (input: string) => unknown } }).default?.load;
  if (yamlLoad === undefined) {
    throw new Error("js-yaml load function is unavailable.");
  }

  const directory = resolve(options.directory);
  let entries: Array<{ name: string; isFile: () => boolean }> = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
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
    if (ext !== ".yaml" && ext !== ".yml" && ext !== ".json") {
      continue;
    }

    const filePath = resolve(directory, entry.name);
    try {
      const source = await readFile(filePath, "utf-8");
      const raw = ext === ".json" ? JSON.parse(source) : yamlLoad(source);
      const preset = normalizePreset(raw);
      if (instrumentRegistry.has(preset.definition.id)) {
        continue;
      }
      instrumentRegistry.register(preset);
      discovered.push(preset.definition.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Skipping invalid instrument preset ${entry.name}: ${message}`);
    }
  }

  return discovered;
}

/** Coerce a parsed YAML/JSON document into a validated {@link InstrumentPreset}. */
function normalizePreset(raw: unknown): InstrumentPreset {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("instrument preset must be an object.");
  }
  const record = raw as Record<string, unknown>;
  const categoryValue = record.category;
  const category =
    typeof categoryValue === "string" && categoryValue.trim().length > 0
      ? categoryValue
      : typeof record.id === "string"
        ? record.id
        : "";
  // `category` is preset metadata alongside the schema-valid definition.
  const { category: _category, ...definitionKeys } = record;
  const definition = validateInstrumentDefinition(definitionKeys);
  return { definition, category };
}

/**
 * Load the baked-in starter family from `presets/instruments/`.
 *
 * Node-only (returns `[]` in the browser). Idempotent.
 *
 * @returns The ids newly registered.
 */
export async function loadBundledInstrumentPresets(): Promise<string[]> {
  if (!isNodeRuntime()) {
    return [];
  }
  const [pathModule, urlModule] = await Promise.all([
    import("node:path"),
    import("node:url"),
  ]);
  const directory = pathModule.resolve(
    pathModule.dirname(urlModule.fileURLToPath(import.meta.url)),
    "..",
    "..",
    "presets",
    "instruments",
  );
  return loadInstrumentPresetsFromDirectory({ directory });
}
