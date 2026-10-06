import { describe, it, expect } from "vitest";
import { getImpactCrackParams } from "./impact-crack-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";
import { renderPreset, renderRecipe } from "../core/renderer.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";

const OVERRIDE_SEED = 4321;

describeRecipe(
  "impact-crack",
  (rng: Rng) => getImpactCrackParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 2000, max: 6000 },
    { name: "filterQ", min: 0.5, max: 3 },
    { name: "attack", min: 0.001, max: 0.003 },
    { name: "decay", min: 0.04, max: 0.1 },
    { name: "level", min: 0.7, max: 1.0 },
    { name: "noiseColorMix", min: 0.0, max: 1.0 },
  ],
  () => {
    it("honours the noiseColorMix override (white -> pink changes output)", async () => {
      const base = await renderRecipe("impact-crack", OVERRIDE_SEED);
      const pink = await renderPreset({
        recipe: "impact-crack",
        seed: OVERRIDE_SEED,
        overrides: { noiseColorMix: 1 },
      });

      expect(compareBuffers(base.samples, pink.samples).identical).toBe(false);
    });

    it("renders non-silent audio at both noiseColorMix extremes", async () => {
      for (const noiseColorMix of [0, 1]) {
        const result = await renderPreset({
          recipe: "impact-crack",
          seed: OVERRIDE_SEED,
          overrides: { noiseColorMix },
        });
        expect(
          result.samples.some((sample) => sample !== 0),
          `noiseColorMix=${noiseColorMix} should render non-silent audio`,
        ).toBe(true);
      }
    });
  },
);
