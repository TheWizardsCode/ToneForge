import { getCardRoundCompleteParams } from "./card-round-complete-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-round-complete",
  (rng: Rng) => getCardRoundCompleteParams(rng) as unknown as Record<string, number>,
  [
    { name: "frequency", min: 500, max: 900 },
    { name: "attack", min: 0.005, max: 0.02 },
    { name: "sustain", min: 0.3, max: 0.6 },
    { name: "decay", min: 0.1, max: 0.35 },
    { name: "filterCutoff", min: 1500, max: 3500 },
    { name: "level", min: 0.5, max: 0.85 },
  ],
);
