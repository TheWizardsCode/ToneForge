/**
 * Audio environment probe: detect WSL / no-device environments and probe
 * real-time audio availability exactly once.
 *
 * Real-time playback needs a live output device. On WSL, in a container, or on
 * any machine without a reachable ALSA/JACK/PipeWire sink, constructing the
 * real-time engine (`node-web-audio-api`) throws — historically surfacing as a
 * raw cpal/ALSA traceback mid-note. This module probes availability up front so
 * the CLI can record `audioDeviceAvailable: false` and fail with an actionable,
 * UK-English message that names the alternatives (`--output` / `--fallback`).
 *
 * Both the engine factory and the system-info source are injectable, so the
 * probe is fully unit-testable without an audio device or a WSL host.
 *
 * Work item: TF-0MVBGEE6L005L7AG.
 */

import { readFileSync } from "node:fs";

import type { InstrumentDefinition } from "./schema.js";

/** A coarse classification of the host environment. */
export type AudioEnvironment = "wsl" | "linux" | "darwin" | "windows" | "unknown";

/**
 * Injectable system-information source.
 *
 * The CLI never hard-codes the host platform into its behaviour — everything
 * the probe needs to know about the environment comes through this seam.
 */
export interface SystemInfo {
  /** Return the contents of `/proc/version`, or `null` when unavailable. */
  readProcVersion(): string | null;
  /** Relevant environment variables (defaults to `process.env`). */
  env: Record<string, string | undefined>;
  /** The OS platform id (defaults to `process.platform`). */
  platform: string;
}

/** The real system-information source (reads the live host). */
export const realSystemInfo: SystemInfo = {
  readProcVersion: () => {
    try {
      return readFileSync("/proc/version", "utf-8");
    } catch {
      return null;
    }
  },
  env: process.env,
  platform: process.platform,
};

/** The outcome of a real-time audio availability probe. */
export interface AudioProbeResult {
  /** The detected environment classification. */
  readonly environment: AudioEnvironment;
  /** Whether a real-time output device is usable. */
  readonly audioDeviceAvailable: boolean;
}

/** A function that probes audio availability (injectable for tests). */
export type AudioProbe = () => Promise<AudioProbeResult>;

/** The minimal engine shape the probe needs (close the probe engine). */
export interface ProbeEngine {
  close?(): void;
}

/** Builds an engine for a definition; the probe only needs it to construct. */
export type ProbeEngineFactory = (
  definition: InstrumentDefinition,
) => ProbeEngine | Promise<ProbeEngine>;

/** A schema-valid, minimal definition used to exercise the engine factory. */
export const PROBE_INSTRUMENT_DEFINITION: InstrumentDefinition = {
  id: "__audio-probe__",
  name: "Audio Probe",
  category: "Probe",
  oscillator: { type: "sine" },
  envelope: { attack: 0, decay: 0, sustain: 1, release: 0 },
};

/** Options for {@link createAudioProbe}. */
export interface CreateAudioProbeOptions {
  /** The (injectable) real-time engine factory. */
  createEngine: ProbeEngineFactory;
  /** Injectable system-information source (default {@link realSystemInfo}). */
  systemInfo?: SystemInfo;
  /** Definition passed to the factory (default {@link PROBE_INSTRUMENT_DEFINITION}). */
  definition?: InstrumentDefinition;
}

function hasNonEmpty(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Classify the host environment.
 *
 * WSL is detected when `/proc/version` mentions "microsoft" (the Linux kernel
 * string WSL exposes) **or** when `WSL_DISTRO_NAME` / `WSL_INTEROP` is set —
 * the latter covers hardened environments where `/proc/version` is masked.
 *
 * @param info - The injectable system-information source.
 * @returns The environment classification.
 */
export function detectEnvironment(info: SystemInfo = realSystemInfo): AudioEnvironment {
  const procVersion = info.readProcVersion();
  if (
    (procVersion !== null && procVersion.toLowerCase().includes("microsoft"))
    || hasNonEmpty(info.env.WSL_DISTRO_NAME)
    || hasNonEmpty(info.env.WSL_INTEROP)
  ) {
    return "wsl";
  }
  switch (info.platform) {
    case "linux":
      return "linux";
    case "darwin":
      return "darwin";
    case "win32":
      return "windows";
    default:
      return "unknown";
  }
}

/**
 * Build an {@link AudioProbe} that attempts to create the real-time engine
 * exactly once via the injectable factory.
 *
 * The probe is deliberately failure-tolerant: any error from the factory
 * (notably `DeviceNotAvailable`) is recorded as `audioDeviceAvailable: false`
 * rather than propagated, so a missing device never crashes the daemon. A
 * successfully created probe engine is closed immediately to release the
 * audio context.
 *
 * @param options - The injectable engine factory and system-info source.
 * @returns The probe function.
 */
export function createAudioProbe(options: CreateAudioProbeOptions): AudioProbe {
  const systemInfo = options.systemInfo ?? realSystemInfo;
  const definition = options.definition ?? PROBE_INSTRUMENT_DEFINITION;
  return async (): Promise<AudioProbeResult> => {
    const environment = detectEnvironment(systemInfo);
    let audioDeviceAvailable = false;
    try {
      const engine = await options.createEngine(definition);
      engine?.close?.();
      audioDeviceAvailable = true;
    } catch {
      audioDeviceAvailable = false;
    }
    return { environment, audioDeviceAvailable };
  };
}

/**
 * Build the actionable, UK-English error shown when a sustained note is
 * requested without a live audio device.
 *
 * The message names the detected environment and suggests **both** offline
 * alternatives so the user can recover immediately.
 *
 * @param environment - The detected environment.
 * @param note - The MIDI note the user tried to play (<note> in the examples).
 * @returns The multi-line message (no trailing newline).
 */
export function buildNoAudioDeviceMessage(
  environment: AudioEnvironment,
  note: number,
): string {
  const prefix = environment === "wsl"
    ? "WSL detected — no live audio device is available."
    : "No live audio device is available on this system.";
  return [
    prefix,
    "Choose an offline alternative:",
    `  - render to a WAV you can play elsewhere: toneforge instrument noteon ${note} --output note.wav`,
    `  - play via an offline pre-render (playback starts after a short render delay): toneforge instrument noteon ${note} --fallback`,
  ].join("\n");
}

/**
 * Build a short capability hint for `instrument status` human output.
 *
 * @param environment - The detected environment.
 * @returns A one-line hint that names the environment and the alternatives.
 */
export function buildNoAudioDeviceHint(environment: AudioEnvironment): string {
  if (environment === "wsl") {
    return "WSL detected — no live audio device is available.";
  }
  return "No live audio device is available on this system.";
}
