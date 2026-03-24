/**
 * Category Dimension Classifier
 *
 * Derives a primary category from recipe name/metadata when available,
 * with metric-based fallback heuristics for unknown sources.
 *
 * Categories are always lowercase strings matching the vocabulary:
 * weapon, footstep, ui, ambient, character, creature, vehicle, impact, card-game.
 *
 * Prefix-to-category mappings are loaded lazily from `.toneforge/config.yaml`
 * (relative to the current working directory) on the first name-based lookup.
 * If the config file is absent, the built-in defaults below are used and a
 * warning is emitted. If the file exists but is malformed, an error is thrown
 * so CI surfaces the problem immediately.
 *
 * Reference: docs/prd/CLASSIFY_PRD.md
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { normalizeCategory } from "../../core/normalize-category.js";
import type { AnalysisResult } from "../../analyze/types.js";
import type { DimensionClassifier, DimensionResult, RecipeContext } from "../types.js";

/**
 * Built-in prefix-to-category defaults, used when `.toneforge/config.yaml` is absent.
 *
 * When a recipe name starts with one of these prefixes (before the first `-`
 * or as a known multi-segment prefix), the corresponding category is assigned.
 */
const DEFAULT_RECIPE_NAME_CATEGORY_MAP: Record<string, string> = {
  weapon: "weapon",
  footstep: "footstep",
  ui: "ui",
  ambient: "ambient",
  character: "character",
  creature: "creature",
  vehicle: "vehicle",
  impact: "impact",
  slam: "impact",
  rumble: "impact",
  debris: "impact",
  rattle: "impact",
  resonance: "impact",
  card: "card-game",
};

let cachedMap: Record<string, string> | null = null;
let warnedMissingConfig = false;

function loadConfigMap(): Record<string, string> {
  if (cachedMap) return cachedMap;

  // Prefer .toneforge/config.yaml in repository root
  const cfgPath = path.resolve(process.cwd(), ".toneforge", "config.yaml");
  try {
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, "utf8");
      const parsed = yaml.load(raw);

      // Reject array roots and other unexpected shapes explicitly
      if (Array.isArray(parsed)) {
        throw new Error(`${cfgPath}: expected mapping of prefix->category, got array`);
      }

      if (parsed && typeof parsed === "object") {
        // Accept either a top-level mapping or a { prefixToCategory: { ... } } shape
        const root = parsed as Record<string, any>;
        const candidate = (root.prefixToCategory && typeof root.prefixToCategory === "object")
          ? root.prefixToCategory
          : root;

        if (Array.isArray(candidate) || typeof candidate !== "object") {
          throw new Error(`${cfgPath}: expected mapping of prefix->category`);
        }

        const map: Record<string, string> = {};
        for (const [k, v] of Object.entries(candidate as Record<string, any>)) {
          if (typeof v === "string") {
            const key = String(k).toLowerCase();
            const value = String(v).toLowerCase().replace(/\s+/g, "-");
            map[key] = value;
          }
        }

        // Normalize defaults as well (defensive)
        const normalizedDefaults: Record<string, string> = {};
        for (const [k, v] of Object.entries(DEFAULT_RECIPE_NAME_CATEGORY_MAP)) {
          normalizedDefaults[String(k).toLowerCase()] = String(v).toLowerCase().replace(/\s+/g, "-");
        }

        cachedMap = { ...normalizedDefaults, ...map };
        return cachedMap;
      }

      // malformed structure
      throw new Error(`${cfgPath}: expected mapping of prefix->category`);
    }
  } catch (err) {
    // Fail fast on malformed config so CI/tests surface the issue; add context
    throw new Error(`Error loading ${cfgPath}: ${(err as Error).message}`);
  }

  // No config file — warn once and fall back to in-memory defaults
  if (!warnedMissingConfig) {
    // eslint-disable-next-line no-console
    console.warn(`.toneforge/config.yaml not found at ${cfgPath}, using built-in defaults`);
    warnedMissingConfig = true;
  }

  // Ensure defaults are normalized defensively
  const normalizedDefaults: Record<string, string> = {};
  for (const [k, v] of Object.entries(DEFAULT_RECIPE_NAME_CATEGORY_MAP)) {
    normalizedDefaults[String(k).toLowerCase()] = String(v).toLowerCase().replace(/\s+/g, "-");
  }

  cachedMap = { ...normalizedDefaults };
  return cachedMap;
}

/**
 * Infer category from analysis metrics when no recipe metadata is available.
 *
 * Uses duration, attack time, RMS, and spectral centroid to make a
 * best-effort category guess. This is inherently less accurate than
 * recipe-metadata-based classification.
 */
function inferCategoryFromMetrics(analysis: AnalysisResult): string {
  const time = analysis.metrics["time"] ?? {};
  const envelope = analysis.metrics["envelope"] ?? {};
  const spectral = analysis.metrics["spectral"] ?? {};

  const duration = typeof time["duration"] === "number" ? time["duration"] : 0;
  const rms = typeof time["rms"] === "number" ? time["rms"] : 0;
  const peak = typeof time["peak"] === "number" ? time["peak"] : 0;
  const attackTime = typeof envelope["attackTime"] === "number" ? envelope["attackTime"] : 50;
  const centroid = typeof spectral["spectralCentroid"] === "number" ? spectral["spectralCentroid"] : 1000;

  // Short, high-peak transient -> impact
  if (duration < 0.3 && attackTime < 10 && peak > 0.6) {
    return "impact";
  }

  // Very short, high centroid, low-medium RMS -> ui
  if (duration < 0.5 && centroid > 2000 && rms < 0.25) {
    return "ui";
  }

  // Short, high RMS, high centroid -> weapon
  if (duration < 1.0 && rms > 0.15 && centroid > 1500) {
    return "weapon";
  }

  // Medium duration, low centroid, moderate attack -> footstep
  if (duration < 0.5 && centroid < 1500 && attackTime < 20) {
    return "footstep";
  }

  // Long, low RMS -> ambient
  if (duration > 2.0 && rms < 0.15) {
    return "ambient";
  }

  // Moderate duration, moderate RMS -> character
  if (duration >= 0.1 && duration <= 1.5) {
    return "character";
  }

  return "unknown";
}

/**
 * Category dimension classifier.
 *
 * Uses recipe metadata as the primary signal for category, with
 * analysis-metric-based fallback for unknown sources.
 *
 * Prefix-to-category mappings are lazy-loaded from the YAML config on the
 * first name-based lookup. Pass a custom `configPath` in the constructor to
 * override the default location (useful for testing).
 */
export class CategoryClassifier implements DimensionClassifier {
  readonly name = "category";

  private readonly configPath: string | undefined;
  private mappings: Record<string, string> | null = null;
  private loaded = false;

  /**
   * @param configPath - Optional override for the config file path. When omitted,
   *   the path is resolved from `process.cwd()` at the time of the first name-based
   *   classify call, so it reflects the working directory at usage time.
   */
  constructor(configPath?: string) {
    this.configPath = configPath;
  }

  /**
   * Lazily load prefix-to-category mappings from `.toneforge/config.yaml`.
   *
   * - If the file is absent: emits a console warning and returns built-in defaults.
   * - If the file is present but malformed: throws an error to fail fast.
   * - On subsequent calls: returns the cached result.
   */
  private loadMappings(): Record<string, string> {
    if (this.loaded) {
      return this.mappings ?? RECIPE_NAME_CATEGORY_MAP;
    }
    this.loaded = true;

    const resolvedPath = this.configPath ?? join(process.cwd(), DEFAULT_CONFIG_PATH);
    let raw: string;
    try {
      raw = readFileSync(resolvedPath, "utf-8");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        console.warn(
          `[ToneForge] No ${resolvedPath} found; using built-in category mappings.`,
        );
        return RECIPE_NAME_CATEGORY_MAP;
      }
      throw err;
    }

    const parsed = loadYaml(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        `[ToneForge] Invalid config at ${resolvedPath}: expected a YAML object at the top level.`,
      );
    }

    const config = parsed as Record<string, unknown>;
    const prefixToCategory = config["prefixToCategory"];

    if (
      !prefixToCategory ||
      typeof prefixToCategory !== "object" ||
      Array.isArray(prefixToCategory)
    ) {
      throw new Error(
        `[ToneForge] Invalid config at ${resolvedPath}: missing or invalid 'prefixToCategory' key.`,
      );
    }

    const mappings: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      prefixToCategory as Record<string, unknown>,
    )) {
      if (typeof value !== "string") {
        throw new Error(
          `[ToneForge] Invalid config at ${resolvedPath}: prefixToCategory['${key}'] must be a string, got ${typeof value}.`,
        );
      }
      mappings[key] = value;
    }

    this.mappings = mappings;
    return mappings;
  }

  classify(analysis: AnalysisResult, context?: RecipeContext): DimensionResult {
    // Primary signal: recipe metadata
    // Normalize to lowercase hyphenated form (e.g. "Card Game" -> "card-game")
    // to match the canonical vocabulary used in RECIPE_NAME_CATEGORY_MAP.
    if (context?.category) {
      return { category: normalizeCategory(context.category) };
    }

    // Secondary signal: recipe name parsing (use config if available)
    if (context?.name) {
      const firstSegment = context.name.split("-")[0]!.toLowerCase();
      const map = loadConfigMap();
      const mapped = map[firstSegment];
    // Secondary signal: recipe name parsing (use config if available)
    if (context?.name) {
      const firstSegment = context.name.split("-")[0]!.toLowerCase();
      const map = loadConfigMap();
      const mapped = map[firstSegment];
>>>>>>> origin/main
      if (mapped) {
        return { category: mapped };
      }
    }

    // Fallback: metric-based heuristics
    return { category: inferCategoryFromMetrics(analysis) };
  }
}
