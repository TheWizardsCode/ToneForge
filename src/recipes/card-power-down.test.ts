import { getCardPowerDownParams } from "./card-power-down-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-power-down",
  (rng: Rng) => getCardPowerDownParams(rng) as unknown as Record<string, number>,
  [
    { name: "freqStart", min: 800, max: 1600 },
    { name: "freqEnd", min: 200, max: 500 },
    { name: "filterCutoff", min: 2000, max: 5000 },
    { name: "attack", min: 0.005, max: 0.02 },
    { name: "decay", min: 0.2, max: 0.5 },
    { name: "level", min: 0.5, max: 0.9 },
    { name: "noiseLevel", min: 0.05, max: 0.2 },
  ],
);
