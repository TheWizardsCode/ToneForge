import { getCardChipStackParams } from "./card-chip-stack-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-chip-stack",
  (rng: Rng) => getCardChipStackParams(rng) as unknown as Record<string, number>,
  [
    { name: "clickFreq", min: 1500, max: 4000 },
    { name: "clickQ", min: 2, max: 8 },
    { name: "clickLevel", min: 0.5, max: 0.9 },
    { name: "ringFreq", min: 800, max: 2000 },
    { name: "ringLevel", min: 0.2, max: 0.5 },
    { name: "attack", min: 0.001, max: 0.003 },
    { name: "clickDecay", min: 0.02, max: 0.08 },
    { name: "ringDecay", min: 0.05, max: 0.2 },
  ],
);
