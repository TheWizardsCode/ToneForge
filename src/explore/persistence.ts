/**
 * Persistence & Result Index
 *
 * Stores exploration run results to disk as JSON index files.
 * Provides loading and querying of past runs.
 *
 * Run results are stored in `.exploration/runs/` with one JSON
 * file per run named by run ID.
 *
 * Reference: docs/prd/EXPLORE_PRD.md Section 13
 */

import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { ExploreRunResult } from "./types.js";

/** Default base directory for exploration data. */
const DEFAULT_BASE_DIR = ".exploration";

/** Subdirectory for run index files. */
const RUNS_DIR = "runs";

/**
 * Generate a unique run ID.
 *
 * Format: `run-<timestamp>-<random>` for sortability and uniqueness.
 */
export function generateRunId(): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(4).toString("hex");
  return `run-${ts}-${rand}`;
}

/**
 * Get the full path to the runs directory.
 */
function runsDir(baseDir: string = DEFAULT_BASE_DIR): string {
  return resolve(baseDir, RUNS_DIR);
}

/**
 * Save an exploration run result to disk.
 *
 * Creates the directory structure if it does not exist.
 *
 * @param result - The completed run result to persist.
 * @param baseDir - Base directory for exploration data.
 * @returns Path to the saved index file.
 */
export async function saveRunResult(
  result: ExploreRunResult,
  baseDir: string = DEFAULT_BASE_DIR,
): Promise<string> {
  const dir = runsDir(baseDir);
  await mkdir(dir, { recursive: true });

  const fileName = `${result.runId}.json`;
  const filePath = resolve(dir, fileName);
  const content = JSON.stringify(result, null, 2);
  await writeFile(filePath, content);

  return filePath;
}

/**
 * Load a specific run result by ID.
 *
 * @param runId - The run ID to load.
 * @param baseDir - Base directory for exploration data.
 * @returns The loaded run result, or null if not found.
 */
export async function loadRunResult(
  runId: string,
  baseDir: string = DEFAULT_BASE_DIR,
): Promise<ExploreRunResult | null> {
  const filePath = resolve(runsDir(baseDir), `${runId}.json`);
  if (!existsSync(filePath)) return null;

  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as ExploreRunResult;
}

/**
 * List all saved run IDs, sorted by creation time (newest first).
 *
 * @param baseDir - Base directory for exploration data.
 * @returns Array of run IDs.
 */
export async function listRunIds(
  baseDir: string = DEFAULT_BASE_DIR,
): Promise<string[]> {
  const dir = runsDir(baseDir);
  if (!existsSync(dir)) return [];

  const entries = await readdir(dir);
  return entries
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort()
    .reverse();
}

/**
 * List all saved runs with summary info.
 *
 * @param baseDir - Base directory for exploration data.
 * @returns Array of run summaries.
 */
export async function listRuns(
  baseDir: string = DEFAULT_BASE_DIR,
): Promise<
  Array<{
    runId: string;
    type: string;
    recipe: string;
    totalCandidates: number;
    keptCandidates: number;
    startedAt: string;
    durationMs: number;
  }>
> {
  const ids = await listRunIds(baseDir);
  const summaries: Array<{
    runId: string;
    type: string;
    recipe: string;
    totalCandidates: number;
    keptCandidates: number;
    startedAt: string;
    durationMs: number;
  }> = [];

  for (const id of ids) {
    const result = await loadRunResult(id, baseDir);
    if (result) {
      summaries.push({
        runId: result.runId,
        type: result.type,
        recipe: result.config.recipe,
        totalCandidates: result.totalCandidates,
        keptCandidates: result.candidates.length,
        startedAt: result.startedAt,
        durationMs: result.durationMs,
      });
    }
  }

  return summaries;
}
