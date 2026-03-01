import { getCardDeckPresenceParams } from "./card-deck-presence-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-deck-presence",
  (rng: Rng) => getCardDeckPresenceParams(rng) as unknown as Record<string, number>,
  [
    { name: "humFreq", min: 80, max: 200 },
    { name: "shimmerRatio", min: 3, max: 6 },
    { name: "shimmerRate", min: 2, max: 8 },
    { name: "shimmerLevel", min: 0.05, max: 0.2 },
    { name: "attack", min: 0.2, max: 0.5 },
    { name: "sustain", min: 0.5, max: 1.2 },
    { name: "release", min: 0.2, max: 0.5 },
    { name: "level", min: 0.1, max: 0.3 },
  ],
);
