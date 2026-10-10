/**
 * Behavioural event model & canonical serialization unit tests.
 *
 * Covers NETWORK_PRD §4.1 / §7 acceptance criteria:
 *  - the canonical event shape and its validation
 *  - deterministic, stable-order canonical encoding that round-trips exactly
 *  - version-gated decode with graceful skipping of unknown versions
 *  - malformed input handling
 *
 * Work item: TF-0MUZYS26D00631KV (Behavioural event model and canonical serialization).
 */

import { describe, it, expect } from "vitest";

import {
  BEHAVIOURAL_EVENT_VERSION,
  createBehaviouralEvent,
  isBehaviouralEvent,
  isSupportedEventVersion,
  validateBehaviouralEvent,
  type BehaviouralEvent,
} from "../types.js";
import {
  canonicalStringify,
  decodeEvent,
  decodeEventOrThrow,
  decodeEventStream,
  encodeEvent,
  MalformedEventError,
  UnsupportedEventVersionError,
} from "../events.js";

/** The verbatim example from NETWORK_PRD §4.1. */
const PRD_EXAMPLE: BehaviouralEvent = {
  version: BEHAVIOURAL_EVENT_VERSION,
  event: "footstep",
  seed: 1042,
  time: 123.45,
  state: "walk",
  context: { surface: "gravel" },
};

// ---------------------------------------------------------------------------
// AC1 — canonical type and validation match NETWORK_PRD §4.1
// ---------------------------------------------------------------------------

describe("AC1 — behavioural event validation", () => {
  it("accepts the NETWORK_PRD §4.1 example shape", () => {
    const result = validateBehaviouralEvent(PRD_EXAMPLE);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.event.event).toBe("footstep");
      expect(result.event.seed).toBe(1042);
      expect(result.event.time).toBe(123.45);
      expect(result.event.state).toBe("walk");
      expect(result.event.context).toEqual({ surface: "gravel" });
      expect(result.event.version).toBe(BEHAVIOURAL_EVENT_VERSION);
    }
  });

  it("stamps the current version when constructed via createBehaviouralEvent", () => {
    const event = createBehaviouralEvent({
      event: "footstep",
      seed: 1042,
      time: 123.45,
      state: "walk",
      context: { surface: "gravel" },
    });
    expect(event.version).toBe(BEHAVIOURAL_EVENT_VERSION);
  });

  it("reports every missing required field", () => {
    const result = validateBehaviouralEvent({});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const fields = result.errors.map((e) => e.field);
      expect(fields).toEqual(
        expect.arrayContaining(["version", "event", "seed", "time", "state", "context"]),
      );
    }
  });

  it("rejects wrong field types", () => {
    expect(validateBehaviouralEvent({ ...PRD_EXAMPLE, event: 7 }).valid).toBe(false);
    expect(validateBehaviouralEvent({ ...PRD_EXAMPLE, seed: 1.5 }).valid).toBe(false);
    expect(validateBehaviouralEvent({ ...PRD_EXAMPLE, seed: "42" }).valid).toBe(false);
    expect(validateBehaviouralEvent({ ...PRD_EXAMPLE, time: Number.NaN }).valid).toBe(false);
    expect(validateBehaviouralEvent({ ...PRD_EXAMPLE, time: -1 }).valid).toBe(false);
    expect(validateBehaviouralEvent({ ...PRD_EXAMPLE, state: "" }).valid).toBe(false);
    expect(validateBehaviouralEvent({ ...PRD_EXAMPLE, context: ["gravel"] }).valid).toBe(false);
    expect(validateBehaviouralEvent({ ...PRD_EXAMPLE, context: { surface: 3 } }).valid).toBe(false);
  });

  it("rejects non-object, null and array inputs", () => {
    expect(validateBehaviouralEvent(null).valid).toBe(false);
    expect(validateBehaviouralEvent([]).valid).toBe(false);
    expect(validateBehaviouralEvent("footstep").valid).toBe(false);
  });

  it("rejects unknown fields so the wire form is canonical", () => {
    const result = validateBehaviouralEvent({ ...PRD_EXAMPLE, extra: true });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "extra")).toBe(true);
    }
  });

  it("rejects an unsupported version at the create boundary", () => {
    expect(() =>
      createBehaviouralEvent({ ...PRD_EXAMPLE, version: 99 }),
    ).toThrow();
  });

  it("narrows with the isBehaviouralEvent type guard", () => {
    expect(isBehaviouralEvent(PRD_EXAMPLE)).toBe(true);
    expect(isBehaviouralEvent({ event: "footstep" })).toBe(false);
    expect(isSupportedEventVersion(1)).toBe(true);
    expect(isSupportedEventVersion(99)).toBe(false);
    expect(isSupportedEventVersion("1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC2 — canonical serialization is deterministic and round-trips exactly
// ---------------------------------------------------------------------------

describe("AC2 — canonical encoding & round-trip", () => {
  it("encodes deterministically across repeated calls", () => {
    expect(encodeEvent(PRD_EXAMPLE)).toBe(encodeEvent(PRD_EXAMPLE));
  });

  it("is insensitive to property insertion order", () => {
    const reordered: BehaviouralEvent = {
      context: { surface: "gravel" },
      state: "walk",
      time: 123.45,
      seed: 1042,
      event: "footstep",
      version: BEHAVIOURAL_EVENT_VERSION,
    };
    expect(encodeEvent(reordered)).toBe(encodeEvent(PRD_EXAMPLE));
  });

  it("is insensitive to context key insertion order", () => {
    const a = createBehaviouralEvent({
      event: "footstep",
      seed: 1,
      time: 0,
      state: "walk",
      context: { surface: "gravel", weather: "rain" },
    });
    const b = createBehaviouralEvent({
      event: "footstep",
      seed: 1,
      time: 0,
      state: "walk",
      context: { weather: "rain", surface: "gravel" },
    });
    expect(encodeEvent(a)).toBe(encodeEvent(b));
  });

  it("produces a compact, bounded wire form", () => {
    const encoded = encodeEvent(PRD_EXAMPLE);
    expect(encoded).not.toMatch(/\s/);
    expect(new TextEncoder().encode(encoded).length).toBeLessThanOrEqual(512);
  });

  it("round-trips a behavioural event exactly", () => {
    const decoded = decodeEvent(encodeEvent(PRD_EXAMPLE));
    expect(decoded.status).toBe("ok");
    if (decoded.status === "ok") {
      expect(decoded.event).toEqual(PRD_EXAMPLE);
    }
  });

  it("re-encoding a decoded event yields the identical canonical string", () => {
    const encoded = encodeEvent(PRD_EXAMPLE);
    expect(encodeEvent(decodeEventOrThrow(encoded))).toBe(encoded);
  });

  it("exposes canonicalStringify with recursive key ordering", () => {
    expect(canonicalStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });
});

// ---------------------------------------------------------------------------
// AC3 — version handling: unknown versions skipped gracefully
// ---------------------------------------------------------------------------

describe("AC3 — version gating", () => {
  const unknownVersionWire = JSON.stringify({
    ...PRD_EXAMPLE,
    version: 99,
  });

  it("reports an unsupported version without throwing from decodeEvent", () => {
    const result = decodeEvent(unknownVersionWire);
    expect(result.status).toBe("unsupported-version");
    if (result.status === "unsupported-version") {
      expect(result.version).toBe(99);
      expect(result.warning.kind).toBe("unsupported-version");
      expect(result.warning.message).toContain("99");
    }
  });

  it("throws a typed error from decodeEventOrThrow for unknown versions", () => {
    expect(() => decodeEventOrThrow(unknownVersionWire)).toThrow(
      UnsupportedEventVersionError,
    );
  });

  it("skips unknown versions in a stream with a structured warning", () => {
    const supportedWire = encodeEvent(PRD_EXAMPLE);
    const result = decodeEventStream([supportedWire, unknownVersionWire]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual(PRD_EXAMPLE);
    expect(result.skipped).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.index).toBe(1);
    expect(result.warnings[0]!.kind).toBe("unsupported-version");
  });

  it("keeps decoding after an unknown-version event", () => {
    const supportedWire = encodeEvent(PRD_EXAMPLE);
    const unknown = JSON.stringify({ ...PRD_EXAMPLE, version: 2 });
    const result = decodeEventStream([unknown, supportedWire]);
    expect(result.events).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC4 — malformed input handling
// ---------------------------------------------------------------------------

describe("AC4 — malformed input", () => {
  it("rejects invalid JSON without throwing", () => {
    for (const bad of ["", "not json", "{"]) {
      const result = decodeEvent(bad);
      expect(result.status).toBe("malformed");
      if (result.status === "malformed") {
        expect(result.warning.kind).toBe("malformed");
      }
    }
  });

  it("rejects non-object top-level JSON values", () => {
    for (const bad of ["[]", "null", "42", '"footstep"']) {
      expect(decodeEvent(bad).status).toBe("malformed");
    }
  });

  it("rejects a missing or non-integer version as malformed", () => {
    const { version: _drop, ...withoutVersion } = PRD_EXAMPLE;
    expect(decodeEvent(JSON.stringify(withoutVersion)).status).toBe("malformed");
    expect(decodeEvent(JSON.stringify({ ...PRD_EXAMPLE, version: 1.5 })).status).toBe(
      "malformed",
    );
  });

  it("rejects structurally invalid known-version events as malformed", () => {
    expect(decodeEvent(JSON.stringify({ ...PRD_EXAMPLE, seed: "x" })).status).toBe(
      "malformed",
    );
    expect(decodeEvent(JSON.stringify({ ...PRD_EXAMPLE, extra: 1 })).status).toBe(
      "malformed",
    );
  });

  it("throws a typed error from decodeEventOrThrow for malformed input", () => {
    expect(() => decodeEventOrThrow("not json")).toThrow(MalformedEventError);
  });

  it("skips malformed entries in a stream without aborting", () => {
    const supportedWire = encodeEvent(PRD_EXAMPLE);
    const result = decodeEventStream(["not json", supportedWire]);
    expect(result.events).toEqual([PRD_EXAMPLE]);
    expect(result.skipped).toBe(1);
    expect(result.warnings[0]!.kind).toBe("malformed");
  });
});
