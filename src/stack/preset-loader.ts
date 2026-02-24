/**
 * Stack Preset Loader
 *
 * Reads JSON stack preset files from disk, validates them against the
 * schema, and verifies that referenced recipes exist in the registry.
 *
 * Reference: docs/prd/STACK_PRD.md
 */

import { readFile } from "node:fs/promises";
import { validatePreset } from "./schema.js";
import { registry } from "../recipes/index.js";
import type { StackDefinition } from "./renderer.js";

/**
 * Load and validate a stack preset from a JSON file.
 *
 * @param filePath - Path to the preset JSON file.
 * @returns A validated StackDefinition ready for rendering.
 * @throws If the file cannot be read, parsed, or validated.
 */
export async function loadPreset(filePath: string): Promise<StackDefinition> {
  // Read file
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read preset '${filePath}': ${message}`);
  }

  // Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse preset '${filePath}': ${message}`);
  }

  // Validate schema
  const definition = validatePreset(data, filePath);

  // Validate recipe references
  for (let i = 0; i < definition.layers.length; i++) {
    const layer = definition.layers[i]!;
    if (!registry.getRegistration(layer.recipe)) {
      throw new Error(
        `Invalid preset '${filePath}': layer[${i}] references unknown recipe '${layer.recipe}'.`,
      );
    }
  }

  return definition;
}
