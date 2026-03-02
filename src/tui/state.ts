/**
 * TUI Wizard Session State Management.
 *
 * Manages the wizard's runtime state: current stage, palette manifest,
 * candidate selections, sweep cache, and back-one-stage navigation.
 *
 * Reference: Parent epic TF-0MM7HULM506CGSOP
 */

import type {
  WizardStage,
  WizardSessionData,
  PaletteManifest,
  ManifestEntry,
  CandidateSelection,
  SweepCache,
} from "./types.js";
import { WIZARD_STAGES } from "./types.js";

/**
 * Manages the wizard session state with forward/backward navigation.
 *
 * The session tracks the current stage, manifest, selections, and
 * sweep cache. Back-one-stage navigation preserves all state.
 */
export class WizardSession {
  private data: WizardSessionData;

  constructor() {
    this.data = {
      currentStage: "define",
      manifest: { entries: [] },
      selections: new Map(),
      sweepCache: new Map(),
      exportDir: null,
      exportByCategory: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Stage navigation
  // ---------------------------------------------------------------------------

  /** Get the current wizard stage. */
  get currentStage(): WizardStage {
    return this.data.currentStage;
  }

  /** Get the 1-based index of the current stage. */
  get currentStageNumber(): number {
    return WIZARD_STAGES.indexOf(this.data.currentStage) + 1;
  }

  /** Get the total number of stages. */
  get totalStages(): number {
    return WIZARD_STAGES.length;
  }

  /**
   * Advance to the next stage.
   *
   * @returns true if advanced, false if already at the last stage.
   */
  advance(): boolean {
    const idx = WIZARD_STAGES.indexOf(this.data.currentStage);
    if (idx < WIZARD_STAGES.length - 1) {
      this.data.currentStage = WIZARD_STAGES[idx + 1]!;
      return true;
    }
    return false;
  }

  /**
   * Go back to the previous stage.
   *
   * All session state is preserved when navigating backward.
   *
   * @returns true if moved back, false if already at the first stage.
   */
  goBack(): boolean {
    const idx = WIZARD_STAGES.indexOf(this.data.currentStage);
    if (idx > 0) {
      this.data.currentStage = WIZARD_STAGES[idx - 1]!;
      return true;
    }
    return false;
  }

  /** Check if the current stage is the first stage. */
  get isFirstStage(): boolean {
    return WIZARD_STAGES.indexOf(this.data.currentStage) === 0;
  }

  /** Check if the current stage is the last stage. */
  get isLastStage(): boolean {
    return (
      WIZARD_STAGES.indexOf(this.data.currentStage) ===
      WIZARD_STAGES.length - 1
    );
  }

  // ---------------------------------------------------------------------------
  // Manifest management (Stage 1 - Define)
  // ---------------------------------------------------------------------------

  /** Get the current palette manifest. */
  get manifest(): PaletteManifest {
    return this.data.manifest;
  }

  /** Add a recipe to the manifest. */
  addToManifest(entry: ManifestEntry): void {
    // Avoid duplicates by recipe name
    if (!this.data.manifest.entries.some((e) => e.recipe === entry.recipe)) {
      this.data.manifest.entries.push(entry);
    }
  }

  /** Remove a recipe from the manifest by name. */
  removeFromManifest(recipe: string): boolean {
    const before = this.data.manifest.entries.length;
    this.data.manifest.entries = this.data.manifest.entries.filter(
      (e) => e.recipe !== recipe,
    );
    return this.data.manifest.entries.length < before;
  }

  /** Check if the manifest has at least one entry. */
  get hasManifestEntries(): boolean {
    return this.data.manifest.entries.length > 0;
  }

  /** Get the number of manifest entries. */
  get manifestSize(): number {
    return this.data.manifest.entries.length;
  }

  // ---------------------------------------------------------------------------
  // Selections management (Stage 2 - Explore)
  // ---------------------------------------------------------------------------

  /** Get all candidate selections. */
  get selections(): Map<string, CandidateSelection> {
    return this.data.selections;
  }

  /** Set the selected candidate for a recipe. */
  setSelection(recipe: string, selection: CandidateSelection): void {
    this.data.selections.set(recipe, selection);
  }

  /** Get the selected candidate for a recipe. */
  getSelection(recipe: string): CandidateSelection | undefined {
    return this.data.selections.get(recipe);
  }

  /** Remove the selection for a recipe. */
  removeSelection(recipe: string): boolean {
    return this.data.selections.delete(recipe);
  }

  /** Check if all manifest recipes have selections. */
  get allRecipesSelected(): boolean {
    return this.data.manifest.entries.every((entry) =>
      this.data.selections.has(entry.recipe),
    );
  }

  /** Get recipes that do not yet have a selection. */
  get unselectedRecipes(): string[] {
    return this.data.manifest.entries
      .filter((entry) => !this.data.selections.has(entry.recipe))
      .map((entry) => entry.recipe);
  }

  // ---------------------------------------------------------------------------
  // Sweep cache management
  // ---------------------------------------------------------------------------

  /** Get cached sweep results for a recipe. */
  getSweepCache(recipe: string): SweepCache | undefined {
    return this.data.sweepCache.get(recipe);
  }

  /** Cache sweep results for a recipe. */
  setSweepCache(recipe: string, cache: SweepCache): void {
    this.data.sweepCache.set(recipe, cache);
  }

  /** Check if sweep results are cached for a recipe. */
  hasSweepCache(recipe: string): boolean {
    return this.data.sweepCache.has(recipe);
  }

  // ---------------------------------------------------------------------------
  // Export settings (Stage 4)
  // ---------------------------------------------------------------------------

  /** Get the export output directory. */
  get exportDir(): string | null {
    return this.data.exportDir;
  }

  /** Set the export output directory. */
  set exportDir(dir: string | null) {
    this.data.exportDir = dir;
  }

  /** Get whether exports are organized by category. */
  get exportByCategory(): boolean {
    return this.data.exportByCategory;
  }

  /** Set whether exports are organized by category. */
  set exportByCategory(value: boolean) {
    this.data.exportByCategory = value;
  }

  // ---------------------------------------------------------------------------
  // Serialization (for future session save/resume)
  // ---------------------------------------------------------------------------

  /** Get the raw session data (for serialization). */
  toData(): WizardSessionData {
    return { ...this.data };
  }
}
