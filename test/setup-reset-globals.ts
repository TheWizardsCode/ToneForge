import { afterEach } from "vitest";
import * as outputModule from "../src/output.js";

// Capture originals at module load time so we can always restore them.
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

afterEach(() => {
  // Restore process.write functions
  try {
    if (process.stdout.write !== originalStdoutWrite) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.stdout.write as any) = originalStdoutWrite;
    }
    if (process.stderr.write !== originalStderrWrite) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.stderr.write as any) = originalStderrWrite;
    }
  } catch (e) {
    // Best-effort: don't fail tests due to restore errors
    // eslint-disable-next-line no-console
    originalConsoleError("Warning: failed to restore process write functions", e);
  }

  // Restore console functions
  try {
    if (console.log !== originalConsoleLog) console.log = originalConsoleLog;
    if (console.error !== originalConsoleError) console.error = originalConsoleError;
  } catch (e) {
    // Best-effort
    // eslint-disable-next-line no-console
    originalConsoleError("Warning: failed to restore console functions", e);
  }

  // Reset TTY override to undefined so tests cannot leak overrides across each other
  try {
    if (typeof outputModule.setTtyOverride === "function") {
      outputModule.setTtyOverride(undefined);
    }
  } catch (e) {
    // Best-effort
    // eslint-disable-next-line no-console
    originalConsoleError("Warning: failed to reset tty override", e);
  }
});
