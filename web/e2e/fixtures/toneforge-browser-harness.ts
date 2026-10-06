/**
 * Browser e2e harness for ToneForge Runtime and recipes.
 *
 * This module is NOT shipped in the web app build. The Playwright spec
 * (`web/e2e/runtime-recipes.spec.ts`) bundles it with esbuild and injects the
 * resulting IIFE into the real browser page, where it exposes
 * `globalThis.__tfHarness`. Each scenario returns plain, serialisable data so
 * assertions run in Node.
 *
 * Work item: TF-0MUUPJ95Z001OHEN
 */

import { createRuntime } from "../../../src/runtime/index.js";
import { createStateMachine } from "../../../src/state/state.js";
import type { StateMachineDefinition } from "../../../src/state/state.js";
import { createContext } from "../../../src/context/context.js";
import { parseSequencePreset } from "../../../src/sequence/schema.js";
import type { SequenceDefinition } from "../../../src/sequence/schema.js";
import { renderRecipe } from "../../../src/core/renderer.js";

// ── Fixtures ──────────────────────────────────────────────────────

function makeClock(startMs = 1000): { now: () => number; advance: (ms: number) => void } {
  let time = startMs;
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
    ],
    initial: "idle",
    transitions: [
      { from: "idle", to: "walk" },
      { from: "walk", to: "idle" },
      { from: "walk", to: "run" },
      { from: "run", to: "walk" },
    ],
  };
}

function sequence(name: string, eventCount: number): SequenceDefinition {
  return parseSequencePreset(
    {
      version: "1.0",
      name,
      events: Array.from({ length: eventCount }, (_, i) => ({
        time: i * 0.3,
        event: "footstep",
        seedOffset: i,
        gain: 0.7,
      })),
    },
    name,
  );
}

/** FNV-1a checksum over quantised samples — cheap and stable in JS. */
function checksum(samples: Float32Array): number {
  let hash = 2166136261;
  for (let i = 0; i < samples.length; i += 1) {
    const quantised = Math.round((samples[i] ?? 0) * 32767);
    hash ^= quantised & 0xffff;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function hasSignal(samples: Float32Array): boolean {
  for (let i = 0; i < samples.length; i += 1) {
    if (samples[i] !== 0) return true;
  }
  return false;
}

// ── Scenarios ─────────────────────────────────────────────────────

function lifecycle() {
  const runtime = createRuntime({ seed: 42, clock: makeClock().now });
  const notified: string[] = [];
  runtime.onEvent((entry) => notified.push(entry.event.type));

  const sessionId = runtime.start();
  const runningAfterStart = runtime.isRunning();
  runtime.stop();

  return {
    sessionId,
    runningAfterStart,
    runningAfterStop: runtime.isRunning(),
    loggedTypes: runtime.log().map((entry) => entry.event.type),
    notified,
  };
}

function stateMachineScenario() {
  const clock = makeClock();
  const runtime = createRuntime({
    seed: 7,
    clock: clock.now,
    stateMachine: createStateMachine(movementDef()),
    sequences: {
      footsteps_walk: sequence("footsteps_walk", 2),
      footsteps_run: sequence("footsteps_run", 3),
    },
  });

  runtime.start();
  clock.advance(100);
  const transition = runtime.setState("walk");
  clock.advance(200);
  runtime.setState("run");

  const inspection = runtime.inspect();
  const log = runtime.log().map((entry) => entry.event);

  runtime.stop();

  return {
    from: transition.from,
    to: transition.to,
    currentState: inspection.state?.currentState,
    transitionCount: inspection.state?.transitions.length,
    activeSequences: inspection.activeSequences,
    eventTypes: log.map((event) => event.type),
    startedSequences: log
      .filter((event) => event.type === "sequence_start")
      .map((event) => event.detail.sequence),
    resolvedRecipes: log
      .filter((event) => event.type === "event_fire")
      .map((event) => event.detail.resolvedRecipe),
  };
}

function contextScenario() {
  const runtime = createRuntime({
    seed: 1,
    context: createContext({
      dimensions: { surface: ["stone", "gravel"] },
      initial: { surface: "stone" },
    }),
  });

  runtime.start();
  const changes = runtime.setContext({ surface: "gravel" });
  const snapshot = runtime.inspect().context;
  const eventTypes = runtime.log().map((entry) => entry.event.type);
  runtime.stop();

  return {
    changeCount: changes.length,
    snapshot,
    eventTypes,
  };
}

function determinismScenario() {
  const run = () => {
    const clock = makeClock();
    const runtime = createRuntime({
      seed: 99,
      clock: clock.now,
      stateMachine: createStateMachine(movementDef(), { clock: clock.now }),
      sequences: {
        footsteps_walk: sequence("footsteps_walk", 2),
        footsteps_run: sequence("footsteps_run", 3),
      },
    });
    runtime.start();
    clock.advance(50);
    runtime.setState("walk");
    clock.advance(120);
    runtime.setState("run");
    runtime.stop();
    return runtime.log().map((entry) => ({
      type: entry.event.type,
      id: entry.event.id,
      timestamp: entry.event.timestamp,
      detail: entry.event.detail,
    }));
  };

  const first = run();
  const second = run();
  return { first, second, equal: JSON.stringify(first) === JSON.stringify(second) };
}

async function renderRecipesScenario() {
  const recipes = ["footstep-stone", "impact-crack"] as const;
  const results: Array<Record<string, unknown>> = [];

  for (const name of recipes) {
    const first = await renderRecipe(name, 42);
    const second = await renderRecipe(name, 42);
    const other = await renderRecipe(name, 43);

    results.push({
      name,
      length: first.samples.length,
      sampleRate: first.sampleRate,
      nonSilent: hasSignal(first.samples),
      deterministic: checksum(first.samples) === checksum(second.samples),
      seedVaries: checksum(first.samples) !== checksum(other.samples),
    });
  }

  return { results };
}

const scenarios: Record<string, () => unknown | Promise<unknown>> = {
  lifecycle,
  stateMachine: stateMachineScenario,
  context: contextScenario,
  determinism: determinismScenario,
  renderRecipes: renderRecipesScenario,
};

(globalThis as unknown as { __tfHarness: unknown }).__tfHarness = {
  scenarios: Object.keys(scenarios),
  run(name: string) {
    const scenario = scenarios[name];
    if (!scenario) throw new Error(`Unknown harness scenario: ${name}`);
    return scenario();
  },
};
