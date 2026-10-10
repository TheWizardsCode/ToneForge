/**
 * ToneForge Visualizer Module
 *
 * Deterministic, audio-synchronised visual effect generation and sprite sheet
 * export. Visuals are driven by rendered audio amplitude and a named aesthetic
 * palette, so the same recipe + seed + palette always yields the same output.
 *
 * Reference: docs/prd/VISUALIZE_PRD.md, docs/prd/PALLETE_PRD.md
 */

export {
  BUILTIN_PALETTES,
  DEFAULT_PALETTE_NAME,
  PaletteError,
  lerpColor,
  listPalettes,
  parseHexColor,
  resolvePalette,
} from "./palette.js";
export type { PaletteDefinition, Rgb, VisualStyle } from "./palette.js";

export { buildAmplitudeEnvelope } from "./envelope.js";

export { generateEffectFrames, styleForRecipe } from "./effects.js";
export type {
  EffectFrame,
  GenerateFramesOptions,
  VisualEffectStyle,
} from "./effects.js";

export { encodePng } from "./png.js";

export { buildSpriteSheetMetadata, composeSpriteSheet } from "./spritesheet.js";
export type { SpriteSheet, SpriteSheetMetadata } from "./spritesheet.js";

export {
  DEFAULT_FRAME_COUNT,
  DEFAULT_FRAME_SIZE,
  VISUAL_FORMATS,
  exportVisual,
} from "./export.js";
export type { VisualExportOptions, VisualExportResult, VisualFormat } from "./export.js";
