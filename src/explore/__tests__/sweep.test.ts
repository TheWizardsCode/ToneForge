import { describe, it, expect } from "vitest";
import { generateMutatedSeeds, defaultConcurrency } from "../sweep.js";

describe("defaultConcurrency", () => {
  it("returns at least 1", () => {
    expect(defaultConcurrency()).toBeGreaterThanOrEqual(1);
  });

  it("returns a finite integer", () => {
    const val = defaultConcurrency();
    expect(Number.isInteger(val)).toBe(true);
    expect(Number.isFinite(val)).toBe(true);
  });
});

describe("generateMutatedSeeds", () => {
  it("generates the requested number of seeds", () => {
    const seeds = generateMutatedSeeds(42, 10, 0.5);
    expect(seeds).toHaveLength(10);
  });

  it("generates non-negative seeds", () => {
    const seeds = generateMutatedSeeds(1, 20, 1.0);
    for (const s of seeds) {
      expect(s).toBeGreaterThanOrEqual(0);
    }
  });

  it("is deterministic for the same base seed", () => {
    const seeds1 = generateMutatedSeeds(42, 10, 0.5);
    const seeds2 = generateMutatedSeeds(42, 10, 0.5);
    expect(seeds1).toEqual(seeds2);
  });

  it("produces different seeds for different base seeds", () => {
    const seeds1 = generateMutatedSeeds(42, 10, 0.5);
    const seeds2 = generateMutatedSeeds(99, 10, 0.5);
    expect(seeds1).not.toEqual(seeds2);
  });

  it("produces different seeds for different jitter values", () => {
    const seeds1 = generateMutatedSeeds(42, 10, 0.1);
    const seeds2 = generateMutatedSeeds(42, 10, 0.9);
    // With same base seed but different jitter, the range changes
    // so results should differ (though not guaranteed for all values)
    expect(seeds1).not.toEqual(seeds2);
  });

  it("returns empty array for count 0", () => {
    expect(generateMutatedSeeds(42, 0, 0.5)).toEqual([]);
  });

  it("handles jitter of 0 gracefully", () => {
    const seeds = generateMutatedSeeds(42, 5, 0);
    expect(seeds).toHaveLength(5);
    // With jitter 0, range is max(1, floor(0*10000))=1
    // So offsets are small (-1 to 0), seeds are close to baseSeed
    for (const s of seeds) {
      expect(s).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles jitter of 1 (maximum)", () => {
    const seeds = generateMutatedSeeds(42, 5, 1);
    expect(seeds).toHaveLength(5);
    for (const s of seeds) {
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
    }
  });
});
