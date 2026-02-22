import { getWeaponLaserZapParams } from "./weapon-laser-zap-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

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
);
