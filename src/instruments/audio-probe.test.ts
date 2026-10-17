/**
 * Unit tests for the audio environment probe
 * (`src/instruments/audio-probe.ts`).
 *
 * The probe detects WSL / device-less environments and attempts to create the
 * real-time engine exactly once, so the CLI can fail with an actionable
 * message instead of a raw cpal/ALSA traceback. The system-info source and the
 * engine factory are both injectable, so these tests are hermetic — no audio
 * device and no WSL host are required.
 *
 * Work item: TF-0MVBGEE6L005L7AG.
 */

import { describe, it, expect, vi } from "vitest";

import {
  createAudioProbe,
  detectEnvironment,
  buildNoAudioDeviceMessage,
  buildNoAudioDeviceHint,
  PROBE_INSTRUMENT_DEFINITION,
  type SystemInfo,
} from "./audio-probe.js";
import type { InstrumentDefinition } from "./schema.js";

/** Build an injectable system-info source with sensible defaults. */
function systemInfo(overrides: Partial<SystemInfo> = {}): SystemInfo {
  return {
    readProcVersion: () => "Linux version 5.15.0 (generic)",
    env: {},
    platform: "linux",
    ...overrides,
  };
}

/** A minimal engine double that records whether it was closed. */
function makeEngine(closed: { value: boolean }) {
  return {
    noteOn: () => {},
    noteOff: () => {},
    close: () => {
      closed.value = true;
    },
  };
}

describe("detectEnvironment", () => {
  it("detects WSL from a Microsoft /proc/version", () => {
    const info = systemInfo({
      readProcVersion: () => "Linux version 5.15.90.1-microsoft-standard-WSL2",
    });
    expect(detectEnvironment(info)).toBe("wsl");
  });

  it("detects WSL from WSL_DISTRO_NAME when /proc/version is unavailable", () => {
    const info = systemInfo({
      readProcVersion: () => null,
      env: { WSL_DISTRO_NAME: "Ubuntu" },
    });
    expect(detectEnvironment(info)).toBe("wsl");
  });

  it("detects WSL from WSL_INTEROP", () => {
    const info = systemInfo({
      readProcVersion: () => null,
      env: { WSL_INTEROP: "/run/WSL/8_interop" },
    });
    expect(detectEnvironment(info)).toBe("wsl");
  });

  it("does not treat an empty WSL_DISTRO_NAME as WSL", () => {
    const info = systemInfo({
      readProcVersion: () => "Linux version 6.1.0",
      env: { WSL_DISTRO_NAME: "" },
    });
    expect(detectEnvironment(info)).toBe("linux");
  });

  it.each([
    ["linux", "linux"],
    ["darwin", "darwin"],
    ["win32", "windows"],
    ["freebsd", "unknown"],
  ] as const)("maps platform %s to %s", (platform, expected) => {
    const info = systemInfo({ readProcVersion: () => null, platform });
    expect(detectEnvironment(info)).toBe(expected);
  });
});

describe("createAudioProbe", () => {
  it("reports the device as available and closes the probe engine on success", async () => {
    const closed = { value: false };
    const createEngine = vi.fn().mockResolvedValue(makeEngine(closed));
    const probe = createAudioProbe({
      createEngine,
      systemInfo: systemInfo({ readProcVersion: () => null, platform: "darwin" }),
    });

    await expect(probe()).resolves.toEqual({
      environment: "darwin",
      audioDeviceAvailable: true,
    });
    expect(createEngine).toHaveBeenCalledWith(PROBE_INSTRUMENT_DEFINITION);
    expect(closed.value).toBe(true);
  });

  it("reports the device as unavailable when the factory throws DeviceNotAvailable", async () => {
    const createEngine = vi.fn(() => {
      throw new Error("DeviceNotAvailable: ALSA Unknown PCM default");
    });
    const probe = createAudioProbe({
      createEngine,
      systemInfo: systemInfo({
        readProcVersion: () => "Linux version 5.15.90.1-microsoft-standard-WSL2",
      }),
    });

    await expect(probe()).resolves.toEqual({
      environment: "wsl",
      audioDeviceAvailable: false,
    });
  });

  it("reports the device as unavailable when the factory rejects", async () => {
    const createEngine = vi.fn().mockRejectedValue(new Error("no output device"));
    const probe = createAudioProbe({
      createEngine,
      systemInfo: systemInfo({ readProcVersion: () => null }),
    });

    await expect(probe()).resolves.toEqual({
      environment: "linux",
      audioDeviceAvailable: false,
    });
  });

  it("accepts a bare engine without a close method", async () => {
    const createEngine = vi.fn().mockReturnValue({});
    const probe = createAudioProbe({
      createEngine,
      systemInfo: systemInfo({ readProcVersion: () => null }),
    });

    await expect(probe()).resolves.toMatchObject({ audioDeviceAvailable: true });
  });

  it("uses a caller-supplied instrument definition", async () => {
    const definition: InstrumentDefinition = {
      id: "probe-test",
      name: "Probe Test",
      oscillator: { type: "square" },
      envelope: { attack: 0, decay: 0, sustain: 1, release: 0 },
    };
    const createEngine = vi.fn().mockReturnValue({});
    const probe = createAudioProbe({
      createEngine,
      systemInfo: systemInfo({ readProcVersion: () => null }),
      definition,
    });

    await probe();
    expect(createEngine).toHaveBeenCalledWith(definition);
  });
});

describe("buildNoAudioDeviceMessage", () => {
  it("names WSL and suggests both offline alternatives", () => {
    const message = buildNoAudioDeviceMessage("wsl", 60);
    expect(message).toContain("WSL detected");
    expect(message).toContain("--output");
    expect(message).toContain("--fallback");
    expect(message).toContain("60");
    expect(message).toMatch(/render delay/i);
  });

  it("names a generic missing device for non-WSL environments", () => {
    const message = buildNoAudioDeviceMessage("linux", 67);
    expect(message).toContain("No live audio device");
    expect(message).not.toContain("WSL detected");
    expect(message).toContain("--output");
    expect(message).toContain("--fallback");
  });
});

describe("buildNoAudioDeviceHint", () => {
  it("mentions WSL when the environment is WSL", () => {
    expect(buildNoAudioDeviceHint("wsl")).toContain("WSL");
  });

  it("uses a generic hint otherwise", () => {
    expect(buildNoAudioDeviceHint("unknown")).toContain("No live audio device");
  });
});
