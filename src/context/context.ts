/**
 * ToneForge Context
 *
 * Manages orthogonal environmental dimensions (surface, environment,
 * weather, timeOfDay, etc.) as a read-only snapshot. Context changes
 * are logged and inspectable.
 *
 * Reference: docs/prd/CONTEXT_PRD.md
 */

// ── Types ─────────────────────────────────────────────────────────

/** A context snapshot: key-value pairs of dimension names to values. */
export type ContextSnapshot = Record<string, string>;

/**
 * Dimension definitions: dimension name → array of valid values.
 * When undefined, any string value is accepted for that dimension.
 */
export type ContextDimensions = Record<string, string[] | undefined>;

/** Record of a single context change. */
export interface ContextChangeRecord {
  /** Monotonic sequence number. */
  seq: number;
  /** Timestamp in milliseconds (from provided clock or Date.now). */
  timestamp: number;
  /** The dimension that changed. */
  dimension: string;
  /** Previous value (undefined if dimension was unset). */
  previousValue: string | undefined;
  /** New value. */
  newValue: string;
}

/** Listener called whenever context changes. */
export type ContextListener = (change: ContextChangeRecord) => void;

/** Context API surface. */
export interface Context {
  /** Set one or more context dimensions. */
  set(updates: Partial<ContextSnapshot>): ContextChangeRecord[];

  /** Get the current context snapshot (read-only copy). */
  get(): Readonly<ContextSnapshot>;

  /** Get a single dimension value. */
  getDimension(dimension: string): string | undefined;

  /** Get the change history (most recent last). */
  history(limit?: number): readonly ContextChangeRecord[];

  /** Register a listener for context changes. Returns unsubscribe function. */
  onChange(listener: ContextListener): () => void;

  /** Reset context to initial values and clear history. */
  reset(): void;
}

// ── Options ───────────────────────────────────────────────────────

export interface ContextOptions {
  /** Optional dimension definitions for validation. */
  dimensions?: ContextDimensions;

  /** Initial context values. */
  initial?: ContextSnapshot;

  /** Maximum history entries to retain (default: 100). */
  maxHistory?: number;

  /** Clock function for timestamps (default: Date.now). */
  clock?: () => number;
}

// ── Factory ───────────────────────────────────────────────────────

/**
 * Create a new Context instance.
 *
 * @param options - Configuration options.
 * @returns A Context object.
 */
export function createContext(options?: ContextOptions): Context {
  const dimensions = options?.dimensions;
  const maxHistory = options?.maxHistory ?? 100;
  const clock = options?.clock ?? (() => Date.now());

  let current: ContextSnapshot = { ...(options?.initial ?? {}) };
  let changeLog: ContextChangeRecord[] = [];
  let seq = 0;
  const listeners: Set<ContextListener> = new Set();

  function validateValue(dimension: string, value: string): void {
    if (dimensions && dimensions[dimension] !== undefined) {
      const allowed = dimensions[dimension]!;
      if (!allowed.includes(value)) {
        throw new Error(
          `Invalid value '${value}' for context dimension '${dimension}'. ` +
          `Allowed: ${allowed.join(", ")}`,
        );
      }
    }
  }

  const context: Context = {
    set(updates: Partial<ContextSnapshot>): ContextChangeRecord[] {
      const changes: ContextChangeRecord[] = [];

      for (const [dimension, value] of Object.entries(updates)) {
        if (value === undefined) continue;

        validateValue(dimension, value);

        const previousValue = current[dimension];

        // Skip if value hasn't changed
        if (previousValue === value) continue;

        seq++;
        const record: ContextChangeRecord = {
          seq,
          timestamp: clock(),
          dimension,
          previousValue,
          newValue: value,
        };

        current[dimension] = value;
        changeLog.push(record);
        changes.push(record);

        // Notify listeners
        for (const listener of listeners) {
          listener(record);
        }
      }

      // Trim history
      if (changeLog.length > maxHistory) {
        changeLog = changeLog.slice(-maxHistory);
      }

      return changes;
    },

    get(): Readonly<ContextSnapshot> {
      return { ...current };
    },

    getDimension(dimension: string): string | undefined {
      return current[dimension];
    },

    history(limit?: number): readonly ContextChangeRecord[] {
      if (limit !== undefined) {
        return changeLog.slice(-limit);
      }
      return [...changeLog];
    },

    onChange(listener: ContextListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    reset(): void {
      current = { ...(options?.initial ?? {}) };
      changeLog = [];
      seq = 0;
    },
  };

  return context;
}
