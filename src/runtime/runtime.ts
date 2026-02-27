/**
 * ToneForge Runtime
 *
 * Lightweight, deterministic playback engine that orchestrates State,
 * Context, and Sequencer for real-time behavioral sound. The runtime
 * schedules sequence events based on the current state and context,
 * logs all events deterministically, and provides full inspection.
 *
 * Reference: docs/prd/RUNTIME_PRD.md
 */

import { createRng } from "../core/rng.js";
import type { Rng } from "../core/rng.js";
import type { StateMachine, TransitionRecord } from "../state/state.js";
import type { Context, ContextChangeRecord } from "../context/context.js";
import type { SequenceDefinition } from "../sequence/schema.js";
import { simulate } from "../sequence/simulator.js";
import type { SimulationResult, TimelineEvent } from "../sequence/simulator.js";

// ── Types ─────────────────────────────────────────────────────────

/** A single runtime event logged during playback. */
export interface RuntimeEvent {
  /** Monotonic event ID (unique within this runtime session). */
  id: number;

  /** Timestamp in milliseconds (from provided clock). */
  timestamp: number;

  /** Type of event. */
  type:
    | "start"
    | "stop"
    | "state_change"
    | "context_change"
    | "sequence_start"
    | "sequence_stop"
    | "event_fire"
    | "event_skip";

  /** Descriptive detail for the event. */
  detail: Record<string, unknown>;

  /** Seed used to generate this event (if applicable). */
  seed?: number;
}

/** A JSONL-compatible log entry. */
export interface RuntimeLogEntry {
  /** Runtime session ID. */
  sessionId: string;

  /** The event. */
  event: RuntimeEvent;
}

/** Result of runtime.inspect(). */
export interface RuntimeInspection {
  /** Whether the runtime is currently running. */
  running: boolean;

  /** Session ID (null if not running). */
  sessionId: string | null;

  /** Current state inspection (if state machine is attached). */
  state: {
    machineName: string;
    currentState: string;
    timeInCurrentMs: number;
    transitions: readonly TransitionRecord[];
    activeSequence: string | undefined;
  } | null;

  /** Current context snapshot. */
  context: Record<string, string>;

  /** Active sequences. */
  activeSequences: string[];

  /** Total events fired this session. */
  eventCount: number;

  /** Base seed for this session. */
  seed: number;
}

/** Listener for runtime events. */
export type RuntimeListener = (entry: RuntimeLogEntry) => void;

/** Mapping from state name to sequence definition. */
export type SequenceMap = Record<string, SequenceDefinition>;

/**
 * Recipe resolver: given a recipe/event name and the current context,
 * returns the effective recipe name. This allows context-driven recipe
 * switching (e.g. "footstep" + surface:"gravel" → "footstep-gravel").
 */
export type RecipeResolver = (
  eventName: string,
  context: Record<string, string>,
) => string;

/** Runtime configuration options. */
export interface RuntimeOptions {
  /** State machine for state-driven sequences. */
  stateMachine?: StateMachine;

  /** Context for environment-driven behavior. */
  context?: Context;

  /** Map of state names to sequence definitions. */
  sequences?: SequenceMap;

  /** Base seed for deterministic event generation. */
  seed?: number;

  /** Clock function for timestamps (default: Date.now). */
  clock?: () => number;

  /**
   * Recipe resolver for context-driven recipe switching.
   * Default: returns event name as-is.
   */
  recipeResolver?: RecipeResolver;

  /** Maximum log entries to retain in memory (default: 1000). */
  maxLogEntries?: number;
}

/** Runtime API surface. */
export interface Runtime {
  /** Start the runtime. Returns the session ID. */
  start(): string;

  /** Stop the runtime. */
  stop(): void;

  /** Whether the runtime is currently running. */
  isRunning(): boolean;

  /** Set the state (delegates to attached StateMachine). */
  setState(stateName: string): TransitionRecord;

  /** Set context dimensions (delegates to attached Context). */
  setContext(updates: Record<string, string>): ContextChangeRecord[];

  /** Inspect current runtime state. */
  inspect(): RuntimeInspection;

  /** Get the event log for this session. */
  log(limit?: number): readonly RuntimeLogEntry[];

  /** Register a listener for runtime events. Returns unsubscribe. */
  onEvent(listener: RuntimeListener): () => void;

  /** Get the current session ID (null if not running). */
  sessionId(): string | null;

  /**
   * Simulate the current sequence for the active state.
   * Returns scheduled timeline events for the active sequence
   * given the current state and context.
   */
  simulateActive(): SimulationResult | null;

  /** Reset the runtime, clearing all state, context, and logs. */
  reset(): void;
}

// ── Factory ───────────────────────────────────────────────────────

/**
 * Create a new Runtime instance.
 *
 * @param options - Runtime configuration.
 * @returns A Runtime object.
 */
export function createRuntime(options?: RuntimeOptions): Runtime {
  const seed = options?.seed ?? 42;
  const clock = options?.clock ?? (() => Date.now());
  const maxLogEntries = options?.maxLogEntries ?? 1000;
  const stateMachine = options?.stateMachine ?? null;
  const context = options?.context ?? null;
  const sequences = options?.sequences ?? {};
  const recipeResolver: RecipeResolver =
    options?.recipeResolver ?? ((name) => name);

  let running = false;
  let currentSessionId: string | null = null;
  let eventLog: RuntimeLogEntry[] = [];
  let eventCounter = 0;
  let sessionRng: Rng = createRng(seed);
  const listeners: Set<RuntimeListener> = new Set();

  // Track active sequence name for inspection
  let activeSequenceName: string | null = null;

  function generateSessionId(): string {
    // Deterministic session ID from seed + timestamp
    const ts = clock();
    return `session-${seed}-${ts}`;
  }

  function emit(event: RuntimeEvent): void {
    const entry: RuntimeLogEntry = {
      sessionId: currentSessionId!,
      event,
    };

    eventLog.push(entry);

    // Trim log
    if (eventLog.length > maxLogEntries) {
      eventLog = eventLog.slice(-maxLogEntries);
    }

    // Notify listeners
    for (const listener of listeners) {
      listener(entry);
    }
  }

  function nextEventId(): number {
    return ++eventCounter;
  }

  function getCurrentContextSnapshot(): Record<string, string> {
    return context ? { ...context.get() } : {};
  }

  function resolveSequenceForState(stateName: string): SequenceDefinition | null {
    // First check if there's a direct state→sequence mapping
    if (sequences[stateName]) {
      return sequences[stateName]!;
    }

    // Then check if the state definition has a sequencer reference
    if (stateMachine) {
      const def = stateMachine.definition();
      const stateDef = def.states.find((s) => s.name === stateName);
      if (stateDef?.sequencer && sequences[stateDef.sequencer]) {
        return sequences[stateDef.sequencer]!;
      }
    }

    return null;
  }

  function activateSequenceForState(stateName: string): void {
    const seqDef = resolveSequenceForState(stateName);

    if (activeSequenceName) {
      emit({
        id: nextEventId(),
        timestamp: clock(),
        type: "sequence_stop",
        detail: { sequence: activeSequenceName, reason: "state_change" },
      });
      activeSequenceName = null;
    }

    if (seqDef) {
      activeSequenceName = seqDef.name;
      emit({
        id: nextEventId(),
        timestamp: clock(),
        type: "sequence_start",
        detail: {
          sequence: seqDef.name,
          state: stateName,
          eventCount: seqDef.events.length,
          hasRepeat: !!seqDef.repeat,
        },
        seed,
      });

      // Simulate the sequence and fire events
      fireSequenceEvents(seqDef, stateName);
    }
  }

  function fireSequenceEvents(
    seqDef: SequenceDefinition,
    stateName: string,
  ): void {
    const simulation = simulate(seqDef, seed);
    const ctx = getCurrentContextSnapshot();

    for (const evt of simulation.events) {
      const resolvedRecipe = recipeResolver(evt.event, ctx);

      emit({
        id: nextEventId(),
        timestamp: clock(),
        type: "event_fire",
        detail: {
          sequence: seqDef.name,
          state: stateName,
          originalRecipe: evt.event,
          resolvedRecipe,
          time_ms: evt.time_ms,
          gain: evt.gain,
          seedOffset: evt.seedOffset,
          eventSeed: evt.eventSeed,
          repetition: evt.repetition,
          context: ctx,
        },
        seed: evt.eventSeed,
      });
    }
  }

  const runtime: Runtime = {
    start(): string {
      if (running) {
        throw new Error("Runtime is already running.");
      }

      running = true;
      eventCounter = 0;
      eventLog = [];
      sessionRng = createRng(seed);
      currentSessionId = generateSessionId();
      activeSequenceName = null;

      emit({
        id: nextEventId(),
        timestamp: clock(),
        type: "start",
        detail: {
          seed,
          state: stateMachine?.current() ?? null,
          context: getCurrentContextSnapshot(),
        },
      });

      // Activate sequence for current state if applicable
      if (stateMachine) {
        const currentState = stateMachine.current();
        const seqDef = resolveSequenceForState(currentState);
        if (seqDef) {
          activeSequenceName = seqDef.name;
          emit({
            id: nextEventId(),
            timestamp: clock(),
            type: "sequence_start",
            detail: {
              sequence: seqDef.name,
              state: currentState,
              eventCount: seqDef.events.length,
              hasRepeat: !!seqDef.repeat,
            },
            seed,
          });

          fireSequenceEvents(seqDef, currentState);
        }
      }

      return currentSessionId;
    },

    stop(): void {
      if (!running) {
        throw new Error("Runtime is not running.");
      }

      if (activeSequenceName) {
        emit({
          id: nextEventId(),
          timestamp: clock(),
          type: "sequence_stop",
          detail: { sequence: activeSequenceName, reason: "runtime_stop" },
        });
        activeSequenceName = null;
      }

      emit({
        id: nextEventId(),
        timestamp: clock(),
        type: "stop",
        detail: {
          totalEvents: eventCounter,
        },
      });

      running = false;
    },

    isRunning(): boolean {
      return running;
    },

    setState(stateName: string): TransitionRecord {
      if (!running) {
        throw new Error(
          "Runtime is not running. Call start() before setting state.",
        );
      }

      if (!stateMachine) {
        throw new Error("No state machine attached to this runtime.");
      }

      const record = stateMachine.set(stateName);

      emit({
        id: nextEventId(),
        timestamp: clock(),
        type: "state_change",
        detail: {
          from: record.from,
          to: record.to,
          durationInPreviousMs: record.durationInPreviousMs,
          seq: record.seq,
        },
      });

      // Switch active sequence
      activateSequenceForState(stateName);

      return record;
    },

    setContext(updates: Record<string, string>): ContextChangeRecord[] {
      if (!running) {
        throw new Error(
          "Runtime is not running. Call start() before setting context.",
        );
      }

      if (!context) {
        throw new Error("No context attached to this runtime.");
      }

      const changes = context.set(updates);

      for (const change of changes) {
        emit({
          id: nextEventId(),
          timestamp: clock(),
          type: "context_change",
          detail: {
            dimension: change.dimension,
            previousValue: change.previousValue,
            newValue: change.newValue,
            seq: change.seq,
          },
        });
      }

      // If there's an active sequence and context changed, re-fire
      // to show recipe resolution with new context
      if (activeSequenceName && stateMachine && changes.length > 0) {
        const currentState = stateMachine.current();
        const seqDef = resolveSequenceForState(currentState);
        if (seqDef) {
          fireSequenceEvents(seqDef, currentState);
        }
      }

      return changes;
    },

    inspect(): RuntimeInspection {
      let stateInfo: RuntimeInspection["state"] = null;

      if (stateMachine) {
        const si = stateMachine.inspect();
        stateInfo = {
          machineName: si.machineName,
          currentState: si.currentState,
          timeInCurrentMs: si.timeInCurrentMs,
          transitions: si.transitions,
          activeSequence: si.activeSequence,
        };
      }

      return {
        running,
        sessionId: currentSessionId,
        state: stateInfo,
        context: getCurrentContextSnapshot(),
        activeSequences: activeSequenceName ? [activeSequenceName] : [],
        eventCount: eventCounter,
        seed,
      };
    },

    log(limit?: number): readonly RuntimeLogEntry[] {
      if (limit !== undefined) {
        return eventLog.slice(-limit);
      }
      return [...eventLog];
    },

    onEvent(listener: RuntimeListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    sessionId(): string | null {
      return currentSessionId;
    },

    simulateActive(): SimulationResult | null {
      if (!stateMachine) return null;

      const currentState = stateMachine.current();
      const seqDef = resolveSequenceForState(currentState);
      if (!seqDef) return null;

      return simulate(seqDef, seed);
    },

    reset(): void {
      if (running) {
        // Force stop without emitting events
        running = false;
      }
      eventLog = [];
      eventCounter = 0;
      currentSessionId = null;
      activeSequenceName = null;
      sessionRng = createRng(seed);

      if (stateMachine) {
        stateMachine.reset();
      }
      if (context) {
        context.reset();
      }
    },
  };

  return runtime;
}
