import { getCardLockParams } from "./card-lock-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-lock",
  (rng: Rng) => getCardLockParams(rng) as unknown as Record<string, number>,
  [
    { name: "clickFreq", min: 1500, max: 4000 },
    { name: "clickLevel", min: 0.4, max: 0.8 },
    { name: "filterStart", min: 3000, max: 6000 },
    { name: "filterEnd", min: 200, max: 600 },
    { name: "noiseLevel", min: 0.3, max: 0.6 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.05, max: 0.2 },
  ],
);
