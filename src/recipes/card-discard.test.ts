import { getCardDiscardParams } from "./card-discard-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-discard",
  (rng: Rng) => getCardDiscardParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 600, max: 2000 },
    { name: "filterQ", min: 1, max: 4 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.04, max: 0.15 },
    { name: "noiseLevel", min: 0.4, max: 0.8 },
    { name: "thudFreq", min: 100, max: 300 },
    { name: "thudLevel", min: 0.2, max: 0.5 },
  ],
);
