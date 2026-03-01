import { getCardGlowParams } from "./card-glow-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-glow",
  (rng: Rng) => getCardGlowParams(rng) as unknown as Record<string, number>,
  [
    { name: "baseFreq", min: 400, max: 900 },
    { name: "lfoRate", min: 3, max: 10 },
    { name: "lfoDepth", min: 10, max: 50 },
    { name: "filterFreq", min: 1000, max: 3000 },
    { name: "filterQ", min: 2, max: 8 },
    { name: "attack", min: 0.05, max: 0.15 },
    { name: "sustain", min: 0.3, max: 0.6 },
    { name: "release", min: 0.1, max: 0.3 },
    { name: "level", min: 0.4, max: 0.8 },
  ],
);
