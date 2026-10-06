/**
 * Tests for the SoundPreset model and deterministic serialisation.
 *
 * AC (TF-0MUV11PVB008I6EA): versioned schema; round-trip with byte-identical
 * re-serialisation; strict validation of version/recipe/seed/overrides;
 * clamping/dropping via normalisation; registry-sourced descriptors.
 */
import { describe, it, expect } from "vitest";
import {
  SOUND_PRESET_VERSION,
  PresetValidationError,
  assertOverrideValid,
  clampOverride,
  createPreset,
  getBaselineParams,
  getEffectiveParams,
  normalisePreset,
  parsePreset,
  presetsEqual,
  serialisePreset,
  type SoundPreset,
} from "../preset.js";
import { registry } from "../../../../src/recipes/index.js";
import { createRng } from "../../../../src/core/rng.js";
import type { ParamDescriptor } from "../../../../src/core/recipe.js";

const RECIPE = "weapon-laser-zap";

function validPreset(overrides: Record<string, number> = {}): SoundPreset {
  return createPreset(RECIPE, 1234, overrides);
}

describe("createPreset", () => {
  it("builds a versioned preset with the seed and overrides", () => {
    const preset = validPreset({ carrierFreq: 500 });
    expect(preset.version).toBe(SOUND_PRESET_VERSION);
    expect(preset.recipe).toBe(RECIPE);
    expect(preset.seed).toBe(1234);
    expect(preset.overrides).toEqual({ carrierFreq: 500 });
  });

  it("rejects a non-integer seed", () => {
    expect(() => createPreset(RECIPE, 1.5)).toThrow(PresetValidationError);
  });

  it("rejects an unknown recipe", () => {
    expect(() => createPreset("no-such-recipe", 1)).toThrow(/Unknown recipe/);
  });
});

describe("serialisePreset / parsePreset round-trip", () => {
  it("deep-equals the original preset after a round-trip", () => {
    const preset = validPreset({ carrierFreq: 500, decay: 0.1 });
    const parsed = parsePreset(serialisePreset(preset));
    expect(parsed).toEqual(preset);
    expect(presetsEqual(parsed, preset)).toBe(true);
  });

  it("re-serialises byte-identically", () => {
    const preset = validPreset({ carrierFreq: 500, decay: 0.1 });
    const once = serialisePreset(preset);
    const twice = serialisePreset(parsePreset(once));
    expect(twice).toBe(once);
  });

  it("is insensitive to override key insertion order", () => {
    const a = serialisePreset(validPreset({ carrierFreq: 500, decay: 0.1 }));
    const b = serialisePreset(validPreset({ decay: 0.1, carrierFreq: 500 }));
    expect(b).toBe(a);
  });

  it("emits fields in a stable order", () => {
    expect(serialisePreset(validPreset())).toBe(
      '{"version":1,"recipe":"weapon-laser-zap","seed":1234,"overrides":{}}',
    );
  });

  it("refuses to serialise non-finite overrides", () => {
    const preset = validPreset();
    preset.overrides.carrierFreq = Number.NaN;
    expect(() => serialisePreset(preset)).toThrow(/non-finite/);
  });
});

describe("parsePreset validation", () => {
  it("rejects invalid JSON", () => {
    expect(() => parsePreset("{not json")).toThrow(/Invalid preset JSON/);
  });

  it("rejects a non-object payload", () => {
    expect(() => parsePreset("[]")).toThrow(/must be a JSON object/);
  });

  it("rejects an unsupported schema version", () => {
    const json = JSON.stringify({
      version: 999,
      recipe: RECIPE,
      seed: 1,
      overrides: {},
    });
    expect(() => parsePreset(json)).toThrow(/Unsupported preset version/);
  });

  it("rejects an unknown recipe", () => {
    const json = JSON.stringify({
      version: SOUND_PRESET_VERSION,
      recipe: "no-such-recipe",
      seed: 1,
      overrides: {},
    });
    expect(() => parsePreset(json)).toThrow(/Unknown recipe/);
  });

  it("rejects a non-integer seed", () => {
    const json = JSON.stringify({
      version: SOUND_PRESET_VERSION,
      recipe: RECIPE,
      seed: 1.25,
      overrides: {},
    });
    expect(() => parsePreset(json)).toThrow(/seed must be an integer/);
  });

  it("rejects an unknown parameter name", () => {
    const json = JSON.stringify({
      version: SOUND_PRESET_VERSION,
      recipe: RECIPE,
      seed: 1,
      overrides: { notAParam: 1 },
    });
    expect(() => parsePreset(json)).toThrow(/Unknown parameter/);
  });

  it("rejects an out-of-range value", () => {
    const json = JSON.stringify({
      version: SOUND_PRESET_VERSION,
      recipe: RECIPE,
      seed: 1,
      overrides: { carrierFreq: 999999 },
    });
    expect(() => parsePreset(json)).toThrow(/outside/);
  });

  it("rejects a non-finite value", () => {
    // JSON.stringify turns NaN into null, so craft the payload textually.
    const json =
      '{"version":1,"recipe":"weapon-laser-zap","seed":1,"overrides":{"carrierFreq":null}}';
    expect(() => parsePreset(json)).toThrow(/finite number/);
  });
});

describe("normalisePreset", () => {
  it("clamps out-of-range overrides and drops unknown/non-finite ones", () => {
    const normalised = normalisePreset({
      version: SOUND_PRESET_VERSION,
      recipe: RECIPE,
      seed: 1234,
      overrides: {
        carrierFreq: 999999,
        notAParam: 5,
        decay: Number.NaN,
      },
    });

    expect(normalised.overrides).toEqual({ carrierFreq: 2000 });
    expect(normalised.version).toBe(SOUND_PRESET_VERSION);
  });

  it("is idempotent", () => {
    const once = normalisePreset({
      version: SOUND_PRESET_VERSION,
      recipe: RECIPE,
      seed: 1234,
      overrides: { carrierFreq: -100 },
    });
    expect(normalisePreset(once)).toEqual(once);
  });
});

describe("descriptor helpers", () => {
  it("rounds integer-typed overrides and clamps to range", () => {
    const descriptor: ParamDescriptor = {
      name: "voices",
      min: 1,
      max: 8,
      unit: "int",
    };
    expect(clampOverride(descriptor, 3.6)).toBe(4);
    expect(clampOverride(descriptor, 99)).toBe(8);
    expect(clampOverride(descriptor, -5)).toBe(1);
  });

  it("validates integer and range constraints", () => {
    const descriptor: ParamDescriptor = {
      name: "voices",
      min: 1,
      max: 8,
      unit: "int",
    };
    expect(() => assertOverrideValid(descriptor, 4)).not.toThrow();
    expect(() => assertOverrideValid(descriptor, 4.5)).toThrow(/integer/);
    expect(() => assertOverrideValid(descriptor, 9)).toThrow(/outside/);
    expect(() => assertOverrideValid(descriptor, Number.NaN)).toThrow(/finite/);
  });
});

describe("baseline parameter reuse", () => {
  it("derives baseline values from the registry getParams", () => {
    const registration = registry.getRegistration(RECIPE);
    expect(registration).toBeDefined();
    const expected = registration?.getParams(createRng(1234));
    expect(getBaselineParams(RECIPE, 1234)).toEqual(expected);
  });

  it("merges baseline and overrides in getEffectiveParams", () => {
    const preset = validPreset({ carrierFreq: 500 });
    const baseline = getBaselineParams(RECIPE, preset.seed);
    const effective = getEffectiveParams(preset);
    expect(effective.carrierFreq).toBe(500);
    expect(effective.decay).toBe(baseline.decay);
  });
});
