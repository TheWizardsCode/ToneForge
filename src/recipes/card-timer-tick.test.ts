import { getCardTimerTickParams } from "./card-timer-tick-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "card-timer-tick",
  (rng: Rng) => getCardTimerTickParams(rng) as unknown as Record<string, number>,
  [
    { name: "freq", min: 1000, max: 2500 },
    { name: "attack", min: 0.0005, max: 0.002 },
    { name: "decay", min: 0.02, max: 0.08 },
    { name: "level", min: 0.4, max: 0.8 },
    { name: "clickCutoff", min: 2000, max: 5000 },
  ],
);
