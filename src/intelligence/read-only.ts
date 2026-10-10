/**
 * ToneForge Intelligence — read-only enforcement.
 *
 * Intelligence is assistive: it suggests, the human decides, and it **never**
 * mutates library data (parent AC4). Every CLI command runs its engine inside
 * {@link withReadOnlyGuard}, which snapshots the library directory, runs the
 * action, and fails loudly if any file changed.
 *
 * The guarantee is deliberately enforced at runtime, not merely documented:
 * a future engine that accidentally writes to the library will be caught.
 *
 * Reference: docs/prd/INTELLIGENCE_PRD.md §10 (Determinism & Safety).
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/** Map of library-relative file path to SHA-256 content hash. */
export type LibrarySnapshot = Record<string, string>;

/** SHA-256 hash of a file's contents. */
function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Snapshot every file under `libraryDir`, keyed by relative path.
 *
 * Traversal is sorted so the snapshot is itself deterministic. A missing
 * directory yields an empty snapshot (auditing a non-existent library is a
 * valid, read-only operation that produces an empty report).
 */
export function snapshotLibrary(libraryDir: string): LibrarySnapshot {
  const files: LibrarySnapshot = {};
  if (!existsSync(libraryDir)) return files;

  const walk = (current: string): void => {
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files[relative(libraryDir, full)] = hashFile(full);
      }
    }
  };

  walk(libraryDir);
  return files;
}

/** Error thrown when an Intelligence action mutates the library. */
export class ReadOnlyViolationError extends Error {
  readonly action: string;
  readonly added: string[];
  readonly removed: string[];
  readonly changed: string[];

  constructor(
    action: string,
    diff: { added: string[]; removed: string[]; changed: string[] },
  ) {
    super(
      `Intelligence action '${action}' modified the library, which is ` +
        `forbidden (read-only guarantee). added=[${diff.added.join(", ")}] ` +
        `removed=[${diff.removed.join(", ")}] changed=[${diff.changed.join(", ")}]`,
    );
    this.name = "ReadOnlyViolationError";
    this.action = action;
    this.added = diff.added;
    this.removed = diff.removed;
    this.changed = diff.changed;
  }
}

/**
 * Assert two snapshots are identical.
 *
 * @throws {ReadOnlyViolationError} when any file was added, removed, or changed.
 */
export function assertLibraryUnchanged(
  before: LibrarySnapshot,
  after: LibrarySnapshot,
  action: string,
): void {
  const added = Object.keys(after).filter((path) => !(path in before));
  const removed = Object.keys(before).filter((path) => !(path in after));
  const changed = Object.keys(before).filter(
    (path) => path in after && before[path] !== after[path],
  );

  if (added.length > 0 || removed.length > 0 || changed.length > 0) {
    throw new ReadOnlyViolationError(action, { added, removed, changed });
  }
}

/**
 * Run `fn` under the read-only guard for `libraryDir`.
 *
 * @param libraryDir - Library directory that must not change.
 * @param action - Action name used in the violation message.
 * @param fn - The read-only operation to run.
 * @throws {ReadOnlyViolationError} if `fn` changes any library file.
 */
export async function withReadOnlyGuard<T>(
  libraryDir: string,
  action: string,
  fn: () => Promise<T>,
): Promise<T> {
  const before = snapshotLibrary(libraryDir);
  const result = await fn();
  const after = snapshotLibrary(libraryDir);
  assertLibraryUnchanged(before, after, action);
  return result;
}
