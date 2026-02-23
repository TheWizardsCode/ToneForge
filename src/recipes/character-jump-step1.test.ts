import { getCharacterJumpStep1Params } from "./character-jump-step1-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "character-jump-step1",
  (rng: Rng) => getCharacterJumpStep1Params(rng) as unknown as Record<string, number>,
  [
    { name: "baseFreq", min: 300, max: 600 },
  ],
);
