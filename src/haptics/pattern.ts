/**
 * ToneForge Haptics — Deterministic Tactile Pattern Generation
 *
 * Turns a rendered audio amplitude envelope plus an aesthetic palette into a
 * deterministic, inspectable haptic pattern. Pulse timing follows the audio's
 * active regions and pulse intensity follows the audio amplitude; the palette
 * scales intensity, sharpness, decay and pulse density so tactile feedback
 * stays perceptually aligned with the visual/aesthetic style.
 *
 * Reference: docs/prd/HAPTICS_PRD.md, docs/prd/DEMO_ROADMAP.md (Demo 13)
 */

import { createRng } from "../core/rng.js";
import type { PaletteDefinition } from "../visualizer/palette.js";

/** Tactile pattern families. */
export type HapticStyle =
  | "impact_thump"
  | "footstep_pulse"
  | "ui_tick"
  | "sustained_rumble"
  | "pulse";

/** How quickly a pulse decays. */
export type HapticDecay = "fast" | "medium" | "slow";

/** A single tactile pulse within a pattern. */
export interface HapticPulse {
  /** Pulse start, offset from the start of the audio event (milliseconds). */
  atMs: number;
  /** Pulse duration in milliseconds. */
  durationMs: number;
  /** Perceived intensity in [0, 1]. */
  intensity: number;
  /** Attack sharpness in [0, 1] (higher = crisper). */
  sharpness: number;
  /** Decay character. */
  decay: HapticDecay;
}

/** A complete deterministic haptic pattern. */
export interface HapticPattern {
  command: "haptic pattern";
  /** Recipe the pattern was generated from (set by the audio-backed builder). */
  recipe?: string;
  /** Seed used for the pattern. */
  seed: number;
  /** Palette name controlling tactile character. */
  palette: string;
  /** Pattern family. */
  style: HapticStyle;
  /** Total pattern duration in milliseconds. */
  durationMs: number;
  /** Number of envelope frames sampled. */
  frameCount: number;
  /** Number of pulses emitted. */
  pulseCount: number;
  /** Sum of all pulse intensities (a coarse "total feedback" measure). */
  totalIntensity: number;
  /** Ordered pulses. */
  pulses: HapticPulse[];
}

/** Options for {@link generateHapticPattern}. */
export interface GenerateHapticOptions {
  /** Per-frame audio amplitude in [0, 1]. */
  envelope: number[];
  /** Audio event duration in seconds. */
  durationSeconds: number;
  /** Palette controlling tactile character. */
  palette: PaletteDefinition;
  /** Deterministic integer seed. */
  seed: number;
  /** Tactile pattern family. */
  style: HapticStyle;
  /** Amplitude below which a frame is considered silent (default 0.1). */
  intensityThreshold?: number;
}

/** Default number of analysis frames for audio-backed patterns. */
export const DEFAULT_HAPTIC_FRAME_COUNT = 16;

/**
 * Map a recipe's category/tags to a tactile pattern family.
 */
export function hapticStyleForRecipe(
  category: string,
  tags: readonly string[] = [],
): HapticStyle {
  const haystack = [category, ...tags].map((v) => v.toLowerCase());
  const has = (...needles: string[]): boolean =>
    haystack.some((value) => needles.some((n) => value.includes(n)));

  if (has("ui", "notification", "confirm", "alert", "chime", "click", "tick")) {
    return "ui_tick";
  }
  if (has("footstep", "step", "walk")) {
    return "footstep_pulse";
  }
  if (has("impact", "explosion", "combat", "hit", "crack", "slam", "punch")) {
    return "impact_thump";
  }
  if (has("vehicle", "engine", "creature", "ambient", "loop", "wind", "rumble")) {
    return "sustained_rumble";
  }
  return "pulse";
}

/**
 * Generate a deterministic haptic pattern from an audio envelope.
 *
 * Contiguous runs of frames above `intensityThreshold` become pulses. Pulse
 * timing is the run's start time (so it matches the audio) and intensity is
 * the run's peak amplitude. The palette scales intensity, sharpness, decay
 * and how many sub-pulses a long run is split into.
 *
 * @throws {RangeError} when the envelope is empty or the duration is invalid.
 */
export function generateHapticPattern(options: GenerateHapticOptions): HapticPattern {
  const {
    envelope,
    durationSeconds,
    palette,
    seed,
    style,
    intensityThreshold = 0.1,
  } = options;

  if (envelope.length === 0) {
    throw new RangeError("envelope must contain at least one frame");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError(`durationSeconds must be positive, got ${durationSeconds}`);
  }

  const frameCount = envelope.length;
  const frameDurationMs = (durationSeconds * 1000) / frameCount;
  const motion = clamp01(palette.visual.motionIntensity);
  const density = clamp01(palette.visual.particleDensity);
  const rng = createRng(seed || 1);

  const pulses: HapticPulse[] = [];
  let frame = 0;
  while (frame < frameCount) {
    if ((envelope[frame] ?? 0) < intensityThreshold) {
      frame++;
      continue;
    }
    let end = frame;
    let peak = 0;
    while (end < frameCount && (envelope[end] ?? 0) >= intensityThreshold) {
      peak = Math.max(peak, envelope[end] ?? 0);
      end++;
    }
    const runLength = end - frame;
    const subPulses = Math.max(1, 1 + Math.round(density * Math.min(2, runLength - 1)));
    const subLength = runLength / subPulses;

    for (let sub = 0; sub < subPulses; sub++) {
      const startFrame = frame + sub * subLength;
      const subPeak = subPulses === 1 ? peak : (envelope[Math.round(startFrame)] ?? peak);
      const seedJitter = 1 - 0.08 * rng();
      const intensity = clamp01(subPeak * (0.5 + 0.5 * motion) * seedJitter);
      if (intensity <= 0) {
        continue;
      }
      const baseDuration = subLength * frameDurationMs;
      const styleFactor = style === "ui_tick" ? 0.5 : style === "sustained_rumble" ? 1.4 : 1;
      const durationMs = Math.max(10, Math.round(baseDuration * (1.2 - 0.5 * motion) * styleFactor));
      pulses.push({
        atMs: Math.round(startFrame * frameDurationMs),
        durationMs,
        intensity,
        sharpness: clamp01(motion * (style === "impact_thump" || style === "ui_tick" ? 1 : 0.65)),
        decay: decayFor(motion, style),
      });
    }
    frame = end;
  }

  const durationMs = Math.round(durationSeconds * 1000);
  return {
    command: "haptic pattern",
    seed,
    palette: palette.name,
    style,
    durationMs,
    frameCount,
    pulseCount: pulses.length,
    totalIntensity: Math.round(pulses.reduce((sum, p) => sum + p.intensity, 0) * 1000) / 1000,
    pulses,
  };
}

/** Choose a decay character from motion intensity and style. */
function decayFor(motion: number, style: HapticStyle): HapticDecay {
  if (style === "sustained_rumble") {
    return motion > 0.7 ? "medium" : "slow";
  }
  if (style === "ui_tick" || style === "impact_thump") {
    return motion > 0.4 ? "fast" : "medium";
  }
  if (motion > 0.7) {
    return "fast";
  }
  return motion > 0.4 ? "medium" : "slow";
}

/** Clamp a value to the inclusive [0, 1] range; non-finite values become 0. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
