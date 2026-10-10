/**
 * Network → Runtime/State bridge integration tests.
 *
 * Covers TF-0MUZYS3UD00657Q3:
 *
 * 1. Received behavioural events execute through the Demo 9 runtime/state
 *    pipeline (state + context → resolved recipes).
 * 2. Two clients given the same event stream resolve byte-identical sound
 *    sequences (parent AC1), both directly and over a network session.
 * 3. The demo stream stays well under the 1 KB/s bandwidth budget (parent AC2).
 * 4. Lifecycle/reset behave deterministically.
 *
 * All tests are offline and deterministic (in-memory transport, virtual clock).
 */

import { describe, expect, it } from "vitest";

import { parseSequencePreset } from "../../sequence/schema.js";
import type { RuntimeScenario } from "../../runtime/scenario.js";
import { createInMemoryNetwork, createInMemoryTransport } from "../transport.js";
import { host, join } from "../session.js";
import type { BehaviouralEvent } from "../types.js";
import { encodeEvent } from "../events.js";
import {
  DEFAULT_BANDWIDTH_BUDGET_BYTES_PER_SECOND,
  canonicalEventByteSize,
  createRuntimeBridge,
  measureStreamBandwidth,
} from "../runtime-bridge.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A Demo-9-style movement scenario: walk/run footsteps over a surface. */
function movementScenario(): RuntimeScenario {
  return {
    version: "1.0",
    name: "network-bridge-test",
    seed: 42,
    stateMachine: {
      name: "movement",
      initial: "idle",
      states: [
        { name: "idle" },
        { name: "walk", sequencer: "footsteps_walk" },
        { name: "run", sequencer: "footsteps_run" },
      ],
      transitions: [
        { from: "idle", to: "walk" },
        { from: "idle", to: "run" },
        { from: "walk", to: "idle" },
        { from: "walk", to: "run" },
        { from: "run", to: "walk" },
        { from: "run", to: "idle" },
      ],
    },
    context: {
      dimensions: { surface: ["stone", "gravel"] },
      initial: { surface: "stone" },
    },
    sequences: {
      footsteps_walk: parseSequencePreset(
        {
          version: "1.0",
          name: "footsteps_walk",
          events: [{ time: 0, event: "footstep", gain: 0.7 }],
        },
        "test#footsteps_walk",
      ),
      footsteps_run: parseSequencePreset(
        {
          version: "1.0",
          name: "footsteps_run",
          events: [{ time: 0, event: "footstep", gain: 0.85 }],
        },
        "test#footsteps_run",
      ),
    },
    recipeResolver: { footstep: "footstep-{surface}" },
    steps: [],
  };
}

/** Build a canonical behavioural event with sensible defaults. */
function behaviour(
  overrides: Partial<BehaviouralEvent> & Pick<BehaviouralEvent, "event" | "time">,
): BehaviouralEvent {
  return {
    version: 1,
    seed: 42,
    state: "walk",
    context: { surface: "stone" },
    ...overrides,
  };
}

/** The event stream used for determinism and bandwidth tests. */
function demoStream(): BehaviouralEvent[] {
  return [
    behaviour({ event: "state-transition", time: 0, state: "walk", seed: 42 }),
    behaviour({ event: "footstep", time: 1, state: "walk", seed: 43 }),
    behaviour({ event: "state-transition", time: 2, state: "run", seed: 44 }),
    behaviour({
      event: "context-change",
      time: 3,
      state: "run",
      seed: 45,
      context: { surface: "gravel" },
    }),
    behaviour({
      event: "footstep",
      time: 4,
      state: "run",
      seed: 46,
      context: { surface: "gravel" },
    }),
  ];
}

// ---------------------------------------------------------------------------
// AC1 — execution through the Demo 9 runtime/state pipeline
// ---------------------------------------------------------------------------

describe("runtime bridge — execution through the runtime/state pipeline (AC1)", () => {
  it("resolves a state transition to the state's sequence recipe", () => {
    const bridge = createRuntimeBridge({ scenario: movementScenario() });
    bridge.start();

    const execution = bridge.apply(
      behaviour({ event: "state-transition", time: 0, state: "walk" }),
    );

    expect(execution.stateChanged).toBe(true);
    expect(execution.resolved).toHaveLength(1);
    expect(execution.resolved[0]!.state).toBe("walk");
    expect(execution.resolved[0]!.sequence).toBe("footsteps_walk");
    expect(execution.resolved[0]!.recipe).toBe("footstep-stone");
    expect(execution.resolved[0]!.originalRecipe).toBe("footstep");

    // The underlying runtime actually transitioned.
    expect(bridge.runtime.inspect().state?.currentState).toBe("walk");
  });

  it("applies a context change so the recipe resolver switches surface", () => {
    const bridge = createRuntimeBridge({ scenario: movementScenario() });
    bridge.start();
    bridge.apply(behaviour({ event: "state-transition", time: 0, state: "run" }));

    const execution = bridge.apply(
      behaviour({
        event: "context-change",
        time: 1,
        state: "run",
        context: { surface: "gravel" },
      }),
    );

    expect(execution.contextChanged).toBe(true);
    expect(execution.resolved).toHaveLength(1);
    expect(execution.resolved[0]!.recipe).toBe("footstep-gravel");
    expect(bridge.runtime.inspect().context["surface"]).toBe("gravel");
  });

  it("logs runtime state/sequence events while executing a received event", () => {
    const bridge = createRuntimeBridge({ scenario: movementScenario() });
    bridge.start();

    bridge.apply(behaviour({ event: "state-transition", time: 0, state: "walk" }));

    const types = bridge.runtime.log().map((entry) => entry.event.type);
    expect(types).toContain("state_change");
    expect(types).toContain("sequence_start");
    expect(types).toContain("event_fire");
  });

  it("re-fires the active sequence for a discrete event, seeded by the event", () => {
    const bridge = createRuntimeBridge({ scenario: movementScenario() });
    bridge.start();
    bridge.apply(behaviour({ event: "state-transition", time: 0, state: "walk" }));

    const execution = bridge.apply(
      behaviour({ event: "footstep", time: 1, state: "walk", seed: 43 }),
    );

    expect(execution.stateChanged).toBe(false);
    expect(execution.contextChanged).toBe(false);
    expect(execution.resolved).toHaveLength(1);
    expect(execution.resolved[0]!.recipe).toBe("footstep-stone");
    // The discrete event's own seed drives synthesis.
    expect(execution.resolved[0]!.eventSeed).toBe(43);
  });

  it("refuses to execute before start()", () => {
    const bridge = createRuntimeBridge({ scenario: movementScenario() });
    expect(() =>
      bridge.apply(behaviour({ event: "footstep", time: 0 })),
    ).toThrow(/not running/i);
  });
});

// ---------------------------------------------------------------------------
// AC2 — deterministic two-client playback (parent AC1)
// ---------------------------------------------------------------------------

describe("runtime bridge — deterministic two-client playback (AC2)", () => {
  it("two bridges fed the same event stream resolve byte-identical sequences", () => {
    const clientA = createRuntimeBridge({ scenario: movementScenario() });
    const clientB = createRuntimeBridge({ scenario: movementScenario() });
    clientA.start();
    clientB.start();

    const stream = demoStream();
    clientA.applyStream(stream);
    clientB.applyStream(stream);

    const a = clientA.resolvedSequence();
    const b = clientB.resolvedSequence();
    expect(a.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toEqual(b);
  });

  it("resolves the expected sound sequence through the stream", () => {
    const bridge = createRuntimeBridge({ scenario: movementScenario() });
    bridge.start();
    bridge.applyStream(demoStream());

    const recipes = bridge.resolvedSequence().map((sound) => sound.recipe);
    expect(recipes).toEqual([
      "footstep-stone",
      "footstep-stone",
      "footstep-stone",
      "footstep-gravel",
      "footstep-gravel",
    ]);
  });

  it("two clients over a network session resolve identifiable sequences", async () => {
    const network = createInMemoryNetwork();
    const hostSession = await host({
      port: 0,
      transport: createInMemoryTransport(network),
    });
    const clientA = await join(hostSession.address, {
      transport: createInMemoryTransport(network),
    });
    const clientB = await join(hostSession.address, {
      transport: createInMemoryTransport(network),
    });

    const bridgeA = createRuntimeBridge({ scenario: movementScenario() });
    const bridgeB = createRuntimeBridge({ scenario: movementScenario() });
    bridgeA.start();
    bridgeB.start();
    clientA.onReceive((received) => bridgeA.apply(received));
    clientB.onReceive((received) => bridgeB.apply(received));

    for (const event of demoStream()) hostSession.emit(event);

    expect(bridgeA.resolvedSequence().length).toBeGreaterThan(0);
    expect(JSON.stringify(bridgeA.resolvedSequence())).toBe(
      JSON.stringify(bridgeB.resolvedSequence()),
    );

    await clientA.close();
    await clientB.close();
    await hostSession.close();
  });
});

// ---------------------------------------------------------------------------
// AC4 — bandwidth (parent AC2)
// ---------------------------------------------------------------------------

describe("runtime bridge — bandwidth (AC4)", () => {
  it("measures canonical event bytes", () => {
    const event = behaviour({ event: "footstep", time: 1, seed: 43 });
    const expected = new TextEncoder().encode(encodeEvent(event)).length;
    expect(canonicalEventByteSize(event)).toBe(expected);
  });

  it("keeps the demo stream well under the 1 KB/s budget", () => {
    const report = measureStreamBandwidth(demoStream());

    expect(report.eventCount).toBe(5);
    expect(report.avgBytesPerEvent).toBeGreaterThan(0);
    expect(report.maxBytesPerEvent).toBeLessThan(DEFAULT_BANDWIDTH_BUDGET_BYTES_PER_SECOND);
    expect(report.withinBudget).toBe(true);
    expect(report.kilobytesPerSecond).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// AC5 — lifecycle / determinism
// ---------------------------------------------------------------------------

describe("runtime bridge — lifecycle", () => {
  it("reset clears the resolved sequence and restarts deterministically", () => {
    const bridge = createRuntimeBridge({ scenario: movementScenario() });
    bridge.start();
    bridge.applyStream(demoStream());
    expect(bridge.resolvedSequence().length).toBeGreaterThan(0);

    bridge.reset();
    expect(bridge.resolvedSequence()).toEqual([]);
    expect(bridge.isRunning()).toBe(true);

    bridge.apply(behaviour({ event: "state-transition", time: 0, state: "walk" }));
    expect(bridge.resolvedSequence()).toHaveLength(1);
    expect(bridge.resolvedSequence()[0]!.recipe).toBe("footstep-stone");
  });

  it("stop() halts execution", () => {
    const bridge = createRuntimeBridge({ scenario: movementScenario() });
    bridge.start();
    bridge.stop();
    expect(bridge.isRunning()).toBe(false);
    expect(() =>
      bridge.apply(behaviour({ event: "footstep", time: 0 })),
    ).toThrow(/not running/i);
  });
});
