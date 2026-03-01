import { getCardPowerUpParams } from "./card-power-up-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-power-up",
  (rng: Rng) => getCardPowerUpParams(rng) as unknown as Record<string, number>,
  [
    { name: "freqStart", min: 300, max: 600 },
    { name: "freqEnd", min: 800, max: 1600 },
    { name: "harmonicRatio", min: 1.5, max: 3 },
    { name: "harmonicLevel", min: 0.2, max: 0.5 },
    { name: "attack", min: 0.01, max: 0.04 },
    { name: "decay", min: 0.15, max: 0.4 },
    { name: "level", min: 0.5, max: 0.9 },
  ],
);
