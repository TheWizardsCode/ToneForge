import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  trackProcess,
  trackTempFile,
  untrackTempFile,
  performCleanup,
  resetCleanupState,
  trackedProcessCount,
  trackedTempFileCount,
} from "../cleanup.js";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

/** Create a mock child process that behaves like a real one. */
function mockProcess(): ChildProcess {
  const emitter = new EventEmitter();
  const proc = emitter as unknown as ChildProcess;
  (proc as unknown as Record<string, unknown>).killed = false;
  proc.kill = vi.fn(() => {
    (proc as unknown as Record<string, unknown>).killed = true;
    return true;
  });
  Object.defineProperty(proc, "pid", { value: 12345, writable: true });
  return proc;
}

describe("cleanup", () => {
  beforeEach(() => {
    resetCleanupState();
  });

  afterEach(() => {
    resetCleanupState();
  });

  // -------------------------------------------------------------------------
  // Process tracking
  // -------------------------------------------------------------------------

  describe("process tracking", () => {
    it("tracks a process", () => {
      const proc = mockProcess();
      trackProcess(proc);
      expect(trackedProcessCount()).toBe(1);
    });

    it("untracks a process when it exits", () => {
      const proc = mockProcess();
      trackProcess(proc);
      expect(trackedProcessCount()).toBe(1);

      proc.emit("exit", 0);
      expect(trackedProcessCount()).toBe(0);
    });

    it("untracks a process on error", () => {
      const proc = mockProcess();
      trackProcess(proc);

      proc.emit("error", new Error("test"));
      expect(trackedProcessCount()).toBe(0);
    });

    it("tracks multiple processes", () => {
      trackProcess(mockProcess());
      trackProcess(mockProcess());
      trackProcess(mockProcess());
      expect(trackedProcessCount()).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Temp file tracking
  // -------------------------------------------------------------------------

  describe("temp file tracking", () => {
    it("tracks a temp file", () => {
      trackTempFile("/tmp/test.wav");
      expect(trackedTempFileCount()).toBe(1);
    });

    it("untracks a temp file", () => {
      trackTempFile("/tmp/test.wav");
      untrackTempFile("/tmp/test.wav");
      expect(trackedTempFileCount()).toBe(0);
    });

    it("tracks multiple temp files", () => {
      trackTempFile("/tmp/a.wav");
      trackTempFile("/tmp/b.wav");
      expect(trackedTempFileCount()).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  describe("performCleanup", () => {
    it("kills all tracked processes", async () => {
      const p1 = mockProcess();
      const p2 = mockProcess();
      trackProcess(p1);
      trackProcess(p2);

      await performCleanup();

      expect(p1.kill).toHaveBeenCalledWith("SIGTERM");
      expect(p2.kill).toHaveBeenCalledWith("SIGTERM");
      expect(trackedProcessCount()).toBe(0);
    });

    it("clears tracked temp files", async () => {
      trackTempFile("/tmp/nonexistent-1.wav");
      trackTempFile("/tmp/nonexistent-2.wav");

      await performCleanup();

      expect(trackedTempFileCount()).toBe(0);
    });

    it("handles already-killed processes gracefully", async () => {
      const proc = mockProcess();
      (proc as unknown as Record<string, unknown>).killed = true;
      trackProcess(proc);

      // Should not throw
      await performCleanup();
      expect(trackedProcessCount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  describe("resetCleanupState", () => {
    it("clears all tracked state", () => {
      trackProcess(mockProcess());
      trackTempFile("/tmp/test.wav");

      resetCleanupState();

      expect(trackedProcessCount()).toBe(0);
      expect(trackedTempFileCount()).toBe(0);
    });
  });
});
