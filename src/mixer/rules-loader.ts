/**
 * Mixer Rule Config Loader
 *
 * Reads, validates and merges declarative mixer rule files from
 * `.toneforge/mixer/*.json` and exposes a normalised `MixRuleSet` to the
 * Mixer runtime.
 *
 * Behaviour mirrors the `.toneforge/config.yaml` fallback in
 * `src/classify/dimensions/category.ts`:
 * - when no rule files are present, the built-in defaults are used (a warning
 *   is emitted so the fallback is observable);
 * - when a file is present but invalid, loading fails fast with actionable
 *   field-level errors rather than silently masking a broken rule file.
 *
 * Work item: TF-0MMLC8PXU0D3O594
 * Reference: docs/prd/MIXER_PRD.md §4; docs/mixer-rules.md
 */

import fs from "node:fs";
import path from "node:path";
import {
  BUILT_IN_MIX_RULES,
  formatValidationErrors,
  parseMixRuleSet,
  validateMixRuleSet,
} from "./schema.js";
import type { MixRuleSet, RawMixRuleFile } from "./schema.js";

/** Repository-relative directory that holds mixer rule files. */
export const MIX_RULES_DIR_PARTS = [".toneforge", "mixer"] as const;

/** Options for {@link loadMixRules}. */
export interface LoadMixRulesOptions {
  /**
   * Directory containing `*.json` rule files. Defaults to
   * `<cwd>/.toneforge/mixer`.
   */
  dir?: string;

  /**
   * Rule set returned when no rule files are present. Defaults to the
   * built-in rule set.
   */
  fallback?: MixRuleSet;

  /**
   * Warning sink used when falling back to built-in defaults. Defaults to
   * `console.warn`.
   */
  warn?: (message: string) => void;
}

/**
 * Resolve the default mixer rules directory for a given working directory.
 *
 * @param cwd - Base directory (defaults to `process.cwd()`).
 * @returns Absolute path to `<cwd>/.toneforge/mixer`.
 */
export function resolveMixRulesDir(cwd: string = process.cwd()): string {
  return path.join(cwd, ...MIX_RULES_DIR_PARTS);
}

/**
 * List the `*.json` rule files in a directory, sorted by filename for
 * deterministic merge order. Missing/unreadable directories yield `[]`.
 */
function listRuleFiles(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

/** Read and JSON-parse a rule file, wrapping errors with context. */
function readRuleFile(filePath: string): unknown {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read mixer rules '${filePath}': ${message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse mixer rules '${filePath}': ${message}`);
  }
}

/** Merge one parsed rule file into the combined raw accumulator. */
function mergeRuleFile(target: RawMixRuleFile, source: RawMixRuleFile): void {
  if (source.version !== undefined) target.version = source.version;

  if (source.defaults !== undefined) {
    target.defaults = { ...(target.defaults ?? {}), ...source.defaults };
  }

  if (source.groups !== undefined) {
    const merged = { ...(target.groups ?? {}) };
    for (const [name, config] of Object.entries(source.groups)) {
      merged[name] = { ...(merged[name] ?? {}), ...config };
    }
    target.groups = merged;
  }

  if (source.rules !== undefined) {
    target.rules = [...(target.rules ?? []), ...source.rules];
  }
}

/**
 * Load and merge all mixer rule files from a directory.
 *
 * Files are read in filename order and merged (later files override earlier
 * `defaults`/`groups`; rules concatenate). Every file is validated before
 * merging; the first invalid file aborts loading with an actionable error.
 *
 * @param options - Loader options.
 * @returns A validated, normalised `MixRuleSet`.
 * @throws If the directory is present but a rule file is unreadable, invalid
 *   JSON, or fails schema validation.
 */
export function loadMixRules(options: LoadMixRulesOptions = {}): MixRuleSet {
  const dir = options.dir ?? resolveMixRulesDir();
  const fallback = options.fallback ?? BUILT_IN_MIX_RULES;
  const warn = options.warn ?? ((message: string) => console.warn(message));

  const files = listRuleFiles(dir);
  if (files.length === 0) {
    warn(`[ToneForge] No mixer rules found in ${dir}; using built-in defaults.`);
    return structuredClone(fallback);
  }

  const combined: RawMixRuleFile = {};
  for (const file of files) {
    const data = readRuleFile(file);
    const errors = validateMixRuleSet(data, file);
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(file, errors));
    }
    mergeRuleFile(combined, data as RawMixRuleFile);
  }

  return parseMixRuleSet(combined, files.join(", "));
}
