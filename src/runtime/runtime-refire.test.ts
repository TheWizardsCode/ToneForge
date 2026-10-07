/**
 * Runtime `refireActive` Tests
 *
 * The live-looping seam: re-firing the active sequence emits a fresh batch of
 * resolved events without changing state, with an optional seed offset.
 *
 * Work item: TF-0MUYF87JH0089VQO
 */

import { describe, it, expect } from "vitest";
import { createRuntime } from "./runtime.js";
import { createStateMachine } from "../state/state.js";
import { createContext } from "../context/context.js";
import { parseSequencePreset } from "../sequence/schema.js";
import type { SequenceDefinition } from "../sequence/schema.js";

function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let time = 1000;
  return { now: () => time, advance: (ms) => { time += ms; } };
}

function walkSequence(): SequenceDefinition {
  return parseSequencePreset(
    {
      version: "1.0",
      name: "seq_walk",
      events: [
        { time: 0, event: "footstep", seedOffset: 0, gain: 0.7 },
        { time: 0.6, event: "footstep", seedOffset: 1, gain: 0.65 },
      ],
    },
    "seq_walk",
  );
}

function makeRuntime() {
  const clock = fakeClock();
  const runtime = createRuntime({
    seed: 42,
    clock: clock.now,
    stateMachine: createStateMachine(
      {
        name: "movement",
        initial: "idle",
        states: [
          { name: "idle" },
          { name: "walk", sequencer: "seq_walk" },
        ],
        transitions: [
          { from: "idle", to: "walk" },
          { from: "walk", to: "idle" },
        ],
      },
      { clock: clock.now },
    ),
    context: createContext({
      dimensions: { surface: ["stone", "gravel"] },
      initial: { surface: "stone" },
      clock: clock.now,
    }),
    sequences: { seq_walk: walkSequence() },
    recipeResolver: (event, ctx) =>
      ctx["surface"] ? `${event}-${ctx["surface"]}` : event,
  });
  return { runtime, clock };
}

function fireDetails(runtime: ReturnType<typeof makeRuntime>["runtime"]) {
  return runtime
    .log()
    .filter((e) => e.event.type === "event_fire")
    .map((e) => e.event.detail);
}

describe("Runtime.refireActive", () => {
  it("emits a fresh resolved batch without changing state", () => {
    const { runtime } = makeRuntime();
    runtime.start();
    runtime.setState("walk");

    const before = fireDetails(runtime).length;
    const refired = runtime.refireActive();

    expect(refired).toBe(true);
    expect(runtime.inspect().state?.currentState).toBe("walk");
    expect(fireDetails(runtime).length).toBe(before + 2);
  });

  it("applies a seed offset for deterministic variation", () => {
    const { runtime } = makeRuntime();
    runtime.start();
    runtime.setState("walk");
    const first = fireDetails(runtime).map((d) => d["eventSeed"]);

    runtime.refireActive(1000);
    const all = fireDetails(runtime).map((d) => d["eventSeed"]);

    expect(first).toEqual([42, 43]);
    expect(all.slice(2)).toEqual([1042, 1043]);
  });

  it("resolves recipes against the current context each time", () => {
    const { runtime } = makeRuntime();
    runtime.start();
    runtime.setState("walk");

    runtime.setContext({ surface: "gravel" });
    runtime.refireActive();

    const recipes = fireDetails(runtime).map((d) => d["resolvedRecipe"]);
    expect(recipes).toContain("footstep-stone");
    expect(recipes).toContain("footstep-gravel");
  });

  it("returns false when no sequence is active", () => {
    const { runtime } = makeRuntime();
    runtime.start();
    expect(runtime.refireActive()).toBe(false);
  });

  it("throws when the runtime is not running", () => {
    const { runtime } = makeRuntime();
    expect(() => runtime.refireActive()).toThrow(/not running/);
  });
});
