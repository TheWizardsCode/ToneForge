/**
 * Sequence Preset Loader
 *
 * Reads JSON sequence preset files from disk, validates them against the
 * schema, and returns a SequenceDefinition ready for simulation/rendering.
 *
 * Reference: docs/prd/SEQUENCER_PRD.md
 */

import { readFile } from "node:fs/promises";
import { parseSequencePreset, validateSequencePreset } from "./schema.js";
import type { SequenceDefinition, ValidationError } from "./schema.js";

/**
 * Load and validate a sequence preset from a JSON file.
 *
 * @param filePath - Path to the preset JSON file.
 * @returns A validated SequenceDefinition ready for simulation/rendering.
 * @throws If the file cannot be read, parsed, or validated.
 */
export async function loadSequencePreset(
  filePath: string,
): Promise<SequenceDefinition> {
  // Read file
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read sequence preset '${filePath}': ${message}`);
  }

  // Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse sequence preset '${filePath}': ${message}`);
  }

  // Validate and parse
  return parseSequencePreset(data, filePath);
}

/**
 * Load a sequence preset file and return validation errors without throwing.
 *
 * @param filePath - Path to the preset JSON file.
 * @returns Object with either errors or the parsed definition.
 */
export async function validateSequencePresetFile(
  filePath: string,
): Promise<{
  errors: ValidationError[];
  definition?: SequenceDefinition;
  raw?: unknown;
}> {
  // Read file
  let rawStr: string;
  try {
    rawStr = await readFile(filePath, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      errors: [{ field: "(file)", message: `Failed to read: ${message}` }],
    };
  }

  // Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(rawStr);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      errors: [{ field: "(json)", message: `Failed to parse JSON: ${message}` }],
    };
  }

  const errors = validateSequencePreset(data, filePath);

  if (errors.length > 0) {
    return { errors, raw: data };
  }

  const definition = parseSequencePreset(data, filePath);
  return { errors: [], definition, raw: data };
}
