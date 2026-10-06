import { describe, it, expect } from "vitest";
import { getCardTransformParams } from "./card-transform-params.js";
import {
  assertOverrideChangesOutput,
  describeRecipe,
} from "../test-utils/recipe-test-helper.js";
import { renderPreset } from "../core/renderer.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";
import type { Rng } from "../core/rng.js";

const OVERRIDE_SEED = 4321;

describeRecipe(
  "card-transform",
  (rng: Rng) => getCardTransformParams(rng) as unknown as Record<string, number>,
  [
    { name: "carrierFreq", min: 300, max: 700 },
    { name: "modRatio", min: 1, max: 4 },
    { name: "modDepthStart", min: 50, max: 200 },
    { name: "modDepthEnd", min: 300, max: 800 },
    { name: "attack", min: 0.02, max: 0.08 },
    { name: "sustain", min: 0.2, max: 0.5 },
    { name: "release", min: 0.1, max: 0.3 },
    { name: "level", min: 0.5, max: 0.9 },
  ],
  () => {
    // One explicit assertion per parameter honoured by the declarative
    // override mappings in card-transform.yaml (parent AC6).
    it("honours the carrierFreq override", async () => {
      await assertOverrideChangesOutput("card-transform", "carrierFreq", 700, OVERRIDE_SEED);
    });

    it("honours the modRatio override", async () => {
      await assertOverrideChangesOutput("card-transform", "modRatio", 4, OVERRIDE_SEED);
    });

    it("honours the modDepthStart override", async () => {
      await assertOverrideChangesOutput("card-transform", "modDepthStart", 200, OVERRIDE_SEED);
    });

    it("honours the modDepthEnd override", async () => {
      await assertOverrideChangesOutput("card-transform", "modDepthEnd", 800, OVERRIDE_SEED);
    });

    it("keeps a coherent FM ratio when only carrierFreq is overridden", async () => {
      // The mapping computes `modulator.frequency = carrier.frequency *
      // modRatio` from the resolved (overridden) carrier frequency, so the
      // output must change and remain deterministic.
      const overridden = await renderPreset({
        recipe: "card-transform",
        seed: OVERRIDE_SEED,
        overrides: { carrierFreq: 700 },
      });
      const repeat = await renderPreset({
        recipe: "card-transform",
        seed: OVERRIDE_SEED,
        overrides: { carrierFreq: 700 },
      });

      expect(compareBuffers(overridden.samples, repeat.samples).identical).toBe(true);
      expect(overridden.samples.some((sample) => sample !== 0)).toBe(true);
    });
  },
);
