/**
 * Renderer Benchmark
 *
 * Measures the time to render a recipe to an audio buffer via renderRecipe().
 * Covers the full offline render pipeline: recipe lookup, OfflineAudioContext
 * creation, graph building, and rendering.
 *
 * Reference: TF-0MM0YUBFR0MCXGLE
 */

import { bench, describe } from "vitest";
import { renderRecipe } from "../core/renderer.js";

describe("renderRecipe", () => {
  bench("ui-scifi-confirm (pure synthesis, seed 42)", async () => {
    await renderRecipe("ui-scifi-confirm", 42);
  });

  bench("weapon-laser-zap (pure synthesis, seed 42)", async () => {
    await renderRecipe("weapon-laser-zap", 42);
  });

  bench("ambient-wind-gust (pure synthesis, seed 42)", async () => {
    await renderRecipe("ambient-wind-gust", 42);
  });

  bench("footstep-gravel (sample-hybrid, seed 42)", async () => {
    await renderRecipe("footstep-gravel", 42);
  });

  bench("creature-vocal (sample-hybrid, seed 42)", async () => {
    await renderRecipe("creature-vocal", 42);
  });
});
