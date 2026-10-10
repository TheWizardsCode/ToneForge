/**
 * Unit tests for the Intelligence exploration suggestion engine.
 *
 * Work item: TF-0MUZLOG1S009F3LF (Exploration suggestion engine + intelligence suggest-exploration).
 */

import { describe, it, expect } from "vitest";
import { buildExplorationSuggestions } from "../suggest-exploration.js";
import { validateActionableCommand } from "../commands.js";
import { makeEntry } from "./helpers.js";
import type { LibraryEntry } from "../../library/types.js";

function recipeEntries(): LibraryEntry[] {
  return [
    makeEntry({ id: "lib-fs-1", recipe: "footstep-stone", seed: 1, embedding: [0, 0, 0] }),
    makeEntry({ id: "lib-fs-2", recipe: "footstep-stone", seed: 2, embedding: [0.001, 0, 0] }),
    makeEntry({ id: "lib-fs-3", recipe: "footstep-stone", seed: 3, embedding: [0, 0.001, 0] }),
    makeEntry({ id: "lib-other", recipe: "ui-scifi-confirm", seed: 1, embedding: [1, 1, 1] }),
  ];
}

describe("buildExplorationSuggestions", () => {
  it("suggests an adjacent seed window beyond current coverage", () => {
    const report = buildExplorationSuggestions(recipeEntries(), "footstep-stone");

    expect(report.command).toBe("intelligence suggest-exploration");
    expect(report.recipe).toBe("footstep-stone");

    const adjacent = report.suggestions.find((s) => s.seedRange.start === 4);
    expect(adjacent).toBeDefined();
    expect(adjacent!.seedRange.end).toBeGreaterThan(adjacent!.seedRange.start);
    expect(adjacent!.rationale).toContain("1-3");
  });

  it("references only the named recipe, not other library entries", () => {
    const report = buildExplorationSuggestions(recipeEntries(), "footstep-stone");
    for (const suggestion of report.suggestions) {
      expect(suggestion.recipe).toBe("footstep-stone");
    }
  });

  it("suggests mutation for tightly clustered entries", () => {
    const report = buildExplorationSuggestions(recipeEntries(), "footstep-stone");
    const mutation = report.suggestions.find((s) => s.suggestedCommand.includes("explore mutate"));

    expect(mutation).toBeDefined();
    expect(mutation!.rationale).toContain("cluster");
    expect(mutation!.suggestedCommand).toContain("--jitter 0.25");
  });

  it("keeps every confidence within [0, 1] and every command valid", () => {
    const report = buildExplorationSuggestions(recipeEntries(), "footstep-stone");

    expect(report.suggestions.length).toBeGreaterThan(0);
    for (const suggestion of report.suggestions) {
      expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(1);
      expect(suggestion.rationale.length).toBeGreaterThan(0);
      const validation = validateActionableCommand(suggestion.suggestedCommand);
      expect(validation.valid, validation.reason).toBe(true);
    }
  });

  it("suggests an initial sweep when the recipe has no library entries", () => {
    const report = buildExplorationSuggestions(recipeEntries(), "weapon-laser-zap");

    expect(report.suggestions).toHaveLength(1);
    expect(report.suggestions[0]!.seedRange).toEqual({ start: 0, end: 99 });
    expect(validateActionableCommand(report.suggestions[0]!.suggestedCommand).valid).toBe(true);
  });

  it("is deterministic for the same input", () => {
    const first = JSON.stringify(buildExplorationSuggestions(recipeEntries(), "footstep-stone"));
    const second = JSON.stringify(buildExplorationSuggestions(recipeEntries(), "footstep-stone"));
    expect(second).toBe(first);
  });
});
