/**
 * Sequence Renderer Tests
 *
 * Tests for renderSequence() — mixes simulated timeline events into a
 * single audio buffer. Covers basic rendering, gain scaling, timing
 * offsets, determinism, clamping, and error cases.
 *
 * Work item: TF-0MM196DBJ10O57VI
 */

import { describe, it, expect } from "vitest";
import { renderSequence } from "./renderer.js";
import { simulate } from "./simulator.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";
import type { SequenceDefinition } from "./schema.js";

const SAMPLE_RATE = 44100;

// ── Helper ────────────────────────────────────────────────────────

/** A simple 2-event sequence using lightweight recipes. */
function twoEventSequence(): SequenceDefinition {
  return {
    name: "test-render",
    events: [
      { time: 0, time_ms: 0, event: "impact-crack", seedOffset: 0, probability: 1.0, gain: 0.8 },
      { time: 0.05, time_ms: 50, event: "rumble-body", seedOffset: 1, probability: 1.0, gain: 0.6 },
    ],
  };
}

/** A 3-event weapon burst sequence. */
function weaponBurstSequence(): SequenceDefinition {
  return {
    name: "weapon-burst",
    events: [
      { time: 0, time_ms: 0, event: "weapon-laser-zap", seedOffset: 0, probability: 1.0, gain: 1.0 },
      { time: 0.12, time_ms: 120, event: "weapon-laser-zap", seedOffset: 1, probability: 1.0, gain: 0.9 },
      { time: 0.24, time_ms: 240, event: "weapon-laser-zap", seedOffset: 2, probability: 1.0, gain: 0.85 },
    ],
  };
}

// ── Basic rendering ───────────────────────────────────────────────

describe("renderSequence — basic rendering", () => {
  it("renders a 2-event sequence and produces valid output", async () => {
    const sim = simulate(twoEventSequence(), 42);
    const result = await renderSequence(sim);

    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.sampleRate).toBe(SAMPLE_RATE);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.numberOfChannels).toBe(1);
  });

  it("renders the weapon burst sequence", async () => {
    const sim = simulate(weaponBurstSequence(), 42);
    const result = await renderSequence(sim);

    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThan(0.24); // at least 240ms
  });

  it("renders a single-event sequence", async () => {
    const def: SequenceDefinition = {
      name: "single",
      events: [
        { time: 0, time_ms: 0, event: "impact-crack", seedOffset: 0, probability: 1.0, gain: 1.0 },
      ],
    };
    const sim = simulate(def, 42);
    const result = await renderSequence(sim);

    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it("returns empty buffer for empty simulation", async () => {
    const result = await renderSequence({
      name: "empty",
      events: [],
      sampleRate: SAMPLE_RATE,
      totalDuration: 0,
      totalDuration_ms: 0,
      seed: 42,
    });
    expect(result.samples).toHaveLength(0);
    expect(result.duration).toBe(0);
  });
});

// ── Output values ─────────────────────────────────────────────────

describe("renderSequence — output values", () => {
  it("clamps output to [-1, 1]", async () => {
    const sim = simulate(twoEventSequence(), 42);
    const result = await renderSequence(sim);

    // Check min/max across entire buffer (single pass, no per-element expect)
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < result.samples.length; i++) {
      const v = result.samples[i]!;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
  });

  it("respects totalDuration override", async () => {
    const sim = simulate(twoEventSequence(), 42);
    const result = await renderSequence(sim, { totalDuration: 2.0 });

    // Duration should be exactly 2.0 seconds
    expect(result.duration).toBe(2.0);
    expect(result.samples.length).toBe(Math.ceil(2.0 * SAMPLE_RATE));
  });
});

// ── Determinism ───────────────────────────────────────────────────

describe("renderSequence — determinism", () => {
  it("produces byte-identical output for the same seed (2 runs)", async () => {
    const sim1 = simulate(twoEventSequence(), 42);
    const result1 = await renderSequence(sim1);

    const sim2 = simulate(twoEventSequence(), 42);
    const result2 = await renderSequence(sim2);

    const comparison = compareBuffers(result1.samples, result2.samples);
    expect(comparison.identical).toBe(true);
  });

  it("produces byte-identical output across 10 consecutive runs", async () => {
    const baseSim = simulate(weaponBurstSequence(), 42);
    const baseline = await renderSequence(baseSim);

    for (let i = 0; i < 9; i++) {
      const sim = simulate(weaponBurstSequence(), 42);
      const run = await renderSequence(sim);
      const comparison = compareBuffers(baseline.samples, run.samples);
      expect(comparison.identical).toBe(true);
    }
  });

  it("produces different output for different seeds", async () => {
    const sim1 = simulate(weaponBurstSequence(), 42);
    const result1 = await renderSequence(sim1);

    const sim2 = simulate(weaponBurstSequence(), 99);
    const result2 = await renderSequence(sim2);

    const comparison = compareBuffers(result1.samples, result2.samples);
    expect(comparison.identical).toBe(false);
  });
});

// ── Error cases ───────────────────────────────────────────────────

describe("renderSequence — error cases", () => {
  it("throws on unknown recipe name", async () => {
    const def: SequenceDefinition = {
      name: "bad-recipe",
      events: [
        { time: 0, time_ms: 0, event: "nonexistent-recipe-xyz", seedOffset: 0, probability: 1.0, gain: 1.0 },
      ],
    };
    const sim = simulate(def, 42);
    await expect(renderSequence(sim)).rejects.toThrow(/unknown recipe/i);
  });

  it("includes recipe name in error message", async () => {
    const def: SequenceDefinition = {
      name: "bad-recipe",
      events: [
        { time: 0, time_ms: 0, event: "totally-fake-recipe", seedOffset: 0, probability: 1.0, gain: 1.0 },
      ],
    };
    const sim = simulate(def, 42);
    await expect(renderSequence(sim)).rejects.toThrow(/totally-fake-recipe/);
  });
});
