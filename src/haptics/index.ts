/**
 * ToneForge Haptics Module
 *
 * Deterministic, audio-synchronised tactile pattern generation. Patterns are
 * derived from a rendered audio envelope and an aesthetic palette, so the same
 * recipe + seed + palette always yields the same feedback.
 *
 * Reference: docs/prd/HAPTICS_PRD.md
 */

export {
  DEFAULT_HAPTIC_FRAME_COUNT,
  generateHapticPattern,
  hapticStyleForRecipe,
} from "./pattern.js";
export type {
  GenerateHapticOptions,
  HapticDecay,
  HapticPattern,
  HapticPulse,
  HapticStyle,
} from "./pattern.js";

export { buildHapticPattern } from "./build.js";
export type { BuildHapticPatternOptions } from "./build.js";
