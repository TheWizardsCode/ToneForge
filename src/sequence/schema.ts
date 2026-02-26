/**
 * Sequence Preset Schema
 *
 * Defines the JSON schema types for sequence preset files and provides
 * validation. Presets are versioned (v1) to support forward-compatible
 * schema evolution.
 *
 * Reference: docs/prd/SEQUENCER_PRD.md
 */

// ── JSON Schema Types ─────────────────────────────────────────────

/** A single event definition in a sequence preset. */
export interface SequenceEventJson {
  /** Time offset in seconds from the start of the sequence. */
  time: number;

  /**
   * Name of the recipe, stack preset, or library entry to trigger.
   * Resolved at runtime by the recipe resolver.
   */
  event: string;

  /**
   * Integer offset added to the base seed for this event.
   * Ensures each event instance gets a unique but deterministic seed.
   * Defaults to the event's index in the events array.
   */
  seedOffset?: number;

  /**
   * Probability that this event fires (0..1, default: 1.0).
   * Used for probabilistic patterns (e.g. footsteps, ambient).
   */
  probability?: number;

  /** Optional gain multiplier for this event (default: 1.0). */
  gain?: number;

  /** Optional duration override in seconds. */
  duration?: number;
}

/** Repeat configuration for looping the entire sequence. */
export interface SequenceRepeatJson {
  /** Number of times to repeat the pattern. 0 = no repeat, just play once. */
  count: number;

  /** Interval in seconds between the start of each repetition. */
  interval: number;
}

/** JSON representation of a sequence preset file. */
export interface SequencePresetJson {
  /** Schema version for forward-compatibility (e.g. "1.0"). */
  version: string;

  /** Human-readable name for the sequence preset. */
  name: string;

  /** Optional description of the sequence behavior. */
  description?: string;

  /** Optional tempo in BPM. Used for beat-aligned quantization. */
  tempo?: number;

  /** Array of event definitions. */
  events: SequenceEventJson[];

  /** Optional repeat configuration for looping the pattern. */
  repeat?: SequenceRepeatJson;
}

// ── Validated Internal Types ──────────────────────────────────────

/** A validated, resolved event ready for scheduling. */
export interface SequenceEvent {
  /** Time offset in seconds from the start of the sequence. */
  time: number;

  /** Time offset in milliseconds. */
  time_ms: number;

  /** Name of the recipe/stack/library entry to trigger. */
  event: string;

  /** Integer seed offset for this event. */
  seedOffset: number;

  /** Probability of firing (0..1). */
  probability: number;

  /** Gain multiplier. */
  gain: number;

  /** Duration override in seconds, or undefined for recipe default. */
  duration?: number;
}

/** A validated sequence definition ready for simulation/rendering. */
export interface SequenceDefinition {
  /** Human-readable name. */
  name: string;

  /** Optional description. */
  description?: string;

  /** Tempo in BPM, or undefined. */
  tempo?: number;

  /** Resolved events sorted by time. */
  events: SequenceEvent[];

  /** Repeat configuration, or undefined. */
  repeat?: {
    count: number;
    interval: number;
  };
}

// ── Validation Error ──────────────────────────────────────────────

/** A structured validation error with field-level detail. */
export interface ValidationError {
  /** Path to the invalid field (e.g. "events[2].time"). */
  field: string;

  /** Human-readable error message. */
  message: string;
}

// ── Validation ────────────────────────────────────────────────────

/**
 * Validate a parsed JSON object against the sequence preset schema.
 *
 * Returns an array of validation errors. An empty array means the preset
 * is valid.
 *
 * @param data - The parsed JSON data.
 * @param filePath - File path for error messages.
 * @returns Array of validation errors (empty = valid).
 */
export function validateSequencePreset(
  data: unknown,
  filePath: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    errors.push({
      field: "(root)",
      message: `Invalid preset '${filePath}': expected a JSON object.`,
    });
    return errors;
  }

  const obj = data as Record<string, unknown>;

  // Version field
  if (typeof obj["version"] !== "string" || obj["version"].trim() === "") {
    errors.push({
      field: "version",
      message: `Missing or invalid 'version' field (expected string, e.g. "1.0").`,
    });
  }

  // Name field
  if (typeof obj["name"] !== "string" || obj["name"].trim() === "") {
    errors.push({
      field: "name",
      message: `Missing or invalid 'name' field (expected non-empty string).`,
    });
  }

  // Description (optional)
  if (obj["description"] !== undefined && typeof obj["description"] !== "string") {
    errors.push({
      field: "description",
      message: `Invalid 'description' field (expected string).`,
    });
  }

  // Tempo (optional)
  if (obj["tempo"] !== undefined) {
    if (typeof obj["tempo"] !== "number" || obj["tempo"] <= 0) {
      errors.push({
        field: "tempo",
        message: `Invalid 'tempo' field (expected positive number).`,
      });
    }
  }

  // Events field
  if (!Array.isArray(obj["events"])) {
    errors.push({
      field: "events",
      message: `Missing or invalid 'events' field (expected array).`,
    });
  } else if (obj["events"].length === 0) {
    errors.push({
      field: "events",
      message: `'events' array must contain at least one event.`,
    });
  } else {
    for (let i = 0; i < obj["events"].length; i++) {
      const raw = obj["events"][i] as Record<string, unknown>;
      const prefix = `events[${i}]`;

      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        errors.push({
          field: prefix,
          message: `Event must be an object.`,
        });
        continue;
      }

      // time (required, number >= 0)
      if (typeof raw["time"] !== "number" || raw["time"] < 0) {
        errors.push({
          field: `${prefix}.time`,
          message: `Missing or invalid 'time' (expected number >= 0).`,
        });
      }

      // event (required, non-empty string)
      if (typeof raw["event"] !== "string" || raw["event"].trim() === "") {
        errors.push({
          field: `${prefix}.event`,
          message: `Missing or invalid 'event' name (expected non-empty string).`,
        });
      }

      // seedOffset (optional, integer)
      if (raw["seedOffset"] !== undefined) {
        if (typeof raw["seedOffset"] !== "number" || !Number.isInteger(raw["seedOffset"])) {
          errors.push({
            field: `${prefix}.seedOffset`,
            message: `Invalid 'seedOffset' (expected integer).`,
          });
        }
      }

      // probability (optional, 0..1)
      if (raw["probability"] !== undefined) {
        if (
          typeof raw["probability"] !== "number" ||
          raw["probability"] < 0 ||
          raw["probability"] > 1
        ) {
          errors.push({
            field: `${prefix}.probability`,
            message: `Invalid 'probability' (expected number 0..1).`,
          });
        }
      }

      // gain (optional, number >= 0)
      if (raw["gain"] !== undefined) {
        if (typeof raw["gain"] !== "number" || raw["gain"] < 0) {
          errors.push({
            field: `${prefix}.gain`,
            message: `Invalid 'gain' (expected number >= 0).`,
          });
        }
      }

      // duration (optional, number > 0)
      if (raw["duration"] !== undefined) {
        if (typeof raw["duration"] !== "number" || raw["duration"] <= 0) {
          errors.push({
            field: `${prefix}.duration`,
            message: `Invalid 'duration' (expected number > 0).`,
          });
        }
      }
    }
  }

  // Repeat (optional)
  if (obj["repeat"] !== undefined) {
    if (typeof obj["repeat"] !== "object" || obj["repeat"] === null || Array.isArray(obj["repeat"])) {
      errors.push({
        field: "repeat",
        message: `Invalid 'repeat' field (expected object).`,
      });
    } else {
      const rep = obj["repeat"] as Record<string, unknown>;

      if (typeof rep["count"] !== "number" || !Number.isInteger(rep["count"]) || rep["count"] < 0) {
        errors.push({
          field: "repeat.count",
          message: `Missing or invalid 'count' (expected non-negative integer).`,
        });
      }

      if (typeof rep["interval"] !== "number" || rep["interval"] <= 0) {
        errors.push({
          field: "repeat.interval",
          message: `Missing or invalid 'interval' (expected positive number in seconds).`,
        });
      }
    }
  }

  return errors;
}

/**
 * Parse and validate a sequence preset JSON into a SequenceDefinition.
 *
 * @param data - The parsed JSON data.
 * @param filePath - File path for error messages.
 * @returns A validated SequenceDefinition.
 * @throws If validation fails with descriptive error messages.
 */
export function parseSequencePreset(
  data: unknown,
  filePath: string,
): SequenceDefinition {
  const errors = validateSequencePreset(data, filePath);

  if (errors.length > 0) {
    const messages = errors.map((e) => `  ${e.field}: ${e.message}`).join("\n");
    throw new Error(
      `Invalid sequence preset '${filePath}':\n${messages}`,
    );
  }

  const obj = data as Record<string, unknown>;
  const rawEvents = obj["events"] as Array<Record<string, unknown>>;

  const events: SequenceEvent[] = rawEvents.map((raw, i) => ({
    time: raw["time"] as number,
    time_ms: (raw["time"] as number) * 1000,
    event: raw["event"] as string,
    seedOffset: (raw["seedOffset"] as number | undefined) ?? i,
    probability: (raw["probability"] as number | undefined) ?? 1.0,
    gain: (raw["gain"] as number | undefined) ?? 1.0,
    duration: raw["duration"] as number | undefined,
  }));

  // Sort by time for deterministic scheduling
  events.sort((a, b) => a.time - b.time);

  const definition: SequenceDefinition = {
    name: obj["name"] as string,
    description: obj["description"] as string | undefined,
    tempo: obj["tempo"] as number | undefined,
    events,
  };

  if (obj["repeat"] !== undefined) {
    const rep = obj["repeat"] as Record<string, unknown>;
    definition.repeat = {
      count: rep["count"] as number,
      interval: rep["interval"] as number,
    };
  }

  return definition;
}
