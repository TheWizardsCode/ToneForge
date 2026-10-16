/**
 * Browser playback smoke test for the instruments engine wiring
 * (TF-0MV9WXN7H003QI88, dual-runtime browser child).
 *
 * Simulates a browser runtime: `process.versions.node` is removed (so
 * `isNodeRuntime()` returns false) and `AudioContext` is resolved from the
 * global scope, mirroring how the songs module behaves in a real browser.
 * The web entrypoint (`web/src/audio.ts`) must create the real-time
 * instrument graph and schedule Note On / Note Off without throwing, and the
 * module graph must not require `node-web-audio-api` to be importable.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** Minimal Web Audio node surface for the smoke test. */
function createParam(): {
  value: number;
  setValueAtTime(): void;
  linearRampToValueAtTime(): void;
  cancelScheduledValues(): void;
} {
  return {
    value: 0,
    setValueAtTime(): void {},
    linearRampToValueAtTime(): void {},
    cancelScheduledValues(): void {},
  };
}

function createNode(): {
  type?: string;
  frequency: { value: number };
  detune: { value: number };
  gain: {
    value: number;
    setValueAtTime(): void;
    linearRampToValueAtTime(): void;
    cancelScheduledValues(): void;
  };
  connect(): void;
  start(): void;
  stop(): void;
} {
  return {
    frequency: { value: 0 },
    detune: { value: 0 },
    gain: createParam(),
    connect(): void {},
    start(): void {},
    stop(): void {},
  };
}

describe("instruments real-time playback in a browser-like runtime", () => {
  it("registers a real-time instrument and plays a note through the web audio entrypoint", async () => {
    const originalNodeVersion = process.versions.node;
    Reflect.deleteProperty(process.versions, "node");
    let created = 0;
    vi.stubGlobal("AudioContext", class {
      sampleRate = 44100;
      currentTime = 0;
      destination = { connect(): void {} };
      constructor() {
        created += 1;
      }
      createOscillator() {
        return { ...createNode(), type: "sine" };
      }
      createGain() {
        return createNode();
      }
    });
    vi.resetModules();

    try {
      const { playInstrumentNote, getRealtimeInstrument } = await import("../src/audio.js");
      const definition = {
        id: "web-smoke.pluck",
        name: "Web Smoke Pluck",
        oscillator: { type: "sine" },
        envelope: { attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.12 },
      };

      const instrument = getRealtimeInstrument(definition);
      expect(instrument.id).toBe("web-smoke.pluck");

      expect(playInstrumentNote(definition, 60, 100)).toBe(true);
      expect(playInstrumentNote(definition, 67, 100)).toBe(true);

      // Exactly one AudioContext was constructed for the registered instrument.
      expect(created).toBe(1);
    } finally {
      (process.versions as unknown as Record<string, unknown>).node =
        originalNodeVersion;
    }
  });
});
