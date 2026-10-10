/**
 * Explainability-contract tests.
 *
 * Proves the confidence/rationale contract is identical across `audit`,
 * `recommend`, and `suggest-exploration`, and that every report declares the
 * read-only / dry-run guarantee.
 *
 * Work item: TF-0MUZLOGCW006O8LH (Safety, determinism & explainability hardening).
 */

import { describe, it, expect } from "vitest";
import { buildAuditReport } from "../audit.js";
import { buildRecommendations } from "../recommend.js";
import { buildExplorationSuggestions } from "../suggest-exploration.js";
import { validateActionableCommand } from "../commands.js";
import { sampleLibrary } from "./helpers.js";
import type { IntelligenceReport, IntelligenceSuggestion } from "../types.js";

function buildReports(): IntelligenceReport[] {
  const entries = sampleLibrary();
  return [
    buildAuditReport(entries, "./library"),
    buildRecommendations(entries, "sci-fi menu navigation", { maxResults: 5 }),
    buildExplorationSuggestions(entries, "weapon-laser-zap"),
  ];
}

function collectSuggestions(reports: IntelligenceReport[]): IntelligenceSuggestion[] {
  return reports.flatMap((report) => {
    if (report.command === "intelligence audit") return report.findings;
    if (report.command === "intelligence recommend") return report.recommendations;
    return report.suggestions;
  });
}

describe("shared explainability contract", () => {
  it("every suggestion exposes confidence in [0, 1], a rationale, and a valid command", () => {
    const suggestions = collectSuggestions(buildReports());

    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(1);
      expect(typeof suggestion.rationale).toBe("string");
      expect(suggestion.rationale.length).toBeGreaterThan(0);
      expect(typeof suggestion.suggestedCommand).toBe("string");
      const validation = validateActionableCommand(suggestion.suggestedCommand);
      expect(validation.valid, validation.reason).toBe(true);
    }
  });

  it("every report declares the read-only and dry-run guarantee", () => {
    for (const report of buildReports()) {
      expect(report.readOnly).toBe(true);
      expect(report.dryRun).toBe(true);
      expect(typeof report.version).toBe("string");
      expect(report.version.length).toBeGreaterThan(0);
    }
  });

  it("all three reports use distinct command discriminators", () => {
    const commands = buildReports().map((report) => report.command).sort();
    expect(commands).toEqual([
      "intelligence audit",
      "intelligence recommend",
      "intelligence suggest-exploration",
    ]);
  });

  it("serialises deterministically", () => {
    const first = JSON.stringify(buildReports());
    const second = JSON.stringify(buildReports());
    expect(second).toBe(first);
  });
});
