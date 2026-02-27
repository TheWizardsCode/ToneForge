/**
 * State Machine Tests
 *
 * Tests for createStateMachine(): state transitions, validation,
 * transition restrictions, inspection, history, listeners, and reset.
 *
 * Work item: TF-0MM1N6PCH1O8DLZN
 */

import { describe, it, expect } from "vitest";
import { createStateMachine } from "./state.js";
import type {
  StateMachineDefinition,
  TransitionRecord,
} from "./state.js";

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

/** Movement state machine definition for tests. */
function movementDef(): StateMachineDefinition {
  return {
    name: "movement",
    states: [
      { name: "idle", params: { cadence: 0, intensity: 0 } },
      { name: "walk", sequencer: "footsteps_walk", params: { cadence: 0.6, intensity: 0.7 } },
      { name: "run", sequencer: "footsteps_run", params: { cadence: 0.35, intensity: 0.85 } },
      { name: "sprint", sequencer: "footsteps_sprint", params: { cadence: 0.25, intensity: 1.0 } },
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

/** Simple two-state definition (all transitions allowed). */
function toggleDef(): StateMachineDefinition {
  return {
    name: "toggle",
    states: [{ name: "on" }, { name: "off" }],
    initial: "on",
    // No transitions defined → all allowed
  };
}

// ── createStateMachine — basics ──────────────────────────────────

describe("createStateMachine — basics", () => {
  it("starts in the initial state", () => {
    const sm = createStateMachine(movementDef());
    expect(sm.current()).toBe("idle");
  });

  it("returns the definition", () => {
    const def = movementDef();
    const sm = createStateMachine(def);
    expect(sm.definition().name).toBe("movement");
    expect(sm.definition().states).toHaveLength(4);
  });

  it("returns the current state definition", () => {
    const sm = createStateMachine(movementDef());
    const def = sm.currentDefinition();
    expect(def.name).toBe("idle");
    expect(def.params?.intensity).toBe(0);
  });
});

// ── validation ───────────────────────────────────────────────────

describe("createStateMachine — validation", () => {
  it("throws on duplicate state names", () => {
    expect(() =>
      createStateMachine({
        name: "test",
        states: [{ name: "a" }, { name: "a" }],
        initial: "a",
      }),
    ).toThrow(/Duplicate state name: 'a'/);
  });

  it("throws on unknown initial state", () => {
    expect(() =>
      createStateMachine({
        name: "test",
        states: [{ name: "a" }],
        initial: "b",
      }),
    ).toThrow(/Initial state 'b' not found/);
  });

  it("throws on transition referencing unknown from-state", () => {
    expect(() =>
      createStateMachine({
        name: "test",
        states: [{ name: "a" }, { name: "b" }],
        initial: "a",
        transitions: [{ from: "x", to: "b" }],
      }),
    ).toThrow(/Transition references unknown state 'x'/);
  });

  it("throws on transition referencing unknown to-state", () => {
    expect(() =>
      createStateMachine({
        name: "test",
        states: [{ name: "a" }, { name: "b" }],
        initial: "a",
        transitions: [{ from: "a", to: "z" }],
      }),
    ).toThrow(/Transition references unknown state 'z'/);
  });
});

// ── set (transitions) ────────────────────────────────────────────

describe("createStateMachine — set", () => {
  it("transitions to a valid state", () => {
    const sm = createStateMachine(movementDef());
    const record = sm.set("walk");
    expect(record.from).toBe("idle");
    expect(record.to).toBe("walk");
    expect(sm.current()).toBe("walk");
  });

  it("throws on unknown state", () => {
    const sm = createStateMachine(movementDef());
    expect(() => sm.set("flying")).toThrow(/Unknown state 'flying'/);
  });

  it("throws on transition to self", () => {
    const sm = createStateMachine(movementDef());
    expect(() => sm.set("idle")).toThrow(/Already in state 'idle'/);
  });

  it("throws on disallowed transition", () => {
    const sm = createStateMachine(movementDef());
    // Can't go from idle directly to sprint
    expect(() => sm.set("sprint")).toThrow(
      /Transition from 'idle' to 'sprint' is not allowed/,
    );
  });

  it("allows any transition when transitions are not defined", () => {
    const sm = createStateMachine(toggleDef());
    sm.set("off");
    expect(sm.current()).toBe("off");
    sm.set("on");
    expect(sm.current()).toBe("on");
  });

  it("records durationInPreviousMs using clock", () => {
    const clock = fakeClock();
    const sm = createStateMachine(movementDef(), { clock: clock.now });
    clock.advance(250);
    const record = sm.set("walk");
    expect(record.durationInPreviousMs).toBe(250);
  });

  it("increments seq for each transition", () => {
    const sm = createStateMachine(movementDef());
    const r1 = sm.set("walk");
    const r2 = sm.set("run");
    expect(r1.seq).toBe(1);
    expect(r2.seq).toBe(2);
  });
});

// ── inspect ──────────────────────────────────────────────────────

describe("createStateMachine — inspect", () => {
  it("returns current state info", () => {
    const clock = fakeClock();
    const sm = createStateMachine(movementDef(), { clock: clock.now });
    sm.set("walk");
    clock.advance(300);
    const info = sm.inspect();
    expect(info.machineName).toBe("movement");
    expect(info.currentState).toBe("walk");
    expect(info.timeInCurrentMs).toBe(300);
    expect(info.activeSequence).toBe("footsteps_walk");
  });

  it("transitions are included in inspect", () => {
    const sm = createStateMachine(movementDef());
    sm.set("walk");
    sm.set("run");
    const info = sm.inspect();
    expect(info.transitions).toHaveLength(2);
  });

  it("activeSequence is undefined for states without sequencer", () => {
    const sm = createStateMachine(movementDef());
    const info = sm.inspect();
    expect(info.activeSequence).toBeUndefined();
  });
});

// ── history ──────────────────────────────────────────────────────

describe("createStateMachine — history", () => {
  it("starts with empty history", () => {
    const sm = createStateMachine(movementDef());
    expect(sm.history()).toEqual([]);
  });

  it("records transitions in order", () => {
    const sm = createStateMachine(movementDef());
    sm.set("walk");
    sm.set("run");
    const hist = sm.history();
    expect(hist).toHaveLength(2);
    expect(hist[0]!.to).toBe("walk");
    expect(hist[1]!.to).toBe("run");
  });

  it("limits history with the limit param", () => {
    const sm = createStateMachine(movementDef());
    sm.set("walk");
    sm.set("run");
    sm.set("sprint");
    const hist = sm.history(2);
    expect(hist).toHaveLength(2);
    expect(hist[0]!.to).toBe("run");
    expect(hist[1]!.to).toBe("sprint");
  });

  it("trims to maxHistory", () => {
    const sm = createStateMachine(movementDef(), { maxHistory: 2 });
    sm.set("walk");
    sm.set("run");
    sm.set("sprint"); // oldest should be trimmed
    const hist = sm.history();
    expect(hist).toHaveLength(2);
    expect(hist[0]!.to).toBe("run");
  });
});

// ── onTransition ─────────────────────────────────────────────────

describe("createStateMachine — onTransition", () => {
  it("notifies listeners on transition", () => {
    const sm = createStateMachine(movementDef());
    const records: TransitionRecord[] = [];
    sm.onTransition((r) => records.push(r));
    sm.set("walk");
    expect(records).toHaveLength(1);
    expect(records[0]!.to).toBe("walk");
  });

  it("unsubscribe stops notifications", () => {
    const sm = createStateMachine(movementDef());
    const records: TransitionRecord[] = [];
    const unsub = sm.onTransition((r) => records.push(r));
    sm.set("walk");
    unsub();
    sm.set("run");
    expect(records).toHaveLength(1);
  });
});

// ── reset ────────────────────────────────────────────────────────

describe("createStateMachine — reset", () => {
  it("resets to initial state", () => {
    const sm = createStateMachine(movementDef());
    sm.set("walk");
    sm.set("run");
    sm.reset();
    expect(sm.current()).toBe("idle");
  });

  it("clears history", () => {
    const sm = createStateMachine(movementDef());
    sm.set("walk");
    sm.reset();
    expect(sm.history()).toEqual([]);
  });

  it("resets seq counter", () => {
    const sm = createStateMachine(movementDef());
    sm.set("walk");
    sm.reset();
    const record = sm.set("walk");
    expect(record.seq).toBe(1);
  });
});
