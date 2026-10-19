/**
 * CLI Integration Tests for `toneforge runtime start`.
 *
 * Help text, flag validation, non-interactive `--script` replay (human and
 * `--json`), determinism, and the non-TTY guard.
 *
 * Work item: TF-0MUYBRKAT0036X2A
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

import { main } from "./cli.js";

// ── Helpers ───────────────────────────────────────────────────────

async function captureOutput(fn: () => Promise<number>): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

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
    return { code, stdout: stdoutLines.join("\n"), stderr: stderrLines.join("\n") };
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

const tempFiles: string[] = [];

function writeScript(content: string): string {
  const path = join(tmpdir(), `tf-session-${Date.now()}-${Math.random()}.txt`);
  writeFileSync(path, content);
  tempFiles.push(path);
  return path;
}

afterEach(() => {
  for (const f of tempFiles) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }
  tempFiles.length = 0;
});

const SESSION_SCRIPT = `# scripted session
state walk
context surface=gravel
state sprint
quit
`;

/** Project root (this test lives in `src/`). */
const PROJECT_ROOT = resolve(import.meta.dirname, "..");

/**
 * How long a spawned CLI child may take to become ready.
 *
 * Every serve test cold-boots the CLI from source: `bin/dev-cli.js` registers
 * `tsx`, then imports the whole command tree before the service installs its
 * SIGINT/SIGTERM handlers. Cached full-suite runs put one such spawn at
 * ~1.8-2.5 s on an idle host and up to ~6.5 s under parallel load, but the
 * triage run for TF-0MVE3XFZ5005TPHP saw host load averages of 33-39 on a
 * 16-core box. A short fixed fallback therefore fired *before* the handlers
 * existed, so Node's default SIGTERM terminated the child (exit code `null`, no
 * `runtime serve` summary). This budget only bounds a genuine hang; the
 * readiness marker is what actually triggers the signal in the happy path.
 */
const SERVE_READY_TIMEOUT_MS = 60_000;

/**
 * Per-test budget for a serve spawn: the readiness budget plus time for the
 * child to boot, process input, shut down and flush its JSON summary, with
 * headroom for scheduler contention. Without it the global 20 s `testTimeout`
 * (vitest.config.ts) leaves no margin once the host is saturated.
 */
const SERVE_TEST_TIMEOUT_MS = 120_000;

/**
 * Extra time a signalled child gets before the harness escalates to SIGKILL.
 * Prevents a stuck child from outliving the test and leaving an orphan behind.
 */
const KILL_ESCALATION_MS = 5_000;

/**
 * Spawn `runtime start --serve --json`, feed *input* to stdin, then send
 * *signal* once the child is ready (when *readyMarker* appears on stdout) or
 * after *fallbackMs* as a safety net. Resolves once the child exits.
 *
 * *stderr* is captured so a failure reports *why* the child died instead of
 * just its exit code.
 */
async function runServeUntilSignal(
  input: string,
  signal: NodeJS.Signals,
  opts: { readyMarker?: string; fallbackMs?: number } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [
        join(PROJECT_ROOT, "bin", "dev-cli.js"),
        "runtime",
        "start",
        "--serve",
        "--json",
      ],
      { cwd: PROJECT_ROOT, stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    let signalled = false;
    let escalation: NodeJS.Timeout | undefined;
    const sendSignal = (): void => {
      if (signalled) return;
      signalled = true;
      child.kill(signal);
      escalation = setTimeout(() => child.kill("SIGKILL"), KILL_ESCALATION_MS);
    };
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (opts.readyMarker && stdout.includes(opts.readyMarker)) sendSignal();
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      clearTimeout(fallback);
      if (escalation) clearTimeout(escalation);
      resolvePromise({ code, stdout, stderr });
    });
    child.stdin.end(input);
    const fallback = setTimeout(
      sendSignal,
      opts.fallbackMs ?? SERVE_READY_TIMEOUT_MS,
    );
  });
}

// ── Help ──────────────────────────────────────────────────────────

describe("CLI runtime start — help", () => {
  it("shows start help with commands and options", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "start", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("runtime start");
    expect(stdout).toContain("state <name>");
    expect(stdout).toContain("--script");
    expect(stdout).toContain("--cache-size");
    expect(stdout).toContain("--iterations");
    expect(stdout).toContain("start [state]");
    expect(stdout).toContain("stop");
  });

  it("lists start in the runtime command help", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("runtime", "--help")));
    expect(code).toBe(0);
    expect(stdout).toContain("start");
    expect(stdout).toContain("demo");
  });
});

// ── Flag validation ───────────────────────────────────────────────

describe("CLI runtime start — flag validation", () => {
  it("rejects a non-integer seed", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("runtime", "start", "--seed", "abc", "--script", writeScript("quit\n"), "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("integer");
  });

  it("rejects a non-positive cache size", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("runtime", "start", "--cache-size", "0", "--script", writeScript("quit\n"), "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--cache-size");
  });

  it("reports a missing script file", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("runtime", "start", "--script", "does-not-exist.txt", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Failed to read");
  });

  it("requires an interactive terminal when no script is given", async () => {
    // The test process is not a TTY.
    const { code, stderr } = await captureOutput(() =>
      main(argv("runtime", "start", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("interactive terminal");
  });
});

// ── Scripted replay ───────────────────────────────────────────────

describe("CLI runtime start — --script --json", () => {
  it("streams one JSON object per runtime event and a summary", async () => {
    const script = writeScript(SESSION_SCRIPT);
    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "start", "--script", script, "--json")),
    );
    expect(code).toBe(0);

    const lines = stdout.split("\n").filter((l) => l.trim() !== "");
    const records = lines.map((l) => JSON.parse(l));

    const events = records.filter((r) => r.command === "runtime event");
    expect(events.length).toBeGreaterThan(0);

    const types = events.map((r) => r.event.type);
    expect(types).toContain("state_change");
    expect(types).toContain("context_change");
    expect(types).toContain("event_fire");

    const recipes = events
      .filter((r) => r.event.type === "event_fire")
      .map((r) => r.event.detail.resolvedRecipe);
    expect(recipes).toContain("footstep-stone");
    expect(recipes).toContain("footstep-gravel");

    const summary = records.find((r) => r.command === "runtime start");
    expect(summary).toBeDefined();
    expect(summary.script).toBe(script);
    expect(summary.commands).toBeGreaterThan(0);
    expect(summary.stats).toBeDefined();

    // The stop event must precede the summary.
    const stopIndex = records.findIndex(
      (r) => r.command === "runtime event" && r.event.type === "stop",
    );
    expect(stopIndex).toBeGreaterThanOrEqual(0);
    expect(stopIndex).toBeLessThan(records.indexOf(summary));
  });

  it("is deterministic across runs with the same script and seed", async () => {
    const script = writeScript(SESSION_SCRIPT);
    const run = async () => {
      const { stdout } = await captureOutput(() =>
        main(argv("runtime", "start", "--script", script, "--json")),
      );
      return stdout;
    };
    expect(await run()).toBe(await run());
  });

  it("honours the --seed override", async () => {
    const script = writeScript("state walk\nquit\n");
    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "start", "--seed", "7", "--script", script, "--json")),
    );
    expect(code).toBe(0);
    const records = stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const fires = records.filter(
      (r) => r.command === "runtime event" && r.event.type === "event_fire",
    );
    expect(fires[0].event.detail.eventSeed).toBe(7);
  });
});

describe("CLI runtime start — --script (human)", () => {
  it("prints command feedback and exits 0", async () => {
    const script = writeScript("help\nstate walk\nquit\n");
    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "start", "--script", script)),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("Commands:");
    expect(stdout).toContain("State: idle -> walk");
  });

  it("plays scheduled events through the host playback path", async () => {
    const playerModule = await import("./audio/player.js");
    vi.mocked(playerModule.playAudio).mockClear();

    // walk then sprint cancels the walk tasks; sprint schedules 3 short events.
    const script = writeScript("state walk\nstate sprint\nquit\n");
    const { code } = await captureOutput(() =>
      main(argv("runtime", "start", "--script", script)),
    );
    expect(code).toBe(0);
    expect(playerModule.playAudio).toHaveBeenCalled();
  });

  it("reports invalid commands without terminating", async () => {
    const script = writeScript("bogus\nstate nope\nstate walk\nquit\n");
    const { code, stdout, stderr } = await captureOutput(() =>
      main(argv("runtime", "start", "--script", script)),
    );
    expect(code).toBe(0);
    expect(stderr).toContain("Unknown command");
    expect(stdout).toContain("State: idle -> walk");
  });
});

// ── Service mode ──────────────────────────────────────────────────

describe("CLI runtime start — --serve", () => {
  it("lists --serve and the param command in help", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "start", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("--serve");
    expect(stdout).toContain("param <id> <name> <value>");
  });

  it("rejects --serve combined with --script", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(
        argv(
          "runtime",
          "start",
          "--serve",
          "--script",
          writeScript("quit\n"),
          "--json",
        ),
      ),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--serve");
  });

  it("stays alive after stdin closes and shuts down cleanly on SIGTERM", async () => {
    // `state walk` proves the runtime is live and processing input; stdin then
    // closes, but the service must keep running until the signal arrives.
    const { code, stdout, stderr } = await runServeUntilSignal(
      "state walk\n",
      "SIGTERM",
      { readyMarker: "state_change" },
    );
    expect(code, `child exited abnormally; stderr:\n${stderr}`).toBe(0);

    const records = stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    // Liveness: the signal is only sent once this event has been observed, so
    // its presence proves the service was up and processing stdin rather than
    // being killed during boot by the harness' safety net.
    expect(records.map((r) => r.event?.type)).toContain("state_change");
    const summary = records.find((r) => r.command === "runtime serve");
    expect(summary).toBeDefined();
    expect(summary.shutdownReason).toBe("signal:SIGTERM");
  }, SERVE_TEST_TIMEOUT_MS);

  it("shuts down cleanly on a quit command", async () => {
    // No readiness marker: the child must exit on its own once it has consumed
    // the piped `quit`. The fallback is only a safety net for a genuine hang;
    // its previous 10 s budget could fire before a loaded cold boot had
    // processed `quit`, killing the child with SIGKILL (exit code `null`).
    const { code, stdout, stderr } = await runServeUntilSignal(
      "state walk\nparam footstep-stone gain 0.5\nquit\n",
      "SIGKILL",
    );
    expect(code, `child exited abnormally; stderr:\n${stderr}`).toBe(0);

    const records = stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const summary = records.find((r) => r.command === "runtime serve");
    expect(summary).toBeDefined();
    expect(summary.shutdownReason).toBe("quit");
    const paramEvents = records.filter(
      (r) => r.command === "runtime event" && r.event.type === "parameter_change",
    );
    expect(paramEvents).toHaveLength(1);
  }, SERVE_TEST_TIMEOUT_MS);
});

// ── Continuous transport ──────────────────────────────────────────

describe("CLI runtime start — continuous transport", () => {
  it("rejects a negative --iterations", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("runtime", "start", "--iterations", "-1", "--script", writeScript("quit\n"), "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--iterations");
  });

  it("loops the transport for --iterations and reports the count", async () => {
    const script = writeScript("start walk\nquit\n");
    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "start", "--script", script, "--json", "--iterations", "1")),
    );
    expect(code).toBe(0);

    const records = stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const fires = records.filter(
      (r) => r.command === "runtime event" && r.event.type === "event_fire",
    );
    // One footstep per state activation + one per loop iteration.
    expect(fires.length).toBe(2);

    const summary = records.find((r) => r.command === "runtime start");
    expect(summary.stats.transportRunning).toBe(false);
    expect(summary.stats.iteration).toBe(1);
  });

  it("repeats seeds across iterations with --no-seed-variation", async () => {
    const script = writeScript("start walk\nquit\n");
    const { code, stdout } = await captureOutput(() =>
      main(argv(
        "runtime", "start", "--script", script, "--json",
        "--iterations", "1", "--no-seed-variation",
      )),
    );
    expect(code).toBe(0);

    const records = stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const seeds = records
      .filter((r) => r.command === "runtime event" && r.event.type === "event_fire")
      .map((r) => r.event.detail.eventSeed);
    expect(seeds.slice(0, 1)).toEqual(seeds.slice(1, 2));
  });
});
