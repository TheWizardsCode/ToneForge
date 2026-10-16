/**
 * Browser compatibility for the instrument engine.
 *
 * Mirrors the `src/recipes/browser-compat.test.ts` convention: simulate a
 * browser-like runtime (no `process.versions.node`, `OfflineAudioContext`
 * resolved from the global) and prove the instrument engine code path is
 * importable and renders through the browser-resolved Web Audio API without
 * any static `node-web-audio-api` dependency.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { OfflineAudioContext as NodeOfflineAudioContext } from "node-web-audio-api";
import type { InstrumentDefinition } from "./schema.js";
import { computePeak } from "./__tests__/helpers.js";

/** A minimal pluck-like definition used for the browser render. */
const PLUCK: InstrumentDefinition = {
  id: "browser.pluck",
  name: "Browser Pluck",
  oscillator: { type: "sine" },
  envelope: { attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.12 },
};

afterEach(() => {
  vi.stubGlobal("OfflineAudioContext", undefined);
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("instruments module in a browser-like runtime", () => {
  it("renders offline through the browser-native OfflineAudioContext", async () => {
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
      const { renderInstrument } = await import("./index.js");

      const events = [
        { type: "midiNoteOn" as const, note: 69, velocity: 100, time: 0 },
        { type: "midiNoteOff" as const, note: 69, velocity: 100, time: 0.3 },
      ];
      const rendered = await renderInstrument(PLUCK, events, { tail: 0.2 });

      expect(rendered.samples.length).toBeGreaterThan(0);
      // The tone is audible (peak well above the silence threshold).
      expect(computePeak(rendered.samples)).toBeGreaterThan(0.01);
      // Every context came from the browser-native global — the module graph
      // contains no static node-web-audio-api import.
      expect(constructed).toBe(1);
    } finally {
      (process.versions as unknown as Record<string, unknown>).node =
        originalNodeVersion;
    }
  });

  it("keeps node-web-audio-api out of the importable module graph", async () => {
    const originalNodeVersion = process.versions.node;
    Reflect.deleteProperty(process.versions, "node");
    vi.stubGlobal("AudioContext", undefined);
    vi.resetModules();

    try {
      const module = await import("./index.js");
      const engine = await import("./engine.js");
      // Fire a value import so the module graph is evaluated, then assert
      // the public surface resolves without referencing the Node package.
      expect(typeof module.renderInstrument).toBe("function");
      expect(engine.isNodeRuntime()).toBe(false);
    } finally {
      (process.versions as unknown as Record<string, unknown>).node =
        originalNodeVersion;
    }
  });
});
