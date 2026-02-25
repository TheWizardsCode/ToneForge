/**
 * Library module type definitions.
 *
 * Defines the LibraryEntry schema for persistent, indexed storage
 * of curated sound effects with metadata, analysis, classification,
 * and deterministic regeneration presets.
 *
 * Reference: docs/prd/LIBRARY_PRD.md Sections 4-7
 */

import type { AnalysisResult } from "../analyze/types.js";
import type { ClassificationResult } from "../classify/types.js";

/** Current library schema version. */
export const LIBRARY_VERSION = "1.0";

/** Default base directory for library storage. */
export const DEFAULT_LIBRARY_DIR = ".toneforge-library";

/** Library index file name. */
export const INDEX_FILE = "index.json";

/**
 * Deterministic preset for regenerating a sound.
 *
 * Contains all parameters needed to reproduce the exact audio output.
 */
export interface LibraryPreset {
  /** Recipe name used for generation. */
  recipe: string;

  /** Seed used for deterministic generation. */
  seed: number;

  /** Rendered parameters (recipe-specific key-value pairs). */
  params: Record<string, number>;
}

/**
 * Provenance information tracking the origin and versions used.
 */
export interface LibraryProvenance {
  /** ToneForge version that generated this entry. */
  toneforgeVersion: string;
}

/**
 * File paths for the entry's on-disk assets (relative to library root).
 */
export interface LibraryFiles {
  /** Relative path to the WAV audio file. */
  wav: string;

  /** Relative path to the metadata JSON file. */
  metadata: string;
}

/**
 * A single library entry representing a curated sound effect.
 *
 * Contains all data needed to identify, search, classify,
 * and regenerate the sound.
 */
export interface LibraryEntry {
  /** Unique identifier in format `lib-<candidateId>`. */
  id: string;

  /** Recipe name used to generate this sound. */
  recipe: string;

  /** Seed used for deterministic generation. */
  seed: number;

  /** Sound category (from classification or "uncategorized"). */
  category: string;

  /** Duration of the audio in seconds. */
  duration: number;

  /** Descriptive tags for search and filtering. */
  tags: string[];

  /** Analysis result with computed audio metrics. */
  analysis: AnalysisResult;

  /** Classification result with semantic labels, or null if unclassified. */
  classification: ClassificationResult | null;

  /** Deterministic preset for regeneration. */
  preset: LibraryPreset;

  /** Provenance information. */
  provenance: LibraryProvenance;

  /** File paths relative to library root. */
  files: LibraryFiles;

  /** ISO timestamp of when this entry was promoted to the library. */
  promotedAt: string;
}

/**
 * The on-disk index structure stored at `.toneforge-library/index.json`.
 */
export interface LibraryIndex {
  /** Schema version for forward compatibility. */
  version: string;

  /** All library entries. */
  entries: LibraryEntry[];
}

/**
 * Filter options for listing library entries.
 */
export interface LibraryFilter {
  /** Filter by category (exact match). */
  category?: string;

  /** Filter by recipe name (exact match). */
  recipe?: string;

  /** Filter by tags (entry must contain all specified tags). */
  tags?: string[];
}
