import { describe, expect, it, vi } from "vitest";
import { OfflineAudioContext } from "node-web-audio-api";
import { createRng } from "./rng.js";
import type { ToneGraphDocument } from "./tonegraph-schema.js";
import { loadToneGraph } from "./tonegraph.js";

vi.mock("../audio/sample-loader.js", async () => {
  const actual = await vi.importActual<typeof import("../audio/sample-loader.js")>("../audio/sample-loader.js");
  return {
    ...actual,
    loadSample: vi.fn(async (_samplePath: string, ctx: OfflineAudioContext) => {
      const sr = ctx.sampleRate;
      const length = Math.ceil(sr * 0.1);
      const buffer = ctx.createBuffer(1, length, sr);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i += 1) {
        channel[i] = Math.sin((i / sr) * Math.PI * 2 * 440) * 0.25;
      }
      return buffer;
    }),
  };
});

async function renderGraph(graph: ToneGraphDocument, seed = 42): Promise<Float32Array> {
  const duration = graph.meta?.duration ?? 0.25;
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * (duration + 0.1)), sampleRate);
  const handle = await loadToneGraph(graph, ctx, createRng(seed));
  handle.start(0);
  handle.stop(handle.duration);
  const rendered = await ctx.startRendering();
  return new Float32Array(rendered.getChannelData(0));
}

describe("loadToneGraph", () => {
  it("builds oscillator/filter/gain graph with chain routing", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.2 },
      nodes: {
        osc: { kind: "oscillator", params: { type: "sine", frequency: 660 } },
        filter: { kind: "biquadFilter", params: { type: "lowpass", frequency: 1200, Q: 1 } },
        amp: { kind: "gain", params: { gain: 0.25 } },
        out: { kind: "destination" },
      },
      routing: [{ chain: ["osc", "filter", "amp", "out"] }],
    };

    const samples = await renderGraph(graph, 1);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("supports flat routing and fmPattern", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.15 },
      nodes: {
        fm: { kind: "fmPattern", params: { carrierFrequency: 330, modulatorFrequency: 120, modulationIndex: 80 } },
        out: { kind: "destination" },
      },
      routing: [{ from: "fm", to: "out" }],
    };

    const samples = await renderGraph(graph, 2);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("supports envelope scheduling", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.2 },
      nodes: {
        osc: { kind: "oscillator", params: { type: "triangle", frequency: 440 } },
        env: { kind: "envelope", params: { attack: 0.01, decay: 0.08, sustain: 0.2, release: 0.05 } },
        out: { kind: "destination" },
      },
      routing: [{ chain: ["osc", "env", "out"] }],
    };

    const samples = await renderGraph(graph, 3);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("supports automation set, linear ramp, and lfo", async () => {
    const graph = {
      version: "0.1",
      meta: { duration: 0.2 },
      nodes: {
        osc: {
          kind: "oscillator",
          params: { type: "sine", frequency: 220 },
          automation: {
            frequency: [
              { kind: "set", time: 0, value: 220 },
              { kind: "linearRamp", time: 0.2, value: 660 },
              { kind: "lfo", rate: 4, depth: 20, offset: 440, start: 0, end: 0.2, step: 1 / 64, wave: "sine" },
            ],
          },
        },
        gain: { kind: "gain", params: { gain: 0.2 } },
        out: { kind: "destination" },
      },
      routing: [{ chain: ["osc", "gain", "out"] }],
    } as unknown as ToneGraphDocument;

    const samples = await renderGraph(graph, 4);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("uses graph.random.seed deterministically for noise", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.2 },
      random: { algorithm: "xorshift32", seed: 999 },
      nodes: {
        noise: { kind: "noise", params: { color: "pink", level: 0.2 } },
        out: { kind: "destination" },
      },
      routing: [{ from: "noise", to: "out" }],
    };

    const a = await renderGraph(graph, 100);
    const b = await renderGraph(graph, 200);
    expect(a.length).toBe(b.length);

    for (let i = 0; i < Math.min(a.length, 128); i += 1) {
      expect(a[i]).toBeCloseTo(b[i] as number, 6);
    }
  });

  it("supports bufferSource via loadSample integration", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.12 },
      nodes: {
        sample: { kind: "bufferSource", params: { sample: "footstep-gravel/impact.wav", playbackRate: 1.1 } },
        out: { kind: "destination" },
      },
      routing: [{ from: "sample", to: "out" }],
    };

    const samples = await renderGraph(graph, 5);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("supports lfo and constant nodes routing into AudioParams", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.15 },
      nodes: {
        osc: { kind: "oscillator", params: { frequency: 220 } },
        lfo: { kind: "lfo", params: { rate: 3, depth: 40, offset: 0 } },
        c: { kind: "constant", params: { value: 440 } },
        amp: { kind: "gain", params: { gain: 0.2 } },
        out: { kind: "destination" },
      },
      routing: [
        { chain: ["osc", "amp", "out"] },
        { from: "lfo", to: "osc.frequency" },
        { from: "c", to: "osc.frequency" },
      ],
    };

    const samples = await renderGraph(graph, 6);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("throws for unsupported node kind values", async () => {
    const graph = {
      version: "0.1",
      meta: { duration: 0.1 },
      nodes: {
        bad: { kind: "not-a-real-kind" },
      },
      routing: [],
    } as unknown as ToneGraphDocument;

    const ctx = new OfflineAudioContext(1, 4410, 44100);
    await expect(loadToneGraph(graph, ctx, createRng(1))).rejects.toThrow("Unsupported node kind");
  });
});
