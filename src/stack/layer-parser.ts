/**
 * Inline Layer Parser
 *
 * Parses the `--layer "recipe=name,offset=50ms,gain=0.8"` CLI syntax
 * into typed StackLayer objects, enabling ad-hoc sound stacking without
 * preset files.
 *
 * Accepted formats:
 *   --layer "recipe=weapon-laser-zap,offset=50ms,gain=0.8"
 *   --layer "recipe=ui-scifi-confirm,offset=0.05,gain=0.3"
 *   --layer "recipe=ambient-wind-gust"
 *   --layer "recipe=impact-crack,offset=0ms,gain=1.2,duration=0.1"
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import type { StackLayer, StackDefinition } from "./renderer.js";

/** Valid key names accepted in a layer spec string. */
const VALID_KEYS = new Set(["recipe", "offset", "gain", "duration"]);

/**
 * Parse a time value string into seconds.
 *
 * Supported formats:
 * - `"50ms"` -> 0.05
 * - `"1.5s"` -> 1.5
 * - `"0.3"` -> 0.3 (bare number = seconds)
 */
function parseTime(value: string, key: string): number {
  if (value.endsWith("ms")) {
    const num = Number(value.slice(0, -2));
    if (Number.isNaN(num)) {
      throw new Error(`Invalid time value for "${key}": "${value}" is not a valid number`);
    }
    return num / 1000;
  }
  if (value.endsWith("s")) {
    const num = Number(value.slice(0, -1));
    if (Number.isNaN(num)) {
      throw new Error(`Invalid time value for "${key}": "${value}" is not a valid number`);
    }
    return num;
  }
  // Bare number = seconds
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid time value for "${key}": "${value}" is not a valid number`);
  }
  return num;
}

/**
 * Parse a single `--layer` spec string into a StackLayer.
 *
 * @param input - Key=value string, e.g. `"recipe=weapon-laser-zap,offset=50ms,gain=0.8"`
 * @returns Parsed StackLayer object
 * @throws Error if required fields are missing or values are invalid
 */
export function parseLayer(input: string): StackLayer {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("Empty layer specification");
  }

  const pairs = trimmed.split(",");
  const parsed: Record<string, string> = {};

  for (const pair of pairs) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid key=value pair: "${pair}" (missing "=" separator)`);
    }

    const key = pair.slice(0, eqIndex).trim().toLowerCase();
    const value = pair.slice(eqIndex + 1).trim();

    if (!VALID_KEYS.has(key)) {
      throw new Error(
        `Unknown layer key "${key}". Valid keys: ${[...VALID_KEYS].join(", ")}`,
      );
    }

    if (key in parsed) {
      throw new Error(`Duplicate key "${key}" in layer specification`);
    }

    parsed[key] = value;
  }

  // Recipe is required
  if (!parsed.recipe) {
    throw new Error("Missing required \"recipe\" field in layer specification");
  }

  const layer: StackLayer = {
    recipe: parsed.recipe,
    startTime: 0,
  };

  // Parse optional offset -> startTime
  if (parsed.offset !== undefined) {
    const startTime = parseTime(parsed.offset, "offset");
    if (startTime < 0) {
      throw new Error(`Offset must be non-negative, got ${startTime}s`);
    }
    layer.startTime = startTime;
  }

  // Parse optional gain
  if (parsed.gain !== undefined) {
    const gain = Number(parsed.gain);
    if (Number.isNaN(gain)) {
      throw new Error(`Invalid gain value: "${parsed.gain}" is not a valid number`);
    }
    layer.gain = gain;
  }

  // Parse optional duration
  if (parsed.duration !== undefined) {
    const duration = parseTime(parsed.duration, "duration");
    if (duration <= 0) {
      throw new Error(`Duration must be positive, got ${duration}s`);
    }
    layer.duration = duration;
  }

  return layer;
}

/**
 * Parse multiple `--layer` spec strings into a StackDefinition.
 *
 * @param inputs - Array of key=value strings from repeated `--layer` flags
 * @returns Complete StackDefinition ready for rendering
 * @throws Error if no layers are provided or any layer is invalid
 */
export function parseLayers(inputs: string[]): StackDefinition {
  if (inputs.length === 0) {
    throw new Error("At least one --layer specification is required");
  }

  return {
    name: "inline-stack",
    layers: inputs.map(parseLayer),
  };
}
