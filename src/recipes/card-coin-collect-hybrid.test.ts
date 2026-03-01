import { getCardCoinCollectHybridParams } from "./card-coin-collect-hybrid-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-coin-collect-hybrid",
  (rng: Rng) => getCardCoinCollectHybridParams(rng) as unknown as Record<string, number>,
  [
    { name: "baseFreq", min: 900, max: 1800 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.1, max: 0.35 },
    { name: "mixLevel", min: 0.3, max: 0.7 },
    { name: "synthLevel", min: 0.4, max: 0.8 },
    { name: "filterCutoff", min: 3000, max: 8000 },
    { name: "shimmerLevel", min: 0.1, max: 0.35 },
  ],
);
