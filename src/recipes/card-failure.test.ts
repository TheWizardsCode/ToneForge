import { getCardFailureParams } from "./card-failure-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-failure",
  (rng: Rng) => getCardFailureParams(rng) as unknown as Record<string, number>,
  [
    { name: "startFreq", min: 500, max: 900 },
    { name: "sweepDrop", min: 100, max: 300 },
    { name: "detuneOffset", min: 15, max: 50 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.15, max: 0.5 },
    { name: "primaryLevel", min: 0.5, max: 0.9 },
    { name: "secondaryLevel", min: 0.2, max: 0.5 },
  ],
);
