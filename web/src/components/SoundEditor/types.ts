/**
 * Public types for the embeddable SoundEditor.
 *
 * The editor is framework-agnostic: it depends only on DOM types and the
 * preset shape, never on ToneForge internals or a UI framework.
 */

/** Current SoundPreset schema version. */
export const SOUND_PRESET_VERSION = 1;

/**
 * Versioned, deterministic description of a single sound.
 *
 * `overrides` are parameter values applied on top of the seed-derived
 * defaults; an empty object means "use the seed exactly as generated".
 */
export interface SoundPreset {
  version: number;
  recipe: string;
  seed: number;
  overrides: Record<string, number>;
}

/** Callback invoked with the current preset whenever editor state changes. */
export type SoundPresetListener = (preset: SoundPreset) => void;

/**
 * Minimal audio-engine seam.
 *
 * The editor never constructs an AudioContext during mount; an engine (built by
 * later slices) is supplied by the host and disposed by the editor.
 */
export interface AudioEngine {
  /** Release audio resources. Invoked once by `dispose()`. */
  dispose?: () => void;
}

/** Options accepted by {@link createSoundEditor}. */
export interface SoundEditorOptions {
  /** Initial preset. Defaults to a minimal valid preset. */
  preset?: SoundPreset;
  /** Optional audio engine to dispose with the editor. */
  audioEngine?: AudioEngine;
  /** Accessible label for the editor region. Defaults to "Sound editor". */
  label?: string;
}

/**
 * Framework-agnostic controller returned by {@link createSoundEditor}.
 *
 * Lifecycle: `mount()` renders the editor into a host container; `dispose()`
 * tears everything down and is idempotent. All methods throw after dispose.
 */
export interface SoundEditorController {
  /** Render the editor into `container`. Re-mounting replaces the previous root. */
  mount(container: HTMLElement): void;
  /** Remove all DOM, listeners, observers, timers and audio resources. Idempotent. */
  dispose(): void;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  onChange(listener: SoundPresetListener): () => void;
  /** Snapshot of the current preset (a defensive copy). */
  getPreset(): SoundPreset;
  /** Replace the current preset; notifies `onChange` listeners when it changes. */
  setPreset(preset: SoundPreset): void;
}
