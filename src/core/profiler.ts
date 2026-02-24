/**
 * Pipeline Profiler
 *
 * Collects phase-level timing data for the `toneforge generate` lifecycle.
 * Designed for zero overhead when profiling is disabled: all `mark()` calls
 * short-circuit on a boolean check before any work.
 *
 * Usage:
 *   1. Record process start as early as possible:
 *        globalThis.__toneforgeProcessStart = process.hrtime.bigint();
 *   2. Enable profiling when `--profile` is detected:
 *        profiler.enable();
 *   3. Mark phases throughout the pipeline:
 *        profiler.mark("cli_parse");
 *        profiler.mark("recipe_resolution");
 *   4. Print the report at exit:
 *        profiler.report();
 *
 * Output format (stderr, one line per phase):
 *   process_start: 0ms
 *   module_load: 142ms
 *   cli_parse: 145ms
 *   ...
 *
 * Reference: TF-0MM0YTYLE0BN0YR9
 */

/** Augment globalThis so TypeScript knows about the process-start anchor. */
declare global {
  // eslint-disable-next-line no-var
  var __toneforgeProcessStart: bigint | undefined; // optional — set by bin/dev-cli.js
}

/** A single timing mark with its phase name and absolute timestamp. */
interface Mark {
  /** Phase name (e.g. "cli_parse", "render"). */
  phase: string;
  /** Absolute timestamp from `process.hrtime.bigint()`. */
  timestamp: bigint;
}

class Profiler {
  private enabled = false;
  private readonly marks: Mark[] = [];

  /**
   * Enable profiling. Must be called before any marks are recorded.
   * After enabling, the profiler picks up `globalThis.__toneforgeProcessStart`
   * as the t=0 anchor and records "process_start" automatically.
   */
  enable(): void {
    this.enabled = true;
    // Record the process-start anchor set in bin/dev-cli.js or dist entry
    const processStart = globalThis.__toneforgeProcessStart;
    if (processStart !== undefined) {
      this.marks.push({ phase: "process_start", timestamp: processStart });
    } else {
      // Fallback: use current time (less accurate but functional)
      this.marks.push({ phase: "process_start", timestamp: process.hrtime.bigint() });
    }
  }

  /** Returns true if profiling is active. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Record a timing mark for the given phase.
   * No-op when profiling is disabled (single boolean check).
   */
  mark(phase: string): void {
    if (!this.enabled) return;
    this.marks.push({ phase, timestamp: process.hrtime.bigint() });
  }

  /**
   * Print the profiling report to stderr.
   *
   * Output format:
   *   <phase>: <N>ms
   *
   * Two sections:
   * 1. Cumulative: milliseconds from process_start to each phase
   * 2. Phase durations: milliseconds between consecutive phases
   *
   * No-op when profiling is disabled.
   */
  report(): void {
    if (!this.enabled || this.marks.length === 0) return;

    const origin = this.marks[0]!.timestamp;

    process.stderr.write("\n--- ToneForge Profile ---\n");

    // Cumulative from process start
    process.stderr.write("\nCumulative (from process start):\n");
    for (const m of this.marks) {
      const ms = Number(m.timestamp - origin) / 1_000_000;
      process.stderr.write(`  ${m.phase}: ${ms.toFixed(1)}ms\n`);
    }

    // Phase durations (delta between consecutive marks)
    if (this.marks.length > 1) {
      process.stderr.write("\nPhase durations:\n");
      for (let i = 1; i < this.marks.length; i++) {
        const prev = this.marks[i - 1]!;
        const curr = this.marks[i]!;
        const ms = Number(curr.timestamp - prev.timestamp) / 1_000_000;
        process.stderr.write(`  ${prev.phase} -> ${curr.phase}: ${ms.toFixed(1)}ms\n`);
      }
    }

    const totalMs = Number(this.marks[this.marks.length - 1]!.timestamp - origin) / 1_000_000;
    process.stderr.write(`\nTotal: ${totalMs.toFixed(1)}ms\n`);
    process.stderr.write("--- End Profile ---\n");
  }

  /**
   * Get all recorded marks. Useful for testing.
   */
  getMarks(): ReadonlyArray<{ phase: string; timestamp: bigint }> {
    return this.marks;
  }

  /**
   * Reset the profiler state. Useful for testing.
   */
  reset(): void {
    this.enabled = false;
    this.marks.length = 0;
  }
}

/** Singleton profiler instance. */
export const profiler = new Profiler();
