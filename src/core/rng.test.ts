import { describe, it, expect } from "vitest";
import { createRng, rr } from "./rng.js";
import type { Rng } from "./rng.js";

describe("createRng", () => {
  it("returns a function", () => {
    const rng = createRng(42);
    expect(typeof rng).toBe("function");
  });

  it("produces values in [0, 1)", () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("produces the same first 1000 values for the same seed", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);

    const seq1: number[] = [];
    const seq2: number[] = [];

    for (let i = 0; i < 1000; i++) {
      seq1.push(rng1());
      seq2.push(rng2());
    }

    expect(seq1).toEqual(seq2);
  });

  it("produces different sequences for different seeds", () => {
    const rng1 = createRng(1);
    const rng2 = createRng(2);

    const seq1: number[] = [];
    const seq2: number[] = [];

    for (let i = 0; i < 100; i++) {
      seq1.push(rng1());
      seq2.push(rng2());
    }

    // At least some values should differ
    const hasDifference = seq1.some((v, i) => v !== seq2[i]);
    expect(hasDifference).toBe(true);
  });

  it("handles seed 0 without throwing or producing NaN/Infinity", () => {
    const rng = createRng(0);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(Number.isNaN(v)).toBe(false);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("handles negative seeds", () => {
    const rng = createRng(-42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("handles large seeds", () => {
    const rng = createRng(2147483647);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("rr", () => {
  it("returns values in [min, max)", () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rr(rng, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it("is deterministic for the same seed", () => {
    const rng1 = createRng(7);
    const rng2 = createRng(7);

    for (let i = 0; i < 100; i++) {
      expect(rr(rng1, 0, 100)).toBe(rr(rng2, 0, 100));
    }
  });

  it("handles equal min and max (returns min)", () => {
    const rng = createRng(1);
    expect(rr(rng, 5, 5)).toBe(5);
  });

  it("handles negative ranges", () => {
    const rng = createRng(42);
    for (let i = 0; i < 100; i++) {
      const v = rr(rng, -10, -5);
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThan(-5);
    }
  });
});

describe("Rng type", () => {
  it("type is compatible with createRng return value", () => {
    const rng: Rng = createRng(42);
    const value: number = rng();
    expect(typeof value).toBe("number");
  });
});
