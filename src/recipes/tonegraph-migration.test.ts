import { describe, it, expect } from "vitest";
import { OfflineAudioContext } from "node-web-audio-api";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RecipeRegistry, discoverFileBackedRecipes, type RecipeRegistration } from "../core/recipe.js";
import { createRng } from "../core/rng.js";

const PRESETS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "presets", "recipes");
const SAMPLE_RATE = 44100;

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
  const frameCount = Math.ceil(SAMPLE_RATE * duration);
  const ctx = new OfflineAudioContext(1, frameCount, SAMPLE_RATE);
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

describe("ToneGraph recipe migrations", () => {
  it("discovers all migrated YAML recipes", async () => {
    const fileBackedRegistry = new RecipeRegistry();
    const discovered = await discoverFileBackedRecipes(fileBackedRegistry, { recipeDirectory: PRESETS_DIR });

    expect(discovered.sort()).toEqual([...MIGRATED].sort());

    for (const recipeName of MIGRATED) {
      const fileBacked = fileBackedRegistry.getRegistration(recipeName);
      expect(fileBacked, `${recipeName} should be discovered from presets/recipes`).toBeDefined();
      expect(fileBacked!.params.length).toBeGreaterThan(0);
    }
  });

  it("renders file-backed recipes with expected structure", async () => {
    const fileBackedRegistry = new RecipeRegistry();
    await discoverFileBackedRecipes(fileBackedRegistry, { recipeDirectory: PRESETS_DIR });

    for (const recipeName of MIGRATED) {
      const fileBacked = fileBackedRegistry.getRegistration(recipeName)!;

      const fileRender = await renderRegistration(fileBacked, 42);

      expect(fileRender.samples.some((sample) => sample !== 0)).toBe(true);
      expect(fileRender.peak).toBeGreaterThan(0.01);
      expect(fileRender.duration).toBeGreaterThan(0);
    }
  });

  it("keeps ui-scifi-confirm deterministic at seed 42", async () => {
    const fileBackedRegistry = new RecipeRegistry();
    await discoverFileBackedRecipes(fileBackedRegistry, { recipeDirectory: PRESETS_DIR });

    const fileBacked = fileBackedRegistry.getRegistration("ui-scifi-confirm")!;
    const runA = await renderRegistration(fileBacked, 42);
    const runB = await renderRegistration(fileBacked, 42);

    expect(runA.samples.length).toBe(runB.samples.length);
    for (let i = 0; i < runA.samples.length; i += 1) {
      expect(runA.samples[i]).toBe(runB.samples[i]);
    }
  });
});
