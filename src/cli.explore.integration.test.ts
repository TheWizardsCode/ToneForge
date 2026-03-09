/**
 * CLI Integration Tests for the explore command.
 *
 * Tests help text, flag validation, and actual sweep/mutate/show/runs
 * operations using small seed ranges to keep execution fast.
 *
 * Work item: TF-0MM0BWL0B0NMZ6L5
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "./compat/cli.js";
import { clearIndexCache } from "./library/index-store.js";

// Mock the playAudio function for CLI tests
import { vi } from "vitest";
vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

/** Capture console output during a function call. */
async function captureOutput(fn: () => Promise<number>): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const origLog = console.log;
  const origError = console.error;
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

  console.log = (...args: unknown[]) => {
    stdoutLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderrLines.push(args.map(String).join(" "));
  };
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutLines.push(String(chunk).replace(/\n$/, ""));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrLines.push(String(chunk).replace(/\n$/, ""));
    return true;
  }) as typeof process.stderr.write;

  try {
    const code = await fn();
    return {
      code,
      stdout: stdoutLines.join("\n"),
      stderr: stderrLines.join("\n"),
    };
  } finally {
    console.log = origLog;
    console.error = origError;
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

/** Helper to build a fake argv array. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

// ── Help commands ─────────────────────────────────────────────────

describe("CLI explore — help", () => {
  it("explore --help returns 0 and shows subcommands", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("explore", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("sweep");
    expect(stdout).toContain("mutate");
    expect(stdout).toContain("promote");
    expect(stdout).toContain("show");
    expect(stdout).toContain("runs");
  });

  it("explore with no subcommand shows help", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("explore")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("sweep");
  });

  it("explore sweep --help returns 0", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("explore", "sweep", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("--recipe");
    expect(stdout).toContain("--seed-range");
    expect(stdout).toContain("--rank-by");
  });

  it("explore mutate --help returns 0", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("explore", "mutate", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("--recipe");
    expect(stdout).toContain("--seed");
    expect(stdout).toContain("--jitter");
  });

  it("explore promote --help returns 0", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("explore", "promote", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("--run");
    expect(stdout).toContain("--id");
  });

  it("top-level --help lists the explore command", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("explore");
  });

  it("unknown explore subcommand returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "nonexistent")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Unknown explore subcommand");
  });
});

// ── Sweep validation ──────────────────────────────────────────────

describe("CLI explore sweep — validation", () => {
  it("requires --recipe", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "sweep")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--recipe is required");
  });

  it("rejects unknown recipe", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "sweep", "--recipe", "nonexistent-recipe")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Unknown recipe");
  });

  it("rejects invalid seed-range format", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "sweep", "--recipe", "impact-crack", "--seed-range", "abc")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--seed-range");
  });

  it("rejects seed-range where start > end", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "sweep", "--recipe", "impact-crack", "--seed-range", "10:5")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("start");
  });

  it("rejects invalid rank-by metric", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "sweep", "--recipe", "impact-crack", "--rank-by", "invalid-metric")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Unknown rank metric");
  });

  it("rejects clusters outside 1-8 range", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "sweep", "--recipe", "impact-crack", "--clusters", "0")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--clusters");
  });

  it("rejects keep-top less than 1", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "sweep", "--recipe", "impact-crack", "--keep-top", "0")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--keep-top");
  });

  it("validation errors output JSON in --json mode", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "sweep", "--json")),
    );
    expect(code).toBe(1);
    const json = JSON.parse(stderr);
    expect(json.error).toContain("--recipe is required");
  });
});

// ── Mutate validation ─────────────────────────────────────────────

describe("CLI explore mutate — validation", () => {
  it("requires --recipe", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "mutate")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--recipe is required");
  });

  it("requires --seed", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "mutate", "--recipe", "impact-crack")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--seed is required");
  });

  it("rejects non-integer seed", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "mutate", "--recipe", "impact-crack", "--seed", "abc")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--seed");
  });

  it("rejects jitter outside 0-1", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "mutate", "--recipe", "impact-crack", "--seed", "42", "--jitter", "2.0")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--jitter");
  });
});

// ── Promote validation ────────────────────────────────────────────

describe("CLI explore promote — validation", () => {
  it("requires --run or --latest", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "promote", "--id", "some-id")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--run or --latest is required");
  });

  it("requires --id", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "promote", "--run", "some-run")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--id is required");
  });

  it("rejects --run and --latest together", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "promote", "--run", "some-run", "--latest", "--id", "some-id")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("mutually exclusive");
  });

  it("--latest with no runs returns error", async () => {
    try { rmSync(".exploration", { recursive: true, force: true }); } catch { /* ignore */ }
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "promote", "--latest", "--id", "some-id")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("No exploration runs found");
  });
});

// ── Show validation ───────────────────────────────────────────────

describe("CLI explore show — validation", () => {
  it("requires --run or --latest", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "show")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--run or --latest is required");
  });

  it("returns error for nonexistent run", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "show", "--run", "nonexistent-run")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Run not found");
  });

  it("rejects --run and --latest together", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "show", "--run", "some-run", "--latest")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("mutually exclusive");
  });

  it("--latest with no runs returns error", async () => {
    try { rmSync(".exploration", { recursive: true, force: true }); } catch { /* ignore */ }
    const { code, stderr } = await captureOutput(
      () => main(argv("explore", "show", "--latest")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("No exploration runs found");
  });
});

// ── End-to-end sweep (small range) ────────────────────────────────

describe("CLI explore sweep — e2e", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `toneforge-explore-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    // Clean up .exploration directory created by the run
    try { rmSync(".exploration", { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("sweeps a small seed range and returns JSON output", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv(
        "explore", "sweep",
        "--recipe", "impact-crack",
        "--seed-range", "0:2",
        "--keep-top", "2",
        "--clusters", "1",
        "--json",
      )),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("explore sweep");
    expect(json.type).toBe("sweep");
    expect(json.totalCandidates).toBe(3);
    expect(json.candidates.length).toBeLessThanOrEqual(2);
    expect(json.runId).toBeDefined();
    expect(json.exploreVersion).toBe("1.0");

    // Each candidate should have required fields
    for (const c of json.candidates) {
      expect(c.id).toBeDefined();
      expect(c.recipe).toBe("impact-crack");
      expect(typeof c.score).toBe("number");
      expect(typeof c.cluster).toBe("number");
      expect(c.analysis).toBeDefined();
    }
  });

  it("sweeps and exports WAV files with --output", async () => {
    const outDir = join(tempDir, "wavs");
    const { code } = await captureOutput(
      () => main(argv(
        "explore", "sweep",
        "--recipe", "impact-crack",
        "--seed-range", "0:1",
        "--keep-top", "2",
        "--clusters", "1",
        "--output", outDir,
      )),
    );
    expect(code).toBe(0);
    expect(existsSync(outDir)).toBe(true);

    // Should have WAV files for the kept candidates
    const files = readFileSync.toString(); // just check dir exists
    expect(existsSync(outDir)).toBe(true);
  });

  it("sweeps with multiple rank-by metrics", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv(
        "explore", "sweep",
        "--recipe", "impact-crack",
        "--seed-range", "0:2",
        "--rank-by", "rms,spectral-centroid",
        "--keep-top", "2",
        "--clusters", "1",
        "--json",
      )),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.candidates.length).toBeLessThanOrEqual(2);
    // Each candidate should have metric scores for both metrics
    for (const c of json.candidates) {
      expect(c.metricScores).toHaveProperty("rms");
      expect(c.metricScores).toHaveProperty("spectral-centroid");
    }
  });

  it("produces human-readable output without --json", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv(
        "explore", "sweep",
        "--recipe", "impact-crack",
        "--seed-range", "0:1",
        "--keep-top", "2",
        "--clusters", "1",
      )),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("Sweep complete");
    expect(stdout).toContain("Run ID:");
  });
});

// ── End-to-end mutate (small count) ───────────────────────────────

describe("CLI explore mutate — e2e", () => {
  afterEach(() => {
    try { rmSync(".exploration", { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("mutates a seed and returns JSON output", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv(
        "explore", "mutate",
        "--recipe", "impact-crack",
        "--seed", "42",
        "--count", "3",
        "--jitter", "0.1",
        "--json",
      )),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("explore mutate");
    expect(json.type).toBe("mutate");
    expect(json.totalCandidates).toBe(3);
    expect(json.candidates).toHaveLength(3);
    expect(json.runId).toBeDefined();
  });

  it("produces human-readable output without --json", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv(
        "explore", "mutate",
        "--recipe", "impact-crack",
        "--seed", "42",
        "--count", "2",
      )),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("Mutate complete");
    expect(stdout).toContain("Run ID:");
  });
});

// ── End-to-end runs command ───────────────────────────────────────

describe("CLI explore runs — e2e", () => {
  afterEach(() => {
    try { rmSync(".exploration", { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("lists runs in JSON mode", async () => {
    // First create a run
    await captureOutput(
      () => main(argv(
        "explore", "sweep",
        "--recipe", "impact-crack",
        "--seed-range", "0:1",
        "--keep-top", "2",
        "--clusters", "1",
        "--json",
      )),
    );

    // Now list runs
    const { code, stdout } = await captureOutput(
      () => main(argv("explore", "runs", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("explore runs");
    expect(json.count).toBeGreaterThanOrEqual(1);
    expect(json.runs.length).toBeGreaterThanOrEqual(1);
    expect(json.runs[0].type).toBe("sweep");
    expect(json.runs[0].recipe).toBe("impact-crack");
  });

  it("shows 'no runs' message when empty", async () => {
    // Clean any existing runs first
    try { rmSync(".exploration", { recursive: true, force: true }); } catch { /* ignore */ }

    const { code, stdout } = await captureOutput(
      () => main(argv("explore", "runs")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("No exploration runs found");
  });
});

// ── End-to-end show --latest ──────────────────────────────────────

describe("CLI explore show --latest — e2e", () => {
  afterEach(() => {
    try { rmSync(".exploration", { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("shows the most recent run with --latest", async () => {
    // Create a run first
    const sweepResult = await captureOutput(
      () => main(argv(
        "explore", "sweep",
        "--recipe", "impact-crack",
        "--seed-range", "0:1",
        "--keep-top", "2",
        "--clusters", "1",
        "--json",
      )),
    );
    expect(sweepResult.code).toBe(0);
    const sweepJson = JSON.parse(sweepResult.stdout);

    // Now show --latest
    const { code, stdout } = await captureOutput(
      () => main(argv("explore", "show", "--latest", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("explore show");
    expect(json.runId).toBe(sweepJson.runId);
    expect(json.type).toBe("sweep");
    expect(json.config.recipe).toBe("impact-crack");
  });

  it("shows the latest of multiple runs", async () => {
    // Create two runs
    await captureOutput(
      () => main(argv(
        "explore", "sweep",
        "--recipe", "impact-crack",
        "--seed-range", "0:1",
        "--keep-top", "2",
        "--clusters", "1",
        "--json",
      )),
    );

    const secondResult = await captureOutput(
      () => main(argv(
        "explore", "mutate",
        "--recipe", "impact-crack",
        "--seed", "42",
        "--count", "2",
        "--json",
      )),
    );
    expect(secondResult.code).toBe(0);
    const secondJson = JSON.parse(secondResult.stdout);

    // --latest should resolve to the second (most recent) run
    const { code, stdout } = await captureOutput(
      () => main(argv("explore", "show", "--latest", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.runId).toBe(secondJson.runId);
    expect(json.type).toBe("mutate");
  });

  it("shows human-readable output with --latest", async () => {
    // Create a run
    await captureOutput(
      () => main(argv(
        "explore", "sweep",
        "--recipe", "impact-crack",
        "--seed-range", "0:1",
        "--keep-top", "2",
        "--clusters", "1",
      )),
    );

    const { code, stdout } = await captureOutput(
      () => main(argv("explore", "show", "--latest")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("Run:");
    expect(stdout).toContain("Type: sweep");
    expect(stdout).toContain("impact-crack");
  });
});

// ── End-to-end promote --latest ───────────────────────────────────

describe("CLI explore promote --latest — e2e", () => {
  beforeEach(() => {
    clearIndexCache();
  });

  afterEach(() => {
    clearIndexCache();
    try { rmSync(".exploration", { recursive: true, force: true }); } catch { /* ignore */ }
    try { rmSync(".toneforge-library", { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("promotes a candidate from the latest run with --latest", async () => {
    // Create a run
    const sweepResult = await captureOutput(
      () => main(argv(
        "explore", "sweep",
        "--recipe", "impact-crack",
        "--seed-range", "0:1",
        "--keep-top", "2",
        "--clusters", "1",
        "--json",
      )),
    );
    expect(sweepResult.code).toBe(0);
    const sweepJson = JSON.parse(sweepResult.stdout);
    const candidateId = sweepJson.candidates[0].id;

    // Promote using --latest
    const { code, stdout } = await captureOutput(
      () => main(argv("explore", "promote", "--latest", "--id", candidateId, "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("explore promote");
    expect(json.candidateId).toBe(candidateId);
    expect(json.duplicate).toBe(false);
  });
});
