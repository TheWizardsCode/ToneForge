/**
 * Unit tests for the sample-accurate ADSR envelope engine (`envelope.ts`).
 *
 * Covers the attack → decay → sustain → release state machine: stage
 * transitions at sample boundaries, zero-length stages, releases from any
 * current level (including mid-attack), long release tails, and sample-rate
 * independence (44100 Hz and 48000 Hz). The offline-render AC asserts a held
 * tone is non-silent during sustain and decays to silence within the release
 * tail after Note Off, rendered through the shared instrument harness.
 */

import { describe, it, expect } from "vitest";
import { AdsrEnvelope, type AdsrConfig, type EnvelopeStage } from "./envelope.js";
import {
  HARNESS_SAMPLE_RATE,
  computeRms,
  isSilent,
  renderNoteSequence,
} from "./__tests__/helpers.js";
import type { NoteEvent, VoiceBuilder } from "./__tests__/helpers.js";

const SR_44100 = 44100;
const SR_48000 = 48000;

/** A typical pluck-like envelope shape used across tests. */
const PICK_CONFIG: AdsrConfig = {
  attack: 0.01,
  decay: 0.05,
  sustain: 0.4,
  release: 0.2,
};

/** Collect the envelope's per-sample values across a run. */
function runEnvelope(
  config: AdsrConfig,
  sampleRate: number,
  noteOnAtSample: number,
  noteOffAtSample: number | undefined,
  totalSamples: number,
): number[] {
  const env = new AdsrEnvelope(config, sampleRate);
  const values: number[] = [];
  for (let i = 0; i < totalSamples; i++) {
    if (i === noteOnAtSample) {
      env.noteOn();
    }
    if (i === noteOffAtSample) {
      env.noteOff();
    }
    values.push(env.nextValue());
  }
  return values;
}

// ── Stage lifecycle ───────────────────────────────────────────────

describe("AdsrEnvelope stage lifecycle", () => {
  it("begins at 0 and idle, rises over attack to peak, decays to sustain and holds", () => {
    const sampleRate = 1000; // 1 ms per sample — easy arithmetic
    const env = new AdsrEnvelope(
      { attack: 0.002, decay: 0.003, sustain: 0.25, release: 0.01 },
      sampleRate,
    );

    expect(env.stage).toBe("idle");
    expect(env.value).toBe(0);

    env.noteOn();
    expect(env.stage).toBe("attack");
    env.nextValue(); // 0.5
    env.nextValue(); // 1.0 → decay
    expect(env.value).toBe(1);
    expect(env.stage).toBe("decay");

    // decay: 0.003 s at 1000 Hz = 3 samples from 1 → 0.25 (0.25 each)
    env.nextValue(); // 0.75
    env.nextValue(); // 0.5
    env.nextValue(); // 0.25 → sustain
    expect(env.value).toBeCloseTo(0.25, 6);
    expect(env.stage).toBe("sustain");

    // Sustain holds indefinitely until noteOff.
    env.nextValue();
    env.nextValue();
    env.nextValue();
    expect(env.value).toBeCloseTo(0.25, 6);
    expect(env.stage).toBe("sustain");
    expect(env.isActive).toBe(true);
  });

  it("runs release only after noteOff and reaches exactly 0 at the tail end", () => {
    const sampleRate = 1000;
    const env = new AdsrEnvelope(
      { attack: 0, decay: 0, sustain: 1, release: 0.004 },
      sampleRate,
    );
    env.noteOn();
    env.nextValue();
    expect(env.value).toBe(1);
    expect(env.stage).toBe("sustain");

    // No noteOff yet — value stays at sustain no matter how long we run.
    for (let i = 0; i < 10; i++) {
      env.nextValue();
    }
    expect(env.value).toBe(1);
    expect(env.stage).toBe("sustain");

    env.noteOff();
    expect(env.stage).toBe("release");
    // release: 1 / 4 samples = 0.25 each
    expect(env.nextValue()).toBeCloseTo(0.75, 6);
    expect(env.nextValue()).toBeCloseTo(0.5, 6);
    expect(env.nextValue()).toBeCloseTo(0.25, 6);
    expect(env.nextValue()).toBe(0);
    expect(env.stage).toBe("idle");
    expect(env.isActive).toBe(false);

    // Stays at 0 after the tail.
    env.nextValue();
    env.nextValue();
    expect(env.value).toBe(0);
    expect(env.stage).toBe("idle");
  });

  it("supports zero attack, zero decay and zero sustain", () => {
    const sampleRate = 1000;
    // Zero attack + zero decay: noteOn jumps straight to sustain=0.7.
    const env = new AdsrEnvelope(
      { attack: 0, decay: 0, sustain: 0.7, release: 0.001 },
      sampleRate,
    );
    env.noteOn();
    env.nextValue();
    expect(env.value).toBeCloseTo(0.7, 6);
    expect(env.stage).toBe("sustain");

    // Zero sustain: attack → decay all the way down to 0 (idle).
    const env2 = new AdsrEnvelope(
      { attack: 0.001, decay: 0.002, sustain: 0, release: 0.001 },
      sampleRate,
    );
    env2.noteOn();
    env2.nextValue(); // attack 1 sample → 1
    env2.nextValue(); // decay 0.5
    env2.nextValue(); // 0
    expect(env2.value).toBe(0);
    expect(env2.stage).toBe("sustain");
  });

  it("supports a long release tail and a note released during attack", () => {
    const sampleRate = 1000;
    // Long release: 0.5 s of tail from a peak value of 1.
    const env = new AdsrEnvelope(
      { attack: 0, decay: 0, sustain: 1, release: 0.5 },
      sampleRate,
    );
    env.noteOn();
    env.nextValue();
    env.noteOff();
    const releaseValues = env.process(500);
    expect(releaseValues.length).toBe(500);
    expect(releaseValues[499]).toBe(0);
    // Float32 accumulation over 250 samples keeps this within ±0.01.
    expect(releaseValues[250]).toBeCloseTo(0.5, 2);
    expect(env.stage).toBe("idle");

    // Released during attack: release starts from the current (partial) level.
    const env2 = new AdsrEnvelope(
      { attack: 0.005, decay: 0.01, sustain: 0.5, release: 0.01 },
      sampleRate,
    );
    env2.noteOn();
    env2.nextValue(); // 0.2
    env2.nextValue(); // 0.4
    env2.nextValue(); // 0.6
    expect(env2.value).toBeCloseTo(0.6, 4);
    env2.noteOff();
    // Release from 0.6 over 10 samples: 0.06 per sample.
    env2.nextValue();
    expect(env2.value).toBeCloseTo(0.54, 4);
    env2.nextValue();
    expect(env2.value).toBeCloseTo(0.48, 4);
  });

  it("treats noteOff while idle as a no-op", () => {
    const env = new AdsrEnvelope(PICK_CONFIG, SR_44100);
    env.noteOff();
    expect(env.stage).toBe("idle");
    expect(env.value).toBe(0);
  });

  it("rejects invalid configs and sample rates", () => {
    expect(
      () => new AdsrEnvelope({ attack: -1, decay: 0, sustain: 0.5, release: 0.1 }, SR_44100),
    ).toThrow(/attack/);
    expect(
      () => new AdsrEnvelope({ attack: 0, decay: 0, sustain: 1.5, release: 0.1 }, SR_44100),
    ).toThrow(/sustain/);
    expect(
      () => new AdsrEnvelope({ attack: 0, decay: 0, sustain: 0.5, release: -0.1 }, SR_44100),
    ).toThrow(/release/);
    expect(() => new AdsrEnvelope(PICK_CONFIG, 0)).toThrow(/sampleRate/);
    expect(() => new AdsrEnvelope(PICK_CONFIG, -44100)).toThrow(/sampleRate/);
  });
});

// ── Sample-rate independence ──────────────────────────────────────

describe("AdsrEnvelope sample-rate independence", () => {
  it("reaches peak in the same attack time at 44100 Hz and 48000 Hz", () => {
    const attack = 0.02;
    for (const sampleRate of [SR_44100, SR_48000]) {
      const env = new AdsrEnvelope(
        { attack, decay: 0, sustain: 1, release: 0.01 },
        sampleRate,
      );
      env.noteOn();
      const expectedSamples = Math.round(attack * sampleRate);
      let reachedPeakAt = -1;
      for (let i = 0; i < expectedSamples + 2; i++) {
        const value = env.nextValue();
        if (value >= 1 && reachedPeakAt < 0) {
          reachedPeakAt = i;
        }
      }
      // Within one sample of the theoretical attack length.
      expect(reachedPeakAt).toBeGreaterThanOrEqual(expectedSamples - 1);
      expect(reachedPeakAt).toBeLessThanOrEqual(expectedSamples + 1);
    }
  });

  it("decays to sustain in the same time at both sample rates", () => {
    const valueAt = (sampleRate: number, sample: number): number => {
      const env = new AdsrEnvelope(
        { attack: 0, decay: 0.1, sustain: 0.5, release: 0.01 },
        sampleRate,
      );
      env.noteOn();
      for (let i = 0; i < sample; i++) {
        env.nextValue();
      }
      return env.value;
    };

    // Halfway through the decay (0.05 s) both should sit at ~0.75.
    expect(valueAt(SR_44100, Math.round(0.05 * SR_44100))).toBeCloseTo(0.75, 4);
    expect(valueAt(SR_48000, Math.round(0.05 * SR_48000))).toBeCloseTo(0.75, 4);
    // At the decay end both are at sustain.
    expect(valueAt(SR_44100, Math.round(0.1 * SR_44100))).toBeCloseTo(0.5, 4);
    expect(valueAt(SR_48000, Math.round(0.1 * SR_48000))).toBeCloseTo(0.5, 4);
  });
});

// ── Determinism ───────────────────────────────────────────────────

describe("AdsrEnvelope determinism", () => {
  it("produces identical output for identical input sequences", () => {
    const a = runEnvelope(PICK_CONFIG, SR_44100, 10, 5000, 5100);
    const b = runEnvelope(PICK_CONFIG, SR_44100, 10, 5000, 5100);
    expect(a).toEqual(b);
    expect(b.length).toBe(5100);
  });
});

// ── Offline-render AC ─────────────────────────────────────────────

describe("ADSR offline render", () => {
  const PLUCK: AdsrConfig = {
    attack: 0.005,
    decay: 0.06,
    sustain: 0.5,
    release: 0.12,
  };
  const SUSTAIN_HOLD = 0.3;

  /** Voice builder: a sine tone shaped by the ADSR envelope. */
  const adsrVoice = (config: AdsrConfig): VoiceBuilder => (ctx, note) => {
    const sampleRate = HARNESS_SAMPLE_RATE;

    // Sample-accurate envelope values over sustain hold + release tail.
    const holdSamples = Math.round(note.duration * sampleRate);
    const releaseSamples = Math.round(config.release * sampleRate);
    const curve = new Float32Array(holdSamples + releaseSamples + 1);

    const env = new AdsrEnvelope(config, sampleRate);
    env.noteOn();
    let i = 0;
    for (; i < holdSamples; i++) {
      curve[i] = env.nextValue();
    }
    env.noteOff();
    for (; i < curve.length; i++) {
      curve[i] = env.nextValue();
    }

    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = note.frequency;
    const gain = ctx.createGain();
    // Scale by velocity and apply the envelope curve across the note + tail.
    const scale = note.gain;
    for (let k = 0; k < curve.length; k++) {
      curve[k] *= scale;
    }
    gain.gain.setValueCurveAtTime(curve, note.time, curve.length / sampleRate);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(note.time);
    oscillator.stop(note.time + curve.length / sampleRate + 0.01);
  };

  it("held note is non-silent during sustain and silent within the release tail after Note Off", async () => {
    const events: NoteEvent[] = [
      { note: 69, velocity: 110, time: 0, duration: SUSTAIN_HOLD },
    ];
    const render = await renderNoteSequence(events, {
      tail: 0.25,
      voice: adsrVoice(PLUCK),
    });
    const { samples, sampleRate } = render;

    // Sustain window: 0.06 s decay ends at t=0.065, so sample the middle of
    // the hold (t in [0.12, 0.28]) — the envelope is at sustain=0.5 there.
    const start = Math.round(0.12 * sampleRate);
    const end = Math.round(0.28 * sampleRate);
    const sustainWindow = samples.slice(start, end);
    const sustainRms = computeRms(sustainWindow);
    // A 440 Hz tone at ~0.5 gain has RMS ≫ the silence threshold.
    expect(sustainRms).toBeGreaterThan(0.01);
    expect(isSilent(sustainWindow)).toBe(false);

    // Release tail: release starts at t=0.3 and completes at ~0.42; the
    // final tail window (t in [0.45, 0.55]) must be silent.
    const tailStart = Math.round(0.45 * sampleRate);
    const tailEnd = Math.round(0.55 * sampleRate);
    const tailWindow = samples.slice(tailStart, tailEnd);
    expect(isSilent(tailWindow)).toBe(true);
    // The buffer as a whole is not silent (it held a note).
    expect(isSilent(samples)).toBe(false);
  });
});
