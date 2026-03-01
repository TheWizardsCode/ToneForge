import { getCardDrawParams } from "./card-draw-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-draw",
  (rng: Rng) => getCardDrawParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 1200, max: 3000 },
    { name: "filterQ", min: 0.5, max: 2.5 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.04, max: 0.15 },
    { name: "noiseLevel", min: 0.3, max: 0.7 },
    { name: "sweepBaseFreq", min: 400, max: 800 },
    { name: "sweepRange", min: 200, max: 600 },
    { name: "sweepLevel", min: 0.3, max: 0.6 },
  ],
);
