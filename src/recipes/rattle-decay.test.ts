import { getRattleDecayParams } from "./rattle-decay-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "rattle-decay",
  (rng: Rng) => getRattleDecayParams(rng) as unknown as Record<string, number>,
  [
    { name: "rattleRate", min: 30, max: 100 },
    { name: "rattleDecay", min: 0.001, max: 0.004 },
    { name: "filterFreq", min: 2000, max: 5000 },
    { name: "filterQ", min: 1, max: 5 },
    { name: "duration", min: 0.15, max: 0.45 },
    { name: "densityDecay", min: 3.0, max: 6.0 },
    { name: "level", min: 0.3, max: 0.7 },
  ],
);
