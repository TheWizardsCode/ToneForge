import { getUiNotificationChimeParams } from "./ui-notification-chime-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "ui-notification-chime",
  (rng: Rng) => getUiNotificationChimeParams(rng) as unknown as Record<string, number>,
  [
    { name: "fundamentalFreq", min: 400, max: 1200 },
    { name: "harmonicCount", min: 2, max: 6 },
    { name: "harmonicDecayFactor", min: 0.3, max: 0.8 },
    { name: "attack", min: 0.005, max: 0.02 },
    { name: "sustainLevel", min: 0.3, max: 0.7 },
    { name: "decay", min: 0.1, max: 0.4 },
    { name: "release", min: 0.1, max: 0.5 },
  ],
);
