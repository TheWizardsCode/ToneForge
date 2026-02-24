/**
 * Inline Layer Parser Tests
 *
 * Tests for the --layer "recipe=name,offset=50ms,gain=0.8" CLI syntax parser.
 *
 * Work item: TF-0MLZZJZP50VW0Q4P
 */

import { describe, it, expect } from "vitest";
import { parseLayer, parseLayers } from "./layer-parser.js";

describe("parseLayer", () => {
  it("parses a full spec with all fields", () => {
    const result = parseLayer("recipe=impact-crack,offset=50ms,gain=0.8,duration=0.1");
    expect(result).toEqual({
      recipe: "impact-crack",
      startTime: 0.05, // 50ms -> 0.05s
      gain: 0.8,
      duration: 0.1,
    });
  });

  it("parses recipe-only spec with defaults", () => {
    const result = parseLayer("recipe=ambient-wind-gust");
    expect(result).toEqual({
      recipe: "ambient-wind-gust",
      startTime: 0,
    });
    // gain and duration should be undefined (not set)
    expect(result.gain).toBeUndefined();
    expect(result.duration).toBeUndefined();
  });

  it("parses offset with ms suffix", () => {
    const result = parseLayer("recipe=test,offset=100ms");
    expect(result.startTime).toBe(0.1);
  });

  it("parses offset with s suffix", () => {
    const result = parseLayer("recipe=test,offset=1.5s");
    expect(result.startTime).toBe(1.5);
  });

  it("parses bare numeric offset as seconds", () => {
    const result = parseLayer("recipe=test,offset=0.3");
    expect(result.startTime).toBe(0.3);
  });

  it("parses duration with ms suffix", () => {
    const result = parseLayer("recipe=test,duration=500ms");
    expect(result.duration).toBe(0.5);
  });

  it("parses duration with s suffix", () => {
    const result = parseLayer("recipe=test,duration=2s");
    expect(result.duration).toBe(2);
  });

  it("parses bare numeric duration as seconds", () => {
    const result = parseLayer("recipe=test,duration=1.2");
    expect(result.duration).toBe(1.2);
  });

  it("handles whitespace in input", () => {
    const result = parseLayer("  recipe=test , offset=10ms , gain=0.5  ");
    expect(result.recipe).toBe("test");
    expect(result.startTime).toBe(0.01);
    expect(result.gain).toBe(0.5);
  });

  // ── Error cases ──────────────────────────────────────────────

  it("throws on empty input", () => {
    expect(() => parseLayer("")).toThrow("Empty layer specification");
  });

  it("throws on whitespace-only input", () => {
    expect(() => parseLayer("   ")).toThrow("Empty layer specification");
  });

  it("throws on missing recipe field", () => {
    expect(() => parseLayer("offset=50ms,gain=0.8")).toThrow(/missing required.*recipe/i);
  });

  it("throws on unknown key", () => {
    expect(() => parseLayer("recipe=test,pan=0.5")).toThrow(/unknown layer key.*pan/i);
  });

  it("throws on missing = separator", () => {
    expect(() => parseLayer("recipe:test")).toThrow(/missing "=" separator/i);
  });

  it("throws on non-numeric gain", () => {
    expect(() => parseLayer("recipe=test,gain=loud")).toThrow(/not a valid number/i);
  });

  it("throws on non-numeric offset", () => {
    expect(() => parseLayer("recipe=test,offset=soon")).toThrow(/not a valid number/i);
  });

  it("throws on non-numeric duration", () => {
    expect(() => parseLayer("recipe=test,duration=long")).toThrow(/not a valid number/i);
  });

  it("throws on negative offset", () => {
    expect(() => parseLayer("recipe=test,offset=-50ms")).toThrow(/non-negative/i);
  });

  it("throws on zero duration", () => {
    expect(() => parseLayer("recipe=test,duration=0")).toThrow(/positive/i);
  });

  it("throws on negative duration", () => {
    expect(() => parseLayer("recipe=test,duration=-1")).toThrow(/positive/i);
  });

  it("throws on duplicate key", () => {
    expect(() => parseLayer("recipe=test,recipe=other")).toThrow(/duplicate key/i);
  });
});

describe("parseLayers", () => {
  it("parses multiple layer specs into a StackDefinition", () => {
    const result = parseLayers([
      "recipe=impact-crack,offset=0ms,gain=0.9",
      "recipe=rumble-body,offset=5ms,gain=0.7",
      "recipe=debris-tail,offset=50ms,gain=0.5",
    ]);

    expect(result.name).toBe("inline-stack");
    expect(result.layers).toHaveLength(3);

    expect(result.layers[0]).toEqual({
      recipe: "impact-crack",
      startTime: 0,
      gain: 0.9,
    });
    expect(result.layers[1]).toEqual({
      recipe: "rumble-body",
      startTime: 0.005,
      gain: 0.7,
    });
    expect(result.layers[2]).toEqual({
      recipe: "debris-tail",
      startTime: 0.05,
      gain: 0.5,
    });
  });

  it("parses a single layer spec", () => {
    const result = parseLayers(["recipe=test"]);
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0]!.recipe).toBe("test");
  });

  it("throws on empty array", () => {
    expect(() => parseLayers([])).toThrow(/at least one/i);
  });
});
