import { getCardTreasureRevealParams } from "./card-treasure-reveal-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-treasure-reveal",
  (rng: Rng) => getCardTreasureRevealParams(rng) as unknown as Record<string, number>,
  [
    { name: "shimmerCutoff", min: 4000, max: 10000 },
    { name: "shimmerLevel", min: 0.3, max: 0.7 },
    { name: "shimmerDecay", min: 0.1, max: 0.3 },
    { name: "toneFreq", min: 500, max: 1200 },
    { name: "intervalRatio", min: 1.2, max: 1.5 },
    { name: "toneAttack", min: 0.02, max: 0.1 },
    { name: "toneDecay", min: 0.15, max: 0.5 },
    { name: "toneLevel", min: 0.5, max: 0.9 },
  ],
);
