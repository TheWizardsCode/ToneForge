import { getCardUnlockParams } from "./card-unlock-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-unlock",
  (rng: Rng) => getCardUnlockParams(rng) as unknown as Record<string, number>,
  [
    { name: "clickFreq", min: 2000, max: 5000 },
    { name: "clickLevel", min: 0.4, max: 0.8 },
    { name: "filterStart", min: 200, max: 600 },
    { name: "filterEnd", min: 3000, max: 6000 },
    { name: "noiseLevel", min: 0.3, max: 0.6 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.05, max: 0.2 },
  ],
);
