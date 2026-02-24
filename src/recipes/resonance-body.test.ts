import { getResonanceBodyParams } from "./resonance-body-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "resonance-body",
  (rng: Rng) => getResonanceBodyParams(rng) as unknown as Record<string, number>,
  [
    { name: "fundamentalFreq", min: 80, max: 250 },
    { name: "overtoneRatio", min: 1.5, max: 3.5 },
    { name: "fundamentalDecay", min: 0.15, max: 0.6 },
    { name: "overtoneDecay", min: 0.08, max: 0.3 },
    { name: "overtoneLevel", min: 0.2, max: 0.5 },
    { name: "level", min: 0.6, max: 1.0 },
    { name: "attack", min: 0.001, max: 0.005 },
  ],
);
