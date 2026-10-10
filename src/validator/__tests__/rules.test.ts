import { describe, it, expect } from "vitest";
import {
  RULESETS,
  RULESET_NAMES,
  STRICTNESS_LEVELS,
  getRuleset,
  isRulesetName,
  listRulesets,
  resolveRuleset,
  type Ruleset,
} from "../rules.js";

describe("validator rules", () => {
  it("exposes the four supported platform rulesets", () => {
    expect(listRulesets()).toEqual(["mobile", "web", "console", "desktop"]);
    for (const name of RULESET_NAMES) {
      expect(RULESETS[name]).toBeDefined();
      expect(RULESETS[name].name).toBe(name);
    }
  });

  it("exposes strictness levels from least to most severe", () => {
    expect(STRICTNESS_LEVELS).toEqual(["info", "warning", "error"]);
  });

  it("defines structurally valid audio rules for every ruleset", () => {
    for (const name of RULESET_NAMES) {
      const { audio } = RULESETS[name];
      expect(audio.peakClipping.maxPeak).toBeGreaterThan(0);
      expect(audio.peakClipping.maxPeak).toBeLessThanOrEqual(1);
      expect(audio.duration.min).toBeGreaterThanOrEqual(0);
      expect(audio.duration.min).toBeLessThan(audio.duration.max);
      expect(audio.silenceRatio.maxRatio).toBeGreaterThanOrEqual(0);
      expect(audio.silenceRatio.maxRatio).toBeLessThanOrEqual(1);
      expect(audio.silenceRatio.threshold).toBeGreaterThan(0);
    }
  });

  it("constrains mobile more tightly than desktop", () => {
    const mobile = RULESETS.mobile.audio;
    const desktop = RULESETS.desktop.audio;
    expect(mobile.peakClipping.maxPeak).toBeLessThan(desktop.peakClipping.maxPeak);
    expect(mobile.duration.max).toBeLessThan(desktop.duration.max);
  });

  it("looks up a ruleset by name", () => {
    expect(getRuleset("console")).toBe(RULESETS.console);
  });

  it("rejects an unknown ruleset name with an actionable error", () => {
    expect(() => getRuleset("handheld" as never)).toThrowError(
      /Unknown ruleset 'handheld'.*mobile, web, console, desktop/,
    );
  });

  it("recognises only supported ruleset names", () => {
    expect(isRulesetName("mobile")).toBe(true);
    expect(isRulesetName("desktop")).toBe(true);
    expect(isRulesetName("handheld")).toBe(false);
    expect(isRulesetName("")).toBe(false);
  });

  it("resolves a name to its built-in ruleset", () => {
    expect(resolveRuleset("web")).toBe(RULESETS.web);
  });

  it("passes through a custom ruleset unchanged", () => {
    const custom: Ruleset = {
      name: "web",
      audio: {
        peakClipping: { maxPeak: 0.5 },
        duration: { min: 0.1, max: 0.2 },
        silenceRatio: { maxRatio: 0.1, threshold: 0.0005 },
      },
    };
    expect(resolveRuleset(custom)).toBe(custom);
  });
});
