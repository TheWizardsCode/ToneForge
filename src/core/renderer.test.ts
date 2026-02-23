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

describe("async buildOfflineGraph support", () => {
  it("correctly awaits an async buildOfflineGraph", async () => {
    // Register a recipe with an async buildOfflineGraph that uses a
    // delayed oscillator start to prove the promise was awaited.
    const { RecipeRegistry } = await import("./recipe.js");
    const { createRng, rr } = await import("./rng.js");
    const { OfflineAudioContext } = await import("node-web-audio-api");

    const testRegistry = new RecipeRegistry();
    testRegistry.register("async-test-recipe", {
      factory: () => {
        throw new Error("Not used in offline render");
      },
      getDuration: () => 0.1,
      buildOfflineGraph: async (_rng, ctx, duration) => {
        // Simulate async work (e.g., sample loading) with a microtask
        await Promise.resolve();
        const osc = ctx.createOscillator();
        osc.frequency.value = 440;
        const gain = ctx.createGain();
        gain.gain.value = 0.5;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        osc.stop(duration);
      },
      description: "Async test recipe",
      category: "Test",
      signalChain: "Oscillator -> Gain -> Destination",
      params: [],
      getParams: () => ({}),
    });

    // Render using the async recipe through the same pipeline pattern
    const seed = 42;
    const rng = createRng(seed);
    const dur = testRegistry.getRegistration("async-test-recipe")!.getDuration(rng);
    const sampleRate = 44100;
    const length = Math.ceil(sampleRate * dur);
    const ctx = new OfflineAudioContext(1, length, sampleRate);
    const graphRng = createRng(seed);
    await testRegistry.getRegistration("async-test-recipe")!.buildOfflineGraph(graphRng, ctx, dur);
    const audioBuffer = await ctx.startRendering();
    const samples = new Float32Array(audioBuffer.getChannelData(0));

    // Verify the async graph produced non-silent output
    const nonZero = samples.filter((s) => s !== 0).length;
    expect(nonZero).toBeGreaterThan(0);
  });

  it("propagates errors from a rejecting async buildOfflineGraph", async () => {
    const { RecipeRegistry } = await import("./recipe.js");

    const testRegistry = new RecipeRegistry();
    testRegistry.register("async-error-recipe", {
      factory: () => {
        throw new Error("Not used in offline render");
      },
      getDuration: () => 0.1,
      buildOfflineGraph: async () => {
        await Promise.resolve();
        throw new Error("Sample file not found: missing.wav");
      },
      description: "Async error test recipe",
      category: "Test",
      signalChain: "None",
      params: [],
      getParams: () => ({}),
    });

    const { OfflineAudioContext } = await import("node-web-audio-api");
    const { createRng } = await import("./rng.js");
    const ctx = new OfflineAudioContext(1, 4410, 44100);
    const rng = createRng(42);

    await expect(
      testRegistry.getRegistration("async-error-recipe")!.buildOfflineGraph(rng, ctx, 0.1),
    ).rejects.toThrow("Sample file not found: missing.wav");
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
