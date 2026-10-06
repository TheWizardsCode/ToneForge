import { describe, it, expect, vi, afterEach } from "vitest";
import { OfflineAudioContext as NodeOfflineAudioContext } from "node-web-audio-api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/**
 * Verifies the renderer is Runtime-aware: when it runs outside Node.js it
 * resolves OfflineAudioContext from the browser-native global (via the
 * cross-platform abstraction) instead of importing node-web-audio-api.
 */
describe("renderRecipe in a browser-like runtime", () => {
  it("renders using the browser-native OfflineAudioContext global", async () => {
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
      const { renderRecipe } = await import("./renderer.js");
      // footstep-stone is a synchronously-registered built-in recipe, so it
      // is available even in a browser-like runtime (file-backed discovery is
      // a Node-only path and intentionally skipped here).
      const result = await renderRecipe("footstep-stone", 42);

      expect(constructed).toBeGreaterThan(0);
      expect(result.samples).toBeInstanceOf(Float32Array);
      expect(result.samples.length).toBeGreaterThan(0);
      expect(result.sampleRate).toBe(44100);
      expect(result.numberOfChannels).toBe(1);
    } finally {
      (process.versions as unknown as Record<string, unknown>).node =
        originalNodeVersion;
    }
  });
});
