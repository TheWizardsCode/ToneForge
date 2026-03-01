import { getCardTimerWarningParams } from "./card-timer-warning-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-timer-warning",
  (rng: Rng) => getCardTimerWarningParams(rng) as unknown as Record<string, number>,
  [
    { name: "freq", min: 1500, max: 3500 },
    { name: "urgencyRatio", min: 1.3, max: 1.8 },
    { name: "attack", min: 0.0005, max: 0.002 },
    { name: "decay", min: 0.05, max: 0.15 },
    { name: "level", min: 0.5, max: 0.9 },
    { name: "vibratoRate", min: 8, max: 20 },
    { name: "vibratoDepth", min: 20, max: 80 },
  ],
);
