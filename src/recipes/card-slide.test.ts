import { getCardSlideParams } from "./card-slide-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-slide",
  (rng: Rng) => getCardSlideParams(rng) as unknown as Record<string, number>,
  [
    { name: "startFreq", min: 500, max: 1000 },
    { name: "sweepRange", min: 100, max: 400 },
    { name: "attack", min: 0.001, max: 0.008 },
    { name: "decay", min: 0.06, max: 0.2 },
    { name: "filterCutoff", min: 1000, max: 3000 },
    { name: "noiseLevel", min: 0.1, max: 0.35 },
  ],
);
