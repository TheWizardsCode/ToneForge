import { getCardComboBreakParams } from "./card-combo-break-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-combo-break",
  (rng: Rng) => getCardComboBreakParams(rng) as unknown as Record<string, number>,
  [
    { name: "freqStart", min: 500, max: 1000 },
    { name: "freqEnd", min: 150, max: 350 },
    { name: "dissonanceRatio", min: 1.05, max: 1.15 },
    { name: "attack", min: 0.001, max: 0.005 },
    { name: "decay", min: 0.15, max: 0.35 },
    { name: "toneLevel", min: 0.4, max: 0.8 },
    { name: "noiseLevel", min: 0.2, max: 0.5 },
  ],
);
