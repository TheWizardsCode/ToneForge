import { describe, it, expect } from "vitest";
import { getAmbientWindGustParams } from "./ambient-wind-gust-params.js";
import {
  assertOverrideChangesOutput,
  describeRecipe,
} from "../test-utils/recipe-test-helper.js";
import { createRng } from "../core/rng.js";
import { renderPreset, renderRecipe } from "../core/renderer.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";
import type { Rng } from "../core/rng.js";

const OVERRIDE_SEED = 4321;

describeRecipe(
  "ambient-wind-gust",
  (rng: Rng) => getAmbientWindGustParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 200, max: 1500 },
    { name: "filterQ", min: 0.5, max: 3.0 },
    { name: "lfoRate", min: 0.5, max: 4.0 },
    { name: "lfoDepth", min: 100, max: 800 },
    { name: "attack", min: 0.1, max: 0.5 },
    { name: "sustain", min: 0.2, max: 1.0 },
    { name: "release", min: 0.2, max: 0.8 },
    { name: "level", min: 0.3, max: 0.8 },
  ],
  () => {
    // One explicit assertion per parameter that the declarative override
    // mappings in ambient-wind-gust.yaml now honour (parent AC6).
    it("honours the filterFreq override", async () => {
      await assertOverrideChangesOutput("ambient-wind-gust", "filterFreq", 1500, OVERRIDE_SEED);
    });

    it("honours the lfoRate override", async () => {
      await assertOverrideChangesOutput("ambient-wind-gust", "lfoRate", 4, OVERRIDE_SEED);
    });

    it("honours the lfoDepth override", async () => {
      await assertOverrideChangesOutput("ambient-wind-gust", "lfoDepth", 100, OVERRIDE_SEED);
    });

    it("applies the lfoDepth mapping as half the declared depth", async () => {
      // The YAML automation `depth` is `lfoDepth / 2`; verify the rendered
      // output changes and stays deterministic and non-silent.
      const overridden = await renderPreset({
        recipe: "ambient-wind-gust",
        seed: OVERRIDE_SEED,
        overrides: { lfoDepth: 800 },
      });
      const repeat = await renderPreset({
        recipe: "ambient-wind-gust",
        seed: OVERRIDE_SEED,
        overrides: { lfoDepth: 800 },
      });

      expect(compareBuffers(overridden.samples, repeat.samples).identical).toBe(true);
      expect(overridden.samples.some((sample) => sample !== 0)).toBe(true);

      const base = await renderRecipe("ambient-wind-gust", OVERRIDE_SEED);
      expect(compareBuffers(base.samples, overridden.samples).identical).toBe(false);
    });
  },
);
