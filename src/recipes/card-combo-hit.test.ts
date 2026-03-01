import { getCardComboHitParams } from "./card-combo-hit-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-combo-hit",
  (rng: Rng) => getCardComboHitParams(rng) as unknown as Record<string, number>,
  [
    { name: "freq", min: 600, max: 1200 },
    { name: "harmonicRatio", min: 1.5, max: 3 },
    { name: "harmonicLevel", min: 0.3, max: 0.6 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.05, max: 0.15 },
    { name: "level", min: 0.5, max: 0.9 },
    { name: "brightnessFreq", min: 3000, max: 7000 },
  ],
);
