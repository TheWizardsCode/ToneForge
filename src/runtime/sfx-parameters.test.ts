/**
 * Real-time SFX Parameter Adjustment Tests
 *
 * Tests for setSfxParameter(id, name, value): updating parameters of
 * currently playing sounds in real time, scoped to continuous/looping
 * sounds.
 *
 * Work item: TF-0MLYX9DP51U7AQDK
 */

import { describe, it, expect } from "vitest";
import { createRuntime } from "./runtime.js";
import type { RuntimeLogEntry, RuntimeEvent } from "./runtime.js";
import { createStateMachine } from "../state/state.js";
import type { StateMachineDefinition } from "../state/state.js";
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

function loopSequence(): SequenceDefinition {
  return parseSequencePreset(
    {
      version: "1.0",
      name: "engine_loop",
      events: [
        { time: 0, event: "engine", seedOffset: 0, gain: 0.8 },
      ],
      repeat: { count: 0, interval: 1.0 },
    },
    "test-engine",
  );
}

function createLoopRuntime() {
  const clock = fakeClock();
  const sm = createStateMachine(
    {
      name: "vehicle",
      states: [
        { name: "stopped" },
        { name: "running", sequencer: "engine_loop" },
      ],
      initial: "stopped",
      transitions: [
        { from: "stopped", to: "running" },
        { from: "running", to: "stopped" },
      ],
    },
    { clock: clock.now },
  );

  const sequences = { engine_loop: loopSequence() };

  const runtime = createRuntime({
    stateMachine: sm,
    sequences,
    seed: 42,
    clock: clock.now,
  });

  return { runtime, sm, clock };
}

/**
 * Helper to find events of a specific type in the log.
 */
function findEvents(
  log: readonly RuntimeLogEntry[],
  type: RuntimeEvent["type"],
): RuntimeLogEntry[] {
  return log.filter((e) => e.event.type === type);
}

// ── setSfxParameter — basic usage ────────────────────────────────

describe("setSfxParameter — basic usage", () => {
  it("throws when runtime is not running", () => {
    const { runtime } = createLoopRuntime();
    expect(() =>
      runtime.setSfxParameter("engine-1", "intensity", 0.5),
    ).toThrow(/not running/);
  });

  it("updates the intensity parameter of a sound", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(100);

    const result = runtime.setSfxParameter("engine-1", "intensity", 0.5);

    expect(result).toEqual({ id: "engine-1", name: "intensity", value: 0.5 });

    const events = runtime.log();
    const paramEvents = findEvents(events, "parameter_change");
    expect(paramEvents).toHaveLength(1);
    expect(paramEvents[0]!.event.detail["id"]).toBe("engine-1");
    expect(paramEvents[0]!.event.detail["name"]).toBe("intensity");
    expect(paramEvents[0]!.event.detail["value"]).toBe(0.5);
  });

  it("updates the gain parameter of a sound", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    runtime.setSfxParameter("sfx-1", "gain", 0.8);

    const events = runtime.log();
    const paramEvents = findEvents(events, "parameter_change");
    expect(paramEvents[0]!.event.detail["name"]).toBe("gain");
    expect(paramEvents[0]!.event.detail["value"]).toBe(0.8);
  });

  it("updates the pitch parameter of a sound", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    runtime.setSfxParameter("engine-1", "pitch", 1.5);

    const events = runtime.log();
    const paramEvents = findEvents(events, "parameter_change");
    expect(paramEvents[0]!.event.detail["name"]).toBe("pitch");
    expect(paramEvents[0]!.event.detail["value"]).toBe(1.5);
  });

  it("supports repeated parameter changes", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    runtime.setSfxParameter("engine-1", "intensity", 0.3);
    clock.advance(100);
    runtime.setSfxParameter("engine-1", "intensity", 0.7);
    clock.advance(100);
    runtime.setSfxParameter("engine-1", "intensity", 1.0);

    const events = runtime.log();
    const paramEvents = findEvents(events, "parameter_change");
    expect(paramEvents).toHaveLength(3);
    expect(paramEvents[0]!.event.detail["value"]).toBe(0.3);
    expect(paramEvents[1]!.event.detail["value"]).toBe(0.7);
    expect(paramEvents[2]!.event.detail["value"]).toBe(1.0);
  });
});

// ── setSfxParameter — validation ─────────────────────────────────

describe("setSfxParameter — validation", () => {
  it("rejects unknown parameter names", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    expect(() =>
      runtime.setSfxParameter("engine-1", "unknown_param", 0.5),
    ).toThrow(/unknown parameter/i);
  });

  it("rejects out-of-range values (negative gain)", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    expect(() =>
      runtime.setSfxParameter("engine-1", "gain", -0.1),
    ).toThrow(/out of range/);
  });

  it("rejects out-of-range values (gain > 1.0)", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    expect(() =>
      runtime.setSfxParameter("engine-1", "gain", 1.1),
    ).toThrow(/out of range/);
  });

  it("rejects out-of-range values (intensity > 1.0)", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    expect(() =>
      runtime.setSfxParameter("engine-1", "intensity", 1.5),
    ).toThrow(/out of range/);
  });

  it("rejects out-of-range values (intensity < 0)", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    expect(() =>
      runtime.setSfxParameter("engine-1", "intensity", -0.1),
    ).toThrow(/out of range/);
  });

  it("rejects out-of-range values (pitch < 0.1)", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    expect(() =>
      runtime.setSfxParameter("engine-1", "pitch", 0.0),
    ).toThrow(/out of range/);
  });

  it("rejects out-of-range values (pitch > 4.0)", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    expect(() =>
      runtime.setSfxParameter("engine-1", "pitch", 5.0),
    ).toThrow(/out of range/);
  });

  it("allows boundary values (gain 0 and 1)", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    expect(() =>
      runtime.setSfxParameter("engine-1", "gain", 0),
    ).not.toThrow();
    expect(() =>
      runtime.setSfxParameter("engine-1", "gain", 1),
    ).not.toThrow();
  });

  it("allows boundary values (intensity 0 and 1)", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    expect(() =>
      runtime.setSfxParameter("engine-1", "intensity", 0),
    ).not.toThrow();
    expect(() =>
      runtime.setSfxParameter("engine-1", "intensity", 1),
    ).not.toThrow();
  });
});

// ── setSfxParameter — determinism ────────────────────────────────

describe("setSfxParameter — determinism", () => {
  it("identical parameter sequences produce identical logs", () => {
    function runSession(): RuntimeLogEntry[] {
      const clock = fakeClock();
      const { runtime } = createLoopRuntime();
      runtime.start();
      clock.advance(50);
      runtime.setSfxParameter("engine-1", "intensity", 0.3);
      clock.advance(100);
      runtime.setSfxParameter("engine-1", "gain", 0.8);
      clock.advance(50);
      runtime.setSfxParameter("engine-1", "pitch", 1.2);
      clock.advance(50);
      runtime.stop();
      return runtime.log();
    }

    const log1 = runSession();
    const log2 = runSession();

    const events1 = findEvents(log1, "parameter_change");
    const events2 = findEvents(log2, "parameter_change");

    expect(events1).toHaveLength(events2.length);
    for (let i = 0; i < events1.length; i++) {
      expect(events1[i]!.event.detail).toEqual(events2[i]!.event.detail);
    }
  });
});

// ── setSfxParameter — multiple sounds ────────────────────────────

describe("setSfxParameter — multiple sounds", () => {
  it("tracks parameters independently per sound ID", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    runtime.setSfxParameter("engine-1", "intensity", 0.5);
    runtime.setSfxParameter("engine-2", "intensity", 0.8);

    const events = runtime.log();
    const paramEvents = findEvents(events, "parameter_change");
    expect(paramEvents).toHaveLength(2);
    expect(paramEvents[0]!.event.detail["id"]).toBe("engine-1");
    expect(paramEvents[1]!.event.detail["id"]).toBe("engine-2");
  });

  it("different parameter names for different sounds", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    runtime.setSfxParameter("engine-1", "intensity", 0.5);
    runtime.setSfxParameter("engine-1", "gain", 0.7);

    const events = runtime.log();
    const paramEvents = findEvents(events, "parameter_change");
    expect(paramEvents).toHaveLength(2);
    expect(paramEvents[0]!.event.detail["name"]).toBe("intensity");
    expect(paramEvents[1]!.event.detail["name"]).toBe("gain");
  });
});

// ── setSfxParameter — engine user story ──────────────────────────

describe("setSfxParameter — engine user story", () => {
  it("engine pitch tracks RPM in a continuous loop", () => {
    const { runtime, clock, sm } = createLoopRuntime();
    runtime.start();
    sm.set("running");
    clock.advance(50);

    // RPM 0.3 → intensity 0.3, pitch 0.6
    runtime.setSfxParameter("engine-1", "intensity", 0.3);
    runtime.setSfxParameter("engine-1", "pitch", 0.6);
    clock.advance(200);

    // RPM 0.7 → intensity 0.7, pitch 1.4
    runtime.setSfxParameter("engine-1", "intensity", 0.7);
    runtime.setSfxParameter("engine-1", "pitch", 1.4);
    clock.advance(200);

    // RPM 1.0 → intensity 1.0, pitch 2.0
    runtime.setSfxParameter("engine-1", "intensity", 1.0);
    runtime.setSfxParameter("engine-1", "pitch", 2.0);
    clock.advance(100);

    const events = runtime.log();
    const paramEvents = findEvents(events, "parameter_change");
    expect(paramEvents).toHaveLength(6);

    // Verify the RPM progression is logged
    const intensities = paramEvents.map(
      (e) => e.event.detail["value"] as number,
    );
    const names = paramEvents.map((e) => e.event.detail["name"] as string);

    // Check that all expected changes occurred
    expect(names[0]).toBe("intensity");
    expect(names[1]).toBe("pitch");
    expect(names[2]).toBe("intensity");
    expect(names[3]).toBe("pitch");
    expect(names[4]).toBe("intensity");
    expect(names[5]).toBe("pitch");
  });
});

// ── setSfxParameter — error does not corrupt state ───────────────

describe("setSfxParameter — error resilience", () => {
  it("invalid parameter does not corrupt subsequent valid operations", () => {
    const { runtime, clock } = createLoopRuntime();
    runtime.start();
    clock.advance(50);

    // Invalid param — should throw, not corrupt
    expect(() =>
      runtime.setSfxParameter("engine-1", "bogus", 0.5),
    ).toThrow(/unknown parameter/i);

    // Subsequent valid param should still work
    runtime.setSfxParameter("engine-1", "intensity", 0.5);

    const events = runtime.log();
    const paramEvents = findEvents(events, "parameter_change");
    expect(paramEvents).toHaveLength(1);
    expect(paramEvents[0]!.event.detail["value"]).toBe(0.5);
  });
});
