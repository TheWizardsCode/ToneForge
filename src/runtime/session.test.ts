/**
 * Runtime Session Tests
 *
 * Live event-driven session: command handling, immediate state/context
 * application, cache-backed scheduling at sequence-relative times,
 * cancellation, deterministic scripted replay, and clean shutdown.
 *
 * Work item: TF-0MUYBRKAT0036X2A
 */

import { describe, it, expect } from "vitest";
import { createBufferCache } from "./buffer-cache.js";
import type { BufferCacheKey } from "./buffer-cache.js";
import { createRuntimeSession } from "./session.js";
import type { RuntimeSession } from "./session.js";
import { parseRuntimeScenario } from "./scenario.js";
import type { RuntimeScenario } from "./scenario.js";
import type { RenderResult } from "../core/renderer.js";
import type { RuntimeLogEntry } from "./runtime.js";

// ── Fixtures ──────────────────────────────────────────────────────

function sessionScenario(): RuntimeScenario {
  return parseRuntimeScenario(
    {
      version: "1.0",
      name: "session_test",
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
          { from: "walk", to: "idle" },
          { from: "walk", to: "sprint" },
          { from: "sprint", to: "idle" },
        ],
      },
      context: {
        dimensions: { surface: ["stone", "gravel"] },
        initial: { surface: "stone" },
      },
      sequences: {
        seq_walk: {
          version: "1.0",
          name: "seq_walk",
          events: [
            { time: 0, event: "footstep", seedOffset: 0, gain: 0.7 },
            { time: 0.6, event: "footstep", seedOffset: 1, gain: 0.65 },
            { time: 1.2, event: "footstep", seedOffset: 2, gain: 0.7 },
          ],
        },
        seq_sprint: {
          version: "1.0",
          name: "seq_sprint",
          events: [
            { time: 0, event: "footstep", seedOffset: 0, gain: 1.0 },
            { time: 0.25, event: "footstep", seedOffset: 1, gain: 0.95 },
            { time: 0.5, event: "footstep", seedOffset: 2, gain: 1.0 },
          ],
        },
      },
      recipeResolver: { footstep: "footstep-{surface}" },
      steps: [{ time: 0, state: "walk" }],
    },
    "session-test",
  );
}

interface FakeTask {
  delay: number;
  run: () => void;
  cancelled: boolean;
  done: boolean;
}

function makeHarness(options?: { virtualClock?: boolean }) {
  const tasks: FakeTask[] = [];
  const scheduler = (delay: number, run: () => void): (() => void) => {
    const task: FakeTask = { delay, run, cancelled: false, done: false };
    tasks.push(task);
    return () => {
      task.cancelled = true;
    };
  };

  const renderCalls: BufferCacheKey[] = [];
  const cache = createBufferCache({
    renderer: async (key) => {
      renderCalls.push(key);
      return {
        samples: new Float32Array([key.seed]),
        sampleRate: 44100,
        duration: 0.01,
        numberOfChannels: 1,
      };
    },
  });

  const played: RenderResult[] = [];
  const events: RuntimeLogEntry[] = [];

  const session: RuntimeSession = createRuntimeSession({
    scenario: sessionScenario(),
    cache,
    scheduler,
    play: (result) => {
      played.push(result);
    },
    onEvent: (entry) => events.push(entry),
    virtualClock: options?.virtualClock,
    schedulePlayback: true,
  });

  const flush = async (): Promise<void> => {
    for (const task of tasks) {
      if (task.cancelled || task.done) continue;
      task.done = true;
      task.run();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  const firedRecipes = (): string[] =>
    events
      .filter((e) => e.event.type === "event_fire")
      .map((e) => String(e.event.detail["resolvedRecipe"]));

  return { session, tasks, renderCalls, played, events, flush, cache, firedRecipes };
}

// ── Command handling ──────────────────────────────────────────────

describe("createRuntimeSession — command handling", () => {
  it("applies a state command immediately", () => {
    const h = makeHarness();
    const result = h.session.handleCommand("state walk");
    expect(result).toMatchObject({ ok: true, type: "state" });
    expect(h.session.runtime.inspect().state?.currentState).toBe("walk");
  });

  it("applies a context command immediately", () => {
    const h = makeHarness();
    const result = h.session.handleCommand("context surface=gravel");
    expect(result).toMatchObject({ ok: true, type: "context" });
    expect(h.session.runtime.inspect().context["surface"]).toBe("gravel");
  });

  it("reports errors for invalid commands without terminating", () => {
    const h = makeHarness();
    expect(h.session.handleCommand("bogus").ok).toBe(false);
    expect(h.session.handleCommand("state").ok).toBe(false);
    expect(h.session.handleCommand("state nope").ok).toBe(false);
    expect(h.session.handleCommand("context bad").ok).toBe(false);
    // Session is still alive and usable.
    expect(h.session.handleCommand("state walk").ok).toBe(true);
    expect(h.session.runtime.isRunning()).toBe(true);
  });

  it("ignores blank lines and comments", () => {
    const h = makeHarness();
    expect(h.session.handleCommand("").type).toBe("noop");
    expect(h.session.handleCommand("   ").type).toBe("noop");
    expect(h.session.handleCommand("# a comment").type).toBe("noop");
  });

  it("inspect returns parseable JSON", () => {
    const h = makeHarness();
    h.session.handleCommand("state walk");
    const result = h.session.handleCommand("inspect");
    const info = JSON.parse(result.message);
    expect(info.running).toBe(true);
    expect(info.state.currentState).toBe("walk");
  });

  it("help lists the commands and quit ends the session", () => {
    const h = makeHarness();
    expect(h.session.handleCommand("help").message).toContain("state");
    expect(h.session.handleCommand("quit").type).toBe("quit");
    expect(h.session.handleCommand("exit").type).toBe("quit");
  });

  it("reset cancels pending playback and restarts the runtime", () => {
    const h = makeHarness();
    h.session.handleCommand("state walk");
    const pendingBefore = h.tasks.filter((t) => !t.cancelled && !t.done).length;
    expect(pendingBefore).toBe(3);

    const result = h.session.handleCommand("reset");
    expect(result.type).toBe("reset");
    expect(h.session.runtime.isRunning()).toBe(true);
    expect(h.session.runtime.inspect().state?.currentState).toBe("idle");
    expect(h.tasks.filter((t) => !t.cancelled && !t.done).length).toBe(0);
  });
});

// ── Scheduling ────────────────────────────────────────────────────

describe("createRuntimeSession — playback scheduling", () => {
  it("schedules one task per event at the sequence-relative time", () => {
    const h = makeHarness();
    h.session.handleCommand("state walk");
    expect(h.tasks.map((t) => t.delay)).toEqual([0, 600, 1200]);
  });

  it("renders through the cache and plays the gained buffer", async () => {
    const h = makeHarness();
    h.session.handleCommand("state walk");
    await h.flush();

    expect(h.renderCalls.map((c) => c.seed)).toEqual([42, 43, 44]);
    expect(h.played).toHaveLength(3);
    // gain 0.7 scales the fake sample (seed 42 -> 42 * 0.7).
    expect(h.played[0]!.samples[0]).toBeCloseTo(42 * 0.7);
  });

  it("reuses cached renders when a state is re-entered", async () => {
    const h = makeHarness();
    h.session.handleCommand("state walk");
    await h.flush();
    const afterFirst = h.renderCalls.length;

    h.session.handleCommand("state idle");
    await h.flush();
    h.session.handleCommand("state walk");
    await h.flush();

    expect(h.renderCalls.length).toBe(afterFirst);
    expect(h.cache.stats().hits).toBeGreaterThanOrEqual(3);
  });

  it("cancels a sequence's pending playback when the state changes", () => {
    const h = makeHarness();
    h.session.handleCommand("state walk");
    const walkTasks = [...h.tasks];
    expect(walkTasks).toHaveLength(3);

    h.session.handleCommand("state sprint");

    expect(walkTasks.every((t) => t.cancelled)).toBe(true);
    const sprintTasks = h.tasks.slice(3);
    expect(sprintTasks.map((t) => t.delay)).toEqual([0, 250, 500]);
    expect(sprintTasks.every((t) => !t.cancelled)).toBe(true);
  });

  it("resolves context-driven recipes on a context change", async () => {
    const h = makeHarness();
    h.session.handleCommand("state walk");
    await h.flush();
    h.session.handleCommand("context surface=gravel");
    await h.flush();

    const recipes = h.firedRecipes();
    expect(recipes).toContain("footstep-stone");
    expect(recipes).toContain("footstep-gravel");
  });

  it("waitForIdle resolves once scheduled tasks have run", async () => {
    const h = makeHarness();
    h.session.handleCommand("state walk");
    const idle = h.session.waitForIdle();
    await h.flush();
    await expect(idle).resolves.toBeUndefined();
  });

  it("stop cancels pending playback and stops the runtime", () => {
    const h = makeHarness();
    h.session.handleCommand("state walk");
    h.session.stop();
    expect(h.session.runtime.isRunning()).toBe(false);
    expect(h.tasks.every((t) => t.cancelled)).toBe(true);
  });
});

// ── Scripted replay ───────────────────────────────────────────────

describe("createRuntimeSession — scripted replay", () => {
  const SCRIPT = `# replay
state walk
context surface=gravel
state sprint
quit
`;

  it("runs a command script and stops at quit", () => {
    const h = makeHarness({ virtualClock: true });
    const results = h.session.runCommandScript(SCRIPT);
    expect(results.map((r) => r.type)).toEqual([
      "noop",
      "state",
      "context",
      "state",
      "quit",
    ]);
  });

  it("replays deterministically with a virtual clock", () => {
    const run = () => {
      const h = makeHarness({ virtualClock: true });
      h.session.runCommandScript(SCRIPT);
      return JSON.stringify(h.events.map((e) => e.event));
    };
    expect(run()).toBe(run());
  });

  it("uses a live clock by default", () => {
    const h = makeHarness();
    // Two state changes separated by no virtual advance still get wall-clock
    // timestamps; the point is the clock is not pinned to 0.
    h.session.handleCommand("state walk");
    const timestamps = h.events.map((e) => e.event.timestamp);
    expect(timestamps.some((t) => t > 0)).toBe(true);
  });
});

// ── Continuous transport ──────────────────────────────────────────

interface TransportTask {
  due: number;
  order: number;
  task: () => void;
  cancelled: boolean;
  done: boolean;
}

/**
 * Harness for the continuous transport. Uses a virtual scheduler that runs
 * tasks in due-time order, so loop iterations are deterministic and instant.
 */
function makeTransportHarness(opts: { maxIterations?: number; seedVariation?: boolean } = {}) {
  let now = 0;
  let order = 0;
  const tasks: TransportTask[] = [];

  const scheduler = (delay: number, task: () => void): (() => void) => {
    const t: TransportTask = {
      due: now + Math.max(0, delay),
      order: order++,
      task,
      cancelled: false,
      done: false,
    };
    tasks.push(t);
    return () => {
      t.cancelled = true;
    };
  };

  const renderCalls: BufferCacheKey[] = [];
  const cache = createBufferCache({
    renderer: async (key) => {
      renderCalls.push(key);
      return {
        samples: new Float32Array([key.seed]),
        sampleRate: 44100,
        duration: 0.01,
        numberOfChannels: 1,
      };
    },
  });

  const played: RenderResult[] = [];
  const events: RuntimeLogEntry[] = [];

  const session = createRuntimeSession({
    scenario: sessionScenario(),
    cache,
    scheduler,
    play: (result) => {
      played.push(result);
    },
    onEvent: (entry) => events.push(entry),
    virtualClock: true,
    schedulePlayback: true,
    seedVariation: opts.seedVariation ?? true,
    maxIterations: opts.maxIterations ?? 0,
  });

  const nextTask = (): TransportTask | undefined =>
    tasks
      .filter((t) => !t.cancelled && !t.done)
      .sort((a, b) => a.due - b.due || a.order - b.order)[0];

  const runSteps = async (count: number): Promise<void> => {
    for (let i = 0; i < count; i++) {
      const next = nextTask();
      if (!next) return;
      next.done = true;
      now = Math.max(now, next.due);
      next.task();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  const runToIdle = async (maxSteps = 500): Promise<void> => {
    for (let i = 0; i < maxSteps; i++) {
      if (!nextTask()) return;
      await runSteps(1);
    }
  };

  const firedSeeds = (): number[] =>
    events
      .filter((e) => e.event.type === "event_fire")
      .map((e) => Number(e.event.detail["eventSeed"]));
  const firedRecipes = (): string[] =>
    events
      .filter((e) => e.event.type === "event_fire")
      .map((e) => String(e.event.detail["resolvedRecipe"]));
  const firedTimes = (): number[] =>
    events
      .filter((e) => e.event.type === "event_fire")
      .map((e) => Number(e.event.detail["time_ms"]));

  return {
    session,
    tasks,
    renderCalls,
    played,
    events,
    runSteps,
    runToIdle,
    cache,
    firedSeeds,
    firedRecipes,
    firedTimes,
    now: () => now,
  };
}

const WALK_EVENTS = 3;

describe("createRuntimeSession — continuous transport", () => {
  it("start <state> loops the active sequence for maxIterations", async () => {
    const h = makeTransportHarness({ maxIterations: 2 });
    const result = h.session.handleCommand("start walk");
    expect(result).toMatchObject({ ok: true, type: "start" });
    expect(h.session.stats().transportRunning).toBe(true);

    await h.runToIdle();

    expect(h.session.stats().transportRunning).toBe(false);
    expect(h.session.stats().iteration).toBe(2);
    // Initial batch + 2 refires, 3 events each.
    expect(h.firedSeeds()).toHaveLength(WALK_EVENTS * 3);
  });

  it("varies the event seed per iteration by default", async () => {
    const h = makeTransportHarness({ maxIterations: 2 });
    h.session.handleCommand("start walk");
    await h.runToIdle();

    const seeds = h.firedSeeds();
    expect(seeds.slice(0, 3)).toEqual([42, 43, 44]);
    expect(seeds.slice(3, 6)).toEqual([1042, 1043, 1044]);
    expect(seeds.slice(6, 9)).toEqual([2042, 2043, 2044]);
  });

  it("repeats seeds when seedVariation is disabled", async () => {
    const h = makeTransportHarness({ maxIterations: 2, seedVariation: false });
    h.session.handleCommand("start walk");
    await h.runToIdle();

    expect(h.firedSeeds()).toEqual([42, 43, 44, 42, 43, 44, 42, 43, 44]);
  });

  it("re-resolves recipes when context changes mid-loop", async () => {
    const h = makeTransportHarness({ maxIterations: 0 });
    h.session.handleCommand("start walk");
    await h.runSteps(WALK_EVENTS);

    expect(h.firedRecipes().filter((r) => r === "footstep-stone")).toHaveLength(WALK_EVENTS);

    h.session.handleCommand("context surface=gravel");
    await h.runSteps(WALK_EVENTS);

    expect(h.firedRecipes().filter((r) => r === "footstep-gravel")).toHaveLength(WALK_EVENTS);
    h.session.stop();
  });

  it("switches sequence on a state change mid-loop", async () => {
    const h = makeTransportHarness({ maxIterations: 0 });
    h.session.handleCommand("start walk");
    await h.runSteps(WALK_EVENTS);

    h.session.handleCommand("state sprint");
    await h.runSteps(3);

    expect(h.firedTimes().slice(-3)).toEqual([0, 250, 500]);
    const types = h.events.map((e) => e.event.type);
    expect(types).toContain("sequence_stop");
    expect(types).toContain("sequence_start");
    h.session.stop();
  });

  it("stop cancels the loop and pending playback", async () => {
    const h = makeTransportHarness({ maxIterations: 0 });
    h.session.handleCommand("start walk");
    expect(h.session.stats().transportRunning).toBe(true);

    const result = h.session.handleCommand("stop");
    expect(result.type).toBe("stop");
    expect(h.session.stats().transportRunning).toBe(false);
    expect(h.tasks.every((t) => t.cancelled || t.done)).toBe(true);
  });

  it("start without a state arms the transport and waits for a state", async () => {
    const h = makeTransportHarness({ maxIterations: 2 });
    h.session.handleCommand("start");
    await h.runSteps(1);
    expect(h.firedSeeds()).toHaveLength(0);
    expect(h.session.stats().transportRunning).toBe(true);

    h.session.handleCommand("state walk");
    await h.runToIdle();
    expect(h.firedSeeds().length).toBeGreaterThan(0);
    expect(h.session.stats().transportRunning).toBe(false);
  });

  it("rejects malformed start usage", () => {
    const h = makeTransportHarness();
    const result = h.session.handleCommand("start walk sprint");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Usage: start");
  });

  it("replays a scripted transport deterministically", async () => {
    const run = async () => {
      const h = makeTransportHarness({ maxIterations: 2 });
      h.session.runCommandScript("start walk\ncontext surface=gravel\nquit\n");
      await h.runToIdle();
      return JSON.stringify(h.events.map((e) => e.event));
    };
    expect(await run()).toBe(await run());
  });
});
