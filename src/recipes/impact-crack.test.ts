import { getImpactCrackParams } from "./impact-crack-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "impact-crack",
  (rng: Rng) => getImpactCrackParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 2000, max: 6000 },
    { name: "filterQ", min: 0.5, max: 3 },
    { name: "attack", min: 0.001, max: 0.003 },
    { name: "decay", min: 0.04, max: 0.1 },
    { name: "level", min: 0.7, max: 1.0 },
    { name: "noiseColorMix", min: 0.0, max: 1.0 },
  ],
);
