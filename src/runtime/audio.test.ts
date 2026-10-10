/**
 * Runtime Audio Bridge Tests
 *
 * Verifies the render-backed runtime pipeline: scripted scenarios resolve to
 * recipes, state/context changes change the rendered audio and the event log,
 * the same seed reproduces identical output, and the browser scheduling helper
 * wires a rendered buffer to an AudioBufferSourceNode.
 *
 * Work item: TF-0MUXW66870013DOL
 */

import { describe, it, expect } from "vitest";
import { parseSequencePreset } from "../sequence/schema.js";
import type { SequenceDefinition } from "../sequence/schema.js";
import {
  runRuntimeScenario,
  scheduleRuntimeBuffer,
  playRenderResultOnContext,
} from "./audio.js";
import type { SchedulableAudioContext } from "./audio.js";
import { loadRuntimeScenario } from "./scenario.js";
import type { RuntimeScenario } from "./scenario.js";

const DEMO_SCENARIO = "presets/runtime/footsteps.json";

// ── Helpers ───────────────────────────────────────────────────────

function sequence(
  name: string,
  events: Array<{ time: number; gain: number }>,
): SequenceDefinition {
  return parseSequencePreset(
    {
      version: "1.0",
      name,
      events: events.map((e, i) => ({
        time: e.time,
        event: "footstep",
        seedOffset: i,
        gain: e.gain,
      })),
    },
    name,
  );
}

/**
 * Build a minimal single-step scenario for buffer comparison: the initial
 * surface and the state entered at t=0 are the two independent variables.
 */
function miniScenario(surface: string, state: "walk" | "sprint"): RuntimeScenario {
  return {
    version: "1.0",
    name: `mini_${state}_${surface}`,
    seed: 42,
    stateMachine: {
      name: "movement",
      initial: "idle",
      states: [
        { name: "idle" },
        { name: "walk", sequencer: "seq_walk" },
        { name: "sprint", sequencer: "seq_sprint" },
      ],
      transitions: [
        { from: "idle", to: "walk" },
        { from: "idle", to: "sprint" },
        { from: "walk", to: "sprint" },
      ],
    },
    context: {
      dimensions: { surface: ["stone", "gravel"] },
      initial: { surface },
    },
    sequences: {
      seq_walk: sequence("seq_walk", [
        { time: 0, gain: 0.7 },
        { time: 0.6, gain: 0.65 },
      ]),
      seq_sprint: sequence("seq_sprint", [
        { time: 0, gain: 1.0 },
        { time: 0.25, gain: 0.95 },
      ]),
    },
    recipeResolver: { footstep: "footstep-{surface}" },
    steps: [{ time: 0, state }],
  };
}

function samplesEqual(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function hasSignal(samples: Float32Array): boolean {
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] !== 0) return true;
  }
  return false;
}

// ── Shipped demo scenario ─────────────────────────────────────────

describe("runRuntimeScenario — shipped footsteps demo", () => {
  it("resolves the scripted state/context timeline to recipes", async () => {
    const scenario = await loadRuntimeScenario(DEMO_SCENARIO);
    const result = await runRuntimeScenario(scenario);

    expect(result.scenario).toBe("runtime_footsteps");
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.render.samples.length).toBeGreaterThan(0);
    expect(result.render.sampleRate).toBe(44100);
    expect(hasSignal(result.render.samples)).toBe(true);
  });

  it("records the context-driven recipe change (footstep-stone → footstep-gravel)", async () => {
    const scenario = await loadRuntimeScenario(DEMO_SCENARIO);
    const result = await runRuntimeScenario(scenario);

    const recipes = [...new Set(result.events.map((e) => e.recipe))];
    expect(recipes).toContain("footstep-stone");
    expect(recipes).toContain("footstep-gravel");

    // Stone must be heard before gravel, and the log must record both.
    const firstStone = result.events.findIndex((e) => e.recipe === "footstep-stone");
    const firstGravel = result.events.findIndex((e) => e.recipe === "footstep-gravel");
    expect(firstStone).toBeGreaterThanOrEqual(0);
    expect(firstGravel).toBeGreaterThan(firstStone);

    const logRecipes = result.log
      .filter((entry) => entry.event.type === "event_fire")
      .map((entry) => entry.event.detail["resolvedRecipe"]);
    expect(logRecipes).toContain("footstep-stone");
    expect(logRecipes).toContain("footstep-gravel");
  });

  it("records the state change from walk to sprint", async () => {
    const scenario = await loadRuntimeScenario(DEMO_SCENARIO);
    const result = await runRuntimeScenario(scenario);

    const states = result.events.map((e) => e.state);
    expect(states).toContain("walk");
    expect(states).toContain("sprint");

    const stateChanges = result.log
      .filter((entry) => entry.event.type === "state_change")
      .map((entry) => entry.event.detail["to"]);
    expect(stateChanges).toContain("walk");
    expect(stateChanges).toContain("sprint");
  });

  it("emits a standalone render for every resolved event", async () => {
    const scenario = await loadRuntimeScenario(DEMO_SCENARIO);
    const result = await runRuntimeScenario(scenario);

    expect(result.eventRenders).toHaveLength(result.events.length);
    result.eventRenders.forEach((entry, i) => {
      expect(entry.event).toEqual(result.events[i]);
      expect(entry.render.samples.length).toBeGreaterThan(0);
    });
  });

  it("orders the timeline by absolute time", async () => {
    const scenario = await loadRuntimeScenario(DEMO_SCENARIO);
    const result = await runRuntimeScenario(scenario);

    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i]!.time_ms).toBeGreaterThanOrEqual(
        result.events[i - 1]!.time_ms,
      );
    }
  });
});

// ── Determinism ───────────────────────────────────────────────────

describe("runRuntimeScenario — determinism", () => {
  it("reproduces the same event log and samples for a fixed seed", async () => {
    const scenario = await loadRuntimeScenario(DEMO_SCENARIO);
    const first = await runRuntimeScenario(scenario);
    const second = await runRuntimeScenario(scenario);

    expect(JSON.stringify(second.log)).toBe(JSON.stringify(first.log));
    expect(JSON.stringify(second.events)).toBe(JSON.stringify(first.events));
    expect(samplesEqual(second.render.samples, first.render.samples)).toBe(true);
  });

  it("produces a different timeline when the seed changes", async () => {
    const scenario = await loadRuntimeScenario(DEMO_SCENARIO);
    const first = await runRuntimeScenario(scenario);
    const second = await runRuntimeScenario({ ...scenario, seed: 99 });

    expect(JSON.stringify(second.events)).not.toBe(JSON.stringify(first.events));
  });
});

// ── State/context audibly change the buffer ───────────────────────

describe("runRuntimeScenario — state/context change the audio", () => {
  it("renders different buffers for different surfaces", async () => {
    const stone = await runRuntimeScenario(miniScenario("stone", "walk"));
    const gravel = await runRuntimeScenario(miniScenario("gravel", "walk"));

    expect(stone.events.every((e) => e.recipe === "footstep-stone")).toBe(true);
    expect(gravel.events.every((e) => e.recipe === "footstep-gravel")).toBe(true);
    expect(samplesEqual(stone.render.samples, gravel.render.samples)).toBe(false);
  });

  it("renders different buffers for different states on the same surface", async () => {
    const walk = await runRuntimeScenario(miniScenario("gravel", "walk"));
    const sprint = await runRuntimeScenario(miniScenario("gravel", "sprint"));

    expect(samplesEqual(walk.render.samples, sprint.render.samples)).toBe(false);
  });
});

// ── Browser scheduling helper ─────────────────────────────────────

function fakeContext(): {
  ctx: SchedulableAudioContext;
  copied: Float32Array[];
  started: () => number | undefined;
  connected: () => boolean;
} {
  const copied: Float32Array[] = [];
  let startedAt: number | undefined;
  let connectedToDestination = false;

  const ctx: SchedulableAudioContext = {
    destination: { kind: "destination" },
    createBuffer(_channels, length, sampleRate) {
      return {
        length,
        sampleRate,
        copyToChannel(source: Float32Array) {
          copied.push(source);
        },
      };
    },
    createBufferSource() {
      const source = {
        buffer: null,
        connect() {
          connectedToDestination = true;
          return source;
        },
        start(when?: number) {
          startedAt = when;
        },
      };
      return source;
    },
  };

  return {
    ctx,
    copied,
    started: () => startedAt,
    connected: () => connectedToDestination,
  };
}

describe("scheduleRuntimeBuffer", () => {
  it("copies samples into an AudioBuffer and starts a source", () => {
    const fake = fakeContext();
    const samples = new Float32Array([0.1, 0.2, 0.3]);

    const source = scheduleRuntimeBuffer(fake.ctx, samples, 44100);

    expect(source.buffer).not.toBeNull();
    expect(fake.copied).toHaveLength(1);
    expect(fake.copied[0]).toBe(samples);
    expect(fake.connected()).toBe(true);
    expect(fake.started()).toBe(0);
  });

  it("honours the when option", () => {
    const fake = fakeContext();
    scheduleRuntimeBuffer(fake.ctx, new Float32Array([1, 0, -1]), 44100, {
      when: 1.5,
    });
    expect(fake.started()).toBe(1.5);
  });

  it("rejects an empty buffer", () => {
    const fake = fakeContext();
    expect(() => scheduleRuntimeBuffer(fake.ctx, new Float32Array(0), 44100)).toThrow(
      /empty audio buffer/,
    );
  });
});

describe("playRenderResultOnContext", () => {
  it("schedules a rendered result on the context", () => {
    const fake = fakeContext();
    const result = {
      samples: new Float32Array([0.5, -0.5]),
      sampleRate: 22050,
      duration: 0.5,
      numberOfChannels: 1,
    };

    playRenderResultOnContext(fake.ctx, result);

    expect(fake.copied).toHaveLength(1);
    expect(fake.copied[0]).toBe(result.samples);
    expect(fake.connected()).toBe(true);
  });
});
