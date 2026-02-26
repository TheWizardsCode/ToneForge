/**
 * Sequence Simulator Tests
 *
 * Tests for simulate(), formatTimeline(), and msToSamples().
 * Covers deterministic simulation, probability filtering, repeat expansion,
 * duration limits, and timeline formatting.
 *
 * Work item: TF-0MM196BQ90Z3AAT3
 */

import { describe, it, expect } from "vitest";
import { simulate, formatTimeline, msToSamples } from "./simulator.js";
import type { SequenceDefinition } from "./schema.js";

const SAMPLE_RATE = 44100;

// ── Helper ────────────────────────────────────────────────────────

/** A minimal valid sequence definition for test baselines. */
function threeEventSequence(): SequenceDefinition {
  return {
    name: "test-seq",
    events: [
      { time: 0, time_ms: 0, event: "shot", seedOffset: 0, probability: 1.0, gain: 1.0 },
      { time: 0.12, time_ms: 120, event: "shot", seedOffset: 1, probability: 1.0, gain: 0.9 },
      { time: 0.24, time_ms: 240, event: "shot", seedOffset: 2, probability: 1.0, gain: 0.85 },
    ],
  };
}

// ── msToSamples ───────────────────────────────────────────────────

describe("msToSamples", () => {
  it("converts 0ms to 0 samples", () => {
    expect(msToSamples(0, SAMPLE_RATE)).toBe(0);
  });

  it("converts 1000ms to sampleRate samples", () => {
    expect(msToSamples(1000, SAMPLE_RATE)).toBe(SAMPLE_RATE);
  });

  it("rounds to nearest integer sample", () => {
    // 120ms at 44100 Hz = 5292.0 samples exactly
    expect(msToSamples(120, SAMPLE_RATE)).toBe(5292);
  });

  it("handles fractional ms with rounding", () => {
    // 1ms at 44100 Hz = 44.1, should round to 44
    expect(msToSamples(1, SAMPLE_RATE)).toBe(44);
  });

  it("accuracy is within 1 sample at 44.1kHz", () => {
    // Verify the tolerance guarantee: abs(actual - expected) <= 1
    for (const ms of [0, 1, 10, 50, 100, 120, 250, 500, 1000, 2000]) {
      const exact = (ms / 1000) * SAMPLE_RATE;
      const computed = msToSamples(ms, SAMPLE_RATE);
      expect(Math.abs(computed - exact)).toBeLessThanOrEqual(0.5);
    }
  });
});

// ── simulate — basic ─────────────────────────────────────────────

describe("simulate — basic timeline", () => {
  it("produces correct number of events for a simple sequence", () => {
    const result = simulate(threeEventSequence(), 42);
    expect(result.events).toHaveLength(3);
  });

  it("sets name from definition", () => {
    const result = simulate(threeEventSequence(), 42);
    expect(result.name).toBe("test-seq");
  });

  it("records the seed", () => {
    const result = simulate(threeEventSequence(), 42);
    expect(result.seed).toBe(42);
  });

  it("uses default sample rate of 44100", () => {
    const result = simulate(threeEventSequence(), 42);
    expect(result.sampleRate).toBe(44100);
  });

  it("computes correct eventSeed = baseSeed + seedOffset", () => {
    const result = simulate(threeEventSequence(), 100);
    expect(result.events[0]!.eventSeed).toBe(100); // 100 + 0
    expect(result.events[1]!.eventSeed).toBe(101); // 100 + 1
    expect(result.events[2]!.eventSeed).toBe(102); // 100 + 2
  });

  it("computes correct sampleOffset for each event", () => {
    const result = simulate(threeEventSequence(), 42);
    expect(result.events[0]!.sampleOffset).toBe(msToSamples(0, SAMPLE_RATE));
    expect(result.events[1]!.sampleOffset).toBe(msToSamples(120, SAMPLE_RATE));
    expect(result.events[2]!.sampleOffset).toBe(msToSamples(240, SAMPLE_RATE));
  });

  it("preserves gain values", () => {
    const result = simulate(threeEventSequence(), 42);
    expect(result.events[0]!.gain).toBe(1.0);
    expect(result.events[1]!.gain).toBe(0.9);
    expect(result.events[2]!.gain).toBe(0.85);
  });

  it("events are sorted by time", () => {
    const result = simulate(threeEventSequence(), 42);
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i]!.time_ms).toBeGreaterThanOrEqual(
        result.events[i - 1]!.time_ms,
      );
    }
  });

  it("all events in rep 0 when no repeat", () => {
    const result = simulate(threeEventSequence(), 42);
    for (const evt of result.events) {
      expect(evt.repetition).toBe(0);
    }
  });
});

// ── simulate — determinism ────────────────────────────────────────

describe("simulate — determinism", () => {
  it("produces identical results for the same seed", () => {
    const a = simulate(threeEventSequence(), 42);
    const b = simulate(threeEventSequence(), 42);
    expect(a.events).toEqual(b.events);
  });

  it("produces different results for different seeds when probability < 1", () => {
    const def: SequenceDefinition = {
      name: "prob-test",
      events: [
        { time: 0, time_ms: 0, event: "a", seedOffset: 0, probability: 0.5, gain: 1.0 },
        { time: 0.1, time_ms: 100, event: "b", seedOffset: 1, probability: 0.5, gain: 1.0 },
        { time: 0.2, time_ms: 200, event: "c", seedOffset: 2, probability: 0.5, gain: 1.0 },
        { time: 0.3, time_ms: 300, event: "d", seedOffset: 3, probability: 0.5, gain: 1.0 },
        { time: 0.4, time_ms: 400, event: "e", seedOffset: 4, probability: 0.5, gain: 1.0 },
        { time: 0.5, time_ms: 500, event: "f", seedOffset: 5, probability: 0.5, gain: 1.0 },
      ],
    };

    // Run multiple seeds and collect event counts
    const counts = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      counts.add(simulate(def, seed).events.length);
    }
    // With 6 events at 0.5 probability and 20 seeds, we should see variation
    expect(counts.size).toBeGreaterThan(1);
  });

  it("produces identical results across 10 consecutive runs (determinism guarantee)", () => {
    const baseline = simulate(threeEventSequence(), 42);
    for (let i = 0; i < 10; i++) {
      const run = simulate(threeEventSequence(), 42);
      expect(run.events).toEqual(baseline.events);
      expect(run.totalDuration).toBe(baseline.totalDuration);
      expect(run.totalDuration_ms).toBe(baseline.totalDuration_ms);
    }
  });
});

// ── simulate — repeat expansion ───────────────────────────────────

describe("simulate — repeat expansion", () => {
  it("expands events across repetitions", () => {
    const def: SequenceDefinition = {
      name: "repeat-test",
      events: [
        { time: 0, time_ms: 0, event: "hit", seedOffset: 0, probability: 1.0, gain: 1.0 },
      ],
      repeat: { count: 2, interval: 1.0 },
    };
    // count=2 means 3 total plays: original + 2 repeats
    const result = simulate(def, 42);
    expect(result.events).toHaveLength(3);
    expect(result.events[0]!.repetition).toBe(0);
    expect(result.events[1]!.repetition).toBe(1);
    expect(result.events[2]!.repetition).toBe(2);
  });

  it("applies correct time offsets for repeats", () => {
    const def: SequenceDefinition = {
      name: "repeat-timing",
      events: [
        { time: 0.1, time_ms: 100, event: "hit", seedOffset: 0, probability: 1.0, gain: 1.0 },
      ],
      repeat: { count: 1, interval: 0.5 },
    };
    const result = simulate(def, 42);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]!.time_ms).toBe(100);   // rep 0: 100ms
    expect(result.events[1]!.time_ms).toBe(600);   // rep 1: 100 + 500 = 600ms
  });

  it("repeat count 0 means play once (no repeats)", () => {
    const def: SequenceDefinition = {
      name: "no-repeat",
      events: [
        { time: 0, time_ms: 0, event: "hit", seedOffset: 0, probability: 1.0, gain: 1.0 },
      ],
      repeat: { count: 0, interval: 1.0 },
    };
    const result = simulate(def, 42);
    expect(result.events).toHaveLength(1);
  });
});

// ── simulate — maxDuration ────────────────────────────────────────

describe("simulate — maxDuration filtering", () => {
  it("excludes events beyond maxDuration", () => {
    const def: SequenceDefinition = {
      name: "duration-test",
      events: [
        { time: 0, time_ms: 0, event: "a", seedOffset: 0, probability: 1.0, gain: 1.0 },
        { time: 0.5, time_ms: 500, event: "b", seedOffset: 1, probability: 1.0, gain: 1.0 },
        { time: 1.5, time_ms: 1500, event: "c", seedOffset: 2, probability: 1.0, gain: 1.0 },
      ],
    };
    const result = simulate(def, 42, { maxDuration: 1.0 });
    expect(result.events).toHaveLength(2);
    expect(result.events.every((e) => e.time_ms <= 1000)).toBe(true);
  });

  it("sets totalDuration to maxDuration when specified", () => {
    const result = simulate(threeEventSequence(), 42, { maxDuration: 5.0 });
    expect(result.totalDuration).toBe(5.0);
    expect(result.totalDuration_ms).toBe(5000);
  });
});

// ── simulate — custom sampleRate ──────────────────────────────────

describe("simulate — custom sampleRate", () => {
  it("uses custom sample rate for sampleOffset calculation", () => {
    const def: SequenceDefinition = {
      name: "custom-rate",
      events: [
        { time: 1.0, time_ms: 1000, event: "a", seedOffset: 0, probability: 1.0, gain: 1.0 },
      ],
    };
    const result = simulate(def, 42, { sampleRate: 48000 });
    expect(result.sampleRate).toBe(48000);
    expect(result.events[0]!.sampleOffset).toBe(48000);
  });
});

// ── formatTimeline ────────────────────────────────────────────────

describe("formatTimeline", () => {
  it("produces the expected timeline shape", () => {
    const result = simulate(threeEventSequence(), 42);
    const timeline = formatTimeline(result);

    expect(timeline["name"]).toBe("test-seq");
    expect(timeline["seed"]).toBe(42);
    expect(timeline["sampleRate"]).toBe(44100);
    expect(Array.isArray(timeline["events"])).toBe(true);

    const events = timeline["events"] as Array<Record<string, unknown>>;
    expect(events).toHaveLength(3);
    expect(events[0]!["time_ms"]).toBe(0);
    expect(events[0]!["event"]).toBe("shot");
    expect(events[0]!["seedOffset"]).toBe(0);
  });

  it("includes duration only when present", () => {
    const def: SequenceDefinition = {
      name: "dur-test",
      events: [
        { time: 0, time_ms: 0, event: "a", seedOffset: 0, probability: 1.0, gain: 1.0, duration: 0.5 },
        { time: 0.1, time_ms: 100, event: "b", seedOffset: 1, probability: 1.0, gain: 1.0 },
      ],
    };
    const result = simulate(def, 42);
    const timeline = formatTimeline(result);
    const events = timeline["events"] as Array<Record<string, unknown>>;
    expect(events[0]!["duration"]).toBe(0.5);
    expect(events[1]!["duration"]).toBeUndefined();
  });
});
