import { describe, it, expect } from "vitest";
import {
  checkDurationBounds,
  checkPeakClipping,
  checkSilenceRatio,
  computeSilenceRatio,
  extractAudioFacts,
  runChecks,
  type AudioFacts,
} from "../checks.js";
import type { AudioRules, DurationRule, PeakClippingRule, SilenceRatioRule } from "../rules.js";
import { makeEntry } from "./helpers.js";

const peakRule: PeakClippingRule = { maxPeak: 0.95 };
const durationRule: DurationRule = { min: 0.05, max: 1.5 };
const silenceRule: SilenceRatioRule = { maxRatio: 0.35, threshold: 0.001 };
const audioRules: AudioRules = {
  peakClipping: peakRule,
  duration: durationRule,
  silenceRatio: silenceRule,
};

const facts = (overrides: Partial<AudioFacts> = {}): AudioFacts => ({
  peak: 0.8,
  duration: 0.5,
  silenceRatio: 0.1,
  ...overrides,
});

describe("computeSilenceRatio", () => {
  it("returns 1 for an all-zero buffer", () => {
    expect(computeSilenceRatio(new Float32Array(100))).toBe(1);
  });

  it("returns 0 for a buffer with no silent samples", () => {
    expect(computeSilenceRatio(new Float32Array([1, -1, 0.5, -0.5]))).toBe(0);
  });

  it("computes the silent fraction", () => {
    // 2 silent, 2 loud -> 0.5
    expect(computeSilenceRatio(new Float32Array([0, 0, 1, -1]))).toBeCloseTo(0.5, 6);
  });

  it("honours a custom silence threshold", () => {
    // With threshold 0.001 only the first sample is silent.
    expect(computeSilenceRatio(new Float32Array([0.0005, 0.02]), 0.001)).toBeCloseTo(0.5, 6);
  });

  it("returns 0 for an empty buffer rather than NaN", () => {
    expect(computeSilenceRatio(new Float32Array(0))).toBe(0);
  });
});

describe("extractAudioFacts", () => {
  it("reads duration and peak from the analysis result", () => {
    const entry = makeEntry({ id: "lib-a", duration: 0.75, peak: 0.9 });
    expect(extractAudioFacts(entry)).toEqual({
      peak: 0.9,
      duration: 0.75,
      silenceRatio: null,
    });
  });

  it("prefers the top-level entry duration", () => {
    const entry = makeEntry({ id: "lib-a", duration: 0.75, peak: 0.9 });
    // Corrupt the analysis duration; the entry value must win.
    entry.analysis.metrics["time"]!["duration"] = 99;
    expect(extractAudioFacts(entry).duration).toBe(0.75);
  });

  it("computes silence ratio from samples when provided", () => {
    const entry = makeEntry({ id: "lib-a", silenceRatio: 0.9 });
    const samples = new Float32Array([0, 0, 1, 1]);
    expect(extractAudioFacts(entry, samples).silenceRatio).toBeCloseTo(0.5, 6);
  });

  it("falls back to the analysis silence-ratio metric", () => {
    const entry = makeEntry({ id: "lib-a", silenceRatio: 0.42 });
    expect(extractAudioFacts(entry).silenceRatio).toBe(0.42);
  });

  it("reports null when the peak metric is absent", () => {
    const entry = makeEntry({ id: "lib-a", peak: null });
    expect(extractAudioFacts(entry).peak).toBeNull();
  });
});

describe("checkPeakClipping", () => {
  it("passes when peak is within the limit", () => {
    const result = checkPeakClipping(facts({ peak: 0.9 }), peakRule, "error");
    expect(result.status).toBe("pass");
    expect(result.check).toBe("peak_clipping");
    expect(result.value).toBe(0.9);
  });

  it("reports a violation at the active strictness", () => {
    const error = checkPeakClipping(facts({ peak: 0.97 }), peakRule, "error");
    expect(error.status).toBe("error");
    expect(error.message).toMatch(/peak 0.97 exceeds <=0.95/);

    expect(checkPeakClipping(facts({ peak: 0.97 }), peakRule, "warning").status).toBe("warning");
    expect(checkPeakClipping(facts({ peak: 0.97 }), peakRule, "info").status).toBe("info");
  });

  it("skips when the peak is unavailable", () => {
    const result = checkPeakClipping(facts({ peak: null }), peakRule, "error");
    expect(result.status).toBe("skipped");
    expect(result.value).toBeNull();
    expect(result.message).toMatch(/peak amplitude not available/);
  });
});

describe("checkDurationBounds", () => {
  it("passes when duration is within bounds", () => {
    const result = checkDurationBounds(facts({ duration: 0.5 }), durationRule, "error");
    expect(result.status).toBe("pass");
  });

  it("flags durations below the minimum", () => {
    const result = checkDurationBounds(facts({ duration: 0.01 }), durationRule, "warning");
    expect(result.status).toBe("warning");
    expect(result.message).toMatch(/below minimum 0.05s/);
  });

  it("flags durations above the maximum", () => {
    const result = checkDurationBounds(facts({ duration: 2.1 }), durationRule, "error");
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/exceeds maximum 1.5s/);
  });

  it("skips when duration is unavailable", () => {
    expect(checkDurationBounds(facts({ duration: null }), durationRule, "error").status).toBe("skipped");
  });
});

describe("checkSilenceRatio", () => {
  it("passes when the ratio is within the limit", () => {
    const result = checkSilenceRatio(facts({ silenceRatio: 0.2 }), silenceRule, "error");
    expect(result.status).toBe("pass");
  });

  it("flags a high silence ratio", () => {
    const result = checkSilenceRatio(facts({ silenceRatio: 0.45 }), silenceRule, "error");
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/silence ratio 0.45 exceeds <=0.35/);
  });

  it("skips when the ratio is unavailable", () => {
    expect(checkSilenceRatio(facts({ silenceRatio: null }), silenceRule, "error").status).toBe("skipped");
  });
});

describe("runChecks", () => {
  it("runs all three checks in a stable order", () => {
    const results = runChecks(facts(), audioRules, "warning");
    expect(results.map((r) => r.check)).toEqual([
      "peak_clipping",
      "duration_bounds",
      "silence_ratio",
    ]);
    expect(results.every((r) => r.status === "pass")).toBe(true);
  });

  it("reports every violated rule at the active strictness", () => {
    const results = runChecks(
      { peak: 0.99, duration: 3, silenceRatio: 0.9 },
      audioRules,
      "error",
    );
    expect(results.map((r) => r.status)).toEqual(["error", "error", "error"]);
  });
});
