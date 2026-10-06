/**
 * Audition controls (play / stop / loop) for the SoundEditor.
 *
 * Audio is created lazily and only after an explicit user gesture (browser
 * autoplay policy): before that an "Enable audio" affordance is shown and no
 * `AudioContext` exists. Playback uses the real-time Web Audio path, rendering
 * the current preset with `renderPreset` and playing it through a buffer source.
 *
 * Edits made while playing are picked up on the *next* render (loop boundary or
 * next Play) rather than mutating live nodes, so the previewed preset always
 * equals the current editor preset at render time.
 *
 * The audio context, source node and render function are injectable so the
 * control is unit-testable without a real Web Audio implementation.
 */

import type { RenderResult } from "@toneforge/core/renderer.js";
import type { SoundPreset } from "../../models/preset.js";
import { getAudioContext } from "@toneforge/audio/web-audio.js";

/** Minimal structural view of an AudioBuffer used by the audition control. */
export interface AuditionBuffer {
  length: number;
  getChannelData(channel: number): Float32Array;
}

/** Minimal structural view of an AudioBufferSourceNode. */
export interface AuditionSource {
  buffer: AuditionBuffer | null;
  loop: boolean;
  onended: (() => void) | null;
  connect(destination: unknown): void;
  disconnect(): void;
  start(when?: number): void;
  stop(): void;
}

/** Minimal structural view of a real-time AudioContext. */
export interface AuditionContext {
  readonly state: string;
  readonly destination: unknown;
  createBuffer(channels: number, length: number, sampleRate: number): AuditionBuffer;
  createBufferSource(): AuditionSource;
  resume(): Promise<void>;
  close(): Promise<void>;
}

/** Options accepted by {@link createAudition}. */
export interface AuditionOptions {
  /** Read the current editor preset (called at render time). */
  getPreset: () => SoundPreset;
  /** Render function (defaults to the core `renderPreset`). */
  render?: (preset: SoundPreset) => Promise<RenderResult>;
  /** Context factory (defaults to the cross-platform `getAudioContext`). */
  createContext?: () => AuditionContext;
  /** Accessible label for the control group. */
  label?: string;
}

/** Public audition control surface. */
export interface Audition {
  readonly element: HTMLElement;
  /** Render + play the current preset (no-op until audio is enabled). */
  play(): Promise<void>;
  /** Stop playback. */
  stop(): void;
  /** Current play/loop state for tests and hosts. */
  isPlaying(): boolean;
  isLooping(): boolean;
  isEnabled(): boolean;
  /** Release nodes and the audio context. Idempotent. */
  dispose(): void;
}

const defaultRender = async (preset: SoundPreset): Promise<RenderResult> => {
  const { renderPreset } = await import("@toneforge/core/renderer.js");
  return renderPreset(preset);
};

const defaultCreateContext = (): AuditionContext =>
  getAudioContext() as unknown as AuditionContext;

/** Create the audition control. */
export function createAudition(options: AuditionOptions): Audition {
  const render = options.render ?? defaultRender;
  const createContext = options.createContext ?? defaultCreateContext;

  const element = document.createElement("div");
  element.className = "tf-audition";
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", options.label ?? "Audition");

  const enableButton = document.createElement("button");
  enableButton.type = "button";
  enableButton.className = "tf-audition__enable";
  enableButton.textContent = "Enable audio";

  const controls = document.createElement("div");
  controls.className = "tf-audition__controls";
  controls.hidden = true;

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "tf-audition__play";
  playButton.textContent = "Play";

  const stopButton = document.createElement("button");
  stopButton.type = "button";
  stopButton.className = "tf-audition__stop";
  stopButton.textContent = "Stop";

  const loopButton = document.createElement("button");
  loopButton.type = "button";
  loopButton.className = "tf-audition__loop";
  loopButton.textContent = "Loop";
  loopButton.setAttribute("aria-pressed", "false");

  controls.append(playButton, stopButton, loopButton);

  const status = document.createElement("p");
  status.className = "tf-audition__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  element.append(enableButton, controls, status);

  let context: AuditionContext | null = null;
  let source: AuditionSource | null = null;
  let enabled = false;
  let playing = false;
  let looping = false;
  let disposed = false;

  function setStatus(message: string): void {
    status.textContent = message;
  }

  function wireInteractive(): void {
    enableButton.addEventListener("click", () => {
      void enable();
    });
    playButton.addEventListener("click", () => {
      void play();
    });
    stopButton.addEventListener("click", () => {
      stop();
    });
    loopButton.addEventListener("click", () => {
      loopButton.setAttribute("aria-pressed", String(!looping));
      looping = !looping;
    });
  }

  async function enable(): Promise<void> {
    if (disposed || enabled) {
      return;
    }
    try {
      context = createContext();
      await context.resume();
      enabled = true;
      enableButton.hidden = true;
      controls.hidden = false;
      setStatus("Audio enabled");
    } catch {
      enabled = false;
      enableButton.disabled = true;
      playButton.disabled = true;
      stopButton.disabled = true;
      loopButton.disabled = true;
      controls.hidden = false;
      setStatus("Audio is unavailable in this environment");
      element.dataset.state = "unsupported";
    }
  }

  function stopSource(): void {
    if (!source) {
      return;
    }
    source.onended = null;
    try {
      source.stop();
    } catch {
      // ignore stop() on a finished node
    }
    source.disconnect();
    source = null;
  }

  async function play(): Promise<void> {
    if (disposed || !enabled || !context) {
      return;
    }
    stopSource();
    const preset = options.getPreset();
    const result = await render(preset);
    if (disposed || !enabled || !context) {
      return;
    }
    const buffer = context.createBuffer(
      result.numberOfChannels,
      result.samples.length,
      result.sampleRate,
    );
    buffer.getChannelData(0).set(result.samples);
    const nextSource = context.createBufferSource();
    nextSource.buffer = buffer;
    nextSource.loop = false;
    nextSource.connect(context.destination);
    nextSource.onended = () => handleEnded(nextSource);
    source = nextSource;
    playing = true;
    nextSource.start(0);
    setStatus("Playing");
  }

  function handleEnded(endedSource: AuditionSource): void {
    if (source !== endedSource) {
      return;
    }
    source = null;
    if (disposed || !playing) {
      return;
    }
    if (looping) {
      void play();
    } else {
      playing = false;
      setStatus("Stopped");
    }
  }

  function stop(): void {
    if (disposed) {
      return;
    }
    playing = false;
    stopSource();
    setStatus("Stopped");
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    playing = false;
    stopSource();
    if (context) {
      const toClose = context;
      context = null;
      enabled = false;
      void toClose.close();
    }
    element.remove();
  }

  wireInteractive();

  return {
    element,
    play,
    stop,
    isPlaying: () => playing,
    isLooping: () => looping,
    isEnabled: () => enabled,
    dispose,
  };
}
