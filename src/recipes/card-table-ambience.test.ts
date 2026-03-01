import { getCardTableAmbienceParams } from "./card-table-ambience-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-table-ambience",
  (rng: Rng) => getCardTableAmbienceParams(rng) as unknown as Record<string, number>,
  [
    { name: "filterFreq", min: 200, max: 800 },
    { name: "filterQ", min: 0.5, max: 2 },
    { name: "lfoRate", min: 0.2, max: 1.5 },
    { name: "lfoDepth", min: 30, max: 150 },
    { name: "attack", min: 0.05, max: 0.3 },
    { name: "sustain", min: 1, max: 2 },
    { name: "release", min: 0.3, max: 0.8 },
    { name: "level", min: 0.3, max: 0.7 },
  ],
);
