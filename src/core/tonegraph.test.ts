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
    const graph: ToneGraphDocument = {
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
    };

    const samples = await renderGraph(graph, 4);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("applies exponentialRamp node automation to oscillator frequency", async () => {
    const sweptGraph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.2 },
      nodes: {
        osc: {
          kind: "oscillator",
          params: { type: "sine", frequency: 440 },
          automation: {
            frequency: [
              { kind: "set", time: 0, value: 440 },
              { kind: "exponentialRamp", time: 0.2, value: 60 },
            ],
          },
        },
        gain: { kind: "gain", params: { gain: 0.2 } },
        out: { kind: "destination" },
      },
      routing: [{ chain: ["osc", "gain", "out"] }],
    };

    const baselineGraph = {
      version: "0.1",
      meta: { duration: 0.2 },
      nodes: {
        osc: { kind: "oscillator", params: { type: "sine", frequency: 440 } },
        gain: { kind: "gain", params: { gain: 0.2 } },
        out: { kind: "destination" },
      },
      routing: [{ chain: ["osc", "gain", "out"] }],
    } as ToneGraphDocument;

    const swept = await renderGraph(sweptGraph, 4);
    const baseline = await renderGraph(baselineGraph, 4);

    expect(swept.some((sample) => sample !== 0)).toBe(true);
    expect(swept.length).toBe(baseline.length);
    const identical = swept.every((sample, index) => sample === baseline[index]);
    expect(identical).toBe(false);

    const repeat = await renderGraph(sweptGraph, 4);
    for (let i = 0; i < swept.length; i += 1) {
      expect(swept[i]).toBe(repeat[i]);
    }
  });

  it("throws when exponentialRamp automation targets a non-positive value", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.1 },
      nodes: {
        osc: {
          kind: "oscillator",
          params: { frequency: 440 },
          automation: { frequency: [{ kind: "exponentialRamp", time: 0.1, value: 0 }] },
        },
        out: { kind: "destination" },
      },
      routing: [{ from: "osc", to: "out" }],
    };

    const ctx = new OfflineAudioContext(1, 4410, 44100);
    await expect(loadToneGraph(graph, ctx, createRng(1))).rejects.toThrow(
      "value must be greater than 0",
    );
  });

  it("schedules the envelope release inside the render window", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.22 },
      nodes: {
        dc: { kind: "constant", params: { value: 1 } },
        env: {
          kind: "envelope",
          params: { attack: 0.01, decay: 0.01, sustain: 1, release: 0.1 },
        },
        out: { kind: "destination" },
      },
      routing: [{ chain: ["dc", "env", "out"] }],
    };

    const duration = graph.meta!.duration!;
    const sampleRate = 44100;
    const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * duration), sampleRate);
    const handle = await loadToneGraph(graph, ctx, createRng(1));
    handle.start(0);
    handle.stop(handle.duration);
    const rendered = await ctx.startRendering();
    const samples = new Float32Array(rendered.getChannelData(0));
    const at = (seconds: number): number =>
      samples[Math.min(samples.length - 1, Math.floor(seconds * sampleRate))]!;

    // Sustain plateau is held before the release window.
    expect(at(0.1)).toBeCloseTo(1, 2);

    // The release ramp lies inside the buffer: half-way through it the
    // envelope is non-zero and still below the sustain level.
    const midRelease = at(duration - 0.05);
    expect(midRelease).toBeGreaterThan(0);
    expect(midRelease).toBeLessThan(1);

    // The envelope reaches silence by the end of the render window.
    expect(Math.abs(samples[samples.length - 1]!)).toBeLessThan(0.05);
  });

  it("holds a release = 0 envelope at sustain until the stop time", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.2 },
      nodes: {
        dc: { kind: "constant", params: { value: 1 } },
        env: {
          kind: "envelope",
          params: { attack: 0.01, decay: 0.01, sustain: 0.75, release: 0 },
        },
        out: { kind: "destination" },
      },
      routing: [{ chain: ["dc", "env", "out"] }],
    };

    const sampleRate = 44100;
    const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * 0.2), sampleRate);
    const handle = await loadToneGraph(graph, ctx, createRng(1));
    handle.start(0);
    handle.stop(handle.duration);
    const rendered = await ctx.startRendering();
    const samples = new Float32Array(rendered.getChannelData(0));
    const at = (seconds: number): number =>
      samples[Math.min(samples.length - 1, Math.floor(seconds * sampleRate))]!;

    // Release = 0 keeps the original behaviour: the sustain plateau holds
    // through the whole render window and the drop to silence happens at the
    // stop boundary (outside the buffer).
    expect(at(0.15)).toBeCloseTo(0.75, 2);
    expect(samples[samples.length - 1]!).toBeCloseTo(0.75, 2);
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

  it("supports bus routing fan-in and fan-out", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.2 },
      buses: { mix: { gain: 0.5 } },
      nodes: {
        oscA: { kind: "oscillator", params: { type: "sine", frequency: 330 } },
        oscB: { kind: "oscillator", params: { type: "sine", frequency: 550 } },
        out: { kind: "destination" },
      },
      routing: [{ bus: "mix", from: ["oscA", "oscB"], to: ["out"] }],
    };

    const samples = await renderGraph(graph, 7);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("creates a gain node for each declared bus and applies its gain", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.2 },
      buses: { mix: { gain: 0.5 } },
      nodes: {
        osc: { kind: "oscillator", params: { type: "sine", frequency: 440 } },
        out: { kind: "destination" },
      },
      routing: [{ bus: "mix", from: "osc", to: "out" }],
    };

    const ctx = new OfflineAudioContext(1, 4410, 44100);
    const handle = await loadToneGraph(graph, ctx, createRng(7));

    const busNode = handle.nodes["bus:mix"] as GainNode | undefined;
    expect(busNode).toBeDefined();
    expect(busNode!.gain.value).toBeCloseTo(0.5, 6);
  });

  it("mixes flat links, chain routing and bus routing together", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.2 },
      buses: { mix: { gain: 0.4 } },
      nodes: {
        osc: { kind: "oscillator", params: { type: "sawtooth", frequency: 220 } },
        filter: { kind: "biquadFilter", params: { type: "lowpass", frequency: 900 } },
        noise: { kind: "noise", params: { color: "white", level: 0.2 } },
        amp: { kind: "gain", params: { gain: 0.3 } },
        out: { kind: "destination" },
      },
      routing: [
        { chain: ["osc", "filter"] },
        { from: "noise", to: "amp" },
        { bus: "mix", from: ["filter", "amp"], to: "out" },
      ],
    };

    const samples = await renderGraph(graph, 8);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("scales bus output by the declared bus gain", async () => {
    const makeGraph = (gain: number): ToneGraphDocument => ({
      version: "0.1",
      meta: { duration: 0.1 },
      buses: { mix: { gain } },
      nodes: {
        osc: { kind: "oscillator", params: { type: "sine", frequency: 440 } },
        out: { kind: "destination" },
      },
      routing: [{ bus: "mix", from: "osc", to: "out" }],
    });

    const full = await renderGraph(makeGraph(1), 9);
    const quiet = await renderGraph(makeGraph(0.25), 9);

    const peak = (samples: Float32Array): number => {
      let max = 0;
      for (const sample of samples) {
        const abs = Math.abs(sample);
        if (abs > max) {
          max = abs;
        }
      }
      return max;
    };

    expect(peak(full)).toBeGreaterThan(0);
    expect(peak(quiet) / peak(full)).toBeCloseTo(0.25, 2);
  });

  it("applies sequence events deterministically", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.25 },
      nodes: {
        osc: { kind: "oscillator", params: { type: "sine", frequency: 220 } },
        amp: { kind: "gain", params: { gain: 0.25 } },
        out: { kind: "destination" },
      },
      routing: [{ chain: ["osc", "amp", "out"] }],
      sequences: [
        {
          node: "osc",
          param: "frequency",
          events: [
            { kind: "set", time: 0, value: 220 },
            { kind: "linearRamp", time: 0.25, value: 660 },
          ],
        },
      ],
    };

    const first = await renderGraph(graph, 11);
    const second = await renderGraph(graph, 11);

    expect(first.length).toBe(second.length);
    for (let i = 0; i < first.length; i += 1) {
      expect(first[i]).toBe(second[i]);
    }
  });

  it("sequence changes rendered output relative to an unsequenced baseline", async () => {
    const baseNodes = {
      osc: { kind: "oscillator", params: { type: "sine", frequency: 220 } },
      amp: { kind: "gain", params: { gain: 0.25 } },
      out: { kind: "destination" },
    } as const;

    const baseline: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.25 },
      nodes: baseNodes,
      routing: [{ chain: ["osc", "amp", "out"] }],
    };

    const sequenced: ToneGraphDocument = {
      ...baseline,
      nodes: {
        ...baseNodes,
        osc: { kind: "oscillator", params: { type: "sine", frequency: 220 } },
      },
      sequences: [
        {
          node: "osc",
          param: "frequency",
          events: [
            { kind: "set", time: 0, value: 220 },
            { kind: "set", time: 0.1, value: 880 },
          ],
        },
      ],
    };

    const plainSamples = await renderGraph(baseline, 12);
    const sequencedSamples = await renderGraph(sequenced, 12);

    expect(plainSamples.length).toBe(sequencedSamples.length);
    const identical = plainSamples.every((sample, index) => sample === sequencedSamples[index]);
    expect(identical).toBe(false);
  });

  it("throws when a sequence targets an unknown AudioParam", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.1 },
      nodes: {
        osc: { kind: "oscillator" },
        out: { kind: "destination" },
      },
      routing: [{ from: "osc", to: "out" }],
      sequences: [
        { node: "osc", param: "notAParam", events: [{ kind: "set", time: 0, value: 1 }] },
      ],
    };

    const ctx = new OfflineAudioContext(1, 4410, 44100);
    await expect(loadToneGraph(graph, ctx, createRng(1))).rejects.toThrow('targets unknown AudioParam "notAParam"');
  });

  it("throws when a sequence references an unknown node", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      meta: { duration: 0.1 },
      nodes: {
        osc: { kind: "oscillator" },
        out: { kind: "destination" },
      },
      routing: [{ from: "osc", to: "out" }],
      sequences: [
        { node: "ghost", param: "frequency", events: [{ kind: "set", time: 0, value: 1 }] },
      ],
    };

    const ctx = new OfflineAudioContext(1, 4410, 44100);
    await expect(loadToneGraph(graph, ctx, createRng(1))).rejects.toThrow('references unknown node "ghost"');
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

  // --- Namespace resolution tests ---

  it("resolves namespace-qualified chain routing", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      namespaces: {
        sfx: { nodes: ["osc", "filter", "env"] },
      },
      meta: { duration: 0.15 },
      nodes: {
        osc: { kind: "oscillator", params: { type: "sine", frequency: 440 } },
        filter: { kind: "biquadFilter", params: { type: "lowpass", frequency: 2000 } },
        env: { kind: "envelope", params: { attack: 0.005, decay: 0.1, sustain: 0 } },
        out: { kind: "destination" },
      },
      routing: [
        { chain: ["ns/sfx/osc", "ns/sfx/filter", "ns/sfx/env", "out"] },
      ],
    };

    const samples = await renderGraph(graph, 1);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("resolves namespace-qualified flat routing links", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      namespaces: {
        mod: { nodes: ["lfo"] },
        sfx: { nodes: ["osc"] },
      },
      meta: { duration: 0.1 },
      nodes: {
        lfo: { kind: "lfo", params: { rate: 5 } },
        osc: { kind: "oscillator" },
        out: { kind: "destination" },
      },
      routing: [
        { from: "ns/mod/lfo", to: "ns/sfx/osc.frequency" },
        { from: "ns/sfx/osc", to: "out" },
      ],
    };

    const samples = await renderGraph(graph, 1);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("resolves namespace references in bus routing", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      namespaces: {
        sfx: { nodes: ["osc", "noise"] },
      },
      meta: { duration: 0.1 },
      buses: { mix: { gain: 0.5 } },
      nodes: {
        osc: { kind: "oscillator", params: { type: "sine", frequency: 220 } },
        noise: { kind: "noise", params: { color: "white", level: 0.3 } },
        out: { kind: "destination" },
      },
      routing: [
        { bus: "mix", from: ["ns/sfx/osc", "ns/sfx/noise"], to: "out" },
      ],
    };

    const samples = await renderGraph(graph, 1);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("mixes namespace-qualified and plain references in chain", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      namespaces: {
        sfx: { nodes: ["osc", "filter"] },
      },
      meta: { duration: 0.15 },
      nodes: {
        osc: { kind: "oscillator", params: { type: "sine", frequency: 440 } },
        filter: { kind: "biquadFilter", params: { type: "highpass", frequency: 800 } },
        amp: { kind: "gain", params: { gain: 0.3 } },
        out: { kind: "destination" },
      },
      routing: [
        { chain: ["ns/sfx/osc", "ns/sfx/filter", "amp", "out"] },
      ],
    };

    const samples = await renderGraph(graph, 1);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("preserves determinism with namespace references", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      namespaces: {
        sfx: { nodes: ["osc", "filter", "env"] },
      },
      meta: { duration: 0.15 },
      nodes: {
        osc: { kind: "oscillator", params: { type: "sine", frequency: 440 } },
        filter: { kind: "biquadFilter", params: { type: "lowpass", frequency: 2000 } },
        env: { kind: "envelope", params: { attack: 0.005, decay: 0.1, sustain: 0 } },
        out: { kind: "destination" },
      },
      routing: [
        { chain: ["ns/sfx/osc", "ns/sfx/filter", "ns/sfx/env", "out"] },
      ],
    };

    const samplesA = await renderGraph(graph, 42);
    const samplesB = await renderGraph(graph, 42);
    expect(samplesA).toEqual(samplesB);
  });

  it("throws for namespace reference to unknown namespace", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      namespaces: {
        sfx: { nodes: ["osc"] },
      },
      meta: { duration: 0.1 },
      nodes: {
        osc: { kind: "oscillator" },
        out: { kind: "destination" },
      },
      routing: [{ from: "ns/ghost/osc", to: "out" }],
    };

    const ctx = new OfflineAudioContext(1, 4410, 44100);
    await expect(loadToneGraph(graph, ctx, createRng(1))).rejects.toThrow('Unknown namespace "ghost"');
  });

  it("throws for namespace reference to a node not declared in the namespace", async () => {
    const graph: ToneGraphDocument = {
      version: "0.1",
      namespaces: {
        sfx: { nodes: ["osc"] },
      },
      meta: { duration: 0.1 },
      nodes: {
        osc: { kind: "oscillator" },
        filter: { kind: "biquadFilter" },
        out: { kind: "destination" },
      },
      routing: [{ from: "ns/sfx/filter", to: "out" }],
    };

    const ctx = new OfflineAudioContext(1, 4410, 44100);
    await expect(loadToneGraph(graph, ctx, createRng(1))).rejects.toThrow(
      'Node "filter" is not declared in namespace "sfx"',
    );
  });
});
