import { getFootstepGravelParams } from "./footstep-gravel-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "footstep-gravel",
  (rng: Rng) => getFootstepGravelParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 300, max: 1800 },
    { name: "transientAttack", min: 0.001, max: 0.005 },
    { name: "bodyDecay", min: 0.05, max: 0.25 },
    { name: "tailDecay", min: 0.04, max: 0.15 },
    { name: "mixLevel", min: 0.3, max: 0.7 },
    { name: "bodyLevel", min: 0.4, max: 0.9 },
    { name: "tailLevel", min: 0.1, max: 0.4 },
  ],
);
