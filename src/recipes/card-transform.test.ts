import { getCardTransformParams } from "./card-transform-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-transform",
  (rng: Rng) => getCardTransformParams(rng) as unknown as Record<string, number>,
  [
    { name: "carrierFreq", min: 300, max: 700 },
    { name: "modRatio", min: 1, max: 4 },
    { name: "modDepthStart", min: 50, max: 200 },
    { name: "modDepthEnd", min: 300, max: 800 },
    { name: "attack", min: 0.02, max: 0.08 },
    { name: "sustain", min: 0.2, max: 0.5 },
    { name: "release", min: 0.1, max: 0.3 },
    { name: "level", min: 0.5, max: 0.9 },
  ],
);
