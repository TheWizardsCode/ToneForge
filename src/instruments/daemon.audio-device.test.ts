/**
 * Device-probe tests for the instrument daemon
 * (`src/instruments/daemon.ts`).
 *
 * The daemon probes real-time audio availability exactly once at startup via
 * the injectable engine factory. These tests inject (i) a factory that throws
 * `DeviceNotAvailable` and (ii) an injectable system-info source, so the WSL /
 * no-device behaviour is asserted without touching the host.
 *
 * Work item: TF-0MVBGEE6L005L7AG.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import type { InstrumentDaemon, InstrumentEngineFactory } from "./daemon.js";
import { createInstrumentDaemon } from "./daemon.js";
import type { SystemInfo } from "./audio-probe.js";
import {
  instrumentRegistry,
  loadBundledInstrumentPresets,
} from "./presets.js";

const TEST_PRESET = "pluck";

/** System info that always reports WSL. */
const wslSystemInfo: SystemInfo = {
  readProcVersion: () => "Linux version 5.15.90.1-microsoft-standard-WSL2",
  env: { WSL_DISTRO_NAME: "Ubuntu" },
  platform: "linux",
};

/** A factory whose real-time engine construction always fails. */
function throwingEngineFactory(message = "DeviceNotAvailable: ALSA Unknown PCM default"): {
  factory: InstrumentEngineFactory;
  calls: number;
} {
  const state = { calls: 0 };
  const factory: InstrumentEngineFactory = () => {
    state.calls += 1;
    throw new Error(message);
  };
  return {
    get factory() {
      return factory;
    },
    get calls() {
      return state.calls;
    },
  };
}

/** A factory that succeeds and records whether its engine was closed. */
function workingEngineFactory(): {
  factory: InstrumentEngineFactory;
  closed: { value: boolean };
} {
  const closed = { value: false };
  return {
    factory: () => ({
      noteOn: () => {},
      noteOff: () => {},
      close: () => {
        closed.value = true;
      },
    }),
    closed,
  };
}

let daemon: InstrumentDaemon | null = null;
let socketPath: string;

beforeEach(async () => {
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();
  socketPath = `/tmp/toneforge-audio-device-${process.pid}-${Math.random().toString(36).slice(2)}.sock`;
});

afterEach(async () => {
  await daemon?.stop("test-cleanup");
  daemon = null;
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();
});

function makeDaemon(options: {
  createEngine: InstrumentEngineFactory;
  systemInfo?: SystemInfo;
}): InstrumentDaemon {
  daemon = createInstrumentDaemon({
    socketPath,
    createEngine: options.createEngine,
    systemInfo: options.systemInfo,
    defaultPreset: TEST_PRESET,
    loadPresets: async () => [],
    idleTimeoutMs: 0,
  });
  return daemon;
}

describe("instrument daemon audio-device probe", () => {
  it("records audioDeviceAvailable: false and the environment on startup", async () => {
    const throwing = throwingEngineFactory();
    const d = makeDaemon({ createEngine: throwing.factory, systemInfo: wslSystemInfo });

    await d.start();

    const status = await d.handle({ cmd: "status" });
    expect(status).toMatchObject({
      ok: true,
      environment: "wsl",
      audioDeviceAvailable: false,
    });
    expect(status.notes).toEqual([]);
  });

  it("reports an actionable no_audio_device error for a sustained noteon", async () => {
    const d = makeDaemon({
      createEngine: throwingEngineFactory().factory,
      systemInfo: wslSystemInfo,
    });
    await d.start();

    const on = await d.handle({ cmd: "noteon", note: 60 });
    expect(on).toMatchObject({
      ok: false,
      cmd: "noteon",
      code: "no_audio_device",
      environment: "wsl",
    });
  });

  it("probes the real-time factory exactly once", async () => {
    const throwing = throwingEngineFactory();
    const d = makeDaemon({ createEngine: throwing.factory, systemInfo: wslSystemInfo });
    await d.start();
    await d.start(); // idempotent

    await d.handle({ cmd: "status" });
    await d.handle({ cmd: "noteon", note: 60 });
    await d.handle({ cmd: "noteon", note: 64 });

    expect(throwing.calls).toBe(1);
  });

  it("records audioDeviceAvailable: true when the factory succeeds", async () => {
    const working = workingEngineFactory();
    const d = makeDaemon({
      createEngine: working.factory,
      systemInfo: { readProcVersion: () => null, env: {}, platform: "darwin" },
    });
    await d.start();

    const status = await d.handle({ cmd: "status" });
    expect(status).toMatchObject({ environment: "darwin", audioDeviceAvailable: true });
    expect(working.closed.value).toBe(true);
  });

  it("does not crash metadata commands when the device is unavailable", async () => {
    const d = makeDaemon({
      createEngine: throwingEngineFactory().factory,
      systemInfo: wslSystemInfo,
    });
    await d.start();

    await expect(d.handle({ cmd: "status" })).resolves.toMatchObject({ ok: true });
    await expect(d.handle({ cmd: "ping" })).resolves.toMatchObject({ ok: true });

    // Note Off for an unheld note is a clean protocol error, not a crash.
    const off = await d.handle({ cmd: "noteoff", note: 60 });
    expect(off).toMatchObject({ ok: false, code: "note_not_held" });

    // stop resolves without touching the (throwing) engine factory.
    await expect(d.stop("test")).resolves.toBeUndefined();
    daemon = null;
  });
});
