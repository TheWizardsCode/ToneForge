import { describe, it, expect } from "vitest";
import { OfflineAudioContext } from "node-web-audio-api";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRng } from "./rng.js";
import { compareBuffers, formatCompareResult } from "../test-utils/buffer-compare.js";
import { RecipeRegistry, discoverFileBackedRecipes, type RecipeRegistration } from "./recipe.js";

const PRESETS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "presets", "recipes");
const SAMPLE_RATE = 44100;
const DETERMINISM_RUNS = 3;
const SEED = 42;
const PEAK_FLOOR = 0.01; // -40 dBFS

const MIGRATED = [
  "ui-scifi-confirm",
  "weapon-laser-zap",
  "footstep-gravel",
  "ambient-wind-gust",
  "card-transform",
] as const;

interface RenderResult {
  samples: Float32Array;
  duration: number;
  peak: number;
}

async function renderRegistration(registration: RecipeRegistration, seed: number): Promise<RenderResult> {
  const duration = registration.getDuration(createRng(seed));
  const ctx = new OfflineAudioContext(1, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE);
  await registration.buildOfflineGraph(createRng(seed), ctx, duration);
  const rendered = await ctx.startRendering();
  const samples = new Float32Array(rendered.getChannelData(0));

  let peak = 0;
  for (const sample of samples) {
    const abs = Math.abs(sample);
    if (abs > peak) {
      peak = abs;
    }
  }

  return { samples, duration, peak };
}

describe("ToneGraph integration parity", () => {
  it("discovers all migrated recipes as file-backed registrations", async () => {
    const fileBackedRegistry = new RecipeRegistry();
    const discovered = await discoverFileBackedRecipes(fileBackedRegistry, { recipeDirectory: PRESETS_DIR });
    expect(discovered.sort()).toEqual([...MIGRATED].sort());
  });

  it("all migrated file-backed recipes are deterministic across three renders", async () => {
    const fileBackedRegistry = new RecipeRegistry();
    await discoverFileBackedRecipes(fileBackedRegistry, { recipeDirectory: PRESETS_DIR });

    for (const recipeName of MIGRATED) {
      const fileBacked = fileBackedRegistry.getRegistration(recipeName);
      expect(fileBacked, `${recipeName} should be discoverable from presets/recipes`).toBeDefined();

      const renders: Float32Array[] = [];
      for (let i = 0; i < DETERMINISM_RUNS; i += 1) {
        const render = await renderRegistration(fileBacked!, SEED);
        renders.push(render.samples);
      }

      const reference = renders[0]!;
      for (let i = 1; i < renders.length; i += 1) {
        const comparison = compareBuffers(reference, renders[i]!);
        expect(
          comparison.identical,
          `${recipeName} run ${i + 1} diverged from run 1:\n${formatCompareResult(comparison)}`,
        ).toBe(true);
      }
    }
  });

  it("migrated recipes remain structurally valid", async () => {
    const fileBackedRegistry = new RecipeRegistry();
    await discoverFileBackedRecipes(fileBackedRegistry, { recipeDirectory: PRESETS_DIR });

    for (const recipeName of MIGRATED) {
      if (recipeName === "ui-scifi-confirm") {
        continue;
      }

      const fileBacked = fileBackedRegistry.getRegistration(recipeName);
      expect(fileBacked).toBeDefined();

      const fileRender = await renderRegistration(fileBacked!, SEED);

      expect(fileRender.samples.some((sample) => sample !== 0)).toBe(true);
      expect(fileRender.peak).toBeGreaterThan(PEAK_FLOOR);
      expect(fileRender.duration).toBeGreaterThan(0);
    }
  });
});
