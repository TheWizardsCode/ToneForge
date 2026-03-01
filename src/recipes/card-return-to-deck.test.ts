import { getCardReturnToDeckParams } from "./card-return-to-deck-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-return-to-deck",
  (rng: Rng) => getCardReturnToDeckParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 800, max: 2500 },
    { name: "filterQ", min: 1.5, max: 5 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.05, max: 0.15 },
    { name: "noiseLevel", min: 0.3, max: 0.7 },
    { name: "toneStart", min: 400, max: 800 },
    { name: "toneEnd", min: 800, max: 1400 },
    { name: "toneLevel", min: 0.2, max: 0.5 },
  ],
);
