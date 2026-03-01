import { getCardBurnParams } from "./card-burn-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-burn",
  (rng: Rng) => getCardBurnParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterStart", min: 3000, max: 8000 },
    { name: "filterEnd", min: 200, max: 800 },
    { name: "attack", min: 0.005, max: 0.02 },
    { name: "decay", min: 0.3, max: 0.7 },
    { name: "noiseLevel", min: 0.4, max: 0.8 },
    { name: "crackleLevel", min: 0.1, max: 0.4 },
    { name: "rumbleFreq", min: 60, max: 150 },
    { name: "rumbleLevel", min: 0.1, max: 0.3 },
  ],
);
