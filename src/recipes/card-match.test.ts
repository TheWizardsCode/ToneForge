import { getCardMatchParams } from "./card-match-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-match",
  (rng: Rng) => getCardMatchParams(rng) as unknown as Record<string, number>,
  [
    { name: "tone1Freq", min: 700, max: 1400 },
    { name: "tone2Ratio", min: 1.25, max: 1.6 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.08, max: 0.2 },
    { name: "tone2Delay", min: 0.04, max: 0.1 },
    { name: "level", min: 0.5, max: 0.9 },
  ],
);
