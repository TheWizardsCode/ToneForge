/**
 * Preset File Discovery
 *
 * Shared, unit-testable discovery of preset JSON files in a directory.
 * Used by the CLI `list` command and the golden/stack fixture harnesses.
 *
 * Test and temporary artefacts are named with a `__` prefix (for example
 * `__malformed_test__.json`); they are excluded so a leaked or in-flight
 * fixture can never be discovered as a real preset.
 *
 * Work item: TF-0MUYJSV32004EFAZ
 */

import { readdirSync } from "node:fs";

/**
 * List the preset JSON files in `dir`.
 *
 * Returns the basenames of all regular `.json` files, excluding any whose
 * name begins with `__`, sorted lexicographically.
 *
 * @param dir - Directory to scan.
 * @returns Sorted list of preset file basenames.
 */
export function listPresetFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".json") && !name.startsWith("__"))
    .sort();
}
