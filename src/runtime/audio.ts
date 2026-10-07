/**
 * Runtime Audio Bridge
 *
 * Runs a {@link RuntimeScenario} and turns its resolved runtime events into
 * audible audio by composing the existing render and playback layers:
 *
 *   Runtime events → resolved recipes → renderSequence → playback
 *
 * The bridge never synthesises audio itself. It drives the runtime with a
 * deterministic clock, collects the `event_fire` entries the runtime resolves
 * (including context-driven recipe switches), builds a `SimulationResult`, and
 * mixes it with the offline `renderSequence` renderer — the same renderer the
 * `sequence generate` command uses.
 *
 * Playback is host-specific and lives outside this module:
 * - **Node:** encode with `encodeWav` and hand the buffer to `playAudio`.
 * - **Browser:** wrap the buffer in an `AudioBuffer` and schedule an
 *   `AudioBufferSourceNode` on the shared `AudioContext` via
 *   {@link scheduleRuntimeBuffer}.
 *
 * Reference: docs/prd/RUNTIME_PRD.md §19 (Runtime ↔ Render/Playback Pipeline)
 */

import type { RenderResult } from "../core/renderer.js";
import { renderRecipe } from "../core/renderer.js";
import { renderSequence } from "../sequence/renderer.js";
import { msToSamples } from "../sequence/simulator.js";
import type { SimulationResult, TimelineEvent } from "../sequence/simulator.js";
import { createContext } from "../context/context.js";
import { createStateMachine } from "../state/state.js";
import { createRuntime } from "./runtime.js";
import type { RuntimeLogEntry } from "./runtime.js";
import { createTemplateRecipeResolver } from "./scenario.js";
import type { RuntimeScenario } from "./scenario.js";

// ── Types ─────────────────────────────────────────────────────────

/** A single resolved, timeline-positioned runtime event. */
export interface RuntimeAudioEvent {
  /** Absolute time from the start of the scenario, in milliseconds. */
  time_ms: number;

  /** Absolute sample offset at the scenario sample rate. */
  sampleOffset: number;

  /** Resolved recipe name (after recipe-resolver substitution). */
  recipe: string;

  /** Original event name before resolution. */
  originalRecipe: string;

  /** Effective seed for this event. */
  eventSeed: number;

  /** Gain multiplier. */
  gain: number;

  /** Duration override in seconds, or undefined for the recipe default. */
  duration?: number;

  /** Repetition index this event belongs to. */
  repetition: number;

  /** Sequence that produced this event. */
  sequence: string;

  /** State that was active when this event fired. */
  state: string;
}

/** A rendered buffer paired with the event that produced it. */
export interface RuntimeAudioRender {
  /** The resolved event. */
  event: RuntimeAudioEvent;
  /** The standalone render of `event.recipe` (ungained). */
  render: RenderResult;
}

/** Result of running a runtime scenario through the render layer. */
export interface RuntimeAudioResult {
  /** Scenario name. */
  scenario: string;
  /** Base seed used for the session. */
  seed: number;
  /** Sample rate of every rendered buffer. */
  sampleRate: number;
  /** Resolved, timeline-positioned events. */
  events: RuntimeAudioEvent[];
  /** The complete runtime event log for the session. */
  log: RuntimeLogEntry[];
  /** Standalone renders, one per event (in timeline order). */
  eventRenders: RuntimeAudioRender[];
  /** The mixed scenario audio. */
  render: RenderResult;
}

/** Options for {@link runRuntimeScenario}. */
export interface RunRuntimeScenarioOptions {
  /** Sample rate for offsets and rendering (default: 44100). */
  sampleRate?: number;
}

// ── Scenario runner ───────────────────────────────────────────────

/**
 * Convert resolved runtime events into a `SimulationResult` so the existing
 * sequence renderer can mix them. `eventSeed`, `time_ms`, `gain`, and
 * `sampleOffset` come straight from the runtime; `event` is the resolved
 * recipe name.
 */
function toSimulation(
  scenarioName: string,
  seed: number,
  sampleRate: number,
  events: RuntimeAudioEvent[],
): SimulationResult {
  const timeline: TimelineEvent[] = events.map((event) => ({
    time_ms: event.time_ms,
    sampleOffset: event.sampleOffset,
    event: event.recipe,
    eventSeed: event.eventSeed,
    seedOffset: event.eventSeed - seed,
    gain: event.gain,
    ...(event.duration !== undefined ? { duration: event.duration } : {}),
    repetition: event.repetition,
  }));

  let totalDurationMs = 0;
  for (const event of events) {
    if (event.time_ms > totalDurationMs) totalDurationMs = event.time_ms;
  }

  return {
    name: scenarioName,
    events: timeline,
    sampleRate,
    totalDuration: totalDurationMs / 1000,
    totalDuration_ms: totalDurationMs,
    seed,
  };
}

/**
 * Run a scripted runtime scenario and render its resolved events.
 *
 * The runtime is driven with a deterministic clock (each step pins the clock
 * to its time), so the resulting event log and rendered samples are identical
 * for a given seed. Every `event_fire` the runtime resolves between steps is
 * captured with an absolute time offset and then mixed with
 * {@link renderSequence}.
 *
 * @param scenario - A validated {@link RuntimeScenario}.
 * @param options - Optional sample-rate override.
 * @returns The resolved events, event log, per-event renders, and mixed audio.
 */
export async function runRuntimeScenario(
  scenario: RuntimeScenario,
  options?: RunRuntimeScenarioOptions,
): Promise<RuntimeAudioResult> {
  const sampleRate = options?.sampleRate ?? 44100;
  const seed = scenario.seed;

  let currentMs = 0;
  const clock = (): number => currentMs;

  const stateMachine = createStateMachine(scenario.stateMachine, { clock });
  const context = createContext({
    ...(scenario.context?.dimensions !== undefined
      ? { dimensions: scenario.context.dimensions }
      : {}),
    ...(scenario.context?.initial !== undefined
      ? { initial: scenario.context.initial }
      : {}),
    clock,
  });

  const runtime = createRuntime({
    stateMachine,
    context,
    sequences: scenario.sequences,
    seed,
    clock,
    recipeResolver: createTemplateRecipeResolver(scenario.recipeResolver),
  });

  const events: RuntimeAudioEvent[] = [];

  runtime.start();
  let lastLogIndex = runtime.log().length;

  const steps = [...scenario.steps].sort((a, b) => a.time - b.time);
  for (const step of steps) {
    currentMs = Math.round(step.time * 1000);

    if (step.state !== undefined) {
      runtime.setState(step.state);
    }
    if (step.context !== undefined) {
      runtime.setContext(step.context);
    }

    const log = runtime.log();
    for (let i = lastLogIndex; i < log.length; i++) {
      const entry = log[i]!;
      if (entry.event.type !== "event_fire") continue;

      const detail = entry.event.detail;
      const relativeMs = Number(detail["time_ms"] ?? 0);
      const absoluteMs = currentMs + relativeMs;

      events.push({
        time_ms: absoluteMs,
        sampleOffset: msToSamples(absoluteMs, sampleRate),
        recipe: String(detail["resolvedRecipe"]),
        originalRecipe: String(detail["originalRecipe"]),
        eventSeed: Number(detail["eventSeed"]),
        gain: Number(detail["gain"] ?? 1),
        ...(detail["duration"] !== undefined
          ? { duration: Number(detail["duration"]) }
          : {}),
        repetition: Number(detail["repetition"] ?? 0),
        sequence: String(detail["sequence"] ?? ""),
        state: String(detail["state"] ?? ""),
      });
    }
    lastLogIndex = log.length;
  }

  runtime.stop();
  const log = [...runtime.log()];

  // Render each resolved event standalone (for per-event WAV export and
  // inspection), then mix the full timeline with the shared sequence renderer.
  const eventRenders: RuntimeAudioRender[] = [];
  for (const event of events) {
    const render = await renderRecipe(
      event.recipe,
      event.eventSeed,
      event.duration,
    );
    eventRenders.push({ event, render });
  }

  const simulation = toSimulation(scenario.name, seed, sampleRate, events);
  const mixed = await renderSequence(simulation);

  return {
    scenario: scenario.name,
    seed,
    sampleRate,
    events,
    log,
    eventRenders,
    render: mixed,
  };
}

// ── Browser playback ──────────────────────────────────────────────

/**
 * Minimal structural view of a Web Audio `AudioBuffer` — satisfied by both the
 * browser's native `AudioBuffer` and `node-web-audio-api`'s implementation.
 */
export interface SchedulableAudioBuffer {
  copyToChannel(source: Float32Array, channelNumber: number): void;
}

/** Minimal structural view of an `AudioBufferSourceNode`. */
export interface SchedulableAudioBufferSource {
  buffer: SchedulableAudioBuffer | null;
  connect(destination: unknown): unknown;
  start(when?: number, offset?: number, duration?: number): void;
}

/** Minimal structural view of an `AudioContext` used for scheduling. */
export interface SchedulableAudioContext {
  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): SchedulableAudioBuffer;
  createBufferSource(): SchedulableAudioBufferSource;
  destination: unknown;
}

/** Options for {@link scheduleRuntimeBuffer}. */
export interface ScheduleBufferOptions {
  /** Context time (in seconds) at which to begin playback (default: 0). */
  when?: number;
}

/**
 * Schedule a rendered mono buffer on a Web Audio context.
 *
 * Wraps the samples in an `AudioBuffer` and plays them through a fresh
 * `AudioBufferSourceNode` connected to the context destination. Browser and
 * Node share this code path (`node-web-audio-api` exposes the same surface).
 *
 * @param ctx - A Web Audio context (browser-native or `node-web-audio-api`).
 * @param samples - Mono samples in [-1, 1].
 * @param sampleRate - Sample rate of `samples` in Hz.
 * @param options - Scheduling options.
 * @returns The started source node.
 * @throws If `samples` is empty.
 */
export function scheduleRuntimeBuffer(
  ctx: SchedulableAudioContext,
  samples: Float32Array,
  sampleRate: number,
  options?: ScheduleBufferOptions,
): SchedulableAudioBufferSource {
  if (samples.length === 0) {
    throw new Error("Cannot schedule an empty audio buffer (0 samples).");
  }

  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(options?.when ?? 0);

  return source;
}

/**
 * Play a rendered {@link RenderResult} on a Web Audio context.
 *
 * Convenience wrapper around {@link scheduleRuntimeBuffer} for the browser
 * runtime path.
 */
export function playRenderResultOnContext(
  ctx: SchedulableAudioContext,
  result: RenderResult,
  options?: ScheduleBufferOptions,
): SchedulableAudioBufferSource {
  return scheduleRuntimeBuffer(ctx, result.samples, result.sampleRate, options);
}
