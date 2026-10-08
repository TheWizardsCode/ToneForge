/**
 * Canonical serialization and version handling for behavioural events.
 *
 * The canonical form is compact JSON with recursively sorted object keys, so
 * two events that are structurally equal always encode to the identical byte
 * sequence regardless of property insertion order. Decoding is version-gated:
 * an unsupported version is reported (and skipped in a stream) rather than
 * crashing the decoder.
 *
 * Reference: docs/prd/NETWORK_PRD.md §4.1, §7; docs/network.md.
 *
 * Work item: TF-0MUZYS26D00631KV (Behavioural event model and canonical serialization).
 */

import {
  BehaviouralEventValidationError,
  validateBehaviouralEvent,
  isSupportedEventVersion,
  type BehaviouralEvent,
} from "./types.js";

export { BehaviouralEventValidationError, isSupportedEventVersion };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown by {@link decodeEventOrThrow} when the input cannot be parsed. */
export class MalformedEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedEventError";
  }
}

/** Thrown by {@link decodeEventOrThrow} for an unsupported schema version. */
export class UnsupportedEventVersionError extends Error {
  /** The version that was encountered. */
  readonly version: number;

  constructor(version: number) {
    super(`Unsupported behavioural event version: ${version}`);
    this.name = "UnsupportedEventVersionError";
    this.version = version;
  }
}

// ---------------------------------------------------------------------------
// Decode result types
// ---------------------------------------------------------------------------

/** A structured, non-fatal decode notification. */
export interface EventWarning {
  /** What kind of problem was encountered. */
  kind: "unsupported-version" | "malformed";
  /** Human-readable explanation. */
  message: string;
  /** The offending version, when known. */
  version?: number;
}

/** Result of decoding a single behavioural event. */
export type EventDecodeResult =
  | { status: "ok"; event: BehaviouralEvent }
  | { status: "unsupported-version"; version: number; warning: EventWarning }
  | { status: "malformed"; warning: EventWarning };

/** A warning tied to its position in a decoded stream. */
export interface StreamEventWarning extends EventWarning {
  /** Index of the entry in the input stream. */
  index: number;
}

/** Result of decoding a stream of behavioural events. */
export interface EventStreamDecodeResult {
  /** Successfully decoded events, in input order. */
  events: BehaviouralEvent[];
  /** Warnings for entries that were skipped. */
  warnings: StreamEventWarning[];
  /** Number of entries that were skipped. */
  skipped: number;
}

// ---------------------------------------------------------------------------
// Canonical encoding
// ---------------------------------------------------------------------------

/**
 * Recursively rebuild a value with object keys sorted lexicographically.
 * Arrays keep their order; primitives pass through unchanged.
 */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Serialize any value to compact JSON with recursively sorted keys.
 *
 * Exposed for callers that need the same canonical ordering for related
 * payloads (for example late-join snapshots).
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/**
 * Encode a behavioural event to its canonical wire form.
 *
 * The event is validated first; the encoded form is compact (no whitespace)
 * with keys sorted lexicographically, so it is deterministic and
 * round-trippable.
 *
 * @throws {BehaviouralEventValidationError} when the event is invalid.
 */
export function encodeEvent(event: BehaviouralEvent): string {
  const result = validateBehaviouralEvent(event);
  if (!result.valid) {
    throw new BehaviouralEventValidationError(result.errors);
  }
  return canonicalStringify(result.event);
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

function malformed(message: string): EventDecodeResult {
  return { status: "malformed", warning: { kind: "malformed", message } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Decode a canonical (or any JSON) behavioural event without throwing.
 *
 * Distinguishes malformed input from a well-formed event with an unsupported
 * version, so callers can skip forward-compatibly.
 */
export function decodeEvent(text: string): EventDecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return malformed(`not valid JSON: ${detail}`);
  }

  if (!isPlainObject(parsed)) {
    return malformed("top-level JSON value must be an object");
  }

  const version = parsed.version;
  if (version === undefined) {
    return malformed("missing required field: version");
  }
  if (typeof version !== "number" || !Number.isInteger(version)) {
    return malformed("field 'version' must be an integer");
  }
  if (!isSupportedEventVersion(version)) {
    return {
      status: "unsupported-version",
      version,
      warning: {
        kind: "unsupported-version",
        version,
        message: `unsupported behavioural event version ${version}`,
      },
    };
  }

  const result = validateBehaviouralEvent(parsed);
  if (!result.valid) {
    return malformed(
      result.errors.map((e) => `${e.field}: ${e.message}`).join("; "),
    );
  }
  return { status: "ok", event: result.event };
}

/**
 * Decode a behavioural event, throwing on malformed input or an unsupported
 * version.
 *
 * @throws {UnsupportedEventVersionError} for an unknown version.
 * @throws {MalformedEventError} for structurally invalid input.
 */
export function decodeEventOrThrow(text: string): BehaviouralEvent {
  const result = decodeEvent(text);
  switch (result.status) {
    case "ok":
      return result.event;
    case "unsupported-version":
      throw new UnsupportedEventVersionError(result.version);
    case "malformed":
      throw new MalformedEventError(result.warning.message);
  }
}

/**
 * Decode a stream of encoded events, skipping (and warning about) any entry
 * that is malformed or uses an unsupported version. A single bad entry never
 * aborts the stream.
 */
export function decodeEventStream(
  entries: readonly string[],
): EventStreamDecodeResult {
  const events: BehaviouralEvent[] = [];
  const warnings: StreamEventWarning[] = [];

  entries.forEach((entry, index) => {
    const result = decodeEvent(entry);
    if (result.status === "ok") {
      events.push(result.event);
    } else {
      warnings.push({ ...result.warning, index });
    }
  });

  return { events, warnings, skipped: warnings.length };
}
