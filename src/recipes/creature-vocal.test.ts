import { getCreatureVocalParams } from "./creature-vocal-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "creature-vocal",
  (rng: Rng) => getCreatureVocalParams(rng) as unknown as Record<string, number>,
  [
    { name: "carrierFreq", min: 80, max: 220 },
    { name: "modIndex", min: 8, max: 30 },
    { name: "filterCutoff", min: 300, max: 1200 },
    { name: "filterQ", min: 2, max: 10 },
    { name: "mixLevel", min: 0.3, max: 0.7 },
    { name: "attack", min: 0.02, max: 0.08 },
    { name: "decay", min: 0.2, max: 0.5 },
  ],
);
