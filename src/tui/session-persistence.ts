/**
 * TUI Wizard Session Persistence.
 *
 * Provides save/load functionality for wizard session state,
 * enabling auto-save on stage transitions and session resume
 * across terminal sessions.
 *
 * Features:
 * - JSON serialization with Map-to-object conversion (selections)
 * - Sweep cache excluded from persistence (re-runs on resume)
 * - Schema versioning with mismatch detection
 * - Corrupted file handling with clear error messages
 * - Backup rotation: max 3 timestamped backups per session file
 *
 * Reference: TF-0MM8S3BDR1QMN6TZ (Session Save/Resume)
 */

import { writeFile, readFile, copyFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, basename, resolve } from "node:path";
import type { WizardSessionData, CandidateSelection } from "./types.js";

/** Current schema version for session files. */
export const SESSION_SCHEMA_VERSION = 1;

/** Default session file name. */
export const DEFAULT_SESSION_FILE = ".toneforge-session.json";

/** Maximum number of backup files to retain. */
const MAX_BACKUPS = 3;

// ---------------------------------------------------------------------------
// Serialization types (JSON envelope)
// ---------------------------------------------------------------------------

/**
 * JSON-serializable representation of a CandidateSelection map.
 *
 * Converts Map<string, CandidateSelection> to a plain object
 * keyed by recipe name.
 */
type SerializedSelections = Record<string, CandidateSelection>;

/**
 * JSON envelope for persisted session data.
 *
 * Includes a schema version for forward-compatibility detection,
 * and excludes the sweep cache (re-runs on resume).
 */
interface SessionFileEnvelope {
  schemaVersion: number;
  currentStage: WizardSessionData["currentStage"];
  manifest: WizardSessionData["manifest"];
  selections: SerializedSelections;
  exportDir: WizardSessionData["exportDir"];
  exportByCategory: WizardSessionData["exportByCategory"];
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Error thrown when loading a session file with a mismatched schema version.
 */
export class SessionVersionMismatchError extends Error {
  constructor(
    public readonly fileVersion: number,
    public readonly expectedVersion: number,
  ) {
    super(
      `Session file schema version mismatch: file has version ${fileVersion}, ` +
      `but this version of ToneForge expects version ${expectedVersion}. ` +
      `The session file may have been created by a different version of ToneForge. ` +
      `Please start a fresh session or update ToneForge.`,
    );
    this.name = "SessionVersionMismatchError";
  }
}

/**
 * Error thrown when a session file is corrupted or unparseable.
 */
export class SessionCorruptedError extends Error {
  constructor(filePath: string, cause?: Error) {
    super(
      `Session file is corrupted or unparseable: ${filePath}\n` +
      `${cause ? `Cause: ${cause.message}\n` : ""}` +
      `You can delete the file and start a fresh session, or restore from a backup.`,
    );
    this.name = "SessionCorruptedError";
  }
}

// ---------------------------------------------------------------------------
// Core persistence functions
// ---------------------------------------------------------------------------

/**
 * Serialize WizardSessionData to a JSON-compatible envelope.
 *
 * Converts the selections Map to a plain object and excludes
 * the sweep cache entirely.
 */
function serializeSession(data: WizardSessionData): SessionFileEnvelope {
  const selections: SerializedSelections = {};
  for (const [key, value] of data.selections) {
    selections[key] = value;
  }

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    currentStage: data.currentStage,
    manifest: data.manifest,
    selections,
    exportDir: data.exportDir,
    exportByCategory: data.exportByCategory,
  };
}

/**
 * Deserialize a JSON envelope back to WizardSessionData.
 *
 * Converts the plain-object selections back to a Map and
 * initializes an empty sweep cache.
 */
function deserializeSession(envelope: SessionFileEnvelope): WizardSessionData {
  const selections = new Map<string, CandidateSelection>();
  for (const [key, value] of Object.entries(envelope.selections)) {
    selections.set(key, value);
  }

  return {
    currentStage: envelope.currentStage,
    manifest: envelope.manifest,
    selections,
    sweepCache: new Map(),
    exportDir: envelope.exportDir,
    exportByCategory: envelope.exportByCategory,
  };
}

/**
 * Save wizard session state to a JSON file.
 *
 * Before writing, the current file (if it exists) is backed up
 * with a timestamp suffix. Backups beyond MAX_BACKUPS are pruned.
 *
 * @param data - The session data to persist.
 * @param filePath - Path to the session file. Defaults to `.toneforge-session.json` in cwd.
 */
export async function saveSession(
  data: WizardSessionData,
  filePath: string = DEFAULT_SESSION_FILE,
): Promise<void> {
  // Back up existing file before overwriting
  if (existsSync(filePath)) {
    await createBackup(filePath);
  }

  const envelope = serializeSession(data);
  const content = JSON.stringify(envelope, null, 2);
  await writeFile(filePath, content, "utf-8");
}

/**
 * Load wizard session state from a JSON file.
 *
 * Validates the schema version and handles corrupted files gracefully.
 *
 * @param filePath - Path to the session file.
 * @returns The deserialized WizardSessionData.
 * @throws SessionVersionMismatchError if the schema version does not match.
 * @throws SessionCorruptedError if the file cannot be parsed.
 */
export async function loadSession(
  filePath: string = DEFAULT_SESSION_FILE,
): Promise<WizardSessionData> {
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (err) {
    throw new SessionCorruptedError(
      filePath,
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  let envelope: SessionFileEnvelope;
  try {
    envelope = JSON.parse(content) as SessionFileEnvelope;
  } catch (err) {
    throw new SessionCorruptedError(
      filePath,
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  // Validate structure minimally
  if (!envelope || typeof envelope !== "object") {
    throw new SessionCorruptedError(filePath);
  }

  // Check schema version
  if (envelope.schemaVersion !== SESSION_SCHEMA_VERSION) {
    throw new SessionVersionMismatchError(
      envelope.schemaVersion,
      SESSION_SCHEMA_VERSION,
    );
  }

  // Validate required fields
  if (!envelope.currentStage || !envelope.manifest || !envelope.selections) {
    throw new SessionCorruptedError(
      filePath,
      new Error("Missing required fields: currentStage, manifest, or selections"),
    );
  }

  return deserializeSession(envelope);
}

/**
 * Check if a session file exists at the given path.
 *
 * @param filePath - Path to check. Defaults to `.toneforge-session.json` in cwd.
 * @returns true if the file exists.
 */
export function detectSessionFile(
  filePath: string = DEFAULT_SESSION_FILE,
): boolean {
  // During test runs (Vitest/NODE_ENV=test) we avoid interacting with a
  // developer's on-disk session file to keep tests hermetic and deterministic.
  // Tests set `VITEST=true` in the environment; respect that and treat the
  // session file as absent so the TUI does not prompt to resume or delete it.
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    return false;
  }

  return existsSync(filePath);
}

/**
 * Delete the session file and all its backups.
 *
 * @param filePath - Path to the session file. Defaults to `.toneforge-session.json` in cwd.
 */
export async function deleteSessionFile(
  filePath: string = DEFAULT_SESSION_FILE,
): Promise<void> {
  // Delete the main file
  if (existsSync(filePath)) {
    await unlink(filePath);
  }

  // Delete all backups
  const backups = await listBackups(filePath);
  for (const backup of backups) {
    await unlink(backup);
  }
}

// ---------------------------------------------------------------------------
// Backup rotation
// ---------------------------------------------------------------------------

/**
 * Generate a backup file path with a timestamp suffix.
 *
 * Format: `.toneforge-session.2026-03-11T091500.json`
 */
function backupPath(filePath: string): string {
  const dir = dirname(filePath);
  const base = basename(filePath, ".json");
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "")
    .replace("T", "T");
  return resolve(dir, `${base}.${ts}.json`);
}

/**
 * List existing backup files for a session file, sorted oldest first.
 *
 * Backup files match the pattern: `<base>.<timestamp>.json`
 */
export async function listBackups(filePath: string): Promise<string[]> {
  const dir = dirname(resolve(filePath));
  const base = basename(filePath, ".json");

  if (!existsSync(dir)) return [];

  const entries = await readdir(dir);

  // Match pattern: <base>.<timestamp>.json (but not the main file)
  const mainName = basename(filePath);
  const backupPattern = new RegExp(
    `^${escapeRegExp(base)}\\.(\\d{8}T\\d{6})\\.json$`,
  );

  return entries
    .filter((f) => f !== mainName && backupPattern.test(f))
    .sort() // Lexicographic sort by timestamp
    .map((f) => resolve(dir, f));
}

/**
 * Create a timestamped backup of the session file and prune old backups.
 */
async function createBackup(filePath: string): Promise<void> {
  const dest = backupPath(filePath);
  await copyFile(filePath, dest);
  await pruneBackups(filePath);
}

/**
 * Remove old backups beyond MAX_BACKUPS, keeping the newest ones.
 */
async function pruneBackups(filePath: string): Promise<void> {
  const backups = await listBackups(filePath);

  // backups is sorted oldest first; remove the oldest ones
  while (backups.length > MAX_BACKUPS) {
    const oldest = backups.shift()!;
    await unlink(oldest);
  }
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
