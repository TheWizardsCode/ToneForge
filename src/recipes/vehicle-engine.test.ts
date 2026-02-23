import { getVehicleEngineParams } from "./vehicle-engine-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "vehicle-engine",
  (rng: Rng) => getVehicleEngineParams(rng) as unknown as Record<string, number>,
  [
    { name: "oscFreq", min: 40, max: 80 },
    { name: "lfoRate", min: 1, max: 4 },
    { name: "lfoDepth", min: 50, max: 300 },
    { name: "filterCutoff", min: 200, max: 600 },
    { name: "mixLevel", min: 0.3, max: 0.7 },
    { name: "attack", min: 0.1, max: 0.3 },
    { name: "release", min: 0.3, max: 0.8 },
  ],
);
