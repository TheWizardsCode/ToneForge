/**
 * CLI integration tests for `toneforge instrument noteon` / `noteoff`.
 *
 * Runs the real CLI entry (`main`) against an in-process instrument daemon
 * backed by a silent engine and a fake clock, so the sustained-playback
 * semantics, `--length` auto Note Off, validation and JSON output are all
 * exercised headlessly (no audio device, no real timers).
 *
 * Work item: TF-0MVBECXFJ006SSW4.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

import { main } from "./cli.js";
import {
  createInstrumentDaemon,
  createNullEngineFactory,
  type InstrumentDaemon,
  type DaemonClock,
} from "./instruments/daemon.js";
import {
  instrumentRegistry,
  loadBundledInstrumentPresets,
} from "./instruments/presets.js";

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

/** Deterministic fake clock so `--length` fires without wall-clock waits. */
function createFakeClock(startMs = 0) {
  let now = startMs;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: DaemonClock & { advance: (ms: number) => void } = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
    advance: (ms) => {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
  };
  return clock;
}

let socketPath: string;
let daemon: InstrumentDaemon | null = null;
let clock: ReturnType<typeof createFakeClock>;
let prevSocketEnv: string | undefined;

beforeEach(async () => {
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();

  socketPath = join(
    tmpdir(),
    `toneforge-cli-test-${process.pid}-${Math.random().toString(36).slice(2)}.sock`,
  );
  prevSocketEnv = process.env.TONEFORGE_INSTRUMENT_SOCKET;
  process.env.TONEFORGE_INSTRUMENT_SOCKET = socketPath;

  clock = createFakeClock(0);
  daemon = createInstrumentDaemon({
    socketPath,
    createEngine: createNullEngineFactory(),
    clock,
    idleTimeoutMs: 0,
  });
  await daemon.start();
});

afterEach(async () => {
  if (daemon) {
    await daemon.stop("test-cleanup");
    daemon = null;
  }
  if (prevSocketEnv === undefined) {
    delete process.env.TONEFORGE_INSTRUMENT_SOCKET;
  } else {
    process.env.TONEFORGE_INSTRUMENT_SOCKET = prevSocketEnv;
  }
  try {
    rmSync(socketPath, { force: true });
  } catch {
    /* ignore */
  }
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();
});

// ── Help ──────────────────────────────────────────────────────────

describe("instrument help", () => {
  it("is listed in the top-level help", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("--help")));
    expect(code).toBe(0);
    expect(stdout).toContain("instrument");
    expect(stdout).toContain("Demo live MIDI note playback");
  });

  it("documents noteon options and the hold semantics", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("instrument", "noteon", "--help")));
    expect(code).toBe(0);
    expect(stdout).toContain("instrument noteon");
    expect(stdout).toContain("--preset");
    expect(stdout).toContain("--velocity");
    expect(stdout).toContain("--length");
    expect(stdout).toMatch(/keeps sounding until/i);
  });

  it("documents the group subcommands", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("instrument", "--help")));
    expect(code).toBe(0);
    expect(stdout).toContain("noteon");
    expect(stdout).toContain("noteoff");
    expect(stdout).toContain("status");
    expect(stdout).toContain("stop");
  });
});

// ── Sustained playback ────────────────────────────────────────────

describe("instrument noteon / noteoff", () => {
  it("holds a note across two sequential invocations and releases it", async () => {
    const on = await captureOutput(() => main(argv("instrument", "noteon", "60")));
    expect(on.code).toBe(0);
    expect(on.stdout).toContain("Holding note 60");
    expect(daemon!.heldNotes().map((n) => n.note)).toEqual([60]);

    // The note is still sounding between invocations.
    const status = await captureOutput(() => main(argv("instrument", "status")));
    expect(status.code).toBe(0);
    expect(status.stdout).toContain("note 60");

    const off = await captureOutput(() => main(argv("instrument", "noteoff", "60")));
    expect(off.code).toBe(0);
    expect(off.stdout).toContain("Released note 60");
    expect(daemon!.heldNotes()).toHaveLength(0);
  });

  it("releases only the matching note of a chord", async () => {
    for (const note of ["60", "64", "67"]) {
      const result = await captureOutput(() => main(argv("instrument", "noteon", note)));
      expect(result.code).toBe(0);
    }
    const off = await captureOutput(() => main(argv("instrument", "noteoff", "64")));
    expect(off.code).toBe(0);

    const status = await captureOutput(() => main(argv("instrument", "status", "--json")));
    expect(status.code).toBe(0);
    const parsed = JSON.parse(status.stdout) as { notes: Array<{ note: number }> };
    expect(parsed.notes.map((n) => n.note).sort()).toEqual([60, 67]);
  });

  it("fails with a clear message for an unmatched noteoff", async () => {
    const off = await captureOutput(() => main(argv("instrument", "noteoff", "60")));
    expect(off.code).toBe(1);
    expect(off.stderr).toContain("not currently held");
  });

  it("applies --preset and --velocity", async () => {
    const on = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--preset", "pad", "--velocity", "90")),
    );
    expect(on.code).toBe(0);
    expect(on.stdout).toContain("pad");
    expect(on.stdout).toContain("90");
    expect(daemon!.heldNotes()[0]).toMatchObject({ note: 60, velocity: 90, preset: "pad" });
  });

  it("emits JSON when --json is set", async () => {
    const on = await captureOutput(() => main(argv("instrument", "noteon", "60", "--json")));
    expect(on.code).toBe(0);
    expect(JSON.parse(on.stdout)).toMatchObject({
      ok: true,
      command: "instrument-noteon",
      note: 60,
      preset: "pluck",
    });

    const off = await captureOutput(() => main(argv("instrument", "noteoff", "60", "--json")));
    expect(JSON.parse(off.stdout)).toMatchObject({ ok: true, command: "instrument-noteoff", note: 60 });
  });
});

// ── --length ──────────────────────────────────────────────────────

describe("instrument noteon --length", () => {
  it("sends the matching Note Off automatically after the duration", async () => {
    const on = await captureOutput(() => main(argv("instrument", "noteon", "67", "--length", "0.5")));
    expect(on.code).toBe(0);
    expect(on.stdout).toContain("automatically after 0.5s");
    expect(daemon!.heldNotes().map((n) => n.note)).toEqual([67]);

    clock.advance(499);
    await new Promise((r) => setTimeout(r, 0));
    expect(daemon!.heldNotes().map((n) => n.note)).toEqual([67]);

    clock.advance(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(daemon!.heldNotes()).toHaveLength(0);
  });

  it("rejects a non-positive --length", async () => {
    const on = await captureOutput(() => main(argv("instrument", "noteon", "60", "--length", "0")));
    expect(on.code).toBe(1);
    expect(on.stderr).toContain("--length");
    expect(daemon!.heldNotes()).toHaveLength(0);
  });
});

// ── Validation ────────────────────────────────────────────────────

describe("instrument validation", () => {
  it.each(["128", "-1", "60.5", "abc"])("rejects an invalid note '%s'", async (note) => {
    const on = await captureOutput(() => main(argv("instrument", "noteon", note)));
    expect(on.code).toBe(1);
    expect(on.stderr).toContain("invalid MIDI note");
    expect(daemon!.heldNotes()).toHaveLength(0);
  });

  it.each(["0", "128", "abc"])("rejects an invalid velocity '%s'", async (velocity) => {
    const on = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--velocity", velocity)),
    );
    expect(on.code).toBe(1);
    expect(on.stderr).toContain("--velocity");
  });

  it("rejects an unknown preset and lists the available ones", async () => {
    const on = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--preset", "not-a-preset")),
    );
    expect(on.code).toBe(1);
    expect(on.stderr).toContain("not-a-preset");
    expect(on.stderr).toContain("Available presets");
  });
});

// ── status / presets / stop ───────────────────────────────────────

describe("instrument status, presets and stop", () => {
  it("reports held notes and an empty state", async () => {
    const empty = await captureOutput(() => main(argv("instrument", "status")));
    expect(empty.stdout).toContain("No notes are currently held");

    await captureOutput(() => main(argv("instrument", "noteon", "60")));
    await captureOutput(() => main(argv("instrument", "noteon", "64")));
    const held = await captureOutput(() => main(argv("instrument", "status")));
    expect(held.stdout).toContain("note 60");
    expect(held.stdout).toContain("note 64");
  });

  it("lists the bundled instrument presets", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("instrument", "presets")));
    expect(code).toBe(0);
    for (const id of ["pluck", "pad", "bass", "bell", "string-lead"]) {
      expect(stdout).toContain(id);
    }
  });

  it("stops the daemon and releases held notes", async () => {
    await captureOutput(() => main(argv("instrument", "noteon", "60")));
    const stop = await captureOutput(() => main(argv("instrument", "stop")));
    expect(stop.code).toBe(0);
    expect(stop.stdout).toContain("Stopped the instrument daemon");

    // The fake daemon object shared by the test reflects the release.
    await daemon!.whenStopped();
    expect(daemon!.heldNotes()).toHaveLength(0);
  });

  it("is a no-op when stopping a daemon that is not running", async () => {
    await daemon!.stop("test");
    daemon = null;
    await new Promise((r) => setTimeout(r, 10));
    const stop = await captureOutput(() => main(argv("instrument", "stop")));
    expect(stop.code).toBe(0);
  });

  it("rejects an unknown subcommand", async () => {
    const result = await captureOutput(() => main(argv("instrument", "nope")));
    expect(result.code).toBe(1);
  });
});
