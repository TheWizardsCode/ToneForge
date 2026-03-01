import { getCardSuccessParams } from "./card-success-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-success",
  (rng: Rng) => getCardSuccessParams(rng) as unknown as Record<string, number>,
  [
    { name: "baseFreq", min: 600, max: 1100 },
    { name: "intervalRatio", min: 1.2, max: 1.5 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.1, max: 0.4 },
    { name: "primaryLevel", min: 0.5, max: 0.9 },
    { name: "secondaryLevel", min: 0.3, max: 0.6 },
  ],
);
