/**
 * TUI Wizard Cleanup Handler.
 *
 * Manages graceful shutdown on Ctrl+C (SIGINT): kills tracked audio
 * child processes, removes temporary files, and outputs a cancellation
 * message to stderr.
 *
 * Reference: Parent epic TF-0MM7HULM506CGSOP
 */

import type { ChildProcess } from "node:child_process";
import { unlink } from "node:fs/promises";

/** Set of tracked audio child processes to kill on cleanup. */
const trackedProcesses = new Set<ChildProcess>();

/** Set of tracked temp file paths to remove on cleanup. */
const trackedTempFiles = new Set<string>();

/** Whether the cleanup handler is currently installed. */
let handlerInstalled = false;

/** Whether cleanup is currently in progress (prevent re-entry). */
let cleaningUp = false;

/**
 * Track an audio child process for cleanup on SIGINT.
 *
 * The process will be killed (SIGTERM) if the user presses Ctrl+C.
 * Automatically untracked when the process exits.
 */
export function trackProcess(proc: ChildProcess): void {
  trackedProcesses.add(proc);
  proc.on("exit", () => {
    trackedProcesses.delete(proc);
  });
  proc.on("error", () => {
    trackedProcesses.delete(proc);
  });
}

/**
 * Track a temporary file for cleanup on SIGINT.
 *
 * The file will be deleted if the user presses Ctrl+C.
 */
export function trackTempFile(path: string): void {
  trackedTempFiles.add(path);
}

/**
 * Untrack a temporary file (e.g. after normal cleanup).
 */
export function untrackTempFile(path: string): void {
  trackedTempFiles.delete(path);
}

/**
 * Perform cleanup: kill tracked processes and remove temp files.
 *
 * This is called by the SIGINT handler and can also be called
 * manually for graceful shutdown.
 */
export async function performCleanup(): Promise<void> {
  if (cleaningUp) return;
  cleaningUp = true;

  // Kill all tracked audio processes
  for (const proc of trackedProcesses) {
    try {
      if (!proc.killed) {
        proc.kill("SIGTERM");
      }
    } catch {
      // Process may already be dead -- ignore
    }
  }
  trackedProcesses.clear();

  // Remove all tracked temp files
  const removals = [...trackedTempFiles].map((path) =>
    unlink(path).catch(() => {
      // File may not exist -- ignore
    }),
  );
  await Promise.all(removals);
  trackedTempFiles.clear();

  cleaningUp = false;
}

/**
 * Install the SIGINT handler for graceful Ctrl+C cleanup.
 *
 * Only installs once -- subsequent calls are no-ops.
 * The handler kills tracked audio processes, removes temp files,
 * outputs "Session cancelled" to stderr, and exits with code 130.
 */
export function installCleanupHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;

  process.on("SIGINT", async () => {
    await performCleanup();
    process.stderr.write("Session cancelled\n");
    process.exit(130);
  });
}

/**
 * Reset cleanup state (for testing only).
 *
 * Clears all tracked processes and temp files without killing/removing.
 * Does NOT uninstall the SIGINT handler.
 */
export function resetCleanupState(): void {
  trackedProcesses.clear();
  trackedTempFiles.clear();
  cleaningUp = false;
}

/**
 * Get the number of tracked processes (for testing).
 */
export function trackedProcessCount(): number {
  return trackedProcesses.size;
}

/**
 * Get the number of tracked temp files (for testing).
 */
export function trackedTempFileCount(): number {
  return trackedTempFiles.size;
}
