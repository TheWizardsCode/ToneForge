/**
 * ToneForge State Machine
 *
 * Deterministic state machine with explicit transitions, entry/exit
 * hooks, continuous parameters, and full inspection support.
 *
 * Reference: docs/prd/STATE_PRD.md
 */

// ── Types ─────────────────────────────────────────────────────────

/** Definition of a single state in the machine. */
export interface StateDefinition {
  /** Name of the state (e.g. "idle", "walk", "run", "sprint"). */
  name: string;

  /** Associated sequence preset name for this state. */
  sequencer?: string;

  /** Parameters associated with this state (e.g. cadence, intensity). */
  params?: Record<string, number>;
}

/** Definition of a transition between states. */
export interface TransitionDefinition {
  /** Source state name. */
  from: string;

  /** Target state name. */
  to: string;
}

/** Complete state machine definition. */
export interface StateMachineDefinition {
  /** Human-readable name for this state machine (e.g. "movement"). */
  name: string;

  /** Available states. */
  states: StateDefinition[];

  /** Initial state name. */
  initial: string;

  /** Allowed transitions. If empty, all transitions are allowed. */
  transitions?: TransitionDefinition[];
}

/** Record of a state transition. */
export interface TransitionRecord {
  /** Monotonic sequence number. */
  seq: number;

  /** Timestamp in milliseconds. */
  timestamp: number;

  /** Previous state name. */
  from: string;

  /** New state name. */
  to: string;

  /** Duration spent in the previous state, in milliseconds. */
  durationInPreviousMs: number;
}

/** Result of state.inspect(). */
export interface StateInspection {
  /** Name of this state machine. */
  machineName: string;

  /** Current state name. */
  currentState: string;

  /** Current state definition (including params). */
  currentDefinition: StateDefinition;

  /** Time spent in current state, in milliseconds. */
  timeInCurrentMs: number;

  /** Last N transition records (most recent last). */
  transitions: readonly TransitionRecord[];

  /** Active sequence name (from current state definition). */
  activeSequence: string | undefined;
}

/** Listener called on state transition. */
export type StateListener = (record: TransitionRecord) => void;

/** State machine options. */
export interface StateMachineOptions {
  /** Maximum transition history entries (default: 20). */
  maxHistory?: number;

  /** Clock function for timestamps (default: Date.now). */
  clock?: () => number;
}

/** State Machine API surface. */
export interface StateMachine {
  /** Get the current state name. */
  current(): string;

  /** Get the current state definition. */
  currentDefinition(): StateDefinition;

  /** Transition to a new state. Throws if invalid. */
  set(stateName: string): TransitionRecord;

  /** Inspect current state, history, and active sequences. */
  inspect(): StateInspection;

  /** Get transition history (most recent last). */
  history(limit?: number): readonly TransitionRecord[];

  /** Register a listener for transitions. Returns unsubscribe function. */
  onTransition(listener: StateListener): () => void;

  /** Reset to initial state and clear history. */
  reset(): void;

  /** Get the state machine definition. */
  definition(): StateMachineDefinition;
}

// ── Factory ───────────────────────────────────────────────────────

/**
 * Create a new StateMachine instance.
 *
 * @param def - State machine definition.
 * @param options - Configuration options.
 * @returns A StateMachine object.
 */
export function createStateMachine(
  def: StateMachineDefinition,
  options?: StateMachineOptions,
): StateMachine {
  const maxHistory = options?.maxHistory ?? 20;
  const clock = options?.clock ?? (() => Date.now());

  // Validate definition
  const stateMap = new Map<string, StateDefinition>();
  for (const state of def.states) {
    if (stateMap.has(state.name)) {
      throw new Error(`Duplicate state name: '${state.name}'`);
    }
    stateMap.set(state.name, state);
  }

  if (!stateMap.has(def.initial)) {
    throw new Error(
      `Initial state '${def.initial}' not found in state definitions. ` +
      `Available: ${Array.from(stateMap.keys()).join(", ")}`,
    );
  }

  // Build transition set for O(1) validation
  const allowedTransitions: Set<string> | null =
    def.transitions && def.transitions.length > 0
      ? new Set(def.transitions.map((t) => `${t.from}->${t.to}`))
      : null; // null = all transitions allowed

  // Validate transitions reference valid states
  if (def.transitions) {
    for (const t of def.transitions) {
      if (!stateMap.has(t.from)) {
        throw new Error(`Transition references unknown state '${t.from}'.`);
      }
      if (!stateMap.has(t.to)) {
        throw new Error(`Transition references unknown state '${t.to}'.`);
      }
    }
  }

  let currentStateName = def.initial;
  let enteredAt = clock();
  let transitionLog: TransitionRecord[] = [];
  let seq = 0;
  const listeners: Set<StateListener> = new Set();

  const machine: StateMachine = {
    current(): string {
      return currentStateName;
    },

    currentDefinition(): StateDefinition {
      return stateMap.get(currentStateName)!;
    },

    set(stateName: string): TransitionRecord {
      if (!stateMap.has(stateName)) {
        throw new Error(
          `Unknown state '${stateName}'. ` +
          `Available: ${Array.from(stateMap.keys()).join(", ")}`,
        );
      }

      if (stateName === currentStateName) {
        throw new Error(
          `Already in state '${stateName}'. No transition needed.`,
        );
      }

      // Validate transition
      if (allowedTransitions !== null) {
        const key = `${currentStateName}->${stateName}`;
        if (!allowedTransitions.has(key)) {
          throw new Error(
            `Transition from '${currentStateName}' to '${stateName}' ` +
            `is not allowed.`,
          );
        }
      }

      const now = clock();
      const durationInPreviousMs = now - enteredAt;

      seq++;
      const record: TransitionRecord = {
        seq,
        timestamp: now,
        from: currentStateName,
        to: stateName,
        durationInPreviousMs,
      };

      currentStateName = stateName;
      enteredAt = now;
      transitionLog.push(record);

      // Trim history
      if (transitionLog.length > maxHistory) {
        transitionLog = transitionLog.slice(-maxHistory);
      }

      // Notify listeners
      for (const listener of listeners) {
        listener(record);
      }

      return record;
    },

    inspect(): StateInspection {
      const now = clock();
      const stateDef = stateMap.get(currentStateName)!;

      return {
        machineName: def.name,
        currentState: currentStateName,
        currentDefinition: stateDef,
        timeInCurrentMs: now - enteredAt,
        transitions: [...transitionLog],
        activeSequence: stateDef.sequencer,
      };
    },

    history(limit?: number): readonly TransitionRecord[] {
      if (limit !== undefined) {
        return transitionLog.slice(-limit);
      }
      return [...transitionLog];
    },

    onTransition(listener: StateListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    reset(): void {
      currentStateName = def.initial;
      enteredAt = clock();
      transitionLog = [];
      seq = 0;
    },

    definition(): StateMachineDefinition {
      return def;
    },
  };

  return machine;
}
