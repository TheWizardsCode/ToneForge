import { getCardVictoryFanfareParams } from "./card-victory-fanfare-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-victory-fanfare",
  (rng: Rng) => getCardVictoryFanfareParams(rng) as unknown as Record<string, number>,
  [
    { name: "baseFreq", min: 400, max: 800 },
    { name: "noteCount", min: 3, max: 7 },
    { name: "noteDuration", min: 0.15, max: 0.35 },
    { name: "noteAttack", min: 0.005, max: 0.02 },
    { name: "stepRatio", min: 1.1, max: 1.26 },
    { name: "primaryLevel", min: 0.5, max: 0.85 },
    { name: "harmonicLevel", min: 0.2, max: 0.5 },
    { name: "tailDecay", min: 0.3, max: 0.8 },
  ],
);
