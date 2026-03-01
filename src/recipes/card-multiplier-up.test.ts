import { getCardMultiplierUpParams } from "./card-multiplier-up-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-multiplier-up",
  (rng: Rng) => getCardMultiplierUpParams(rng) as unknown as Record<string, number>,
  [
    { name: "baseFreq", min: 500, max: 1000 },
    { name: "intervalRatio", min: 1.15, max: 1.5 },
    { name: "noteCount", min: 2, max: 5 },
    { name: "noteDuration", min: 0.04, max: 0.1 },
    { name: "attack", min: 0.002, max: 0.01 },
    { name: "level", min: 0.5, max: 0.9 },
  ],
);
