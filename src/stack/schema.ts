/**
 * Stack Preset Schema
 *
 * Defines the JSON schema types for stack preset files and provides
 * validation. Presets are versioned from the start to support forward-
 * compatible schema evolution.
 *
 * Reference: docs/prd/STACK_PRD.md
 */

import type { StackDefinition, StackLayer } from "./renderer.js";

// ── JSON Schema Types ─────────────────────────────────────────────

/** JSON representation of a stack layer in a preset file. */
export interface PresetLayerJson {
  recipe: string;
  startTime: number;
  duration?: number;
  gain?: number;
}

/** JSON representation of a stack preset file. */
export interface PresetJson {
  /** Schema version for forward-compatibility (e.g. "1.0"). */
  version: string;

  /** Human-readable name for the stack preset. */
  name: string;

  /** Array of layer definitions. */
  layers: PresetLayerJson[];
}

// ── Validation ────────────────────────────────────────────────────

/**
 * Validate a parsed JSON object against the preset schema.
 *
 * @param data - The parsed JSON data.
 * @param filePath - File path for error messages.
 * @returns A validated StackDefinition.
 * @throws If validation fails with a descriptive error message.
 */
export function validatePreset(
  data: unknown,
  filePath: string,
): StackDefinition {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`Invalid preset '${filePath}': expected a JSON object.`);
  }

  const obj = data as Record<string, unknown>;

  // Version field
  if (typeof obj["version"] !== "string" || obj["version"].trim() === "") {
    throw new Error(
      `Invalid preset '${filePath}': missing or invalid 'version' field (expected string, e.g. "1.0").`,
    );
  }

  // Name field
  if (typeof obj["name"] !== "string" || obj["name"].trim() === "") {
    throw new Error(
      `Invalid preset '${filePath}': missing or invalid 'name' field (expected non-empty string).`,
    );
  }

  // Layers field
  if (!Array.isArray(obj["layers"])) {
    throw new Error(
      `Invalid preset '${filePath}': missing or invalid 'layers' field (expected array).`,
    );
  }

  if (obj["layers"].length === 0) {
    throw new Error(
      `Invalid preset '${filePath}': 'layers' array must contain at least one layer.`,
    );
  }

  const layers: StackLayer[] = [];

  for (let i = 0; i < obj["layers"].length; i++) {
    const raw = obj["layers"][i] as Record<string, unknown>;

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error(
        `Invalid preset '${filePath}': layer[${i}] must be an object.`,
      );
    }

    // recipe (required)
    if (typeof raw["recipe"] !== "string" || raw["recipe"].trim() === "") {
      throw new Error(
        `Invalid preset '${filePath}': layer[${i}] missing or invalid 'recipe' field.`,
      );
    }

    // startTime (required, number >= 0)
    if (typeof raw["startTime"] !== "number" || raw["startTime"] < 0) {
      throw new Error(
        `Invalid preset '${filePath}': layer[${i}] missing or invalid 'startTime' (expected number >= 0).`,
      );
    }

    // duration (optional, number > 0)
    if (raw["duration"] !== undefined) {
      if (typeof raw["duration"] !== "number" || raw["duration"] <= 0) {
        throw new Error(
          `Invalid preset '${filePath}': layer[${i}] invalid 'duration' (expected number > 0).`,
        );
      }
    }

    // gain (optional, number >= 0)
    if (raw["gain"] !== undefined) {
      if (typeof raw["gain"] !== "number" || raw["gain"] < 0) {
        throw new Error(
          `Invalid preset '${filePath}': layer[${i}] invalid 'gain' (expected number >= 0).`,
        );
      }
    }

    layers.push({
      recipe: raw["recipe"] as string,
      startTime: raw["startTime"] as number,
      duration: raw["duration"] as number | undefined,
      gain: raw["gain"] as number | undefined,
    });
  }

  return {
    name: obj["name"] as string,
    layers,
  };
}
