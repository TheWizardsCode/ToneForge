/**
 * ToneForge Visualizer — Audio Envelope Extraction
 *
 * Derives a frame-aligned intensity envelope from rendered audio samples so
 * generated visuals are synchronised to the sound's actual amplitude over
 * time. The extraction is pure and deterministic: the same samples always
 * yield the same envelope.
 *
 * Reference: docs/prd/VISUALIZE_PRD.md §4 (Visual Generation Inputs)
 */

/**
 * Build a normalised amplitude envelope with one value per animation frame.
 *
 * Each frame's intensity is the root-mean-square (RMS) amplitude of the audio
 * slice that maps to that frame, normalised so the loudest frame is `1`.
 * Silence (or all-zero samples) yields an all-zero envelope.
 *
 * @param samples    - Mono audio samples in the range roughly [-1, 1].
 * @param sampleRate - Samples per second.
 * @param frameCount - Number of frames to produce (must be >= 1).
 * @returns          - Array of length `frameCount` with values in [0, 1].
 * @throws {RangeError} when `frameCount` is not a positive integer.
 */
export function buildAmplitudeEnvelope(
  samples: ArrayLike<number>,
  sampleRate: number,
  frameCount: number,
): number[] {
  if (!Number.isInteger(frameCount) || frameCount < 1) {
    throw new RangeError(`frameCount must be a positive integer, got ${frameCount}`);
  }
  if (sampleRate <= 0 || samples.length === 0) {
    return new Array<number>(frameCount).fill(0);
  }

  const envelope: number[] = new Array<number>(frameCount).fill(0);
  const samplesPerFrame = samples.length / frameCount;
  let peak = 0;

  for (let frame = 0; frame < frameCount; frame++) {
    const start = Math.floor(frame * samplesPerFrame);
    const end = Math.min(samples.length, Math.floor((frame + 1) * samplesPerFrame));
    let sumSquares = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      const v = samples[i] ?? 0;
      sumSquares += v * v;
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
    envelope[frame] = rms;
    if (rms > peak) {
      peak = rms;
    }
  }

  if (peak > 0) {
    for (let frame = 0; frame < frameCount; frame++) {
      envelope[frame] = envelope[frame]! / peak;
    }
  }
  return envelope;
}
