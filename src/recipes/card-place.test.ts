import { getCardPlaceParams } from "./card-place-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-place",
  (rng: Rng) => getCardPlaceParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 300, max: 900 },
    { name: "filterQ", min: 1, max: 4 },
    { name: "attack", min: 0.001, max: 0.004 },
    { name: "bodyDecay", min: 0.03, max: 0.1 },
    { name: "bodyLevel", min: 0.5, max: 0.9 },
    { name: "clickFreq", min: 400, max: 800 },
    { name: "clickLevel", min: 0.15, max: 0.4 },
  ],
);
