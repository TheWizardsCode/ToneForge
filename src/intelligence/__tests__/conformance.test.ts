/**
 * Intelligence conformance harness.
 *
 * One deterministic, reusable harness every Intelligence engine is validated
 * against, so `audit`, `recommend` and `suggest-exploration` cannot drift in
 * output shape, determinism, or read-only behaviour.
 *
 * It asserts:
 * 1. byte-identical output across two consecutive runs (determinism);
 * 2. the fixture library is byte-identical before/after (read-only);
 * 3. the JSON output contract (required keys, types, confidence in [0, 1]);
 * 4. the fixture actually contains the planted coverage/redundancy/quality
 *    issues (so the harness cannot pass vacuously).
 *
 * Work item: TF-0MUZLOF4B006KEF6 (Intelligence conformance harness).
 */

import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";

import { auditLibrary } from "../audit.js";
import { recommendSounds } from "../recommend.js";
import { suggestExploration } from "../suggest-exploration.js";
import { validateActionableCommand } from "../commands.js";
import {
  compareSnapshots,
  snapshotDirectory,
} from "../../test-utils/buffer-compare.js";
import type { AuditReport, RecommendReport, SuggestExplorationReport } from "../types.js";

const FIXTURE_DIR = fileURLToPath(
  new URL("../../test-utils/fixtures/intelligence", import.meta.url),
);

/** Assert a confidence-like value is within the closed interval [0, 1]. */
function expectConfidence(value: unknown): void {
  expect(typeof value).toBe("number");
  const n = value as number;
  expect(n).toBeGreaterThanOrEqual(0);
  expect(n).toBeLessThanOrEqual(1);
}

function expectAuditContract(report: AuditReport): void {
  expect(report.command).toBe("intelligence audit");
  expect(typeof report.version).toBe("string");
  expect(typeof report.library).toBe("string");
  expect(typeof report.totalEntries).toBe("number");
  expect(Array.isArray(report.categories)).toBe(true);
  expect(Array.isArray(report.findings)).toBe(true);
  expect(report.summary).toBeTypeOf("object");

  for (const finding of report.findings) {
    expect(typeof finding.id).toBe("string");
    expect(["coverage-gap", "redundancy", "quality"]).toContain(finding.kind);
    expect(typeof finding.summary).toBe("string");
    expect(Array.isArray(finding.assets)).toBe(true);
    expect(typeof finding.rationale).toBe("string");
    expect(typeof finding.suggestedCommand).toBe("string");
    expect(validateActionableCommand(finding.suggestedCommand).valid).toBe(true);
    expectConfidence(finding.confidence);
  }
}

function expectRecommendContract(report: RecommendReport): void {
  expect(report.command).toBe("intelligence recommend");
  expect(typeof report.version).toBe("string");
  expect(typeof report.useCase).toBe("string");
  expect(typeof report.maxResults).toBe("number");
  expect(Array.isArray(report.recommendations)).toBe(true);

  report.recommendations.forEach((rec, index) => {
    expect(rec.rank).toBe(index + 1);
    expect(typeof rec.entryId).toBe("string");
    expect(typeof rec.recipe).toBe("string");
    expect(typeof rec.seed).toBe("number");
    expect(typeof rec.category).toBe("string");
    expect(typeof rec.score).toBe("number");
    expect(typeof rec.rationale).toBe("string");
    expect(validateActionableCommand(rec.suggestedCommand).valid).toBe(true);
    expectConfidence(rec.confidence);
  });
}

function expectSuggestContract(report: SuggestExplorationReport): void {
  expect(report.command).toBe("intelligence suggest-exploration");
  expect(typeof report.version).toBe("string");
  expect(typeof report.recipe).toBe("string");
  expect(Array.isArray(report.suggestions)).toBe(true);

  for (const suggestion of report.suggestions) {
    expect(suggestion.recipe).toBe(report.recipe);
    expect(typeof suggestion.seedRange.start).toBe("number");
    expect(typeof suggestion.seedRange.end).toBe("number");
    expect(suggestion.seedRange.end).toBeGreaterThanOrEqual(suggestion.seedRange.start);
    expect(typeof suggestion.rationale).toBe("string");
    expect(validateActionableCommand(suggestion.suggestedCommand).valid).toBe(true);
    expectConfidence(suggestion.confidence);
  }
}

describe("Intelligence conformance harness", () => {
  it("produces byte-identical audit output across two consecutive runs", async () => {
    const first = await auditLibrary(FIXTURE_DIR);
    const second = await auditLibrary(FIXTURE_DIR);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("produces byte-identical recommendation output across two consecutive runs", async () => {
    const first = await recommendSounds(FIXTURE_DIR, "sci-fi menu navigation", { maxResults: 5 });
    const second = await recommendSounds(FIXTURE_DIR, "sci-fi menu navigation", { maxResults: 5 });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("produces byte-identical exploration output across two consecutive runs", async () => {
    const first = await suggestExploration("footstep-stone", FIXTURE_DIR);
    const second = await suggestExploration("footstep-stone", FIXTURE_DIR);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("asserts the JSON contract for all three engines", async () => {
    const audit = await auditLibrary(FIXTURE_DIR);
    const recommend = await recommendSounds(FIXTURE_DIR, "aggressive weapon", { maxResults: 3 });
    const suggest = await suggestExploration("footstep-stone", FIXTURE_DIR);

    expectAuditContract(audit);
    expectRecommendContract(recommend);
    expectSuggestContract(suggest);
  });

  it("leaves every fixture-library file byte-identical (read-only)", async () => {
    const before = snapshotDirectory(FIXTURE_DIR);

    await auditLibrary(FIXTURE_DIR);
    await recommendSounds(FIXTURE_DIR, "sci-fi menu navigation", { maxResults: 5 });
    await suggestExploration("footstep-stone", FIXTURE_DIR);

    const after = snapshotDirectory(FIXTURE_DIR);
    const diff = compareSnapshots(before, after);
    expect(diff.equal, JSON.stringify(diff)).toBe(true);
  });

  it("detects the planted coverage, redundancy, and quality issues", async () => {
    const report = await auditLibrary(FIXTURE_DIR);
    const kinds = new Set(report.findings.map((f) => f.kind));

    expect(kinds).toEqual(new Set(["coverage-gap", "redundancy", "quality"]));

    const redundancy = report.findings.find((f) => f.kind === "redundancy");
    expect(redundancy).toBeDefined();
    expect(redundancy!.assets).toEqual([
      "lib-fixture-footstep-01",
      "lib-fixture-footstep-02",
      "lib-fixture-footstep-03",
    ]);

    const qualityIds = report.findings.filter((f) => f.kind === "quality").map((f) => f.id);
    expect(qualityIds).toContain("audit-quality-lib-fixture-footstep-01-silence");
    expect(qualityIds).toContain("audit-quality-lib-fixture-weapon-01-clipping");
  });
});
