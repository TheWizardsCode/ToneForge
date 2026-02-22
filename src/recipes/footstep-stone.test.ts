import { getFootstepStoneParams } from "./footstep-stone-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "footstep-stone",
  (rng: Rng) => getFootstepStoneParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 400, max: 2000 },
    { name: "filterQ", min: 1, max: 8 },
    { name: "transientAttack", min: 0.001, max: 0.005 },
    { name: "bodyDecay", min: 0.03, max: 0.15 },
    { name: "tailDecay", min: 0.02, max: 0.08 },
    { name: "bodyLevel", min: 0.5, max: 1.0 },
    { name: "tailLevel", min: 0.1, max: 0.4 },
  ],
);
