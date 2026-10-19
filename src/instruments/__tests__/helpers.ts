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
 * loudness. For noise-based and percussive voices (which have no single
 * dominant frequency) it additionally exposes band-energy, decay-time and
 * spectral-difference helpers: {@link computeBandEnergy} measures how much
 * energy sits in a frequency band, {@link computeDecayTime} measures how long
 * a burst takes to fall to a fraction of its peak, and
 * {@link describeSpectralDifference} compares two buffers and reports whether
 * they are measurably distinct. Every helper delegates to the existing
 * production extractors / FFT utilities (`src/analyze`) so the harness never
 * re-implements platform analysis logic.
 *
 * Naming, layout and import conventions mirror the existing shared test
 * helper precedents (`src/intelligence/__tests__/helpers.ts`,
 * `src/validator/__tests__/helpers.ts`). This file is test infrastructure
 * only — no production behaviour lives here.
 */

import { OfflineAudioContext } from "../../audio/web-audio.js";
import {
  SpectralCentroidExtractor,
  TimeDomainExtractor,
} from "../../analyze/index.js";
import { computeMagnitudeSpectrum } from "../../analyze/fft-utils.js";
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

/**
 * Frequency bands (Hz, inclusive edges) used by
 * {@link describeSpectralDifference} to compare the tonal balance of two
 * buffers. The split mirrors the way a listener hears a drum or noise voice:
 * *low* is the body, *mid* the presence, *high* the air/brilliance.
 */
export const SPECTRAL_BANDS = {
  low: { lowHz: 20, highHz: 250 },
  mid: { lowHz: 250, highHz: 2000 },
  high: { lowHz: 2000, highHz: 8000 },
} as const;

/**
 * Relative spectral-centroid difference above which
 * {@link describeSpectralDifference} reports two buffers as distinct (10% of
 * the louder centroid).
 */
export const SPECTRAL_CENTROID_DISTINCT_RATIO = 0.1;

/**
 * Band-energy ratio outside which {@link describeSpectralDifference} reports
 * two buffers as distinct. A ratio in `[1/1.5, 1.5]` counts as "same balance"
 * for the band in question.
 */
export const SPECTRAL_RATIO_DISTINCT_THRESHOLD = 1.5;

/**
 * Fraction of the peak envelope at which {@link computeDecayTime} considers a
 * burst decayed, by default. 0.1 is −20 dB.
 */
export const DEFAULT_DECAY_RATIO = 0.1;

/**
 * Default envelope window length for {@link computeDecayTime}, in seconds.
 * 10 ms averages a few cycles of a typical drum voice without smearing a
 * 0.2 s decay.
 */
export const DEFAULT_DECAY_WINDOW_SECONDS = 0.01;

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

// ── Spectral band energy ──────────────────────────────────────────

/**
 * Summed FFT magnitude energy in a frequency band.
 *
 * Delegates to the production `computeMagnitudeSpectrum` (the same FFT the
 * `SpectralCentroidExtractor` uses) and sums the squared magnitude of every
 * bin whose centre frequency falls inside `[lowHz, highHz]`. Squaring makes
 * the result a spectral *energy* (Parseval-consistent) rather than an
 * amplitude sum, so band energies can be compared and ratioed.
 *
 * Returns 0 for empty or all-zero buffers.
 *
 * @param samples - Mono audio samples.
 * @param lowHz - Lower band edge in Hz (inclusive).
 * @param highHz - Upper band edge in Hz (inclusive).
 * @param sampleRate - Sample rate in Hz (defaults to
 *                     {@link HARNESS_SAMPLE_RATE}).
 * @throws {TypeError} If the edges are not finite or `highHz < lowHz`.
 */
export function computeBandEnergy(
  samples: Float32Array,
  lowHz: number,
  highHz: number,
  sampleRate?: number,
): number {
  assertBand(lowHz, highHz);
  if (samples.length === 0) return 0;

  const rate = sampleRate ?? HARNESS_SAMPLE_RATE;
  const magnitudes = computeMagnitudeSpectrum(samples);
  return bandEnergyFromMagnitudes(magnitudes, rate, lowHz, highHz);
}

/**
 * Sum squared magnitudes for the bins inside `[lowHz, highHz]`.
 *
 * Shared by {@link computeBandEnergy} and
 * {@link describeSpectralDifference} so a single FFT per buffer serves all
 * three bands.
 */
function bandEnergyFromMagnitudes(
  magnitudes: Float64Array,
  sampleRate: number,
  lowHz: number,
  highHz: number,
): number {
  const fftSize = (magnitudes.length - 1) * 2;
  const binWidth = sampleRate / fftSize;

  let energy = 0;
  for (let bin = 0; bin < magnitudes.length; bin++) {
    const frequency = bin * binWidth;
    if (frequency >= lowHz && frequency <= highHz) {
      const magnitude = magnitudes[bin]!;
      energy += magnitude * magnitude;
    }
  }
  return energy;
}

/** Validate a frequency band's edges. */
function assertBand(lowHz: number, highHz: number): void {
  if (!Number.isFinite(lowHz) || !Number.isFinite(highHz) || highHz < lowHz) {
    throw new TypeError(
      `computeBandEnergy: invalid band ${lowHz}–${highHz} Hz; ` +
        "expected finite edges with highHz >= lowHz.",
    );
  }
}

// ── Envelope decay ────────────────────────────────────────────────

/** Options for {@link computeDecayTime}. */
export interface DecayTimeOptions {
  /** Sample rate in Hz (defaults to {@link HARNESS_SAMPLE_RATE}). */
  sampleRate?: number;
  /**
   * Fraction of the peak envelope at which the burst counts as decayed.
   * Defaults to {@link DEFAULT_DECAY_RATIO} (0.1).
   */
  ratio?: number;
  /**
   * Envelope window length in seconds. The envelope is a centred sliding RMS
   * over this window; defaults to {@link DEFAULT_DECAY_WINDOW_SECONDS}.
   */
  windowSeconds?: number;
}

/**
 * Seconds from the envelope peak until the burst has decayed below a fraction
 * of that peak and stays there.
 *
 * The envelope is a centred sliding RMS over `windowSeconds`, so individual
 * carrier cycles and isolated noise samples do not create spurious crossings.
 * The decay time is measured from the envelope's peak to the **final**
 * crossing below `ratio × peak` — i.e. the signal counts as decayed once it
 * has fallen below the threshold and never rises back above it. This makes the
 * measurement robust for monotonic percussive decays; a later re-hit (or a
 * sustained tail) extends the measured time, so render each voice in
 * isolation when asserting its decay.
 *
 * Returns 0 for empty or silent buffers, and for buffers that stay at or above
 * the threshold until the end.
 *
 * @param samples - Mono audio samples.
 * @param options - Rate / threshold-ratio / window overrides.
 */
export function computeDecayTime(
  samples: Float32Array,
  options?: DecayTimeOptions,
): number {
  if (samples.length === 0) return 0;

  const rate = options?.sampleRate ?? HARNESS_SAMPLE_RATE;
  const ratio = options?.ratio ?? DEFAULT_DECAY_RATIO;
  const windowSeconds = options?.windowSeconds ?? DEFAULT_DECAY_WINDOW_SECONDS;

  if (computePeak(samples) === 0) return 0;

  const windowSamples = Math.max(1, Math.round(windowSeconds * rate));
  const envelope = slidingRms(samples, windowSamples);

  let peakIndex = 0;
  let peakLevel = envelope[0]!;
  for (let i = 1; i < envelope.length; i++) {
    if (envelope[i]! > peakLevel) {
      peakLevel = envelope[i]!;
      peakIndex = i;
    }
  }
  if (peakLevel === 0) return 0;

  const threshold = ratio * peakLevel;

  // Find the last sample still at/above the threshold; the burst has decayed by
  // the sample after it (and never returns above it, by construction).
  let lastAbove = -1;
  for (let i = peakIndex; i < envelope.length; i++) {
    if (envelope[i]! >= threshold) lastAbove = i;
  }
  if (lastAbove < 0 || lastAbove >= envelope.length - 1) return 0;

  return (lastAbove + 1 - peakIndex) / rate;
}

/**
 * Centred sliding RMS envelope over `windowSamples`, computed in O(n) via
 * prefix sums. Near the buffer edges the window is clamped, never padded.
 */
function slidingRms(samples: Float32Array, windowSamples: number): Float32Array {
  const length = samples.length;
  const envelope = new Float32Array(length);
  const half = Math.floor(windowSamples / 2);

  const prefix = new Float64Array(length + 1);
  for (let i = 0; i < length; i++) {
    prefix[i + 1] = prefix[i]! + samples[i]! * samples[i]!;
  }

  for (let i = 0; i < length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(length - 1, i + half);
    const count = end - start + 1;
    envelope[i] = Math.sqrt((prefix[end + 1]! - prefix[start]!) / count);
  }
  return envelope;
}

// ── Spectral difference ───────────────────────────────────────────

/** Per-band energy ratio `A / B` returned by {@link describeSpectralDifference}. */
export interface BandEnergyRatios {
  /** Low band (`SPECTRAL_BANDS.low`) energy ratio. */
  low: number;
  /** Mid band (`SPECTRAL_BANDS.mid`) energy ratio. */
  mid: number;
  /** High band (`SPECTRAL_BANDS.high`) energy ratio. */
  high: number;
}

/** Structured spectral comparison returned by {@link describeSpectralDifference}. */
export interface SpectralDifference {
  /** Spectral centroid of the first buffer, in Hz. */
  centroidA: number;
  /** Spectral centroid of the second buffer, in Hz. */
  centroidB: number;
  /** Signed centroid delta in Hz (`centroidB − centroidA`). */
  centroidDeltaHz: number;
  /**
   * Per-band energy ratios of the buffers' **normalised** band shares. Using
   * shares (each band's fraction of that buffer's total band energy) keeps a
   * global loudness difference from being mistaken for a timbral one. A ratio
   * above 1 means A puts proportionally more of its energy in that band than
   * B; `Infinity` / `0` mean only one buffer has energy there.
   */
  bandEnergyRatios: BandEnergyRatios;
  /**
   * True when the buffers are measurably distinct: their centroids differ by
   * more than {@link SPECTRAL_CENTROID_DISTINCT_RATIO}, or any band-energy
   * ratio lies outside
   * `[1 / SPECTRAL_RATIO_DISTINCT_THRESHOLD, SPECTRAL_RATIO_DISTINCT_THRESHOLD]`.
   * Identical buffers are therefore never reported distinct.
   */
  distinct: boolean;
}

/**
 * Compare two buffers' spectral character: centroid delta plus low/mid/high
 * band-energy ratios, with a documented {@link SpectralDifference.distinct}
 * verdict.
 *
 * Centroids come from the production `SpectralCentroidExtractor` and band
 * energies from {@link computeBandEnergy}'s FFT, so this helper introduces no
 * new analysis maths. It is the shared basis for asserting that two
 * noise-based or percussive voices are (or are not) distinct.
 *
 * @param a - First buffer.
 * @param b - Second buffer.
 * @param sampleRate - Sample rate in Hz (defaults to
 *                     {@link HARNESS_SAMPLE_RATE}).
 */
export function describeSpectralDifference(
  a: Float32Array,
  b: Float32Array,
  sampleRate?: number,
): SpectralDifference {
  const rate = sampleRate ?? HARNESS_SAMPLE_RATE;
  const centroidExtractor = new SpectralCentroidExtractor();
  const centroidA = centroidExtractor.extract(a, rate)["spectralCentroid"] as number;
  const centroidB = centroidExtractor.extract(b, rate)["spectralCentroid"] as number;

  const shareA = bandShares(a, rate);
  const shareB = bandShares(b, rate);

  const bandEnergyRatios: BandEnergyRatios = {
    low: safeRatio(shareA.low, shareB.low),
    mid: safeRatio(shareA.mid, shareB.mid),
    high: safeRatio(shareA.high, shareB.high),
  };

  const loudestCentroid = Math.max(centroidA, centroidB);
  const centroidRelativeDelta =
    loudestCentroid > 0 ? Math.abs(centroidB - centroidA) / loudestCentroid : 0;

  const ratios = [bandEnergyRatios.low, bandEnergyRatios.mid, bandEnergyRatios.high];
  const bandDistinct = ratios.some(
    (ratio) =>
      ratio > SPECTRAL_RATIO_DISTINCT_THRESHOLD ||
      ratio < 1 / SPECTRAL_RATIO_DISTINCT_THRESHOLD,
  );

  return {
    centroidA,
    centroidB,
    centroidDeltaHz: centroidB - centroidA,
    bandEnergyRatios,
    distinct: bandDistinct || centroidRelativeDelta > SPECTRAL_CENTROID_DISTINCT_RATIO,
  };
}

/** Each documented band's share of a buffer's total band energy (0 when silent). */
function bandShares(
  samples: Float32Array,
  sampleRate: number,
): { low: number; mid: number; high: number } {
  if (samples.length === 0) return { low: 0, mid: 0, high: 0 };

  const magnitudes = computeMagnitudeSpectrum(samples);
  const low = bandEnergyFromMagnitudes(
    magnitudes,
    sampleRate,
    SPECTRAL_BANDS.low.lowHz,
    SPECTRAL_BANDS.low.highHz,
  );
  const mid = bandEnergyFromMagnitudes(
    magnitudes,
    sampleRate,
    SPECTRAL_BANDS.mid.lowHz,
    SPECTRAL_BANDS.mid.highHz,
  );
  const high = bandEnergyFromMagnitudes(
    magnitudes,
    sampleRate,
    SPECTRAL_BANDS.high.lowHz,
    SPECTRAL_BANDS.high.highHz,
  );

  const total = low + mid + high;
  if (total <= 0) return { low: 0, mid: 0, high: 0 };
  return { low: low / total, mid: mid / total, high: high / total };
}

/** Magnitude below which a share counts as "no energy" for ratio guards. */
const SHARE_EPSILON = 1e-12;

/**
 * `a / b` with explicit handling of zero-energy bands: two empty bands are
 * equal (1), an empty denominator is `Infinity`, an empty numerator is 0.
 */
function safeRatio(a: number, b: number): number {
  if (a <= SHARE_EPSILON && b <= SHARE_EPSILON) return 1;
  if (b <= SHARE_EPSILON) return Infinity;
  if (a <= SHARE_EPSILON) return 0;
  return a / b;
}
