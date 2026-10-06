import { describe, it, expect } from "vitest";
import { getWeaponLaserZapParams } from "./weapon-laser-zap-params.js";
import {
  assertOverrideChangesOutput,
  describeRecipe,
} from "../test-utils/recipe-test-helper.js";
import { renderPreset } from "../core/renderer.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";
import type { Rng } from "../core/rng.js";

const OVERRIDE_SEED = 4321;

describeRecipe(
  "weapon-laser-zap",
  (rng: Rng) => getWeaponLaserZapParams(rng) as unknown as Record<string, number>,
  [
    { name: "carrierFreq", min: 200, max: 2000 },
    { name: "modulatorFreq", min: 50, max: 500 },
    { name: "modIndex", min: 1, max: 10 },
    { name: "noiseBurstLevel", min: 0.1, max: 0.5 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.03, max: 0.25 },
  ],
  () => {
    // One explicit assertion per parameter honoured by the declarative
    // override mappings in weapon-laser-zap.yaml (parent AC6).
    it("honours the carrierFreq override", async () => {
      await assertOverrideChangesOutput("weapon-laser-zap", "carrierFreq", 2000, OVERRIDE_SEED);
    });

    it("honours the modulatorFreq override", async () => {
      await assertOverrideChangesOutput("weapon-laser-zap", "modulatorFreq", 500, OVERRIDE_SEED);
    });

    it("honours the modIndex override", async () => {
      await assertOverrideChangesOutput("weapon-laser-zap", "modIndex", 10, OVERRIDE_SEED);
    });

    it("keeps the modIndex mapping deterministic and non-silent", async () => {
      // `modDepth.gain = modIndex * modulator.frequency`; verify the computed
      // mapping renders deterministically.
      const overridden = await renderPreset({
        recipe: "weapon-laser-zap",
        seed: OVERRIDE_SEED,
        overrides: { modIndex: 10 },
      });
      const repeat = await renderPreset({
        recipe: "weapon-laser-zap",
        seed: OVERRIDE_SEED,
        overrides: { modIndex: 10 },
      });

      expect(compareBuffers(overridden.samples, repeat.samples).identical).toBe(true);
      expect(overridden.samples.some((sample) => sample !== 0)).toBe(true);
    });
  },
);
