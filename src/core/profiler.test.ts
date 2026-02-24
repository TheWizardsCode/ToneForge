/**
 * Tests for Pipeline Profiler
 *
 * Verifies:
 * - Profiler collects marks when enabled
 * - Profiler is a no-op when disabled
 * - Report output format matches the machine-parseable spec
 * - Reset clears state
 *
 * Reference: TF-0MM0YTYLE0BN0YR9
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { profiler } from "./profiler.js";

describe("Profiler", () => {
  beforeEach(() => {
    profiler.reset();
  });

  afterEach(() => {
    profiler.reset();
  });

  it("should be disabled by default", () => {
    expect(profiler.isEnabled()).toBe(false);
  });

  it("should not record marks when disabled", () => {
    profiler.mark("test_phase");
    expect(profiler.getMarks()).toHaveLength(0);
  });

  it("should record process_start mark on enable", () => {
    profiler.enable();
    expect(profiler.isEnabled()).toBe(true);
    const marks = profiler.getMarks();
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(marks[0]!.phase).toBe("process_start");
  });

  it("should record marks when enabled", () => {
    profiler.enable();
    profiler.mark("phase_a");
    profiler.mark("phase_b");
    const marks = profiler.getMarks();
    // process_start + phase_a + phase_b
    expect(marks).toHaveLength(3);
    expect(marks[1]!.phase).toBe("phase_a");
    expect(marks[2]!.phase).toBe("phase_b");
  });

  it("should record timestamps in increasing order", () => {
    profiler.enable();
    profiler.mark("first");
    profiler.mark("second");
    const marks = profiler.getMarks();
    expect(marks[2]!.timestamp).toBeGreaterThanOrEqual(marks[1]!.timestamp);
    expect(marks[1]!.timestamp).toBeGreaterThanOrEqual(marks[0]!.timestamp);
  });

  it("should use globalThis.__toneforgeProcessStart as anchor when available", () => {
    const fakeStart = process.hrtime.bigint() - BigInt(100_000_000); // 100ms ago
    globalThis.__toneforgeProcessStart = fakeStart;
    try {
      profiler.enable();
      const marks = profiler.getMarks();
      expect(marks[0]!.phase).toBe("process_start");
      expect(marks[0]!.timestamp).toBe(fakeStart);
    } finally {
      (globalThis as Record<string, unknown>).__toneforgeProcessStart = undefined;
    }
  });

  it("should produce report output to stderr when enabled", () => {
    profiler.enable();
    profiler.mark("test_phase");

    // Capture stderr output
    const chunks: string[] = [];
    const originalWrite = process.stderr.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      profiler.report();
    } finally {
      process.stderr.write = originalWrite;
    }

    const output = chunks.join("");
    // Verify format contains expected sections
    expect(output).toContain("--- ToneForge Profile ---");
    expect(output).toContain("--- End Profile ---");
    expect(output).toContain("process_start:");
    expect(output).toContain("test_phase:");
    expect(output).toContain("Total:");

    // Verify each timing line matches "<phase>: <N>ms" pattern
    const lines = output.split("\n").filter((l) => l.includes("ms"));
    for (const line of lines) {
      expect(line.trim()).toMatch(/[\w_>. -]+: \d+(\.\d+)?ms/);
    }
  });

  it("should not produce output when disabled", () => {
    let called = false;
    const originalWrite = process.stderr.write;
    process.stderr.write = (() => {
      called = true;
      return true;
    }) as typeof process.stderr.write;

    try {
      profiler.report();
    } finally {
      process.stderr.write = originalWrite;
    }

    expect(called).toBe(false);
  });

  it("should reset all state", () => {
    profiler.enable();
    profiler.mark("test");
    expect(profiler.getMarks().length).toBeGreaterThan(0);
    expect(profiler.isEnabled()).toBe(true);

    profiler.reset();
    expect(profiler.getMarks()).toHaveLength(0);
    expect(profiler.isEnabled()).toBe(false);
  });
});
