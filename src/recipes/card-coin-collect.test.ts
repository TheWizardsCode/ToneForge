import { getCardCoinCollectParams } from "./card-coin-collect-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-coin-collect",
  (rng: Rng) => getCardCoinCollectParams(rng) as unknown as Record<string, number>,
  [
    { name: "baseFreq", min: 800, max: 2000 },
    { name: "pitchSweep", min: 200, max: 800 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.08, max: 0.3 },
    { name: "toneLevel", min: 0.5, max: 0.9 },
    { name: "harmonicLevel", min: 0.2, max: 0.5 },
    { name: "noiseLevel", min: 0.1, max: 0.4 },
  ],
);
