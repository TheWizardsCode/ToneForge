/**
 * Offline instrument demo: render a single Note On/Note Off into physical
 * samples with **no audio device** (used by `tf instrument noteon
 * --output <file.wav>` and `--fallback`).
 *
 * Sustained real-time playback needs a live output device; this module is the
 * device-free path that turns the same CLI arguments into a deterministic
 * render through the existing `renderInstrument` engine. It is deliberately a
 * thin adapter — no new synthesis — and stays Web Audio-agnostic so it is safe
 * for the web bundle.
 *
 * Work item: TF-0MVBGEDQI008W4VH (child of TF-0MV9PIBNV008C00R).
 */

import { renderInstrument, type InstrumentEvent, type RenderedInstrument } from "./engine.js";
import { getInstrument } from "./presets.js";
import type { InstrumentDefinition } from "./schema.js";

/** Default note-on → note-off hold when `--length` is omitted. */
export const DEFAULT_NOTE_HOLD_SECONDS = 1.0;

/** Options for {@link renderNoteOffline}. */
export interface RenderNoteOfflineOptions {
  /** MIDI note number (0–127). */
  note: number;
  /** MIDI velocity (1–127). */
  velocity: number;
  /** Registered preset id (e.g. `pluck`, `pad`, `bell`). */
  presetId: string;
  /** Note-on → note-off hold in seconds (default {@link DEFAULT_NOTE_HOLD_SECONDS}). */
  holdSeconds?: number;
  /** Extra silent tail after the final event (default engine tail 0.2 s). */
  tail?: number;
  /** Sample rate (default engine 44100 Hz). */
  sampleRate?: number;
}

/**
 * Resolve a registered preset's definition by id, or null.
 *
 * Presets must be loaded first (`loadBundledInstrumentPresets()` or direct
 * registration) — the caller owns registry lifetime.
 */
export function resolveInstrumentDefinition(
  presetId: string,
): InstrumentDefinition | null {
  return getInstrument(presetId)?.definition ?? null;
}

/**
 * Build the Note On/Note Off event pair for a held note.
 *
 * Note On at t=0; Note Off at `holdSeconds` (release velocity 0 — the engine
 * only needs the note number for the release).
 */
export function buildNoteEvents(
  note: number,
  velocity: number,
  holdSeconds: number,
): InstrumentEvent[] {
  return [
    { type: "midiNoteOn", note, velocity, time: 0 },
    { type: "midiNoteOff", note, velocity: 0, time: holdSeconds },
  ];
}

/**
 * Render a single held note offline and return the samples.
 *
 * @throws {Error} If the preset id is not registered.
 */
export async function renderNoteOffline(
  options: RenderNoteOfflineOptions,
): Promise<RenderedInstrument> {
  const definition = resolveInstrumentDefinition(options.presetId);
  if (!definition) {
    throw new Error(`Unknown instrument preset '${options.presetId}'.`);
  }
  const hold = options.holdSeconds ?? DEFAULT_NOTE_HOLD_SECONDS;
  return renderInstrument(
    definition,
    buildNoteEvents(options.note, options.velocity, hold),
    {
      tail: options.tail,
      sampleRate: options.sampleRate,
    },
  );
}
