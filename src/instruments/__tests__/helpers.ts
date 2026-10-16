/**
 * Shared test harness and analysis helpers for instrument features.
 *
 * Renders a note/velocity sequence offline at a **pinned 44100 Hz** sample
 * rate and returns the raw `Float32Array` samples, so later instrument
 * features (envelopes, polyphony, presets, determinism) can assert behaviour
 * reproducibly without ad-hoc test code. The voice that turns a note into an
 * audio graph is pluggable (see {@link VoiceBuilder}); the default voice is a
 * sine oscillator with a short attack/release envelope, deterministic for a
 * given sequence.
 *
 * The file also exposes analysis helpers — peak / RMS, silence detection and
 * dominant-frequency estimation — used by later features to assert pitch and
 * loudness. RMS / peak and the silence threshold reuse the existing
 * production analysis extractors (`src/analyze`) so the harness never
 * re-implements platform analysis logic.
 *
 * Naming, layout and import conventions mirror the existing shared test
 * helper precedents (`src/intelligence/__tests__/helpers.ts`,
 * `src/validator/__tests__/helpers.ts`). This file is test infrastructure
 * only — no production behaviour lives here.
 */

import { OfflineAudioContext } from "../../audio/web-audio.js";
import { TimeDomainExtractor } from "../../analyze/index.js";
import { SILENCE_RMS_THRESHOLD } from "../../analyze/extractors/quality-flags.js";

// ── Constants ─────────────────────────────────────────────────────

/** Sample rate the harness always renders at, in Hz. Pinned by contract. */
export const HARNESS_SAMPLE_RATE = 44100;

/** Default silence appended after the final note-off, in seconds. */
export const DEFAULT_TAIL = 0.1;

/** Default voice attack time, in seconds. */
export const DEFAULT_VOICE_ATTACK = 0.005;

/** Default voice release time (before note-off), in seconds. */
export const DEFAULT_VOICE_RELEASE = 0.05;

/**
 * Relative tolerance for {@link estimateDominantFrequency} (±2%).
 *
 * The zero-crossing estimator is exact for pure tones; the documented
 * tolerance exists to absorb envelope shaping, additive partials and
 * float32 rounding for the non-synthetic buffers later features render.
 */
export const DOMINANT_FREQUENCY_TOLERANCE_RATIO = 0.02;

// ── Pitch / loudness mapping (test utilities) ─────────────────────

/**
 * Map a MIDI note number to its equal-tempered frequency in Hz.
 *
 * Concert A4 (MIDI note 69) is 440 Hz; each semitone is a factor of
 * 2^(1/12). Note 60 (middle C) maps to ~261.63 Hz.
 */
export function midiNoteToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Map a MIDI velocity (0–127) to a linear loudness in [0, 1].
 *
 * Velocity 127 is unity (1.0); 0 is silence. The mapping is linear for
 * determinism; production instruments may apply their own velocity curves
 * and assert against this reference.
 */
export function velocityToGain(velocity: number): number {
  return velocity / 127;
}

// ── Note sequence rendering ───────────────────────────────────────

/** A single note in the sequence to render. */
export interface NoteEvent {
  /** MIDI note number (0–127); 69 = A4 = 440 Hz. */
  note: number;
  /** MIDI velocity (0–127); maps to loudness. */
  velocity: number;
  /** Note-on time relative to the sequence start, in seconds. */
  time: number;
  /** Note-on → note-off span (sustain duration), in seconds. */
  duration: number;
}

/** A resolved note handed to the voice builder, ready for scheduling. */
export interface ScheduledNote {
  /** MIDI note number (0–127). */
  note: number;
  /** MIDI velocity (0–127). */
  velocity: number;
  /** Note-on time in seconds. */
  time: number;
  /** Sustain duration in seconds. */
  duration: number;
  /** Equal-tempered frequency in Hz (from {@link midiNoteToFrequency}). */
  frequency: number;
  /** Linear loudness in [0, 1] (from {@link velocityToGain}). */
  gain: number;
}

/**
 * Builds the audio nodes for a single note on the offline context.
 *
 * Later instrument features pass their own voice builders (oscillator +
 * ADSR + optional filter) so the harness renders through the *real*
 * instrument engine; the {@link defaultVoice} is used when none is given.
 */
export type VoiceBuilder = (
  ctx: OfflineAudioContext,
  note: ScheduledNote,
) => void;

/** Result of an offline note-sequence render. */
export interface RenderedSequence {
  /** Mono audio samples. */
  samples: Float32Array;
  /** Sample rate in Hz (always {@link HARNESS_SAMPLE_RATE}). */
  sampleRate: number;
  /** Rendered duration in seconds (last note-off + tail). */
  duration: number;
}

/** Options for {@link renderNoteSequence}. */
export interface RenderNoteSequenceOptions {
  /** Extra silence after the final note-off, in seconds (default 0.1). */
  tail?: number;
  /** Voice builder; defaults to {@link defaultVoice}. */
  voice?: VoiceBuilder;
}

/**
 * Render a note/velocity sequence offline and return the raw samples.
 *
 * Creates an `OfflineAudioContext` at the pinned 44100 Hz sample rate,
 * schedules one voice per note at its absolute time, renders, and returns
 * the mono samples along with the buffer metadata.
 *
 * @param events - Note events to render (may be empty).
 * @param options - Optional tail / voice overrides.
 * @returns The rendered sequence.
 * @throws {TypeError} If a note is out of range (note 0–127, velocity 0–127,
 *         non-negative time, positive duration).
 * @throws {Error} If `startRendering()` returns `null` — an offline-render
 *         failure under heavy host contention; retry with reduced load.
 */
export async function renderNoteSequence(
  events: NoteEvent[],
  options?: RenderNoteSequenceOptions,
): Promise<RenderedSequence> {
  const sampleRate = HARNESS_SAMPLE_RATE;
  const tail = options?.tail ?? DEFAULT_TAIL;
  const voice = options?.voice ?? defaultVoice;

  if (events.length === 0) {
    return { samples: new Float32Array(0), sampleRate, duration: 0 };
  }

  let end = 0;
  for (const event of events) {
    if (!Number.isFinite(event.note) || event.note < 0 || event.note > 127) {
      throw new TypeError(
        `renderNoteSequence: note ${event.note} out of range 0–127.`,
      );
    }
    if (!Number.isFinite(event.velocity) || event.velocity < 0 || event.velocity > 127) {
      throw new TypeError(
        `renderNoteSequence: velocity ${event.velocity} out of range 0–127.`,
      );
    }
    if (!Number.isFinite(event.time) || event.time < 0) {
      throw new TypeError(
        `renderNoteSequence: time ${event.time} must be a non-negative number of seconds.`,
      );
    }
    if (!Number.isFinite(event.duration) || event.duration <= 0) {
      throw new TypeError(
        `renderNoteSequence: duration ${event.duration} must be a positive number of seconds.`,
      );
    }
    end = Math.max(end, event.time + event.duration);
  }

  const duration = end + tail;
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(1, length, sampleRate);

  for (const event of events) {
    voice(ctx, {
      note: event.note,
      velocity: event.velocity,
      time: event.time,
      duration: event.duration,
      frequency: midiNoteToFrequency(event.note),
      gain: velocityToGain(event.velocity),
    });
  }

  const audioBuffer = await ctx.startRendering();
  if (!audioBuffer) {
    throw new Error(
      "renderNoteSequence: startRendering() returned null. " +
        "This can occur under host contention; retry with reduced load.",
    );
  }

  return {
    samples: new Float32Array(audioBuffer.getChannelData(0)),
    sampleRate,
    duration,
  };
}

/**
 * Default voice: a sine oscillator at the note frequency with a short
 * attack/release envelope and velocity-scaled gain.
 *
 * The envelope keeps the rendered tone free of clicks while leaving the
 * zero-crossing positions (and therefore the measured pitch) untouched.
 */
export function defaultVoice(ctx: OfflineAudioContext, note: ScheduledNote): void {
  // Clamp attack/release so they always fit inside short notes.
  const attack = Math.min(DEFAULT_VOICE_ATTACK, note.duration * 0.25);
  const release = Math.min(DEFAULT_VOICE_RELEASE, note.duration * 0.25);
  const attackEnd = note.time + attack;
  const releaseStart = note.time + note.duration - release;

  const oscillator = ctx.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.value = note.frequency;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, note.time);
  gain.gain.linearRampToValueAtTime(note.gain, attackEnd);
  gain.gain.setValueAtTime(note.gain, releaseStart);
  gain.gain.linearRampToValueAtTime(0, note.time + note.duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(note.time);
  oscillator.stop(note.time + note.duration);
}

// ── Analysis helpers ──────────────────────────────────────────────

/**
 * Peak absolute sample amplitude of the buffer (0 for empty buffers).
 *
 * Delegates to the production `TimeDomainExtractor`.
 */
export function computePeak(samples: Float32Array): number {
  return new TimeDomainExtractor().extract(samples, HARNESS_SAMPLE_RATE).peak as number;
}

/**
 * Root-mean-square amplitude of the buffer (0 for empty buffers).
 *
 * Delegates to the production `TimeDomainExtractor`.
 */
export function computeRms(samples: Float32Array): number {
  return new TimeDomainExtractor().extract(samples, HARNESS_SAMPLE_RATE).rms as number;
}

/** Options for {@link isSilent}. */
export interface SilenceOptions {
  /**
   * RMS below which the buffer counts as silent.
   * Defaults to the production `SILENCE_RMS_THRESHOLD` (0.001).
   */
  rmsThreshold?: number;
}

/**
 * Report whether a buffer is silent (RMS below the silence threshold).
 *
 * Uses the same threshold the platform's `QualityFlagsExtractor` applies,
 * overridable per call.
 */
export function isSilent(samples: Float32Array, options?: SilenceOptions): boolean {
  const threshold = options?.rmsThreshold ?? SILENCE_RMS_THRESHOLD;
  return computeRms(samples) < threshold;
}

/**
 * Estimate the dominant frequency of a buffer via zero-crossing rate.
 *
 * Counts sign changes and averages the interior crossing intervals, so
 * partial cycles at the buffer edges do not bias the result. The estimate
 * is exact for pure tones and accurate within a documented tolerance
 * ({@link DOMINANT_FREQUENCY_TOLERANCE_RATIO}, ±2%) for typical instrument
 * renders. Returns 0 for silent or very short buffers with fewer than two
 * crossings.
 *
 * @param samples - Mono audio samples.
 * @param sampleRate - Sample rate in Hz (defaults to
 *                     {@link HARNESS_SAMPLE_RATE}).
 */
export function estimateDominantFrequency(
  samples: Float32Array,
  sampleRate?: number,
): number {
  const rate = sampleRate ?? HARNESS_SAMPLE_RATE;
  if (samples.length < 2) return 0;

  // Advance to the first non-zero sample to establish the starting polarity.
  let i = 0;
  while (i < samples.length && samples[i] === 0) {
    i++;
  }
  if (i >= samples.length) return 0;

  let previous = samples[i]!;
  let firstCrossing = -1;
  let lastCrossing = -1;
  let crossings = 0;

  for (; i < samples.length; i++) {
    const sample = samples[i]!;
    if (sample === 0) continue; // exact zeros never create crossings
    if (previous !== 0 && Math.sign(sample) !== Math.sign(previous)) {
      if (firstCrossing < 0) firstCrossing = i;
      lastCrossing = i;
      crossings++;
    }
    previous = sample;
  }

  if (crossings < 2) return 0;

  const seconds = (lastCrossing - firstCrossing) / rate;
  return (crossings - 1) / (2 * seconds);
}
