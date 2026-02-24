import { describe, it, expect } from "vitest";
import { clusterCandidates } from "../clustering.js";
import type { ExploreCandidate, ClusterSummary } from "../types.js";
import type { AnalysisResult } from "../../analyze/types.js";

/** Helper: create a minimal AnalysisResult. */
function makeAnalysis(): AnalysisResult {
  return {
    analysisVersion: "1.0",
    sampleRate: 44100,
    sampleCount: 1000,
    metrics: {
      time: { rms: 0.3, crestFactor: 3.0 },
      spectral: { spectralCentroid: 1200 },
      envelope: { attackTime: 0.05 },
    },
  };
}

/** Helper: create a candidate with pre-set metricScores. */
function makeCandidate(
  id: string,
  metricScores: Record<string, number>,
  score: number = 0,
): ExploreCandidate {
  return {
    id,
    recipe: "test",
    seed: Number.parseInt(id.replace(/\D/g, ""), 10) || 1,
    duration: 1.0,
    sampleRate: 44100,
    sampleCount: 1000,
    analysis: makeAnalysis(),
    score,
    metricScores: { ...metricScores },
    cluster: -1,
    promoted: false,
    libraryId: null,
    params: {},
  };
}

describe("clusterCandidates", () => {
  it("returns empty array for no candidates", () => {
    const result = clusterCandidates([], ["rms"], 3);
    expect(result).toEqual([]);
  });

  it("assigns all candidates to one cluster when k=1", () => {
    const candidates = [
      makeCandidate("c1", { rms: 0.1 }),
      makeCandidate("c2", { rms: 0.5 }),
      makeCandidate("c3", { rms: 0.9 }),
    ];

    const summaries = clusterCandidates(candidates, ["rms"], 1);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.size).toBe(3);
    expect(summaries[0]!.index).toBe(0);
    // All candidates should be assigned to cluster 0
    for (const c of candidates) {
      expect(c.cluster).toBe(0);
    }
  });

  it("separates clearly distinct candidates into different clusters", () => {
    // Two obvious groups: low rms and high rms
    const candidates = [
      makeCandidate("low1", { rms: 0.0 }),
      makeCandidate("low2", { rms: 0.05 }),
      makeCandidate("low3", { rms: 0.1 }),
      makeCandidate("high1", { rms: 0.9 }),
      makeCandidate("high2", { rms: 0.95 }),
      makeCandidate("high3", { rms: 1.0 }),
    ];

    const summaries = clusterCandidates(candidates, ["rms"], 2);

    expect(summaries).toHaveLength(2);
    // Total members across clusters should equal total candidates
    const totalMembers = summaries.reduce((sum, s) => sum + s.size, 0);
    expect(totalMembers).toBe(6);

    // Low and high candidates should be in different clusters
    const lowCluster = candidates[0]!.cluster;
    const highCluster = candidates[3]!.cluster;
    expect(lowCluster).not.toBe(highCluster);

    // All low candidates should share a cluster
    expect(candidates[1]!.cluster).toBe(lowCluster);
    expect(candidates[2]!.cluster).toBe(lowCluster);

    // All high candidates should share a cluster
    expect(candidates[4]!.cluster).toBe(highCluster);
    expect(candidates[5]!.cluster).toBe(highCluster);
  });

  it("clamps k to candidates.length when k > candidates", () => {
    const candidates = [
      makeCandidate("c1", { rms: 0.0 }),
      makeCandidate("c2", { rms: 1.0 }),
    ];

    const summaries = clusterCandidates(candidates, ["rms"], 10);

    // k is clamped to 2, so at most 2 clusters
    expect(summaries.length).toBeLessThanOrEqual(2);
    const totalMembers = summaries.reduce((sum, s) => sum + s.size, 0);
    expect(totalMembers).toBe(2);
  });

  it("puts everything in one cluster when no metrics are provided", () => {
    const candidates = [
      makeCandidate("c1", {}),
      makeCandidate("c2", {}),
    ];

    const summaries = clusterCandidates(candidates, [], 3);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.size).toBe(2);
    expect(summaries[0]!.centroid).toEqual({});
  });

  it("sets cluster field on each candidate", () => {
    const candidates = [
      makeCandidate("c1", { rms: 0.2 }),
      makeCandidate("c2", { rms: 0.8 }),
    ];

    clusterCandidates(candidates, ["rms"], 2);

    for (const c of candidates) {
      expect(c.cluster).toBeGreaterThanOrEqual(0);
    }
  });

  it("includes exemplars in cluster summaries", () => {
    const candidates = [
      makeCandidate("c1", { rms: 0.1 }, 0.9),
      makeCandidate("c2", { rms: 0.2 }, 0.8),
      makeCandidate("c3", { rms: 0.15 }, 0.7),
      makeCandidate("c4", { rms: 0.12 }, 0.6),
    ];

    const summaries = clusterCandidates(candidates, ["rms"], 1);

    expect(summaries[0]!.exemplars).toHaveLength(3);
    // Exemplars should be the top 3 by score
    expect(summaries[0]!.exemplars[0]).toBe("c1");
    expect(summaries[0]!.exemplars[1]).toBe("c2");
    expect(summaries[0]!.exemplars[2]).toBe("c3");
  });

  it("includes centroid values in summaries", () => {
    const candidates = [
      makeCandidate("c1", { rms: 0.2 }),
      makeCandidate("c2", { rms: 0.4 }),
    ];

    const summaries = clusterCandidates(candidates, ["rms"], 1);

    expect(summaries[0]!.centroid).toHaveProperty("rms");
    expect(typeof summaries[0]!.centroid["rms"]).toBe("number");
  });

  it("handles multi-dimensional clustering", () => {
    const candidates = [
      makeCandidate("lo-lo", { rms: 0.0, "spectral-centroid": 0.0 }),
      makeCandidate("lo-hi", { rms: 0.0, "spectral-centroid": 1.0 }),
      makeCandidate("hi-lo", { rms: 1.0, "spectral-centroid": 0.0 }),
      makeCandidate("hi-hi", { rms: 1.0, "spectral-centroid": 1.0 }),
    ];

    const summaries = clusterCandidates(
      candidates,
      ["rms", "spectral-centroid"],
      4,
    );

    // Each candidate should be in its own cluster (they're maximally spread)
    const totalMembers = summaries.reduce((sum, s) => sum + s.size, 0);
    expect(totalMembers).toBe(4);
    // At least 2 clusters should exist
    expect(summaries.length).toBeGreaterThanOrEqual(2);
  });

  it("is deterministic across multiple runs", () => {
    const makeCandidates = () => [
      makeCandidate("c1", { rms: 0.0 }),
      makeCandidate("c2", { rms: 0.3 }),
      makeCandidate("c3", { rms: 0.7 }),
      makeCandidate("c4", { rms: 1.0 }),
    ];

    const s1 = clusterCandidates(makeCandidates(), ["rms"], 2);
    const s2 = clusterCandidates(makeCandidates(), ["rms"], 2);

    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });
});
