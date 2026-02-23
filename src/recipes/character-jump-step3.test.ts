import { getCharacterJumpStep3Params } from "./character-jump-step3-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "character-jump-step3",
  (rng: Rng) => getCharacterJumpStep3Params(rng) as unknown as Record<string, number>,
  [
    { name: "baseFreq", min: 300, max: 600 },
    { name: "sweepRange", min: 200, max: 800 },
    { name: "sweepDuration", min: 0.05, max: 0.15 },
    { name: "attack", min: 0.002, max: 0.01 },
    { name: "decay", min: 0.05, max: 0.2 },
  ],
);
