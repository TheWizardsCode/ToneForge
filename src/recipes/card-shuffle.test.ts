import { getCardShuffleParams } from "./card-shuffle-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-shuffle",
  (rng: Rng) => getCardShuffleParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 600, max: 2000 },
    { name: "filterQ", min: 1, max: 4 },
    { name: "attack", min: 0.002, max: 0.008 },
    { name: "decay", min: 0.15, max: 0.4 },
    { name: "grainRate", min: 20, max: 60 },
    { name: "grainDepth", min: 0.3, max: 0.8 },
    { name: "noiseLevel", min: 0.5, max: 0.9 },
  ],
);
