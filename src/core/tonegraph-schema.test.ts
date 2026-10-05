import { describe, it, expect } from "vitest";
import { validateToneGraph } from "./tonegraph-schema.js";

describe("validateToneGraph", () => {
  it("accepts a valid v0.1 document", () => {
    const doc = {
      version: "0.1",
      engine: { backend: "webaudio" },
      meta: {
        name: "ui-scifi-confirm",
        description: "Short sci-fi confirmation tone.",
        category: "UI",
        tags: ["sci-fi", "confirm"],
        duration: 0.19,
        parameters: [
          { name: "frequency", type: "number", min: 400, max: 1200, unit: "Hz", default: 880 },
          { name: "attack", type: "number", min: 0.001, max: 0.01, unit: "s" },
        ],
      },
      random: { algorithm: "xorshift32", seed: 42 },
      transport: { tempo: 120, timeSignature: [4, 4] },
      nodes: {
        osc: { kind: "oscillator", params: { type: "sine", frequency: 880 } },
        filter: { kind: "biquadFilter", params: { type: "lowpass", frequency: 2200, Q: 1 } },
        env: { kind: "envelope", params: { attack: 0.005, decay: 0.18, sustain: 0, release: 0 } },
        out: { kind: "destination" },
      },
      routing: [{ chain: ["osc", "filter", "env", "out"] }],
    };

    const validated = validateToneGraph(doc);

    expect(validated.version).toBe("0.1");
    expect(Object.keys(validated.nodes)).toEqual(["osc", "filter", "env", "out"]);
    expect(validated.routing).toHaveLength(1);
  });

  it("accepts routing in flat link form", () => {
    const doc = {
      version: "0.1",
      nodes: {
        osc: { kind: "oscillator", params: { type: "triangle" } },
        out: { kind: "destination" },
      },
      routing: [{ from: "osc", to: "out" }],
    };

    const validated = validateToneGraph(doc);

    expect(validated.routing).toEqual([{ from: "osc", to: "out" }]);
  });

  it("accepts routing to AudioParam endpoints", () => {
    const doc = {
      version: "0.1",
      nodes: {
        lfo: { kind: "lfo" },
        osc: { kind: "oscillator" },
        out: { kind: "destination" },
      },
      routing: [
        { from: "lfo", to: "osc.frequency" },
        { from: "osc", to: "out" },
      ],
    };

    const validated = validateToneGraph(doc);

    expect(validated.routing).toEqual([
      { from: "lfo", to: "osc.frequency" },
      { from: "osc", to: "out" },
    ]);
  });

  it("rejects routing from AudioParam endpoints", () => {
    const doc = {
      version: "0.1",
      nodes: {
        osc: { kind: "oscillator" },
        out: { kind: "destination" },
      },
      routing: [{ from: "osc.frequency", to: "out" }],
    };

    expect(() => validateToneGraph(doc)).toThrow("cannot reference AudioParam endpoint");
  });

  it("rejects missing nodes", () => {
    const doc = {
      version: "0.1",
      routing: [],
    };

    expect(() => validateToneGraph(doc)).toThrow("nodes is required");
  });

  it("rejects invalid node kind", () => {
    const doc = {
      version: "0.1",
      nodes: {
        bad: { kind: "tone/Oscillator" },
      },
      routing: [],
    };

    expect(() => validateToneGraph(doc)).toThrow("invalid");
  });

  it("rejects broken routing references", () => {
    const doc = {
      version: "0.1",
      nodes: {
        osc: { kind: "oscillator" },
      },
      routing: [{ from: "osc", to: "missing" }],
    };

    expect(() => validateToneGraph(doc)).toThrow("unknown node");
  });

  it("rejects unsupported version", () => {
    const doc = {
      version: "0.2",
      nodes: {
        osc: { kind: "oscillator" },
      },
      routing: [],
    };

    expect(() => validateToneGraph(doc)).toThrow("Unsupported ToneGraph version");
  });

  it("rejects sequences as reserved for v0.2", () => {
    const doc = {
      version: "0.1",
      nodes: {
        osc: { kind: "oscillator" },
      },
      routing: [],
      sequences: [],
    };

    expect(() => validateToneGraph(doc)).toThrow("reserved for v0.2");
  });

  it("rejects namespaces as reserved for v0.2", () => {
    const doc = {
      version: "0.1",
      nodes: {
        osc: { kind: "oscillator" },
      },
      routing: [],
      namespaces: {},
    };

    expect(() => validateToneGraph(doc)).toThrow("reserved for v0.2");
  });

  it("accepts bus routing with declared buses", () => {
    const doc = {
      version: "0.1",
      buses: {
        mix: { gain: 0.5 },
      },
      nodes: {
        osc: { kind: "oscillator" },
        noise: { kind: "noise" },
        filter: { kind: "biquadFilter" },
        out: { kind: "destination" },
      },
      routing: [
        { bus: "mix", from: ["osc", "noise"], to: ["filter"] },
        { from: "filter", to: "out" },
      ],
    };

    const validated = validateToneGraph(doc);

    expect(validated.buses).toEqual({ mix: { gain: 0.5 } });
    expect(validated.routing).toHaveLength(2);
  });

  it("accepts a bus entry with a single string input and output", () => {
    const doc = {
      version: "0.1",
      buses: { mix: {} },
      nodes: {
        osc: { kind: "oscillator" },
        out: { kind: "destination" },
      },
      routing: [{ bus: "mix", from: "osc", to: "out" }],
    };

    const validated = validateToneGraph(doc);

    expect(validated.routing).toEqual([{ bus: "mix", from: "osc", to: "out" }]);
  });

  it("rejects bus routing that references an undeclared bus", () => {
    const doc = {
      version: "0.1",
      nodes: {
        osc: { kind: "oscillator" },
        out: { kind: "destination" },
      },
      routing: [{ bus: "missing", from: "osc", to: "out" }],
    };

    expect(() => validateToneGraph(doc)).toThrow('unknown bus "missing"');
  });

  it("rejects a bus entry with neither inputs nor outputs", () => {
    const doc = {
      version: "0.1",
      buses: { mix: {} },
      nodes: {
        osc: { kind: "oscillator" },
      },
      routing: [{ bus: "mix" }],
    };

    expect(() => validateToneGraph(doc)).toThrow("must declare at least one input or output");
  });

  it("rejects a bus entry with an empty input list", () => {
    const doc = {
      version: "0.1",
      buses: { mix: {} },
      nodes: {
        out: { kind: "destination" },
      },
      routing: [{ bus: "mix", from: [], to: "out" }],
    };

    expect(() => validateToneGraph(doc)).toThrow("must not be empty");
  });

  it("rejects a bus definition with a non-numeric gain", () => {
    const doc = {
      version: "0.1",
      buses: { mix: { gain: "loud" } },
      nodes: {
        out: { kind: "destination" },
      },
      routing: [],
    };

    expect(() => validateToneGraph(doc)).toThrow("buses.mix.gain must be a finite number");
  });

  it("rejects a bus id that collides with a node id", () => {
    const doc = {
      version: "0.1",
      buses: { mix: {} },
      nodes: {
        mix: { kind: "gain" },
        out: { kind: "destination" },
      },
      routing: [],
    };

    expect(() => validateToneGraph(doc)).toThrow("collides with a node id");
  });

  it("rejects a node id that collides with a generated bus reference", () => {
    const doc = {
      version: "0.1",
      buses: { mix: {} },
      nodes: {
        "bus:mix": { kind: "gain" },
        out: { kind: "destination" },
      },
      routing: [],
    };

    expect(() => validateToneGraph(doc)).toThrow("conflicts with bus reference");
  });

  it("rejects bus inputs that reference an AudioParam endpoint", () => {
    const doc = {
      version: "0.1",
      buses: { mix: {} },
      nodes: {
        osc: { kind: "oscillator" },
        out: { kind: "destination" },
      },
      routing: [{ bus: "mix", from: "osc.frequency", to: "out" }],
    };

    expect(() => validateToneGraph(doc)).toThrow("cannot reference AudioParam endpoint");
  });

  it("rejects bus routing that references an unknown node", () => {
    const doc = {
      version: "0.1",
      buses: { mix: {} },
      nodes: {
        osc: { kind: "oscillator" },
        out: { kind: "destination" },
      },
      routing: [{ bus: "mix", from: ["osc", "ghost"], to: "out" }],
    };

    expect(() => validateToneGraph(doc)).toThrow("unknown node");
  });

  it("rejects invalid meta.parameters bounds", () => {
    const doc = {
      version: "0.1",
      meta: {
        parameters: [
          { name: "frequency", type: "number", min: 1000, max: 10 },
        ],
      },
      nodes: {
        osc: { kind: "oscillator" },
      },
      routing: [],
    };

    expect(() => validateToneGraph(doc)).toThrow("min must be <= max");
  });
});
