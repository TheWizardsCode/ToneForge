import { getRumbleBodyParams } from "./rumble-body-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "rumble-body",
  (rng: Rng) => getRumbleBodyParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 60, max: 200 },
    { name: "filterQ", min: 0.5, max: 2.5 },
    { name: "attack", min: 0.005, max: 0.02 },
    { name: "sustainDecay", min: 0.4, max: 1.2 },
    { name: "tailDecay", min: 0.1, max: 0.3 },
    { name: "level", min: 0.6, max: 1.0 },
    { name: "subBassFreq", min: 30, max: 60 },
    { name: "subBassLevel", min: 0.2, max: 0.5 },
  ],
);
