import { getCardTokenEarnParams } from "./card-token-earn-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-token-earn",
  (rng: Rng) => getCardTokenEarnParams(rng) as unknown as Record<string, number>,
  [
    { name: "baseFreq", min: 600, max: 1400 },
    { name: "harmonic2Ratio", min: 1.9, max: 2.1 },
    { name: "harmonic3Ratio", min: 2.9, max: 3.1 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.1, max: 0.35 },
    { name: "fundamentalLevel", min: 0.5, max: 0.9 },
    { name: "harmonic2Level", min: 0.2, max: 0.5 },
    { name: "harmonic3Level", min: 0.1, max: 0.3 },
  ],
);
