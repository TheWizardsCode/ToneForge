/**
 * SoundPreset model — versioned, deterministic description of a single sound.
 *
 * A preset is `{ version, recipe, seed, overrides }`:
 * - `version`   — schema version (currently {@link SOUND_PRESET_VERSION}).
 * - `recipe`    — a registered recipe name.
 * - `seed`      — integer seed; the seed alone fully determines the baseline
 *                 parameter values (via the recipe's `getParams(rng)`).
 * - `overrides` — sparse map of parameter name → value applied on top of the
 *                 seed-derived baseline.
 *
 * The model is framework-free and has no DOM/audio dependency so it can be
 * unit-tested in isolation and handed between host applications as JSON.
 *
 * Determinism contract: `parsePreset(serialisePreset(p))` deep-equals `p`, and
 * re-serialising is byte-identical (override keys are emitted in sorted order).
 */

import type { ParamDescriptor } from "../../../src/core/recipe.js";
import { createRng } from "../../../src/core/rng.js";
import { registry } from "../../../src/recipes/index.js";

/** Current schema version understood by this module. */
export const SOUND_PRESET_VERSION = 1;

/** Versioned, deterministic description of a single sound. */
export interface SoundPreset {
  version: number;
  recipe: string;
  seed: number;
  overrides: Record<string, number>;
}

/** Thrown when a preset is malformed, unknown or out of range. */
export class PresetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresetValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Descriptors for a recipe, or a clear error when it is not registered. */
export function getParamDescriptors(recipe: string): ParamDescriptor[] {
  const registration = registry.getRegistration(recipe);
  if (!registration) {
    throw new PresetValidationError(`Unknown recipe: ${recipe}`);
  }
  return registration.params;
}

/**
 * Integer-typed parameters are declared with the `int` unit by the recipe
 * registry (`src/core/recipe.ts` maps `type: integer` to `unit: "int"`).
 */
export function isIntegerDescriptor(descriptor: ParamDescriptor): boolean {
  const unit = descriptor.unit.toLowerCase();
  return unit === "int" || unit === "integer";
}

/**
 * Clamp + quantise a value for a descriptor.
 *
 * Out-of-range values are clamped to `[min, max]`; integer-typed parameters
 * are rounded to the nearest integer.
 */
export function clampOverride(
  descriptor: ParamDescriptor,
  value: number,
): number {
  const clamped = Math.min(descriptor.max, Math.max(descriptor.min, value));
  return isIntegerDescriptor(descriptor) ? Math.round(clamped) : clamped;
}

/** Validate a value against a descriptor, throwing on any violation. */
export function assertOverrideValid(
  descriptor: ParamDescriptor,
  value: number,
): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PresetValidationError(
      `Override '${descriptor.name}' must be a finite number`,
    );
  }
  if (isIntegerDescriptor(descriptor) && !Number.isInteger(value)) {
    throw new PresetValidationError(
      `Override '${descriptor.name}' must be an integer`,
    );
  }
  if (value < descriptor.min || value > descriptor.max) {
    throw new PresetValidationError(
      `Override '${descriptor.name}' = ${value} is outside ` +
        `[${descriptor.min}, ${descriptor.max}]`,
    );
  }
}

function sortRecord(record: Record<string, number>): Record<string, number> {
  const sorted: Record<string, number> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = record[key];
  }
  return sorted;
}

/**
 * Sanitise a preset: validate recipe + seed, drop unknown/non-finite
 * overrides, clamp out-of-range values and quantise integer parameters.
 * The returned preset always uses the current schema version.
 *
 * @throws {PresetValidationError} For an unknown recipe or non-integer seed.
 */
export function normalisePreset(preset: SoundPreset): SoundPreset {
  const descriptors = getParamDescriptors(preset.recipe);

  if (!Number.isInteger(preset.seed)) {
    throw new PresetValidationError(
      `Preset seed must be an integer (received ${String(preset.seed)})`,
    );
  }

  const byName = new Map(descriptors.map((d) => [d.name, d]));
  const overrides: Record<string, number> = {};
  for (const [name, raw] of Object.entries(preset.overrides ?? {})) {
    const descriptor = byName.get(name);
    if (!descriptor) {
      continue; // documented: unknown parameter names are dropped
    }
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      continue; // documented: non-finite overrides are dropped
    }
    overrides[name] = clampOverride(descriptor, raw);
  }

  return {
    version: SOUND_PRESET_VERSION,
    recipe: preset.recipe,
    seed: preset.seed,
    overrides: sortRecord(overrides),
  };
}

/**
 * Create a new preset. The result is normalised (unknown/invalid overrides
 * dropped, in-range values clamped).
 */
export function createPreset(
  recipe: string,
  seed: number,
  overrides: Record<string, number> = {},
): SoundPreset {
  return normalisePreset({
    version: SOUND_PRESET_VERSION,
    recipe,
    seed,
    overrides,
  });
}

/**
 * Serialise a preset to canonical JSON.
 *
 * Field order is fixed and override keys are sorted, so equal presets always
 * produce byte-identical output.
 *
 * @throws {PresetValidationError} If an override is non-finite (JSON cannot
 *   represent `NaN`/`Infinity`).
 */
export function serialisePreset(preset: SoundPreset): string {
  const overrides: Record<string, number> = {};
  for (const key of Object.keys(preset.overrides).sort()) {
    const value = preset.overrides[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new PresetValidationError(
        `Cannot serialise non-finite override '${key}'`,
      );
    }
    overrides[key] = value;
  }

  return JSON.stringify({
    version: preset.version,
    recipe: preset.recipe,
    seed: preset.seed,
    overrides,
  });
}

/**
 * Parse and strictly validate a preset from JSON.
 *
 * @throws {PresetValidationError} For invalid JSON, an unsupported version, an
 *   unknown recipe, a non-integer seed, an unknown parameter, a non-finite
 *   value, an out-of-range value or a non-integer value for an integer
 *   parameter.
 */
export function parsePreset(json: string): SoundPreset {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new PresetValidationError(
      `Invalid preset JSON: ${(error as Error).message}`,
    );
  }

  if (!isRecord(raw)) {
    throw new PresetValidationError("Preset must be a JSON object");
  }
  if (raw.version !== SOUND_PRESET_VERSION) {
    throw new PresetValidationError(
      `Unsupported preset version: ${String(raw.version)} ` +
        `(expected ${SOUND_PRESET_VERSION})`,
    );
  }
  if (typeof raw.recipe !== "string" || raw.recipe.length === 0) {
    throw new PresetValidationError("Preset recipe must be a non-empty string");
  }
  if (typeof raw.seed !== "number" || !Number.isInteger(raw.seed)) {
    throw new PresetValidationError(
      `Preset seed must be an integer (received ${String(raw.seed)})`,
    );
  }
  if (raw.overrides !== undefined && !isRecord(raw.overrides)) {
    throw new PresetValidationError("Preset overrides must be an object");
  }

  const descriptors = getParamDescriptors(raw.recipe);
  const byName = new Map(descriptors.map((d) => [d.name, d]));
  const overrides: Record<string, number> = {};
  for (const [name, value] of Object.entries(raw.overrides ?? {})) {
    const descriptor = byName.get(name);
    if (!descriptor) {
      throw new PresetValidationError(
        `Unknown parameter '${name}' for recipe '${raw.recipe}'`,
      );
    }
    if (typeof value !== "number") {
      throw new PresetValidationError(
        `Override '${name}' must be a finite number`,
      );
    }
    assertOverrideValid(descriptor, value);
    overrides[name] = value;
  }

  return {
    version: SOUND_PRESET_VERSION,
    recipe: raw.recipe,
    seed: raw.seed,
    overrides: sortRecord(overrides),
  };
}

/** Deep-equality for presets (order-independent). */
export function presetsEqual(a: SoundPreset, b: SoundPreset): boolean {
  if (
    a.version !== b.version ||
    a.recipe !== b.recipe ||
    a.seed !== b.seed
  ) {
    return false;
  }
  const aKeys = Object.keys(a.overrides);
  const bKeys = Object.keys(b.overrides);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key) => Object.is(a.overrides[key], b.overrides[key]));
}

/**
 * Seed-derived baseline parameter values for a recipe, reusing the recipe
 * registry's `getParams(rng)` — parameter definitions are never duplicated.
 */
export function getBaselineParams(
  recipe: string,
  seed: number,
): Record<string, number> {
  const registration = registry.getRegistration(recipe);
  if (!registration) {
    throw new PresetValidationError(`Unknown recipe: ${recipe}`);
  }
  return { ...registration.getParams(createRng(seed)) };
}

/** Baseline parameters with the preset's overrides applied on top. */
export function getEffectiveParams(
  preset: SoundPreset,
): Record<string, number> {
  return {
    ...getBaselineParams(preset.recipe, preset.seed),
    ...preset.overrides,
  };
}
