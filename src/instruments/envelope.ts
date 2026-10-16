/**
 * Sample-accurate ADSR envelope state machine.
 *
 * A pure, deterministic sample generator with no Web Audio dependency: the
 * envelope is advanced one sample at a time at a supplied sample rate, so
 * stage transitions (attack → decay → sustain → release) land exactly on
 * sample boundaries. Note On runs attack → decay → sustain-hold; Note Off
 * runs the release stage from whatever value the envelope currently holds
 * (so a note released mid-attack releases from its current level, not the
 * peak).
 *
 * The envelope begins at 0 and ends at 0: after the release tail the output
 * reaches and stays at 0. This module is the third child of the playable
 * instruments epic (parent TF-0MV9PIBNV008C00R, child TF-0MV9WXLYN0009201)
 * and is consumed by the voice manager and instrument engine.
 */

/** The stage the envelope is currently in. */
export type EnvelopeStage = "idle" | "attack" | "decay" | "sustain" | "release";

/** An ADSR envelope shape: all times in seconds, sustain a gain in [0, 1]. */
export interface AdsrConfig {
  /** Attack time in seconds (>= 0). */
  attack: number;
  /** Decay time in seconds (>= 0). */
  decay: number;
  /** Sustain level as a gain in [0, 1]. */
  sustain: number;
  /** Release time in seconds (>= 0). */
  release: number;
}

function validateConfig(config: AdsrConfig): void {
  for (const stage of ["attack", "decay", "release"] as const) {
    const value = config[stage];
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(
        `AdsrEnvelope: ${stage} must be a non-negative number of seconds.`,
      );
    }
  }
  if (!Number.isFinite(config.sustain) || config.sustain < 0 || config.sustain > 1) {
    throw new RangeError("AdsrEnvelope: sustain must be a gain within [0, 1].");
  }
}

/**
 * A sample-accurate attack/decay/sustain/release envelope.
 *
 * Advance the envelope one sample at a time with {@link nextValue} (or a
 * block at a time with {@link process}); trigger the stages with
 * {@link noteOn} / {@link noteOff}. The generator is deterministic: the same
 * config, sample rate and note on/off sample positions always produce the
 * same output.
 */
export class AdsrEnvelope {
  /** The envelope shape. */
  readonly config: AdsrConfig;
  /** The sample rate the envelope advances at, in Hz. */
  readonly sampleRate: number;

  private stageValue: EnvelopeStage = "idle";
  private currentValue = 0;
  /** Level the release stage started from (captured on {@link noteOff}). */
  private releaseStartValue = 0;

  /**
   * @param config - The ADSR shape.
   * @param sampleRate - The sample rate in Hz (> 0).
   * @throws {RangeError} If the config or sample rate is invalid.
   */
  constructor(config: AdsrConfig, sampleRate: number) {
    validateConfig(config);
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new RangeError("AdsrEnvelope: sampleRate must be greater than 0.");
    }
    this.config = { ...config };
    this.sampleRate = sampleRate;
  }

  /** The current stage. */
  get stage(): EnvelopeStage {
    return this.stageValue;
  }

  /** The current envelope value (0 when idle). */
  get value(): number {
    return this.currentValue;
  }

  /** Whether the envelope is producing a non-idle stage. */
  get isActive(): boolean {
    return this.stageValue !== "idle";
  }

  /**
   * Begin a note: start the attack stage from the current value.
   *
   * A zero-length attack jumps straight to the peak; a zero-length decay
   * then jumps straight to the sustain level. Calling `noteOn` while active
   * re-triggers the attack from the current value.
   */
  noteOn(): void {
    this.stageValue = "attack";
    if (this.config.attack <= 0) {
      this.currentValue = 1;
      this.beginDecay();
    }
  }

  /**
   * Release the note: start the release stage from the current value.
   *
   * A zero-length release jumps straight to silence (idle). Calling
   * `noteOff` while idle is a no-op.
   */
  noteOff(): void {
    if (this.stageValue === "idle") {
      return;
    }
    this.releaseStartValue = this.currentValue;
    if (this.config.release <= 0) {
      this.currentValue = 0;
      this.stageValue = "idle";
      return;
    }
    this.stageValue = "release";
  }

  /**
   * Advance the envelope by exactly one sample and return the new value.
   *
   * @returns The envelope value for the current sample.
   */
  nextValue(): number {
    switch (this.stageValue) {
      case "idle":
        return 0;
      case "attack": {
        this.currentValue += 1 / (this.config.attack * this.sampleRate);
        if (this.currentValue >= 1) {
          this.currentValue = 1;
          this.beginDecay();
        }
        return this.currentValue;
      }
      case "decay": {
        this.currentValue -=
          (1 - this.config.sustain) / (this.config.decay * this.sampleRate);
        if (this.currentValue <= this.config.sustain) {
          this.currentValue = this.config.sustain;
          this.stageValue = "sustain";
        }
        return this.currentValue;
      }
      case "sustain":
        return this.currentValue;
      case "release": {
        this.currentValue -=
          this.releaseStartValue / (this.config.release * this.sampleRate);
        if (this.currentValue <= 0) {
          this.currentValue = 0;
          this.stageValue = "idle";
        }
        return this.currentValue;
      }
    }
  }

  /**
   * Advance the envelope by *frameCount* samples and return them as a buffer.
   *
   * Equivalent to calling {@link nextValue} *frameCount* times, so it is
   * sample-accurate and deterministic.
   *
   * @param frameCount - Number of samples to generate (>= 0).
   * @returns A buffer of *frameCount* envelope values.
   * @throws {RangeError} If *frameCount* is negative or not an integer.
   */
  process(frameCount: number): Float32Array {
    if (!Number.isInteger(frameCount) || frameCount < 0) {
      throw new RangeError(
        "AdsrEnvelope: frameCount must be a non-negative integer.",
      );
    }
    const out = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      out[i] = this.nextValue();
    }
    return out;
  }

  /** Enter the decay stage, honouring a zero-length decay. */
  private beginDecay(): void {
    if (this.config.decay <= 0) {
      this.currentValue = this.config.sustain;
      this.stageValue = "sustain";
    } else {
      this.stageValue = "decay";
    }
  }
}
