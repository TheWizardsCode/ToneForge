/**
 * Runtime Session
 *
 * A live, event-driven runtime session: it owns a {@link Runtime}, a bounded
 * {@link BufferCache}, and a playback scheduler, so a host can issue state and
 * context commands over time and hear the runtime react immediately.
 *
 * Unlike the scripted `runRuntimeScenario` bridge (which renders a finite
 * deterministic timeline), a session runs against a live clock, renders events
 * through the cache, and schedules each buffer at its sequence-relative time on
 * the host playback path.
 *
 * The session also provides a **continuous transport**: `start` keeps the
 * active sequence looping (re-arming after each pattern period) while state and
 * context changes reconfigure the loop live, and `stop` halts it. Iterations
 * use a distinct, deterministic seed derived from the iteration index.
 *
 * The module is host- and runtime-agnostic: `scheduler` and `play` are
 * injectable, and the default scheduler (`setTimeout`) works in Node and the
 * browser. The caller supplies the host `play` (Node `playAudio`; browser
 * `AudioBufferSourceNode`).
 *
 * Reference: docs/prd/RUNTIME_PRD.md §3, §5, §6, §19
 */

import type { RenderResult } from "../core/renderer.js";
import { createStateMachine } from "../state/state.js";
import { createContext } from "../context/context.js";
import { createRuntime } from "./runtime.js";
import type { Runtime, RuntimeLogEntry } from "./runtime.js";
import type { SimulationResult } from "../sequence/simulator.js";
import { createTemplateRecipeResolver } from "./scenario.js";
import type { RuntimeScenario } from "./scenario.js";
import type { BufferCache, BufferCacheStats } from "./buffer-cache.js";

// ── Types ─────────────────────────────────────────────────────────

/**
 * Schedule `task` to run after `delayMs`. Returns a cancellation function.
 *
 * Defaults to `setTimeout`/`clearTimeout`; inject a fake in tests to control
 * time deterministically.
 */
export type SessionScheduler = (delayMs: number, task: () => void) => () => void;

/** A parsed session command. */
export interface SessionCommandResult {
  /** Whether the command was handled successfully. */
  ok: boolean;
  /** Command family. */
  type:
    | "state"
    | "context"
    | "start"
    | "stop"
    | "inspect"
    | "reset"
    | "help"
    | "quit"
    | "error"
    | "noop";
  /** Human-readable result or error message. */
  message: string;
}

/** Options for {@link createRuntimeSession}. */
export interface RuntimeSessionOptions {
  /** Validated scenario providing state machine, context, sequences, resolver. */
  scenario: RuntimeScenario;

  /** Bounded render cache used for every event. */
  cache: BufferCache;

  /** Base seed override (default: the scenario seed). */
  seed?: number;

  /** Playback scheduler (default: `setTimeout`). */
  scheduler?: SessionScheduler;

  /**
   * Host playback hook. Called with each rendered buffer when it is due.
   * Omit for headless sessions (or when `schedulePlayback` is false).
   */
  play?: (result: RenderResult) => void | Promise<void>;

  /** Observer notified of every runtime event (e.g. for `--json` streaming). */
  onEvent?: (entry: RuntimeLogEntry) => void;

  /**
   * Use a virtual, deterministic clock advanced one step per scripted command
   * (default: false → live clock). Required for reproducible `--script` replay.
   */
  virtualClock?: boolean;

  /** Initial virtual-clock value in ms (default: 0). */
  clockStart?: number;

  /** Render and schedule events for playback (default: true). */
  schedulePlayback?: boolean;

  /**
   * Vary the event seed on each transport iteration (default: true) so a loop
   * does not repeat identically. Deterministic: derived from the iteration
   * index, not the clock.
   */
  seedVariation?: boolean;

  /**
   * Stop the transport automatically after this many loop iterations
   * (default: 0 → unbounded). Bounds scripted/`--json` runs.
   */
  maxIterations?: number;
}

/** Session statistics. */
export interface RuntimeSessionStats {
  /** Runtime events emitted since the session started. */
  eventCount: number;
  /** Playback tasks currently scheduled. */
  pendingTasks: number;
  /** Whether the continuous transport is running. */
  transportRunning: boolean;
  /** Number of completed transport loop iterations. */
  iteration: number;
  /** Render-cache statistics. */
  cache: BufferCacheStats;
}

/** Runtime session API. */
export interface RuntimeSession {
  /** The underlying runtime (for advanced/inspection use). */
  runtime: Runtime;

  /** Apply a single command line. */
  handleCommand(line: string): SessionCommandResult;

  /**
   * Replay a multi-line command script (one command per line; blank lines and
   * `#` comments are ignored). In virtual-clock mode the clock advances by
   * `stepMs` before each command so replays are deterministic.
   */
  runCommandScript(source: string, options?: { stepMs?: number }): SessionCommandResult[];

  /** Resolve once all currently-scheduled playback tasks have run. */
  waitForIdle(): Promise<void>;

  /** Resolve once the continuous transport stops (bounded or via `stop`). */
  waitForTransportIdle(): Promise<void>;

  /** Cancel pending playback and the transport, then stop the runtime. */
  stop(): void;

  /** Session statistics snapshot. */
  stats(): RuntimeSessionStats;
}

// ── Helpers ───────────────────────────────────────────────────────

const DEFAULT_SCHEDULER: SessionScheduler = (delayMs, task) => {
  const handle = setTimeout(task, Math.max(0, delayMs));
  return () => clearTimeout(handle);
};

/**
 * Seed stride between transport iterations.
 *
 * Larger than any realistic sequence `seedOffset`, so iteration `n`'s event
 * seeds never collide with iteration `n-1`'s.
 */
const SEED_STRIDE = 1000;

/** Apply a gain multiplier to a rendered buffer (no-op for unity gain). */
function applyGain(result: RenderResult, gain: number): RenderResult {
  if (gain === 1) return result;
  const samples = new Float32Array(result.samples.length);
  for (let i = 0; i < result.samples.length; i++) {
    samples[i] = result.samples[i]! * gain;
  }
  return { ...result, samples };
}

/**
 * Compute the loop period of a simulated sequence: the last event time plus the
 * final inter-event gap, so the next iteration's first event lands one cadence
 * after the last event (rather than doubling it).
 */
function computePatternPeriodMs(simulation: SimulationResult): number {
  const events = simulation.events;
  if (events.length === 0) return 0;

  const last = events[events.length - 1]!.time_ms;
  if (events.length === 1) return Math.max(last, 0) + 1000;

  const previous = events[events.length - 2]!.time_ms;
  const gap = Math.max(1, last - previous);
  return last + gap;
}

const HELP_TEXT = [
  "Commands:",
  "  state <name>                 transition the state machine",
  "  context <dim>=<value> ...    update environment context",
  "  start [state]                start/inspect the continuous transport",
  "  stop                         stop the continuous transport",
  "  inspect                      print the current runtime inspection",
  "  reset                        reset state/context and restart",
  "  help                         show this help",
  "  quit | exit                  end the session",
].join("\n");

// ── Factory ───────────────────────────────────────────────────────

/**
 * Create a live runtime session.
 *
 * @param options - Session configuration.
 * @returns A {@link RuntimeSession}.
 */
export function createRuntimeSession(
  options: RuntimeSessionOptions,
): RuntimeSession {
  const {
    scenario,
    cache,
    scheduler = DEFAULT_SCHEDULER,
    play,
    onEvent,
    virtualClock = false,
    clockStart = 0,
    schedulePlayback = true,
    seedVariation = true,
    maxIterations = 0,
  } = options;

  const seed = options.seed ?? scenario.seed;

  // Clock: virtual (deterministic) or live.
  let clockMs = clockStart;
  const clock: () => number = virtualClock ? () => clockMs : () => Date.now();

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

  // Playback bookkeeping.
  let pending = 0;
  let eventCount = 0;
  const idleWaiters: Array<() => void> = [];
  const scheduledBySequence = new Map<string, Set<() => void>>();

  // Transport bookkeeping.
  let transportRunning = false;
  let iteration = 0;
  let loopCancel: (() => void) | null = null;
  const transportWaiters: Array<() => void> = [];

  function resolveIdleWaiters(): void {
    if (pending === 0) {
      for (const resolve of idleWaiters.splice(0)) resolve();
    }
  }

  function scheduleTask(delayMs: number, run: () => void | Promise<void>): () => void {
    let done = false;
    pending++;
    const finish = (): void => {
      if (done) return;
      done = true;
      pending--;
      resolveIdleWaiters();
    };

    const cancelTimer = scheduler(delayMs, () => {
      void Promise.resolve()
        .then(run)
        .finally(finish);
    });

    return () => {
      if (done) return;
      cancelTimer();
      finish();
    };
  }

  function trackScheduled(sequence: string, cancel: () => void): void {
    let set = scheduledBySequence.get(sequence);
    if (!set) {
      set = new Set();
      scheduledBySequence.set(sequence, set);
    }
    set.add(cancel);
  }

  function cancelSequence(sequence: string): void {
    const set = scheduledBySequence.get(sequence);
    if (!set) return;
    for (const cancel of set) cancel();
    scheduledBySequence.delete(sequence);
  }

  function cancelAll(): void {
    for (const set of scheduledBySequence.values()) {
      for (const cancel of set) cancel();
    }
    scheduledBySequence.clear();
  }

  // ── Transport ──

  function clearLoopTimer(): void {
    if (loopCancel) {
      loopCancel();
      loopCancel = null;
    }
  }

  function resolveTransportWaiters(): void {
    for (const resolve of transportWaiters.splice(0)) resolve();
  }

  function stopTransport(): void {
    transportRunning = false;
    clearLoopTimer();
    cancelAll();
    resolveTransportWaiters();
  }

  /**
   * (Re-)arm the loop: after one pattern period, advance the iteration, refire
   * the active sequence, and re-arm. Safe to call repeatedly (cancels any
   * pending loop timer first), which is how state/context changes retune it.
   */
  function armLoop(): void {
    clearLoopTimer();
    if (!transportRunning) return;

    const simulation = runtime.simulateActive();
    if (!simulation) return;

    const periodMs = computePatternPeriodMs(simulation);
    if (periodMs <= 0) return;

    loopCancel = scheduler(periodMs, () => {
      loopCancel = null;
      if (!transportRunning) return;
      if (maxIterations > 0 && iteration >= maxIterations) {
        stopTransport();
        return;
      }
      iteration++;
      if (virtualClock) clockMs += periodMs;
      runtime.refireActive(seedVariation ? iteration * SEED_STRIDE : 0);
      armLoop();
    });
  }

  const runtime = createRuntime({
    stateMachine,
    context,
    sequences: scenario.sequences,
    seed,
    clock,
    recipeResolver: createTemplateRecipeResolver(scenario.recipeResolver),
  });

  // Bridge runtime events to the cache + scheduler.
  runtime.onEvent((entry) => {
    eventCount++;

    const event = entry.event;
    if (schedulePlayback && play) {
      if (event.type === "sequence_start" || event.type === "sequence_stop") {
        const sequence = String(event.detail["sequence"] ?? "");
        if (sequence) cancelSequence(sequence);
      } else if (event.type === "event_fire") {
        const detail = event.detail;
        const recipe = String(detail["resolvedRecipe"]);
        const eventSeed = Number(detail["eventSeed"]);
        const gain = Number(detail["gain"] ?? 1);
        const delayMs = Number(detail["time_ms"] ?? 0);
        const sequence = String(detail["sequence"] ?? "");

        const cancel = scheduleTask(delayMs, async () => {
          const rendered = await cache.getOrRender({ recipe, seed: eventSeed });
          await play(applyGain(rendered, gain));
        });
        if (sequence) trackScheduled(sequence, cancel);
      }
    }

    onEvent?.(entry);
  });

  runtime.start();

  function handleCommand(line: string): SessionCommandResult {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      return { ok: true, type: "noop", message: "" };
    }

    const [verb, ...rest] = trimmed.split(/\s+/);

    switch (verb) {
      case "state": {
        if (rest.length !== 1) {
          return {
            ok: false,
            type: "error",
            message: "Usage: state <name>",
          };
        }
        try {
          const record = runtime.setState(rest[0]!);
          if (transportRunning) armLoop();
          return {
            ok: true,
            type: "state",
            message: `State: ${record.from} -> ${record.to}`,
          };
        } catch (error) {
          return { ok: false, type: "error", message: errorMessage(error) };
        }
      }

      case "context": {
        if (rest.length === 0) {
          return {
            ok: false,
            type: "error",
            message: "Usage: context <dimension>=<value> [<dimension>=<value> ...]",
          };
        }
        const updates: Record<string, string> = {};
        for (const token of rest) {
          const eq = token.indexOf("=");
          if (eq <= 0) {
            return {
              ok: false,
              type: "error",
              message: `Invalid context assignment '${token}'. Expected <dimension>=<value>.`,
            };
          }
          updates[token.slice(0, eq)] = token.slice(eq + 1);
        }
        try {
          const changes = runtime.setContext(updates);
          if (transportRunning) armLoop();
          const summary =
            changes.length === 0
              ? "Context unchanged."
              : changes
                  .map(
                    (c) =>
                      `${c.dimension}: ${c.previousValue ?? "(unset)"} -> ${c.newValue}`,
                  )
                  .join(", ");
          return { ok: true, type: "context", message: `Context: ${summary}` };
        } catch (error) {
          return { ok: false, type: "error", message: errorMessage(error) };
        }
      }

      case "start": {
        if (rest.length > 1) {
          return { ok: false, type: "error", message: "Usage: start [state]" };
        }
        const stateArg = rest[0];
        if (stateArg !== undefined) {
          try {
            runtime.setState(stateArg);
          } catch (error) {
            return { ok: false, type: "error", message: errorMessage(error) };
          }
        }
        if (!transportRunning) {
          transportRunning = true;
          iteration = 0;
        }
        armLoop();
        const active = runtime.inspect().state?.activeSequence;
        return {
          ok: true,
          type: "start",
          message: active
            ? `Transport started (sequence: ${active}).`
            : "Transport started; set a state to hear a sequence.",
        };
      }

      case "stop": {
        const wasRunning = transportRunning;
        stopTransport();
        return {
          ok: true,
          type: "stop",
          message: wasRunning
            ? "Transport stopped."
            : "Transport is not running.",
        };
      }

      case "inspect": {
        return {
          ok: true,
          type: "inspect",
          message: JSON.stringify(runtime.inspect(), null, 2),
        };
      }

      case "reset": {
        stopTransport();
        runtime.reset();
        runtime.start();
        return { ok: true, type: "reset", message: "Session reset." };
      }

      case "help": {
        return { ok: true, type: "help", message: HELP_TEXT };
      }

      case "quit":
      case "exit": {
        return { ok: true, type: "quit", message: "Bye." };
      }

      default: {
        return {
          ok: false,
          type: "error",
          message: `Unknown command '${verb}'. Type 'help' for available commands.`,
        };
      }
    }
  }

  const session: RuntimeSession = {
    runtime,

    handleCommand,

    runCommandScript(source: string, scriptOptions?: { stepMs?: number }): SessionCommandResult[] {
      const stepMs = scriptOptions?.stepMs ?? 1000;
      const results: SessionCommandResult[] = [];
      for (const line of source.split(/\r?\n/)) {
        if (virtualClock) clockMs += stepMs;
        const result = handleCommand(line);
        results.push(result);
        if (result.type === "quit") break;
      }
      return results;
    },

    waitForIdle(): Promise<void> {
      if (pending === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        idleWaiters.push(resolve);
      });
    },

    waitForTransportIdle(): Promise<void> {
      if (!transportRunning) return Promise.resolve();
      return new Promise<void>((resolve) => {
        transportWaiters.push(resolve);
      });
    },

    stop(): void {
      stopTransport();
      if (runtime.isRunning()) runtime.stop();
    },

    stats(): RuntimeSessionStats {
      return {
        eventCount,
        pendingTasks: pending,
        transportRunning,
        iteration,
        cache: cache.stats(),
      };
    },
  };

  return session;
}

/** Extract a human-readable message from an unknown thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
