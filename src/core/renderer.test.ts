import { describe, it, expect } from "vitest";
import { renderRecipe } from "./renderer.js";
import {
  compareBuffers,
  formatCompareResult,
} from "../test-utils/buffer-compare.js";

describe("renderRecipe", () => {
  it("returns a RenderResult with sample data", async () => {
    const result = await renderRecipe("ui-scifi-confirm", 42);

    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.sampleRate).toBe(44100);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.numberOfChannels).toBe(1);
  });

  it("throws for unknown recipe", async () => {
    await expect(renderRecipe("nonexistent", 42)).rejects.toThrow(
      "Recipe not found: nonexistent",
    );
  });

  it("renders seed 42 ten times with byte-identical output", async () => {
    const buffers: Float32Array[] = [];

    for (let i = 0; i < 10; i++) {
      const result = await renderRecipe("ui-scifi-confirm", 42);
      buffers.push(result.samples);
    }

    // Compare each buffer against the first
    const reference = buffers[0]!;
    for (let i = 1; i < buffers.length; i++) {
      const comparison = compareBuffers(reference, buffers[i]!);
      expect(
        comparison.identical,
        `Render ${i} diverged from reference:\n${formatCompareResult(comparison)}`,
      ).toBe(true);
    }
  });

  it("produces different sample data for different seeds", async () => {
    const result1 = await renderRecipe("ui-scifi-confirm", 1, 0.5);
    const result2 = await renderRecipe("ui-scifi-confirm", 2, 0.5);

    const comparison = compareBuffers(result1.samples, result2.samples);
    expect(comparison.identical).toBe(false);
  });

  it("completes rendering in under 2 seconds for a 0.5s sound", async () => {
    const start = performance.now();
    await renderRecipe("ui-scifi-confirm", 42, 0.5);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });

  it("renders non-silent audio", async () => {
    const result = await renderRecipe("ui-scifi-confirm", 42);
    const nonZero = result.samples.filter((s) => s !== 0).length;
    expect(nonZero).toBeGreaterThan(0);
  });

  it("supports explicit duration override", async () => {
    const result = await renderRecipe("ui-scifi-confirm", 42, 1.0);
    const expectedLength = Math.ceil(44100 * 1.0);
    expect(result.samples.length).toBe(expectedLength);
    expect(result.duration).toBe(1.0);
  });
});

describe("buffer-compare", () => {
  it("reports identical buffers correctly", () => {
    const a = new Float32Array([0.1, 0.2, 0.3]);
    const b = new Float32Array([0.1, 0.2, 0.3]);
    const result = compareBuffers(a, b);

    expect(result.identical).toBe(true);
    expect(result.firstDivergentIndex).toBe(-1);
    expect(result.delta).toBe(0);
  });

  it("reports first divergent sample with diagnostic info", () => {
    const a = new Float32Array([0.1, 0.2, 0.3]);
    const b = new Float32Array([0.1, 0.5, 0.3]);
    const result = compareBuffers(a, b);

    expect(result.identical).toBe(false);
    expect(result.firstDivergentIndex).toBe(1);
    expect(result.valueA).toBeCloseTo(0.2);
    expect(result.valueB).toBeCloseTo(0.5);
    expect(result.delta).toBeCloseTo(0.3);
  });

  it("handles different length buffers", () => {
    const a = new Float32Array([0.1, 0.2]);
    const b = new Float32Array([0.1, 0.2, 0.3]);
    const result = compareBuffers(a, b);

    expect(result.identical).toBe(false);
  });

  it("formats diagnostic output", () => {
    const a = new Float32Array([0.1, 0.2, 0.3]);
    const b = new Float32Array([0.1, 0.5, 0.3]);
    const result = compareBuffers(a, b);
    const formatted = formatCompareResult(result);

    expect(formatted).toContain("sample 1");
    expect(formatted).toContain("delta");
  });
});
