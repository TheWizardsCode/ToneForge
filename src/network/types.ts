/**
 * Canonical behavioural event model for ToneForge Network.
 *
 * A behavioural event is a compact, serializable description of *what should
 * happen* — never *what it sounds like*. Host and clients exchange these
 * events and resolve them locally, deterministically.
 *
 * Reference: docs/prd/NETWORK_PRD.md §4.1 (Behavioural Event) and §7 (Network API).
 * See also docs/network.md for the canonical wire form.
 *
 * Work item: TF-0MUZYS26D00631KV (Behavioural event model and canonical serialization).
 */

import type { ContextSnapshot } from "../context/context.js";

export type { ContextSnapshot };

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

/**
 * Current canonical schema version for behavioural events.
 *
 * Bump this when the v1 field set changes; older clients then skip the event
 * rather than mis-resolving it.
 */
export const BEHAVIOURAL_EVENT_VERSION = 1;

/**
 * Event schema versions this build can decode.
 *
 * Decoding an event whose version is absent from this list is skipped
 * gracefully with a structured warning rather than throwing.
 */
export const SUPPORTED_EVENT_VERSIONS: readonly number[] = [1];

/**
 * Whether the given value is a schema version this build understands.
 */
export function isSupportedEventVersion(version: unknown): version is number {
  return (
    typeof version === "number" &&
    Number.isInteger(version) &&
    SUPPORTED_EVENT_VERSIONS.includes(version)
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A state snapshot: the behavioural state label at the moment the event was
 * emitted (for example `"walk"`). Resolving the event against local state is
 * what produces identical sound on every client.
 */
export type StateSnapshot = string;

/**
 * A behavioural event as defined by NETWORK_PRD §4.1.
 *
 * The field set is version-gated: additive fields only appear in a new
 * `version`, so a v1 decoder rejects unknown fields rather than guessing.
 */
export interface BehaviouralEvent {
  /** Schema version — gates forward-compatible parsing. */
  version: number;
  /** Event identifier/type, for example `"footstep"`. */
  event: string;
  /** Deterministic seed used for local synthesis. */
  seed: number;
  /** Timestamp in seconds (monotonic session time). */
  time: number;
  /** State snapshot label. */
  state: StateSnapshot;
  /** Context snapshot — flat, string-valued dimensions. */
  context: ContextSnapshot;
}

/**
 * The fields a caller supplies when constructing a v1 event. The `version` is
 * optional and stamped to {@link BEHAVIOURAL_EVENT_VERSION} when omitted.
 */
export type BehaviouralEventInput = Omit<BehaviouralEvent, "version"> & {
  version?: number;
};

/** A single structural validation failure. */
export interface EventValidationError {
  /** Name of the offending field, or `"$"` for the value as a whole. */
  field: string;
  /** Human-readable explanation. */
  message: string;
}

/** Result of validating an unknown value as a behavioural event. */
export type EventValidationResult =
  | { valid: true; event: BehaviouralEvent }
  | { valid: false; errors: EventValidationError[] };

/** Thrown by {@link createBehaviouralEvent} when the input is not a valid event. */
export class BehaviouralEventValidationError extends Error {
  /** The individual validation failures. */
  readonly errors: EventValidationError[];

  constructor(errors: EventValidationError[]) {
    super(
      `Invalid behavioural event: ${errors
        .map((e) => `${e.field}: ${e.message}`)
        .join("; ")}`,
    );
    this.name = "BehaviouralEventValidationError";
    this.errors = errors;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const KNOWN_FIELDS = new Set([
  "version",
  "event",
  "seed",
  "time",
  "state",
  "context",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Validate an unknown value against the canonical v1 behavioural event shape.
 *
 * The check is strict: unknown fields and unsupported versions are reported as
 * errors, which keeps the encoded wire form canonical and round-trippable.
 * Returns a fresh, canonical event object on success — the input is never
 * mutated.
 */
export function validateBehaviouralEvent(
  input: unknown,
): EventValidationResult {
  if (!isPlainObject(input)) {
    return {
      valid: false,
      errors: [{ field: "$", message: "must be a plain object" }],
    };
  }

  const errors: EventValidationError[] = [];

  for (const key of Object.keys(input)) {
    if (!KNOWN_FIELDS.has(key)) {
      errors.push({ field: key, message: "unknown field" });
    }
  }

  const version = input.version;
  if (version === undefined) {
    errors.push({ field: "version", message: "is required" });
  } else if (!Number.isInteger(version)) {
    errors.push({ field: "version", message: "must be an integer" });
  } else if (!isSupportedEventVersion(version)) {
    errors.push({
      field: "version",
      message: `unsupported version ${version}`,
    });
  }

  if (!isNonEmptyString(input.event)) {
    errors.push({ field: "event", message: "must be a non-empty string" });
  }

  if (!Number.isInteger(input.seed)) {
    errors.push({ field: "seed", message: "must be an integer" });
  }

  if (
    typeof input.time !== "number" ||
    !Number.isFinite(input.time) ||
    input.time < 0
  ) {
    errors.push({ field: "time", message: "must be a finite number >= 0" });
  }

  if (!isNonEmptyString(input.state)) {
    errors.push({ field: "state", message: "must be a non-empty string" });
  }

  if (!isPlainObject(input.context)) {
    errors.push({ field: "context", message: "must be a plain object" });
  } else {
    for (const [key, value] of Object.entries(input.context)) {
      if (typeof value !== "string") {
        errors.push({
          field: `context.${key}`,
          message: "must be a string",
        });
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const context: ContextSnapshot = {};
  for (const key of Object.keys(input.context as Record<string, unknown>).sort()) {
    context[key] = (input.context as Record<string, string>)[key]!;
  }

  return {
    valid: true,
    event: {
      version: version as number,
      event: input.event as string,
      seed: input.seed as number,
      time: input.time as number,
      state: input.state as string,
      context,
    },
  };
}

/**
 * Type guard for a valid behavioural event.
 */
export function isBehaviouralEvent(input: unknown): input is BehaviouralEvent {
  return validateBehaviouralEvent(input).valid;
}

/**
 * Construct a validated, version-stamped behavioural event.
 *
 * @throws {BehaviouralEventValidationError} when the input is not a valid event.
 */
export function createBehaviouralEvent(
  input: BehaviouralEventInput,
): BehaviouralEvent {
  const candidate = {
    ...input,
    version: input.version ?? BEHAVIOURAL_EVENT_VERSION,
  };
  const result = validateBehaviouralEvent(candidate);
  if (!result.valid) {
    throw new BehaviouralEventValidationError(result.errors);
  }
  return result.event;
}
