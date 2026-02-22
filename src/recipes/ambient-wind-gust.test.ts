import { getAmbientWindGustParams } from "./ambient-wind-gust-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "ambient-wind-gust",
  (rng: Rng) => getAmbientWindGustParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 200, max: 1500 },
    { name: "filterQ", min: 0.5, max: 3.0 },
    { name: "lfoRate", min: 0.5, max: 4.0 },
    { name: "lfoDepth", min: 100, max: 800 },
    { name: "attack", min: 0.1, max: 0.5 },
    { name: "sustain", min: 0.2, max: 1.0 },
    { name: "release", min: 0.2, max: 0.8 },
    { name: "level", min: 0.3, max: 0.8 },
  ],
);
