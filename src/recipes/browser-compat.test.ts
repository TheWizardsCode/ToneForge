import { describe, it, expect, vi, afterEach } from "vitest";
import { OfflineAudioContext as NodeOfflineAudioContext } from "node-web-audio-api";
import { createRng } from "../core/rng.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/**
 * Built-in synthesised recipes exercise the full recipe graph builder against
 * the browser-resolved OfflineAudioContext. File-backed recipes are skipped
 * here because their discovery is a Node-only path.
 */
const BUILT_IN_RECIPES = ["footstep-stone", "impact-crack"] as const;

describe("built-in recipes in a browser-like runtime", () => {
  it("build and render offline graphs on the browser-native OfflineAudioContext", async () => {
    let constructed = 0;
    const BrowserOfflineAudioContext = new Proxy(NodeOfflineAudioContext, {
      construct(target, args) {
        constructed += 1;
        return Reflect.construct(target, args);
      },
    });

    const originalNodeVersion = process.versions.node;
    Reflect.deleteProperty(process.versions, "node");
    vi.stubGlobal("OfflineAudioContext", BrowserOfflineAudioContext);
    vi.resetModules();

    try {
      const { OfflineAudioContext } = await import("../audio/web-audio.js");
      const { registry } = await import("./index.js");

      for (const name of BUILT_IN_RECIPES) {
        const registration = registry.getRegistration(name);
        expect(registration, `missing built-in recipe ${name}`).toBeDefined();

        const seed = 7;
        const duration = registration!.getDuration(createRng(seed));
        const sampleRate = 44100;
        const length = Math.ceil(sampleRate * duration);

        const ctx = new OfflineAudioContext(1, length, sampleRate);
        await registration!.buildOfflineGraph(createRng(seed), ctx, duration);
        const rendered = await ctx.startRendering();

        expect(rendered.numberOfChannels).toBe(1);
        expect(rendered.length).toBe(length);

        const samples = rendered.getChannelData(0);
        const hasSignal = Array.from(samples).some((sample) => sample !== 0);
        expect(hasSignal, `${name} rendered silence`).toBe(true);
      }

      // Every context came from the browser-native global, never a static
      // node-web-audio-api import.
      expect(constructed).toBe(BUILT_IN_RECIPES.length);
    } finally {
      (process.versions as unknown as Record<string, unknown>).node =
        originalNodeVersion;
    }
  });
});
