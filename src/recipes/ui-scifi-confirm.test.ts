import { getUiSciFiConfirmParams } from "./ui-scifi-confirm-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import type { Rng } from "../core/rng.js";

describeRecipe(
  "ui-scifi-confirm",
  (rng: Rng) => getUiSciFiConfirmParams(rng) as unknown as Record<string, number>,
  [
    { name: "frequency", min: 400, max: 1200 },
    { name: "attack", min: 0.001, max: 0.01 },
    { name: "decay", min: 0.05, max: 0.3 },
    { name: "filterCutoff", min: 800, max: 4000 },
  ],
);
