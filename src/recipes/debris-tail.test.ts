import { getDebrisTailParams } from "./debris-tail-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "debris-tail",
  (rng: Rng) => getDebrisTailParams(rng) as unknown as Record<string, number>,
  [
    { name: "grainRate", min: 20, max: 80 },
    { name: "grainDecay", min: 0.002, max: 0.008 },
    { name: "filterFreq", min: 1000, max: 4000 },
    { name: "filterQ", min: 0.5, max: 3 },
    { name: "durationEnvelope", min: 0.5, max: 1.8 },
    { name: "densityDecay", min: 2.0, max: 5.0 },
    { name: "level", min: 0.4, max: 0.8 },
  ],
);
