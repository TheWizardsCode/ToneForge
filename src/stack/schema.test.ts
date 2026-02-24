/**
 * Stack Preset Schema Validation Tests
 *
 * Tests for the validatePreset() function that validates JSON objects
 * against the stack preset schema.
 *
 * Work item: TF-0MLZZJZP50VW0Q4P
 */

import { describe, it, expect } from "vitest";
import { validatePreset } from "./schema.js";

/** A minimal valid preset object for use as a test baseline. */
function validPreset() {
  return {
    version: "1.0",
    name: "test-preset",
    layers: [
      { recipe: "impact-crack", startTime: 0, gain: 0.9 },
    ],
  };
}

describe("validatePreset — valid inputs", () => {
  it("accepts a minimal valid preset", () => {
    const result = validatePreset(validPreset(), "test.json");
    expect(result.name).toBe("test-preset");
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0]).toEqual({
      recipe: "impact-crack",
      startTime: 0,
      gain: 0.9,
    });
  });

  it("accepts a preset with multiple layers", () => {
    const preset = {
      ...validPreset(),
      layers: [
        { recipe: "impact-crack", startTime: 0, gain: 0.9 },
        { recipe: "rumble-body", startTime: 0.005, gain: 0.7 },
        { recipe: "debris-tail", startTime: 0.05, gain: 0.5 },
      ],
    };
    const result = validatePreset(preset, "test.json");
    expect(result.layers).toHaveLength(3);
  });

  it("accepts layers with optional duration", () => {
    const preset = {
      ...validPreset(),
      layers: [
        { recipe: "impact-crack", startTime: 0, gain: 0.9, duration: 0.5 },
      ],
    };
    const result = validatePreset(preset, "test.json");
    expect(result.layers[0]!.duration).toBe(0.5);
  });

  it("omitted gain results in undefined (caller applies default)", () => {
    const preset = {
      ...validPreset(),
      layers: [{ recipe: "impact-crack", startTime: 0 }],
    };
    const result = validatePreset(preset, "test.json");
    expect(result.layers[0]!.gain).toBeUndefined();
  });

  it("omitted duration results in undefined", () => {
    const preset = {
      ...validPreset(),
      layers: [{ recipe: "impact-crack", startTime: 0 }],
    };
    const result = validatePreset(preset, "test.json");
    expect(result.layers[0]!.duration).toBeUndefined();
  });

  it("accepts gain of zero", () => {
    const preset = {
      ...validPreset(),
      layers: [{ recipe: "impact-crack", startTime: 0, gain: 0 }],
    };
    const result = validatePreset(preset, "test.json");
    expect(result.layers[0]!.gain).toBe(0);
  });

  it("accepts startTime of zero", () => {
    const preset = {
      ...validPreset(),
      layers: [{ recipe: "impact-crack", startTime: 0 }],
    };
    const result = validatePreset(preset, "test.json");
    expect(result.layers[0]!.startTime).toBe(0);
  });
});

describe("validatePreset — invalid inputs", () => {
  it("throws on null input", () => {
    expect(() => validatePreset(null, "test.json")).toThrow(/expected a JSON object/i);
  });

  it("throws on array input", () => {
    expect(() => validatePreset([], "test.json")).toThrow(/expected a JSON object/i);
  });

  it("throws on string input", () => {
    expect(() => validatePreset("hello", "test.json")).toThrow(/expected a JSON object/i);
  });

  it("throws on missing version field", () => {
    const preset = { name: "test", layers: [{ recipe: "a", startTime: 0 }] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/version/i);
  });

  it("throws on empty version string", () => {
    const preset = { version: "  ", name: "test", layers: [{ recipe: "a", startTime: 0 }] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/version/i);
  });

  it("throws on non-string version", () => {
    const preset = { version: 1, name: "test", layers: [{ recipe: "a", startTime: 0 }] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/version/i);
  });

  it("throws on missing name field", () => {
    const preset = { version: "1.0", layers: [{ recipe: "a", startTime: 0 }] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/name/i);
  });

  it("throws on empty name string", () => {
    const preset = { version: "1.0", name: "  ", layers: [{ recipe: "a", startTime: 0 }] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/name/i);
  });

  it("throws on missing layers field", () => {
    const preset = { version: "1.0", name: "test" };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layers/i);
  });

  it("throws on non-array layers", () => {
    const preset = { version: "1.0", name: "test", layers: "not-an-array" };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layers/i);
  });

  it("throws on empty layers array", () => {
    const preset = { version: "1.0", name: "test", layers: [] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/at least one layer/i);
  });

  it("throws when layer is not an object", () => {
    const preset = { version: "1.0", name: "test", layers: ["not-an-object"] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layer\[0\].*object/i);
  });

  it("throws on missing recipe in layer", () => {
    const preset = { version: "1.0", name: "test", layers: [{ startTime: 0 }] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layer\[0\].*recipe/i);
  });

  it("throws on empty recipe string", () => {
    const preset = { version: "1.0", name: "test", layers: [{ recipe: "", startTime: 0 }] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layer\[0\].*recipe/i);
  });

  it("throws on missing startTime", () => {
    const preset = { version: "1.0", name: "test", layers: [{ recipe: "a" }] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layer\[0\].*startTime/i);
  });

  it("throws on negative startTime", () => {
    const preset = { version: "1.0", name: "test", layers: [{ recipe: "a", startTime: -1 }] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layer\[0\].*startTime/i);
  });

  it("throws on non-number startTime", () => {
    const preset = { version: "1.0", name: "test", layers: [{ recipe: "a", startTime: "0" }] };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layer\[0\].*startTime/i);
  });

  it("throws on negative duration", () => {
    const preset = {
      version: "1.0", name: "test",
      layers: [{ recipe: "a", startTime: 0, duration: -1 }],
    };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layer\[0\].*duration/i);
  });

  it("throws on zero duration", () => {
    const preset = {
      version: "1.0", name: "test",
      layers: [{ recipe: "a", startTime: 0, duration: 0 }],
    };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layer\[0\].*duration/i);
  });

  it("throws on non-number duration", () => {
    const preset = {
      version: "1.0", name: "test",
      layers: [{ recipe: "a", startTime: 0, duration: "1s" }],
    };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layer\[0\].*duration/i);
  });

  it("throws on negative gain", () => {
    const preset = {
      version: "1.0", name: "test",
      layers: [{ recipe: "a", startTime: 0, gain: -0.1 }],
    };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layer\[0\].*gain/i);
  });

  it("throws on non-number gain", () => {
    const preset = {
      version: "1.0", name: "test",
      layers: [{ recipe: "a", startTime: 0, gain: "loud" }],
    };
    expect(() => validatePreset(preset, "test.json")).toThrow(/layer\[0\].*gain/i);
  });

  it("includes file path in error messages", () => {
    expect(() => validatePreset(null, "presets/my-preset.json")).toThrow(
      /my-preset\.json/,
    );
  });
});
