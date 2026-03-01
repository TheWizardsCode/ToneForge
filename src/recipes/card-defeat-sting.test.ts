import { getCardDefeatStingParams } from "./card-defeat-sting-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-defeat-sting",
  (rng: Rng) => getCardDefeatStingParams(rng) as unknown as Record<string, number>,
  [
    { name: "startFreq", min: 400, max: 700 },
    { name: "dropRatio", min: 0.75, max: 0.9 },
    { name: "noteDuration", min: 0.3, max: 0.6 },
    { name: "noteAttack", min: 0.005, max: 0.02 },
    { name: "filterStart", min: 2000, max: 4000 },
    { name: "filterEnd", min: 200, max: 600 },
    { name: "level", min: 0.5, max: 0.9 },
    { name: "tailDecay", min: 0.5, max: 1.2 },
  ],
);
