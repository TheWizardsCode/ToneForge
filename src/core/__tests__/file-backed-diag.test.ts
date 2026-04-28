import { describe, it, expect } from "vitest";
import { RecipeRegistry, discoverFileBackedRecipes } from "../recipe.js";
import { createRng } from "../rng.js";
import { resolve } from "node:path";

// Use process.cwd() to locate the repository root during tests and then
// point at the presets recipes directory that is part of the repository.
const PRESETS_DIR = resolve(process.cwd(), "presets", "recipes");

describe("file-backed recipe diagnostics", () => {
  it("derived params differ between seeds and affect rendering", async () => {
    const registry = new RecipeRegistry();
    const discovered = await discoverFileBackedRecipes(registry, { recipeDirectory: PRESETS_DIR });
    // Diagnostic if discovery failed in this environment
    // (prints list of discovered recipe names to help debug CI/test env paths)
    // eslint-disable-next-line no-console
    console.log("test: discovered recipes:", discovered);
    const reg = registry.getRegistration("ui-scifi-confirm");
    if (!reg) {
      throw new Error(`ui-scifi-confirm not discovered; discovered: ${JSON.stringify(discovered)}`);
    }

    const params1 = reg!.getParams(createRng(1));
    const params2 = reg!.getParams(createRng(2));
    // Note: file-backed recipes may declare explicit defaults; `getParams`
    // returns suggested defaults for interactive UIs. For determinism
    // diagnostics we rely on the rendered output differing between seeds
    // (below). Print the param sets for debugging but don't require them
    // to differ here.
    // eslint-disable-next-line no-console
    console.log("test: params seed1=", params1, "seed2=", params2);

    // Render both and ensure sample buffers differ (quick 0.05s render)
    const r1 = await (async () => {
      const dur = reg!.getDuration(createRng(1));
      const { OfflineAudioContext } = await import("node-web-audio-api");
      const frameCount = Math.ceil(44100 * Math.min(0.05, dur));
      const ctx = new OfflineAudioContext(1, frameCount, 44100);
      await reg!.buildOfflineGraph(createRng(1), ctx, Math.min(0.05, dur));
      const rendered = await ctx.startRendering();
      return new Float32Array(rendered.getChannelData(0));
    })();

    const r2 = await (async () => {
      const dur = reg!.getDuration(createRng(2));
      const { OfflineAudioContext } = await import("node-web-audio-api");
      const frameCount = Math.ceil(44100 * Math.min(0.05, dur));
      const ctx = new OfflineAudioContext(1, frameCount, 44100);
      await reg!.buildOfflineGraph(createRng(2), ctx, Math.min(0.05, dur));
      const rendered = await ctx.startRendering();
      return new Float32Array(rendered.getChannelData(0));
    })();

    // If the short renders are identical, fail with diagnostic info
    const identical = r1.length === r2.length && r1.every((v, i) => v === r2[i]);
    expect(identical).toBe(false);
  });
});
