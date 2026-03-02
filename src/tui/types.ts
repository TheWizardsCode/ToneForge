/**
 * TUI Wizard shared type definitions.
 *
 * Defines the data structures used across all wizard stages:
 * palette manifest, candidate selections, and session state.
 *
 * Reference: Parent epic TF-0MM7HULM506CGSOP
 */

import type { ExploreCandidate } from "../explore/types.js";
import type { ClassificationResult } from "../classify/types.js";

/**
 * The four stages of the wizard pipeline.
 *
 * The wizard progresses through these stages sequentially,
 * with back-one-stage navigation supported between adjacent stages.
 */
export type WizardStage = "define" | "explore" | "review" | "export";

/** Ordered list of wizard stages for navigation. */
export const WIZARD_STAGES: readonly WizardStage[] = [
  "define",
  "explore",
  "review",
  "export",
] as const;

/**
 * A single entry in the palette manifest.
 *
 * Represents a recipe the user wants to include in their palette,
 * selected during Stage 1 (Define).
 */
export interface ManifestEntry {
  /** Recipe name (e.g. "card-flip-flick"). */
  recipe: string;

  /** Recipe description from the registry. */
  description: string;

  /** Recipe category (e.g. "card-game"). */
  category: string;

  /** Recipe tags. */
  tags: string[];
}

/**
 * The palette manifest -- the list of recipes the user wants
 * to assemble into a coherent sound palette.
 */
export interface PaletteManifest {
  /** Ordered list of manifest entries. */
  entries: ManifestEntry[];
}

/**
 * A selected candidate for a specific recipe in the palette.
 *
 * Created during Stage 2 (Explore) when the user auditions
 * and picks a candidate for each manifest recipe.
 */
export interface CandidateSelection {
  /** Recipe name this selection is for. */
  recipe: string;

  /** The selected explore candidate. */
  candidate: ExploreCandidate;

  /** Classification result for the selected candidate. */
  classification: ClassificationResult;
}

/**
 * Cached sweep results for a recipe, stored in session state
 * to avoid re-running sweeps on back navigation.
 */
export interface SweepCache {
  /** Recipe name. */
  recipe: string;

  /** Top candidates from the sweep (ranked). */
  candidates: ExploreCandidate[];
}

/**
 * Complete wizard session state.
 *
 * Tracks the current stage, manifest, selections, sweep cache,
 * and navigation history. Managed by the WizardSession class
 * in state.ts.
 */
export interface WizardSessionData {
  /** Current wizard stage. */
  currentStage: WizardStage;

  /** The palette manifest (recipes selected in Stage 1). */
  manifest: PaletteManifest;

  /** Candidate selections (one per manifest recipe, built in Stage 2). */
  selections: Map<string, CandidateSelection>;

  /** Cached sweep results to avoid re-running on back navigation. */
  sweepCache: Map<string, SweepCache>;

  /** Export output directory chosen in Stage 4. */
  exportDir: string | null;

  /** Whether to organize exports by category subdirectories. */
  exportByCategory: boolean;
}
