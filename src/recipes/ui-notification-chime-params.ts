/**
 * UI Notification Chime Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Harmonic series + gentle envelope
 * Produces a pleasant musical chime tone suitable for UI notifications,
 * alerts, or confirmations.
 *
 * Seed-varied parameters:
 * - Fundamental frequency: 400-1200 Hz (pitch of the chime)
 * - Harmonic count: 2-5 (number of overtones)
 * - Harmonic decay factor: 0.3-0.8 (how quickly harmonics fade)
 * - Attack: 0.005-0.02s (gentle onset)
 * - Sustain level: 0.3-0.7 (held level)
 * - Decay: 0.1-0.4s (fade from peak to sustain)
 * - Release: 0.1-0.5s (final fade out)
 *
 * Reference: docs/prd/DEMO_ROADMAP.md
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the ui-notification-chime recipe. */
export interface UiNotificationChimeParams {
  fundamentalFreq: number;
  harmonicCount: number;
  harmonicDecayFactor: number;
  attack: number;
  sustainLevel: number;
  decay: number;
  release: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getUiNotificationChimeParams(rng: Rng): UiNotificationChimeParams {
  return {
    fundamentalFreq: rr(rng, 400, 1200),
    harmonicCount: Math.floor(rr(rng, 2, 6)), // 2-5 integer
    harmonicDecayFactor: rr(rng, 0.3, 0.8),
    attack: rr(rng, 0.005, 0.02),
    sustainLevel: rr(rng, 0.3, 0.7),
    decay: rr(rng, 0.1, 0.4),
    release: rr(rng, 0.1, 0.5),
  };
}
