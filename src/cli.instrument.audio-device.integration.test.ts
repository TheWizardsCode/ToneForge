/**
 * CLI integration tests for audio-device / WSL detection in
 * `toneforge instrument`.
 *
 * These run the real CLI entry (`main`) against an in-process instrument
 * daemon whose engine factory throws `DeviceNotAvailable` and whose system-info
 * source reports WSL. Everything is injectable, so the no-device behaviour is
 * asserted hermetically — no WSL host and no audio device are required.
 *
 * Work item: TF-0MVBGEE6L005L7AG.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";

vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

import { main } from "./cli.js";
import { playAudio } from "./audio/player.js";
import type { InstrumentEngineFactory } from "./instruments/daemon.js";
import { createInstrumentDaemon, type InstrumentDaemon } from "./instruments/daemon.js";
import type { SystemInfo } from "./instruments/audio-probe.js";
import {
  instrumentRegistry,
  loadBundledInstrumentPresets,
} from "./instruments/presets.js";

const WSL_SYSTEM_INFO: SystemInfo = {
  readProcVersion: () => "Linux version 5.15.90.1-microsoft-standard-WSL2",
  env: { WSL_DISTRO_NAME: "Ubuntu" },
  platform: "linux",
};

const PLAIN_LINUX_SYSTEM_INFO: SystemInfo = {
  readProcVersion: () => "Linux version 6.1.0",
  env: {},
  platform: "linux",
};

/** A factory whose real-time engine construction always fails. */
const throwingEngineFactory: InstrumentEngineFactory = () => {
  throw new Error("DeviceNotAvailable: ALSA Unknown PCM default");
};

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

let socketPath: string;
let daemon: InstrumentDaemon | null = null;
let prevSocketEnv: string | undefined;

beforeEach(async () => {
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();
  vi.mocked(playAudio).mockClear();

  socketPath = join(
    tmpdir(),
    `toneforge-audio-device-cli-${process.pid}-${Math.random().toString(36).slice(2)}.sock`,
  );
  prevSocketEnv = process.env.TONEFORGE_INSTRUMENT_SOCKET;
  process.env.TONEFORGE_INSTRUMENT_SOCKET = socketPath;
});

afterEach(async () => {
  await daemon?.stop("test-cleanup");
  daemon = null;
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

/** Start an in-process daemon with the given probe inputs. */
async function startDaemon(options: {
  createEngine: InstrumentEngineFactory;
  systemInfo: SystemInfo;
}): Promise<InstrumentDaemon> {
  daemon = createInstrumentDaemon({
    socketPath,
    createEngine: options.createEngine,
    systemInfo: options.systemInfo,
    loadPresets: async () => [],
    idleTimeoutMs: 0,
  });
  await daemon.start();
  return daemon;
}

describe("instrument noteon without a live audio device", () => {
  it("exits 1 with a UK-English WSL message suggesting both alternatives", async () => {
    await startDaemon({ createEngine: throwingEngineFactory, systemInfo: WSL_SYSTEM_INFO });

    const result = await captureOutput(() => main(argv("instrument", "noteon", "60")));
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("WSL detected");
    expect(result.stderr).toContain("--output");
    expect(result.stderr).toContain("--fallback");
    expect(result.stderr).toMatch(/render delay/i);
    // No raw cpal/ALSA diagnostics or JS stack trace leak to the user.
    expect(result.stderr).not.toContain("DeviceNotAvailable");
    expect(result.stderr).not.toMatch(/\n\s+at\s+\S+/);
  });

  it("names a generic missing device outside WSL", async () => {
    await startDaemon({
      createEngine: throwingEngineFactory,
      systemInfo: PLAIN_LINUX_SYSTEM_INFO,
    });

    const result = await captureOutput(() => main(argv("instrument", "noteon", "64")));
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("No live audio device");
    expect(result.stderr).not.toContain("WSL detected");
    expect(result.stderr).toContain("--output");
    expect(result.stderr).toContain("--fallback");
  });

  it("emits structured JSON with the environment and capabilities", async () => {
    await startDaemon({ createEngine: throwingEngineFactory, systemInfo: WSL_SYSTEM_INFO });

    const result = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--json")),
    );
    expect(result.code).toBe(1);
    const parsed = JSON.parse(result.stderr) as {
      ok: boolean;
      code: string;
      environment: string;
      audioDeviceAvailable: boolean;
      error: string;
    };
    expect(parsed).toMatchObject({
      ok: false,
      code: "no_audio_device",
      environment: "wsl",
      audioDeviceAvailable: false,
    });
    expect(parsed.error).toContain("--output");
    expect(parsed.error).toContain("--fallback");
  });
});

describe("instrument status reports audio capability", () => {
  it("includes environment, audioDeviceAvailable and notes in --json", async () => {
    await startDaemon({ createEngine: throwingEngineFactory, systemInfo: WSL_SYSTEM_INFO });

    const result = await captureOutput(() => main(argv("instrument", "status", "--json")));
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      environment: string;
      audioDeviceAvailable: boolean;
      notes: unknown[];
    };
    expect(parsed.environment).toBe("wsl");
    expect(parsed.audioDeviceAvailable).toBe(false);
    expect(parsed.notes).toEqual([]);
  });

  it("shows a hint in human output when audio is unavailable", async () => {
    await startDaemon({ createEngine: throwingEngineFactory, systemInfo: WSL_SYSTEM_INFO });

    const result = await captureOutput(() => main(argv("instrument", "status")));
    expect(result.code).toBe(0);
    // The warning hint is emitted on stderr; the alternatives on stdout.
    expect(result.stderr).toContain("WSL");
    expect(result.stdout).toContain("--output");
    expect(result.stdout).toContain("--fallback");
  });
});

describe("instrument metadata commands never crash without a device", () => {
  beforeEach(async () => {
    await startDaemon({ createEngine: throwingEngineFactory, systemInfo: WSL_SYSTEM_INFO });
  });

  it("stop exits 0", async () => {
    const result = await captureOutput(() => main(argv("instrument", "stop")));
    expect(result.code).toBe(0);
  });

  it("presets exits 0 and lists the bundled presets", async () => {
    const result = await captureOutput(() => main(argv("instrument", "presets")));
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("pluck");
  });

  it("noteoff --json returns valid JSON (no crash) for an unheld note", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "noteoff", "60", "--json")),
    );
    expect(result.code).toBe(1);
    const parsed = JSON.parse(result.stderr) as { ok: boolean; error: string };
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("not currently held");
  });
});

describe("offline alternatives still work without a device", () => {
  beforeEach(async () => {
    await startDaemon({ createEngine: throwingEngineFactory, systemInfo: WSL_SYSTEM_INFO });
  });

  it("--output renders a WAV regardless of device availability", async () => {
    const target = join(
      tmpdir(),
      `tf-no-device-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`,
    );
    const result = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--length", "0.2", "--output", target)),
    );
    expect(result.code).toBe(0);
    expect(existsSync(target)).toBe(true);
    rmSync(target, { force: true });
  });

  it("--fallback plays the pre-rendered note through the system player", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--length", "0.2", "--fallback")),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("offline pre-render");
    expect(playAudio).toHaveBeenCalledTimes(1);
  });
});
