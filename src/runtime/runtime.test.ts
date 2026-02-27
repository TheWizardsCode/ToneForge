/**
 * Runtime Tests
 *
 * Tests for createRuntime(): start/stop lifecycle, state/context integration,
 * event logging, determinism, inspection, and recipe resolution.
 *
 * Work item: TF-0MM1N6PCH1O8DLZN
 */

import { describe, it, expect } from "vitest";
import { createRuntime } from "./runtime.js";
import type { RuntimeLogEntry } from "./runtime.js";
import { createStateMachine } from "../state/state.js";
import type { StateMachineDefinition } from "../state/state.js";
import { createContext } from "../context/context.js";
import { parseSequencePreset } from "../sequence/schema.js";
import type { SequenceDefinition } from "../sequence/schema.js";

// ── Helpers ───────────────────────────────────────────────────────

function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let time = 1000;
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

function movementDef(): StateMachineDefinition {
  return {
    name: "movement",
    states: [
      { name: "idle" },
      { name: "walk", sequencer: "footsteps_walk" },
      { name: "run", sequencer: "footsteps_run" },
      { name: "sprint", sequencer: "footsteps_sprint" },
    ],
    initial: "idle",
    transitions: [
      { from: "idle", to: "walk" },
      { from: "walk", to: "idle" },
      { from: "walk", to: "run" },
      { from: "run", to: "walk" },
      { from: "run", to: "sprint" },
      { from: "sprint", to: "run" },
    ],
  };
}

function walkSequence(): SequenceDefinition {
  return parseSequencePreset(
    {
      version: "1.0",
      name: "footsteps_walk",
      events: [
        { time: 0, event: "footstep", seedOffset: 0, gain: 0.7 },
        { time: 0.6, event: "footstep", seedOffset: 1, gain: 0.65 },
      ],
    },
    "test-walk",
  );
}

function runSequence(): SequenceDefinition {
  return parseSequencePreset(
    {
      version: "1.0",
      name: "footsteps_run",
      events: [
        { time: 0, event: "footstep", seedOffset: 0, gain: 0.85 },
        { time: 0.35, event: "footstep", seedOffset: 1, gain: 0.8 },
      ],
    },
    "test-run",
  );
}

function sprintSequence(): SequenceDefinition {
  return parseSequencePreset(
    {
      version: "1.0",
      name: "footsteps_sprint",
      events: [
        { time: 0, event: "footstep", seedOffset: 0, gain: 1.0 },
        { time: 0.25, event: "footstep", seedOffset: 1, gain: 0.95 },
      ],
    },
    "test-sprint",
  );
}

function createTestRuntime(clockOverride?: { now: () => number }) {
  const clock = clockOverride ?? fakeClock();
  const sm = createStateMachine(movementDef(), { clock: "now" in clock ? clock.now : undefined });
  const ctx = createContext({
    dimensions: { surface: ["stone", "gravel"] },
    initial: { surface: "stone" },
    clock: "now" in clock ? clock.now : undefined,
  });

  const sequences = {
    footsteps_walk: walkSequence(),
    footsteps_run: runSequence(),
    footsteps_sprint: sprintSequence(),
  };

  const recipeResolver = (eventName: string, context: Record<string, string>) => {
    if (eventName === "footstep") {
      const surface = context["surface"] ?? "stone";
      return `footstep-${surface}`;
    }
    return eventName;
  };

  const runtime = createRuntime({
    stateMachine: sm,
    context: ctx,
    sequences,
    seed: 42,
    clock: "now" in clock ? clock.now : undefined,
    recipeResolver,
  });

  return { runtime, sm, ctx, clock: "now" in clock ? clock : undefined };
}

// ── createRuntime — basics ───────────────────────────────────────

describe("createRuntime — basics", () => {
  it("is not running initially", () => {
    const { runtime } = createTestRuntime();
    expect(runtime.isRunning()).toBe(false);
  });

  it("sessionId is null before start", () => {
    const { runtime } = createTestRuntime();
    expect(runtime.sessionId()).toBeNull();
  });

  it("start() returns a session ID", () => {
    const { runtime } = createTestRuntime();
    const sid = runtime.start();
    expect(sid).toMatch(/^session-42-/);
    expect(runtime.isRunning()).toBe(true);
  });

  it("stop() stops the runtime", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it("throws when starting an already running runtime", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    expect(() => runtime.start()).toThrow(/already running/);
  });

  it("throws when stopping a non-running runtime", () => {
    const { runtime } = createTestRuntime();
    expect(() => runtime.stop()).toThrow(/not running/);
  });
});

// ── start/stop event logging ─────────────────────────────────────

describe("createRuntime — event logging", () => {
  it("logs a start event on start()", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    const events = runtime.log();
    const startEvent = events.find((e) => e.event.type === "start");
    expect(startEvent).toBeDefined();
    expect(startEvent!.event.detail["seed"]).toBe(42);
  });

  it("logs a stop event on stop()", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.stop();
    const events = runtime.log();
    const stopEvent = events.find((e) => e.event.type === "stop");
    expect(stopEvent).toBeDefined();
  });

  it("log entries have incrementing IDs", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.stop();
    const events = runtime.log();
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.event.id).toBeGreaterThan(events[i - 1]!.event.id);
    }
  });

  it("log() with limit returns most recent entries", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.stop();
    const allEvents = runtime.log();
    const limited = runtime.log(1);
    expect(limited).toHaveLength(1);
    expect(limited[0]!.event.id).toBe(allEvents[allEvents.length - 1]!.event.id);
  });
});

// ── state changes ────────────────────────────────────────────────

describe("createRuntime — setState", () => {
  it("throws when runtime is not running", () => {
    const { runtime } = createTestRuntime();
    expect(() => runtime.setState("walk")).toThrow(/not running/);
  });

  it("transitions state and logs state_change", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.setState("walk");
    const events = runtime.log();
    const stateChange = events.find((e) => e.event.type === "state_change");
    expect(stateChange).toBeDefined();
    expect(stateChange!.event.detail["from"]).toBe("idle");
    expect(stateChange!.event.detail["to"]).toBe("walk");
  });

  it("activates sequence when transitioning to a state with a sequencer", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.setState("walk");
    const events = runtime.log();
    const seqStart = events.find((e) => e.event.type === "sequence_start");
    expect(seqStart).toBeDefined();
    expect(seqStart!.event.detail["sequence"]).toBe("footsteps_walk");
  });

  it("fires event_fire for sequence events", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.setState("walk");
    const events = runtime.log();
    const fires = events.filter((e) => e.event.type === "event_fire");
    expect(fires.length).toBeGreaterThan(0);
    expect(fires[0]!.event.detail["resolvedRecipe"]).toBe("footstep-stone");
  });

  it("stops previous sequence when changing state", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.setState("walk");
    runtime.setState("run");
    const events = runtime.log();
    const seqStops = events.filter((e) => e.event.type === "sequence_stop");
    expect(seqStops.length).toBeGreaterThanOrEqual(1);
    expect(seqStops[0]!.event.detail["sequence"]).toBe("footsteps_walk");
  });
});

// ── context changes ──────────────────────────────────────────────

describe("createRuntime — setContext", () => {
  it("throws when runtime is not running", () => {
    const { runtime } = createTestRuntime();
    expect(() => runtime.setContext({ surface: "gravel" })).toThrow(/not running/);
  });

  it("changes context and logs context_change", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.setContext({ surface: "gravel" });
    const events = runtime.log();
    const ctxChange = events.find((e) => e.event.type === "context_change");
    expect(ctxChange).toBeDefined();
    expect(ctxChange!.event.detail["dimension"]).toBe("surface");
    expect(ctxChange!.event.detail["previousValue"]).toBe("stone");
    expect(ctxChange!.event.detail["newValue"]).toBe("gravel");
  });

  it("re-fires sequence events with new context after context change", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.setState("walk");

    // Count events before context change
    const beforeCount = runtime.log().filter((e) => e.event.type === "event_fire").length;

    runtime.setContext({ surface: "gravel" });

    // Should have additional event_fire entries with new resolved recipe
    const afterFires = runtime.log().filter((e) => e.event.type === "event_fire");
    expect(afterFires.length).toBeGreaterThan(beforeCount);

    // Most recent events should resolve to footstep-gravel
    const lastFire = afterFires[afterFires.length - 1]!;
    expect(lastFire.event.detail["resolvedRecipe"]).toBe("footstep-gravel");
  });
});

// ── inspect ──────────────────────────────────────────────────────

describe("createRuntime — inspect", () => {
  it("shows not running when stopped", () => {
    const { runtime } = createTestRuntime();
    const info = runtime.inspect();
    expect(info.running).toBe(false);
    expect(info.sessionId).toBeNull();
  });

  it("shows running state after start", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    const info = runtime.inspect();
    expect(info.running).toBe(true);
    expect(info.sessionId).not.toBeNull();
    expect(info.seed).toBe(42);
  });

  it("shows current state machine info", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.setState("walk");
    const info = runtime.inspect();
    expect(info.state).not.toBeNull();
    expect(info.state!.currentState).toBe("walk");
    expect(info.state!.machineName).toBe("movement");
  });

  it("shows current context snapshot", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    const info = runtime.inspect();
    expect(info.context["surface"]).toBe("stone");
  });

  it("shows active sequences", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.setState("walk");
    const info = runtime.inspect();
    expect(info.activeSequences).toContain("footsteps_walk");
  });
});

// ── determinism ──────────────────────────────────────────────────

describe("createRuntime — determinism", () => {
  it("identical command sequences produce identical logs", () => {
    function runSession() {
      const clock = fakeClock();
      const { runtime } = createTestRuntime(clock);
      runtime.start();
      clock.advance(100);
      runtime.setState("walk");
      clock.advance(200);
      runtime.setContext({ surface: "gravel" });
      clock.advance(150);
      runtime.setState("run");
      clock.advance(100);
      runtime.stop();
      return runtime.log().map((e) => ({
        type: e.event.type,
        detail: e.event.detail,
        seed: e.event.seed,
      }));
    }

    const log1 = runSession();
    const log2 = runSession();

    expect(log1).toEqual(log2);
  });

  it("different seeds produce different session IDs", () => {
    const clock = fakeClock();
    const r1 = createRuntime({ seed: 1, clock: clock.now });
    const r2 = createRuntime({ seed: 2, clock: clock.now });
    const s1 = r1.start();
    const s2 = r2.start();
    expect(s1).not.toBe(s2);
  });
});

// ── onEvent listener ─────────────────────────────────────────────

describe("createRuntime — onEvent", () => {
  it("notifies listener of events", () => {
    const { runtime } = createTestRuntime();
    const received: RuntimeLogEntry[] = [];
    runtime.onEvent((entry) => received.push(entry));
    runtime.start();
    expect(received.length).toBeGreaterThan(0);
    expect(received[0]!.event.type).toBe("start");
  });

  it("unsubscribe stops notifications", () => {
    const { runtime } = createTestRuntime();
    const received: RuntimeLogEntry[] = [];
    const unsub = runtime.onEvent((entry) => received.push(entry));
    runtime.start();
    unsub();
    const countBefore = received.length;
    runtime.setState("walk");
    // Should not have received state_change events after unsubscribe
    // Note: received.length may be > countBefore because setState fires
    // events, but we unsubscribed, so it shouldn't
    expect(received.length).toBe(countBefore);
  });
});

// ── simulateActive ───────────────────────────────────────────────

describe("createRuntime — simulateActive", () => {
  it("returns null when no state machine is attached", () => {
    const rt = createRuntime({ seed: 42 });
    expect(rt.simulateActive()).toBeNull();
  });

  it("returns null for a state with no sequence", () => {
    const { runtime } = createTestRuntime();
    // idle has no sequencer
    expect(runtime.simulateActive()).toBeNull();
  });

  it("returns simulation for active state", () => {
    const { runtime, sm } = createTestRuntime();
    sm.set("walk");
    const sim = runtime.simulateActive();
    expect(sim).not.toBeNull();
    expect(sim!.name).toBe("footsteps_walk");
    expect(sim!.events.length).toBeGreaterThan(0);
  });
});

// ── reset ────────────────────────────────────────────────────────

describe("createRuntime — reset", () => {
  it("resets all state and log", () => {
    const { runtime } = createTestRuntime();
    runtime.start();
    runtime.setState("walk");
    runtime.reset();
    expect(runtime.isRunning()).toBe(false);
    expect(runtime.sessionId()).toBeNull();
    expect(runtime.log()).toEqual([]);
  });

  it("resets attached state machine", () => {
    const { runtime, sm } = createTestRuntime();
    runtime.start();
    runtime.setState("walk");
    runtime.reset();
    expect(sm.current()).toBe("idle");
  });

  it("resets attached context", () => {
    const { runtime, ctx } = createTestRuntime();
    runtime.start();
    runtime.setContext({ surface: "gravel" });
    runtime.reset();
    expect(ctx.get()["surface"]).toBe("stone");
  });
});

// ── runtime without state machine / context ──────────────────────

describe("createRuntime — minimal (no state/context)", () => {
  it("starts and stops cleanly with no attachments", () => {
    const rt = createRuntime({ seed: 99 });
    rt.start();
    expect(rt.isRunning()).toBe(true);
    rt.stop();
    expect(rt.isRunning()).toBe(false);
  });

  it("throws when setting state without a state machine", () => {
    const rt = createRuntime({ seed: 99 });
    rt.start();
    expect(() => rt.setState("walk")).toThrow(/No state machine/);
  });

  it("throws when setting context without a context", () => {
    const rt = createRuntime({ seed: 99 });
    rt.start();
    expect(() => rt.setContext({ surface: "stone" })).toThrow(/No context/);
  });
});
