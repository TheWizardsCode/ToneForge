/**
 * Unit tests for the Intelligence recommendation engine.
 *
 * Work item: TF-0MUZLOFQM000LDAO (Recommendation engine + intelligence recommend).
 */

import { describe, it, expect } from "vitest";
import { buildRecommendations, parseUseCase } from "../recommend.js";
import { validateActionableCommand } from "../commands.js";
import { makeEntry } from "./helpers.js";

function library() {
  return [
    makeEntry({ id: "lib-ui-1", category: "ui", intensity: "soft", texture: ["clean", "bright"], tags: ["sci-fi"], recipe: "ui-scifi-confirm", seed: 42, duration: 0.3 }),
    makeEntry({ id: "lib-ui-2", category: "ui", intensity: "soft", texture: ["tonal"], tags: ["sci-fi", "musical"], recipe: "ui-notification-chime", seed: 17, duration: 0.6 }),
    makeEntry({ id: "lib-weapon-1", category: "weapon", intensity: "hard", texture: ["sharp"], tags: ["sci-fi"], recipe: "weapon-laser-zap", seed: 7, duration: 0.4 }),
    makeEntry({ id: "lib-footstep-1", category: "footstep", intensity: "medium", texture: ["crunchy"], tags: ["organic"], recipe: "footstep-stone", seed: 3, duration: 0.2 }),
  ];
}

describe("parseUseCase", () => {
  it("extracts category, intensity, texture, and tag intent", () => {
    const intent = parseUseCase("calm sci-fi menu navigation");

    expect(intent.categories).toContain("ui");
    expect(intent.intensity).toBe("soft");
    expect(intent.tags).toContain("sci-fi");
    expect(intent.preferShort).toBe(true);
  });

  it("ignores unknown tokens", () => {
    const intent = parseUseCase("xyzzy plugh");
    expect(intent.categories).toEqual([]);
    expect(intent.intensity).toBeNull();
  });
});

describe("buildRecommendations", () => {
  it("ranks matching categories ahead of non-matching ones", () => {
    const report = buildRecommendations(library(), "sci-fi menu navigation", { maxResults: 5 });

    expect(report.command).toBe("intelligence recommend");
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations[0]!.entryId.startsWith("lib-ui")).toBe(true);
    // UI entries must outrank the weapon/footstep entries.
    const firstNonUi = report.recommendations.findIndex((r) => !r.entryId.startsWith("lib-ui"));
    const lastUi = report.recommendations.map((r) => r.entryId.startsWith("lib-ui")).lastIndexOf(true);
    if (firstNonUi !== -1) expect(lastUi).toBeLessThan(firstNonUi);
  });

  it("honours --max-results", () => {
    expect(buildRecommendations(library(), "ui", { maxResults: 2 }).recommendations).toHaveLength(2);
    expect(buildRecommendations(library(), "ui", { maxResults: 0 }).recommendations).toHaveLength(0);
  });

  it("keeps confidence within [0, 1] and provides explanations and valid commands", () => {
    const report = buildRecommendations(library(), "aggressive sci-fi weapon", { maxResults: 4 });

    for (const recommendation of report.recommendations) {
      expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(1);
      expect(recommendation.rationale.length).toBeGreaterThan(0);
      const validation = validateActionableCommand(recommendation.suggestedCommand);
      expect(validation.valid, validation.reason).toBe(true);
    }
  });

  it("ranks a hard weapon above a soft ui cue for an aggressive weapon use case", () => {
    const report = buildRecommendations(library(), "aggressive sci-fi weapon", { maxResults: 4 });

    const weaponRank = report.recommendations.findIndex((r) => r.entryId === "lib-weapon-1");
    const uiRank = report.recommendations.findIndex((r) => r.entryId === "lib-ui-1");
    expect(weaponRank).toBeGreaterThanOrEqual(0);
    expect(weaponRank).toBeLessThan(uiRank);
  });

  it("is deterministic for the same input", () => {
    const first = JSON.stringify(buildRecommendations(library(), "sci-fi menu", { maxResults: 5 }));
    const second = JSON.stringify(buildRecommendations(library(), "sci-fi menu", { maxResults: 5 }));
    expect(second).toBe(first);
  });
});
