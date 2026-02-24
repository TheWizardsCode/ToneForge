import { getSlamTransientParams } from "./slam-transient-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "slam-transient",
  (rng: Rng) => getSlamTransientParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 300, max: 1200 },
    { name: "filterQ", min: 2, max: 8 },
    { name: "attack", min: 0.001, max: 0.003 },
    { name: "decay", min: 0.025, max: 0.07 },
    { name: "level", min: 0.7, max: 1.0 },
    { name: "clickLevel", min: 0.3, max: 0.7 },
    { name: "clickFreq", min: 3000, max: 6000 },
  ],
);
