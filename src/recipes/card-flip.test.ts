import { getCardFlipParams } from "./card-flip-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-flip",
  (rng: Rng) => getCardFlipParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 800, max: 2500 },
    { name: "filterQ", min: 1.5, max: 5 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.03, max: 0.12 },
    { name: "noiseLevel", min: 0.5, max: 0.9 },
    { name: "clickFreq", min: 600, max: 1200 },
    { name: "clickLevel", min: 0.3, max: 0.7 },
  ],
);
