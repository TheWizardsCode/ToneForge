/**
 * Unit tests for the Intelligence library audit engine.
 *
 * Work item: TF-0MUZLOFFI0010MJ5 (Library audit engine + intelligence audit).
 */

import { describe, it, expect } from "vitest";
import { buildAuditReport } from "../audit.js";
import { validateActionableCommand } from "../commands.js";
import { makeEntry, sampleLibrary } from "./helpers.js";

describe("buildAuditReport", () => {
  it("detects coverage gaps, redundancy, and quality issues", () => {
    const report = buildAuditReport(sampleLibrary(), "./library", {
      minClusterSize: 3,
      similarityThreshold: 0.35,
      maxDuration: 5,
    });

    const kinds = new Set(report.findings.map((f) => f.kind));
    expect(kinds.has("coverage-gap")).toBe(true);
    expect(kinds.has("redundancy")).toBe(true);
    expect(kinds.has("quality")).toBe(true);

    expect(report.summary.coverageGaps).toBeGreaterThan(0);
    expect(report.summary.redundancies).toBe(1);
    expect(report.summary.qualityIssues).toBe(2);
  });

  it("reports the planted redundancy cluster with its members and an exemplar", () => {
    const report = buildAuditReport(sampleLibrary(), "./library");
    const redundancy = report.findings.find((f) => f.kind === "redundancy");

    expect(redundancy).toBeDefined();
    expect(redundancy!.assets).toEqual(["lib-a", "lib-b", "lib-c"]);
    expect(redundancy!.supportingMetrics["clusterSize"]).toBe(3);
    expect(redundancy!.suggestedCommand).toContain("library similar --id lib-a");
  });

  it("flags clipping and out-of-bounds duration from analysis metrics", () => {
    const report = buildAuditReport(sampleLibrary(), "./library");
    const qualityIds = report.findings.filter((f) => f.kind === "quality").map((f) => f.id);

    expect(qualityIds).toContain("audit-quality-lib-d-clipping");
    expect(qualityIds).toContain("audit-quality-lib-e-duration");
  });

  it("reports a coverage gap for a missing canonical intensity bucket", () => {
    const report = buildAuditReport(
      [
        makeEntry({ id: "lib-x", category: "footstep", intensity: "hard", material: "stone" }),
        makeEntry({ id: "lib-y", category: "footstep", intensity: "hard", material: "stone" }),
      ],
      "./library",
    );

    const softGap = report.findings.find((f) => f.id === "audit-coverage-footstep-soft");
    expect(softGap).toBeDefined();
    expect(softGap!.summary).toContain("soft");
    expect(softGap!.assets).toEqual(["lib-x", "lib-y"]);
  });

  it("reports limited material variety for a multi-entry category", () => {
    const report = buildAuditReport(
      [
        makeEntry({ id: "lib-x", category: "footstep", intensity: "hard", material: "stone" }),
        makeEntry({ id: "lib-y", category: "footstep", intensity: "soft", material: "stone" }),
      ],
      "./library",
    );

    const materialFinding = report.findings.find((f) => f.id === "audit-coverage-footstep-materials");
    expect(materialFinding).toBeDefined();
    expect(materialFinding!.supportingMetrics["materialCount"]).toBe(1);
  });

  it("keeps every finding confidence within [0, 1] and every command valid", () => {
    const report = buildAuditReport(sampleLibrary(), "./library");

    expect(report.findings.length).toBeGreaterThan(0);
    for (const finding of report.findings) {
      expect(finding.confidence).toBeGreaterThanOrEqual(0);
      expect(finding.confidence).toBeLessThanOrEqual(1);
      expect(finding.rationale.length).toBeGreaterThan(0);
      const validation = validateActionableCommand(finding.suggestedCommand);
      expect(validation.valid, `${finding.id}: ${validation.reason}`).toBe(true);
    }
  });

  it("is deterministic for the same input", () => {
    const first = JSON.stringify(buildAuditReport(sampleLibrary(), "./library"));
    const second = JSON.stringify(buildAuditReport(sampleLibrary(), "./library"));
    expect(second).toBe(first);
  });

  it("returns an empty report for an empty library", () => {
    const report = buildAuditReport([], "./library");

    expect(report.totalEntries).toBe(0);
    expect(report.findings).toEqual([]);
    expect(report.summary).toEqual({
      entries: 0,
      categories: 0,
      coverageGaps: 0,
      redundancies: 0,
      qualityIssues: 0,
    });
  });
});
