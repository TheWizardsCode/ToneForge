import { getCardFanParams } from "./card-fan-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-fan",
  (rng: Rng) => getCardFanParams(rng) as unknown as Record<string, number>,
  [
    { name: "baseFreq", min: 400, max: 900 },
    { name: "sweepRange", min: 200, max: 600 },
    { name: "attack", min: 0.002, max: 0.008 },
    { name: "decay", min: 0.08, max: 0.25 },
    { name: "filterCutoff", min: 1500, max: 4000 },
    { name: "noiseLevel", min: 0.1, max: 0.3 },
    { name: "sweepLevel", min: 0.4, max: 0.8 },
  ],
);
