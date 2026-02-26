/**
 * Sequence Preset Schema Validation Tests
 *
 * Tests for validateSequencePreset() and parseSequencePreset() functions.
 *
 * Work item: TF-0MM196ACB1I3TZ0Q
 */

import { describe, it, expect } from "vitest";
import {
  validateSequencePreset,
  parseSequencePreset,
} from "./schema.js";
import type { SequencePresetJson } from "./schema.js";

/** A minimal valid sequence preset object for use as a test baseline. */
function validPreset(): SequencePresetJson {
  return {
    version: "1.0",
    name: "test-sequence",
    events: [
      { time: 0, event: "weapon-laser-zap" },
    ],
  };
}

// ── validateSequencePreset — valid inputs ─────────────────────────

describe("validateSequencePreset — valid inputs", () => {
  it("accepts a minimal valid preset", () => {
    const errors = validateSequencePreset(validPreset(), "test.json");
    expect(errors).toHaveLength(0);
  });

  it("accepts a preset with multiple events", () => {
    const preset = {
      ...validPreset(),
      events: [
        { time: 0, event: "weapon-laser-zap" },
        { time: 0.12, event: "weapon-laser-zap", seedOffset: 1 },
        { time: 0.24, event: "weapon-laser-zap", seedOffset: 2 },
      ],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors).toHaveLength(0);
  });

  it("accepts events with all optional fields", () => {
    const preset = {
      ...validPreset(),
      events: [
        {
          time: 0.5,
          event: "slam-transient",
          seedOffset: 5,
          probability: 0.8,
          gain: 0.7,
          duration: 1.5,
        },
      ],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors).toHaveLength(0);
  });

  it("accepts a preset with description", () => {
    const preset = { ...validPreset(), description: "A test sequence" };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors).toHaveLength(0);
  });

  it("accepts a preset with tempo", () => {
    const preset = { ...validPreset(), tempo: 120 };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors).toHaveLength(0);
  });

  it("accepts a preset with repeat configuration", () => {
    const preset = {
      ...validPreset(),
      repeat: { count: 3, interval: 1.0 },
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors).toHaveLength(0);
  });

  it("accepts probability of 0", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: 0, event: "weapon-laser-zap", probability: 0 }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors).toHaveLength(0);
  });

  it("accepts probability of 1", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: 0, event: "weapon-laser-zap", probability: 1 }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors).toHaveLength(0);
  });

  it("accepts gain of 0", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: 0, event: "weapon-laser-zap", gain: 0 }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors).toHaveLength(0);
  });

  it("accepts repeat count of 0", () => {
    const preset = {
      ...validPreset(),
      repeat: { count: 0, interval: 1.0 },
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors).toHaveLength(0);
  });
});

// ── validateSequencePreset — invalid inputs ───────────────────────

describe("validateSequencePreset — invalid inputs", () => {
  it("rejects null input", () => {
    const errors = validateSequencePreset(null, "test.json");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.field).toBe("(root)");
  });

  it("rejects array input", () => {
    const errors = validateSequencePreset([], "test.json");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.field).toBe("(root)");
  });

  it("rejects string input", () => {
    const errors = validateSequencePreset("not an object", "test.json");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects missing version field", () => {
    const preset = { ...validPreset() } as Record<string, unknown>;
    delete preset["version"];
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "version")).toBe(true);
  });

  it("rejects empty version string", () => {
    const errors = validateSequencePreset({ ...validPreset(), version: "" }, "test.json");
    expect(errors.some((e) => e.field === "version")).toBe(true);
  });

  it("rejects non-string version", () => {
    const errors = validateSequencePreset({ ...validPreset(), version: 1 }, "test.json");
    expect(errors.some((e) => e.field === "version")).toBe(true);
  });

  it("rejects missing name field", () => {
    const preset = { ...validPreset() } as Record<string, unknown>;
    delete preset["name"];
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "name")).toBe(true);
  });

  it("rejects empty name string", () => {
    const errors = validateSequencePreset({ ...validPreset(), name: "" }, "test.json");
    expect(errors.some((e) => e.field === "name")).toBe(true);
  });

  it("rejects invalid description type", () => {
    const errors = validateSequencePreset({ ...validPreset(), description: 42 }, "test.json");
    expect(errors.some((e) => e.field === "description")).toBe(true);
  });

  it("rejects negative tempo", () => {
    const errors = validateSequencePreset({ ...validPreset(), tempo: -10 }, "test.json");
    expect(errors.some((e) => e.field === "tempo")).toBe(true);
  });

  it("rejects zero tempo", () => {
    const errors = validateSequencePreset({ ...validPreset(), tempo: 0 }, "test.json");
    expect(errors.some((e) => e.field === "tempo")).toBe(true);
  });

  it("rejects missing events field", () => {
    const preset = { ...validPreset() } as Record<string, unknown>;
    delete preset["events"];
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "events")).toBe(true);
  });

  it("rejects non-array events", () => {
    const errors = validateSequencePreset({ ...validPreset(), events: "not-array" }, "test.json");
    expect(errors.some((e) => e.field === "events")).toBe(true);
  });

  it("rejects empty events array", () => {
    const errors = validateSequencePreset({ ...validPreset(), events: [] }, "test.json");
    expect(errors.some((e) => e.field === "events")).toBe(true);
  });

  it("rejects event that is not an object", () => {
    const errors = validateSequencePreset({ ...validPreset(), events: ["string"] }, "test.json");
    expect(errors.some((e) => e.field === "events[0]")).toBe(true);
  });

  it("rejects event with missing time", () => {
    const preset = {
      ...validPreset(),
      events: [{ event: "weapon-laser-zap" }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "events[0].time")).toBe(true);
  });

  it("rejects event with negative time", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: -1, event: "weapon-laser-zap" }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "events[0].time")).toBe(true);
  });

  it("rejects event with missing event name", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: 0 }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "events[0].event")).toBe(true);
  });

  it("rejects event with empty event name", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: 0, event: "" }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "events[0].event")).toBe(true);
  });

  it("rejects non-integer seedOffset", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: 0, event: "weapon-laser-zap", seedOffset: 1.5 }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "events[0].seedOffset")).toBe(true);
  });

  it("rejects probability greater than 1", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: 0, event: "weapon-laser-zap", probability: 1.5 }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "events[0].probability")).toBe(true);
  });

  it("rejects probability less than 0", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: 0, event: "weapon-laser-zap", probability: -0.1 }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "events[0].probability")).toBe(true);
  });

  it("rejects negative gain", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: 0, event: "weapon-laser-zap", gain: -0.5 }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "events[0].gain")).toBe(true);
  });

  it("rejects zero duration", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: 0, event: "weapon-laser-zap", duration: 0 }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "events[0].duration")).toBe(true);
  });

  it("rejects negative duration", () => {
    const preset = {
      ...validPreset(),
      events: [{ time: 0, event: "weapon-laser-zap", duration: -1 }],
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "events[0].duration")).toBe(true);
  });

  it("rejects repeat with missing count", () => {
    const preset = {
      ...validPreset(),
      repeat: { interval: 1.0 },
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "repeat.count")).toBe(true);
  });

  it("rejects repeat with negative count", () => {
    const preset = {
      ...validPreset(),
      repeat: { count: -1, interval: 1.0 },
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "repeat.count")).toBe(true);
  });

  it("rejects repeat with missing interval", () => {
    const preset = {
      ...validPreset(),
      repeat: { count: 2 },
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "repeat.interval")).toBe(true);
  });

  it("rejects repeat with zero interval", () => {
    const preset = {
      ...validPreset(),
      repeat: { count: 2, interval: 0 },
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "repeat.interval")).toBe(true);
  });

  it("rejects repeat with negative interval", () => {
    const preset = {
      ...validPreset(),
      repeat: { count: 2, interval: -1 },
    };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.some((e) => e.field === "repeat.interval")).toBe(true);
  });

  it("collects multiple errors", () => {
    const preset = { version: 42, events: "bad" };
    const errors = validateSequencePreset(preset, "test.json");
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ── parseSequencePreset — valid parsing ───────────────────────────

describe("parseSequencePreset — valid parsing", () => {
  it("parses a minimal valid preset into a SequenceDefinition", () => {
    const result = parseSequencePreset(validPreset(), "test.json");
    expect(result.name).toBe("test-sequence");
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.event).toBe("weapon-laser-zap");
    expect(result.events[0]!.time).toBe(0);
    expect(result.events[0]!.time_ms).toBe(0);
    expect(result.events[0]!.seedOffset).toBe(0);
    expect(result.events[0]!.probability).toBe(1.0);
    expect(result.events[0]!.gain).toBe(1.0);
  });

  it("applies default seedOffset from event index", () => {
    const preset = {
      ...validPreset(),
      events: [
        { time: 0, event: "a" },
        { time: 0.1, event: "b" },
        { time: 0.2, event: "c" },
      ],
    };
    const result = parseSequencePreset(preset, "test.json");
    expect(result.events[0]!.seedOffset).toBe(0);
    expect(result.events[1]!.seedOffset).toBe(1);
    expect(result.events[2]!.seedOffset).toBe(2);
  });

  it("uses explicit seedOffset when provided", () => {
    const preset = {
      ...validPreset(),
      events: [
        { time: 0, event: "a", seedOffset: 10 },
      ],
    };
    const result = parseSequencePreset(preset, "test.json");
    expect(result.events[0]!.seedOffset).toBe(10);
  });

  it("converts time to time_ms correctly", () => {
    const preset = {
      ...validPreset(),
      events: [
        { time: 1.5, event: "a" },
      ],
    };
    const result = parseSequencePreset(preset, "test.json");
    expect(result.events[0]!.time_ms).toBe(1500);
  });

  it("sorts events by time", () => {
    const preset = {
      ...validPreset(),
      events: [
        { time: 0.5, event: "b" },
        { time: 0, event: "a" },
        { time: 1.0, event: "c" },
      ],
    };
    const result = parseSequencePreset(preset, "test.json");
    expect(result.events[0]!.event).toBe("a");
    expect(result.events[1]!.event).toBe("b");
    expect(result.events[2]!.event).toBe("c");
  });

  it("parses repeat configuration", () => {
    const preset = {
      ...validPreset(),
      repeat: { count: 3, interval: 1.0 },
    };
    const result = parseSequencePreset(preset, "test.json");
    expect(result.repeat).toEqual({ count: 3, interval: 1.0 });
  });

  it("includes description and tempo when present", () => {
    const preset = {
      ...validPreset(),
      description: "A test",
      tempo: 120,
    };
    const result = parseSequencePreset(preset, "test.json");
    expect(result.description).toBe("A test");
    expect(result.tempo).toBe(120);
  });
});

// ── parseSequencePreset — invalid inputs ──────────────────────────

describe("parseSequencePreset — invalid inputs", () => {
  it("throws on invalid preset with descriptive message", () => {
    expect(() => parseSequencePreset(null, "bad.json")).toThrow(
      /Invalid sequence preset/,
    );
  });

  it("includes file path in error message", () => {
    expect(() => parseSequencePreset(null, "my-preset.json")).toThrow(
      /my-preset\.json/,
    );
  });

  it("includes field-level detail in error message", () => {
    const preset = { ...validPreset() } as Record<string, unknown>;
    delete preset["name"];
    expect(() => parseSequencePreset(preset, "test.json")).toThrow(/name/);
  });
});
