/**
 * ToneForge Intelligence — sound recommendation engine.
 *
 * `recommendSounds` maps a natural-language use case (e.g. *"sci-fi menu
 * navigation"*) onto an intent (category / intensity / texture / tag
 * preferences) and ranks library entries against it. Every recommendation
 * carries a `confidence` in [0, 1] and a human-readable explanation that
 * references the supporting labels and metrics.
 *
 * The engine is deterministic: the same library and use case always produce
 * the same ranking (no randomness, stable tie-breaks by entry id).
 *
 * Reference: docs/prd/INTELLIGENCE_PRD.md §5.1 (Sound Recommendation),
 * §7 (Explainability & Trust).
 */

import type { LibraryEntry } from "../library/types.js";
import { librarySimilarCommand } from "./commands.js";
import { clamp, loadLibraryEntries, roundTo, slugify } from "./library.js";
import type { IntensityBucket } from "./library.js";
import type { RecommendReport, Recommendation } from "./types.js";
import { INTELLIGENCE_VERSION } from "./types.js";

/** Options for {@link recommendSounds}. */
export interface RecommendOptions {
  /** Maximum number of recommendations. Default: 5. */
  maxResults?: number;
}

/** Scoring weights; their sum bounds the raw score to ~1. */
const WEIGHT_CATEGORY = 0.45;
const WEIGHT_INTENSITY = 0.2;
const WEIGHT_TAG = 0.15;
const WEIGHT_TEXTURE = 0.1;
const WEIGHT_RECIPE = 0.05;
const WEIGHT_DURATION = 0.05;

/** Category keyword vocabulary (use-case token -> category). */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  ui: ["ui", "menu", "navigation", "interface", "button", "click", "confirm", "notification", "hover", "cursor", "hud", "notification"],
  weapon: ["weapon", "gun", "shoot", "laser", "zap", "explosion", "combat", "attack", "fire", "blast"],
  footstep: ["footstep", "step", "walk", "walking", "run", "running", "surface", "gravel", "stone", "wood", "terrain"],
  ambient: ["ambient", "background", "atmosphere", "loop", "drone", "wind", "rain"],
  creature: ["creature", "monster", "animal", "vocal", "growl", "roar"],
  impact: ["impact", "hit", "collision", "crash", "smash", "thud"],
  vehicle: ["vehicle", "car", "engine", "motor", "rev"],
  character: ["character", "voice", "dialogue"],
};

/** Intensity keyword vocabulary. */
const SOFT_KEYWORDS = ["calm", "soft", "quiet", "gentle", "subtle", "low", "peaceful"];
const HARD_KEYWORDS = ["aggressive", "hard", "loud", "intense", "strong", "heavy", "harsh"];
const MEDIUM_KEYWORDS = ["medium", "moderate", "neutral"];

/** Texture keyword vocabulary (use-case token -> texture label). */
const TEXTURE_KEYWORDS: Record<string, string[]> = {
  bright: ["bright", "shiny", "crisp"],
  dark: ["dark", "muffled", "dull"],
  warm: ["warm", "round"],
  sharp: ["sharp", "piercing"],
  smooth: ["smooth", "clean"],
  noisy: ["noisy", "gritty"],
  tonal: ["tonal", "musical", "chime", "melodic"],
  harsh: ["harsh", "grating"],
  crunchy: ["crunchy", "crunch"],
  metallic: ["metallic", "metal"],
};

/** Extra tag vocabulary (use-case token -> tag). */
const TAG_KEYWORDS: Record<string, string[]> = {
  "sci-fi": ["sci", "scifi", "science", "futuristic", "cyber"],
  ranged: ["ranged", "range", "projectile"],
  hit: ["hit", "impact"],
  organic: ["organic", "natural"],
  synthetic: ["synthetic", "digital"],
};

/** Tokens that imply a short, snappy sound. */
const SHORT_TOKENS = ["ui", "menu", "navigation", "click", "button", "hover", "confirm", "notification", "cursor", "hud"];

/** Short-duration threshold (seconds) considered a good fit for UI cues. */
const SHORT_DURATION = 0.5;

/** Extracted intent from a use-case string. */
export interface UseCaseIntent {
  /** Normalised tokens. */
  tokens: string[];

  /** Matched categories (lowercased). */
  categories: string[];

  /** Matched intensity bucket, or null when unspecified. */
  intensity: IntensityBucket | null;

  /** Matched texture labels (lowercased). */
  textures: string[];

  /** Matched tags (lowercased). */
  tags: string[];

  /** Whether the use case implies short sounds. */
  preferShort: boolean;
}

/** Tokenise a use-case string into lowercased alphanumeric tokens. */
export function tokenizeUseCase(useCase: string): string[] {
  return useCase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/**
 * Parse a use case into a structured intent.
 */
export function parseUseCase(useCase: string): UseCaseIntent {
  const tokens = tokenizeUseCase(useCase);
  const tokenSet = new Set(tokens);

  const categories = new Set<string>();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => tokenSet.has(keyword))) categories.add(category);
  }
  // Direct category mention (e.g. "footstep").
  for (const token of tokens) {
    if (Object.prototype.hasOwnProperty.call(CATEGORY_KEYWORDS, token)) categories.add(token);
  }

  let intensity: IntensityBucket | null = null;
  if (SOFT_KEYWORDS.some((keyword) => tokenSet.has(keyword))) intensity = "soft";
  else if (HARD_KEYWORDS.some((keyword) => tokenSet.has(keyword))) intensity = "hard";
  else if (MEDIUM_KEYWORDS.some((keyword) => tokenSet.has(keyword))) intensity = "medium";

  const textures = new Set<string>();
  for (const [texture, keywords] of Object.entries(TEXTURE_KEYWORDS)) {
    if (keywords.some((keyword) => tokenSet.has(keyword))) textures.add(texture);
  }

  const tags = new Set<string>();
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (keywords.some((keyword) => tokenSet.has(keyword))) tags.add(tag);
  }

  return {
    tokens,
    categories: [...categories].sort(),
    intensity,
    textures: [...textures].sort(),
    tags: [...tags].sort(),
    preferShort: SHORT_TOKENS.some((token) => tokenSet.has(token)),
  };
}

/** Score a single entry against an intent. */
function scoreEntry(
  entry: LibraryEntry,
  intent: UseCaseIntent,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const category = (entry.category || "").toLowerCase();
  if (intent.categories.includes(category)) {
    score += WEIGHT_CATEGORY;
    reasons.push(`category '${entry.category}' matches the requested use case`);
  }

  const entryIntensity = (entry.classification?.intensity ?? "").toLowerCase();
  if (intent.intensity !== null) {
    const matches =
      (intent.intensity === "soft" && ["soft", "subtle", "quiet", "low"].includes(entryIntensity)) ||
      (intent.intensity === "hard" && ["hard", "aggressive", "loud", "high"].includes(entryIntensity)) ||
      (intent.intensity === "medium" && ["medium", "moderate"].includes(entryIntensity));
    if (matches) {
      score += WEIGHT_INTENSITY;
      reasons.push(`intensity '${entryIntensity}' matches '${intent.intensity}'`);
    }
  }

  const entryTags = new Set((entry.tags ?? []).map((t) => t.toLowerCase()));
  const matchedTags = intent.tags.filter((tag) => entryTags.has(tag));
  if (matchedTags.length > 0) {
    score += WEIGHT_TAG;
    reasons.push(`shares tag(s): ${matchedTags.join(", ")}`);
  }

  const entryTextures = new Set((entry.classification?.texture ?? []).map((t) => t.toLowerCase()));
  const matchedTextures = intent.textures.filter((texture) => entryTextures.has(texture));
  if (matchedTextures.length > 0) {
    score += WEIGHT_TEXTURE;
    reasons.push(`texture match: ${matchedTextures.join(", ")}`);
  }

  const recipeTokens = new Set(tokenizeUseCase(entry.recipe));
  const recipeOverlap = intent.tokens.filter((token) => recipeTokens.has(token));
  if (recipeOverlap.length > 0) {
    score += WEIGHT_RECIPE;
    reasons.push(`recipe '${entry.recipe}' overlaps the use case`);
  }

  if (intent.preferShort && entry.duration > 0 && entry.duration <= SHORT_DURATION) {
    score += WEIGHT_DURATION;
    reasons.push(`short duration ${roundTo(entry.duration, 3)}s fits a UI cue`);
  } else if (intent.preferShort && entry.duration > SHORT_DURATION * 4) {
    score -= WEIGHT_DURATION;
    reasons.push(`duration ${roundTo(entry.duration, 3)}s is long for a UI cue`);
  }

  return { score, reasons };
}

/**
 * Build a recommendation report from in-memory entries (pure; no I/O).
 */
export function buildRecommendations(
  entries: LibraryEntry[],
  useCase: string,
  options?: RecommendOptions,
): RecommendReport {
  const maxResults = Math.max(0, options?.maxResults ?? 5);
  const intent = parseUseCase(useCase);

  const scored = [...entries]
    .map((entry) => {
      const { score, reasons } = scoreEntry(entry, intent);
      return { entry, score, reasons };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.id.localeCompare(b.entry.id);
    })
    .slice(0, maxResults);

  const recommendations: Recommendation[] = scored.map((item, index) => {
    const confidence = roundTo(clamp(item.score, 0.01, 0.99), 4);
    const rationale =
      item.reasons.length > 0
        ? item.reasons.join("; ")
        : `selected as a fallback candidate for '${useCase}'`;
    return {
      rank: index + 1,
      entryId: item.entry.id,
      recipe: item.entry.recipe,
      seed: item.entry.seed,
      category: item.entry.category,
      score: roundTo(item.score, 4),
      confidence,
      rationale,
      suggestedCommand: librarySimilarCommand(item.entry.id, 5),
    };
  });

  return {
    command: "intelligence recommend",
    version: INTELLIGENCE_VERSION,
    useCase,
    maxResults,
    recommendations,
  };
}

/**
 * Recommend library sounds for a use case.
 *
 * Read-only: never writes to the library.
 *
 * @param libraryDir - Directory containing `index.json`.
 * @param useCase - Natural-language use case.
 * @param options - Optional max-results.
 */
export async function recommendSounds(
  libraryDir: string,
  useCase: string,
  options?: RecommendOptions,
): Promise<RecommendReport> {
  const entries = await loadLibraryEntries(libraryDir);
  return buildRecommendations(entries, useCase, options);
}

/** Re-export for slug tagging of use-case-specific findings. */
export { slugify };
