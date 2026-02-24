/**
 * Stack Renderer Tests
 *
 * Tests for renderStack() — the core multi-layer mixing engine.
 * Covers correct mixing, gain scaling, timing offsets, determinism,
 * clamping, and error cases.
 *
 * Work item: TF-0MLZZJZP50VW0Q4P
 */

import { describe, it, expect } from "vitest";
import { renderStack } from "./renderer.js";
import type { StackDefinition } from "./renderer.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";

const SAMPLE_RATE = 44100;

// ── Helper ────────────────────────────────────────────────────────

/**
 * Build a simple 2-layer stack using known recipes.
 * Uses impact-crack (short transient) and rumble-body (longer body)
 * which are lightweight and fast to render.
 */
function twoLayerStack(): StackDefinition {
  return {
    name: "test-stack",
    layers: [
      { recipe: "impact-crack", startTime: 0, gain: 0.8 },
      { recipe: "rumble-body", startTime: 0.01, gain: 0.6 },
    ],
  };
}

// ── Basic rendering ───────────────────────────────────────────────

describe("renderStack — basic rendering", () => {
  it("renders a 2-layer stack and produces valid output", async () => {
    const result = await renderStack(twoLayerStack(), 42);

    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.sampleRate).toBe(SAMPLE_RATE);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.numberOfChannels).toBe(1);
  });

  it("renders a single-layer stack", async () => {
    const def: StackDefinition = {
      name: "single",
      layers: [{ recipe: "impact-crack", startTime: 0 }],
    };
    const result = await renderStack(def, 42);
    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it("renders the explosion_heavy preset definition", async () => {
    const def: StackDefinition = {
      name: "explosion_heavy",
      layers: [
        { recipe: "impact-crack", startTime: 0, gain: 0.9 },
        { recipe: "rumble-body", startTime: 0.005, gain: 0.7 },
        { recipe: "debris-tail", startTime: 0.05, gain: 0.5 },
      ],
    };
    const result = await renderStack(def, 42);
    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.duration).toBeGreaterThan(0);
  });

  it("renders the door_slam preset definition", async () => {
    const def: StackDefinition = {
      name: "door_slam",
      layers: [
        { recipe: "slam-transient", startTime: 0, gain: 0.9 },
        { recipe: "resonance-body", startTime: 0.003, gain: 0.6 },
        { recipe: "rattle-decay", startTime: 0.04, gain: 0.35 },
      ],
    };
    const result = await renderStack(def, 42);
    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.duration).toBeGreaterThan(0);
  });
});

// ── Duration computation ──────────────────────────────────────────

describe("renderStack — duration computation", () => {
  it("total duration is at least as long as the latest layer end", async () => {
    const def: StackDefinition = {
      layers: [
        { recipe: "impact-crack", startTime: 0 },
        { recipe: "impact-crack", startTime: 0.5 },
      ],
    };
    const result = await renderStack(def, 42);
    // The second layer starts at 0.5s, so total duration must be > 0.5s
    expect(result.duration).toBeGreaterThan(0.5);
  });

  it("sample count matches computed duration", async () => {
    const result = await renderStack(twoLayerStack(), 42);
    const expectedSamples = Math.ceil(result.duration * SAMPLE_RATE);
    expect(result.samples.length).toBe(expectedSamples);
  });
});

// ── Gain scaling ──────────────────────────────────────────────────

describe("renderStack — gain scaling", () => {
  it("gain of 0 produces silence for that layer", async () => {
    // Render with gain 0 — the layer should contribute nothing
    const silentDef: StackDefinition = {
      layers: [{ recipe: "impact-crack", startTime: 0, gain: 0 }],
    };
    const result = await renderStack(silentDef, 42);

    // All samples should be zero (or very near zero)
    const maxAbs = result.samples.reduce(
      (max, s) => Math.max(max, Math.abs(s)),
      0,
    );
    expect(maxAbs).toBe(0);
  });

  it("lower gain produces lower peak amplitude", async () => {
    const loudDef: StackDefinition = {
      layers: [{ recipe: "impact-crack", startTime: 0, gain: 1.0 }],
    };
    const quietDef: StackDefinition = {
      layers: [{ recipe: "impact-crack", startTime: 0, gain: 0.1 }],
    };
    const loud = await renderStack(loudDef, 42);
    const quiet = await renderStack(quietDef, 42);

    const loudPeak = loud.samples.reduce(
      (max, s) => Math.max(max, Math.abs(s)),
      0,
    );
    const quietPeak = quiet.samples.reduce(
      (max, s) => Math.max(max, Math.abs(s)),
      0,
    );

    expect(quietPeak).toBeLessThan(loudPeak);
  });
});

// ── Timing offsets ────────────────────────────────────────────────

describe("renderStack — timing offsets", () => {
  it("offset layer has silence at the beginning", async () => {
    const def: StackDefinition = {
      layers: [{ recipe: "impact-crack", startTime: 0.1 }],
    };
    const result = await renderStack(def, 42);

    // First ~0.1s (4410 samples) should be silent
    const offsetSamples = Math.round(0.1 * SAMPLE_RATE);
    let maxInSilentRegion = 0;
    for (let i = 0; i < offsetSamples; i++) {
      maxInSilentRegion = Math.max(maxInSilentRegion, Math.abs(result.samples[i]!));
    }
    expect(maxInSilentRegion).toBe(0);
  });
});

// ── Output clamping ───────────────────────────────────────────────

describe("renderStack — output clamping", () => {
  it("output values are clamped to [-1, 1]", async () => {
    // Use high gains to potentially exceed [-1, 1]
    const def: StackDefinition = {
      layers: [
        { recipe: "impact-crack", startTime: 0, gain: 5.0 },
        { recipe: "impact-crack", startTime: 0, gain: 5.0 },
      ],
    };
    const result = await renderStack(def, 42);

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < result.samples.length; i++) {
      const s = result.samples[i]!;
      if (s < min) min = s;
      if (s > max) max = s;
    }

    expect(max).toBeLessThanOrEqual(1);
    expect(min).toBeGreaterThanOrEqual(-1);
  });
});

// ── Determinism ───────────────────────────────────────────────────

describe("renderStack — determinism", () => {
  it("10 renders with same seed produce byte-identical output", async () => {
    const def = twoLayerStack();
    const baseline = await renderStack(def, 42);

    for (let i = 1; i < 10; i++) {
      const result = await renderStack(def, 42);
      const cmp = compareBuffers(baseline.samples, result.samples);
      expect(cmp.identical).toBe(true);
    }
  }, 60_000);

  it("explosion_heavy preset is deterministic across 10 renders", async () => {
    const def: StackDefinition = {
      name: "explosion_heavy",
      layers: [
        { recipe: "impact-crack", startTime: 0, gain: 0.9 },
        { recipe: "rumble-body", startTime: 0.005, gain: 0.7 },
        { recipe: "debris-tail", startTime: 0.05, gain: 0.5 },
      ],
    };
    const baseline = await renderStack(def, 99);

    for (let i = 1; i < 10; i++) {
      const result = await renderStack(def, 99);
      const cmp = compareBuffers(baseline.samples, result.samples);
      expect(cmp.identical).toBe(true);
    }
  }, 120_000);

  it("door_slam preset is deterministic across 10 renders", async () => {
    const def: StackDefinition = {
      name: "door_slam",
      layers: [
        { recipe: "slam-transient", startTime: 0, gain: 0.9 },
        { recipe: "resonance-body", startTime: 0.003, gain: 0.6 },
        { recipe: "rattle-decay", startTime: 0.04, gain: 0.35 },
      ],
    };
    const baseline = await renderStack(def, 99);

    for (let i = 1; i < 10; i++) {
      const result = await renderStack(def, 99);
      const cmp = compareBuffers(baseline.samples, result.samples);
      expect(cmp.identical).toBe(true);
    }
  }, 120_000);

  it("different seeds produce different output", async () => {
    const def = twoLayerStack();
    const result1 = await renderStack(def, 42);
    const result2 = await renderStack(def, 9999);

    const cmp = compareBuffers(result1.samples, result2.samples);
    expect(cmp.identical).toBe(false);
  });
});

// ── Error cases ───────────────────────────────────────────────────

describe("renderStack — error cases", () => {
  it("throws on empty layers array", async () => {
    const def: StackDefinition = { layers: [] };
    await expect(renderStack(def, 42)).rejects.toThrow(/at least one layer/i);
  });

  it("throws on unknown recipe name", async () => {
    const def: StackDefinition = {
      layers: [{ recipe: "nonexistent-recipe-xyz", startTime: 0 }],
    };
    await expect(renderStack(def, 42)).rejects.toThrow(
      /recipe not found.*nonexistent-recipe-xyz/i,
    );
  });
});
