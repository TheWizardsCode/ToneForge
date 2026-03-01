import { getCardCoinSpendParams } from "./card-coin-spend-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-coin-spend",
  (rng: Rng) => getCardCoinSpendParams(rng) as unknown as Record<string, number>,
  [
    { name: "baseFreq", min: 500, max: 1000 },
    { name: "pitchDrop", min: 150, max: 500 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.08, max: 0.3 },
    { name: "toneLevel", min: 0.4, max: 0.8 },
    { name: "filterCutoff", min: 1000, max: 3000 },
    { name: "noiseLevel", min: 0.05, max: 0.2 },
  ],
);
