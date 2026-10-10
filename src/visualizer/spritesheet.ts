/**
 * ToneForge Visualizer — Sprite Sheet Composition
 *
 * Packs deterministic effect frames into a single sprite sheet texture and
 * describes the frame grid in metadata suitable for game-engine import.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 13 — sprite sheet export)
 */

import type { EffectFrame } from "./effects.js";

/** A packed sprite sheet texture. */
export interface SpriteSheet {
  /** Sheet width in pixels. */
  width: number;
  /** Sheet height in pixels. */
  height: number;
  /** Individual frame width in pixels. */
  frameWidth: number;
  /** Individual frame height in pixels. */
  frameHeight: number;
  /** Number of frames packed. */
  frameCount: number;
  /** Grid columns used. */
  columns: number;
  /** Grid rows used. */
  rows: number;
  /** Row-major RGBA8 pixels, length `width * height * 4`. */
  rgba: Uint8Array;
}

/** Frame-grid metadata emitted alongside a sprite sheet. */
export interface SpriteSheetMetadata {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  rows: number;
  /** Frames laid out left-to-right, top-to-bottom. */
  frames: Array<{ index: number; x: number; y: number }>;
}

/**
 * Pack frames into a single sprite sheet.
 *
 * Frames must share identical dimensions. When `columns` is omitted the sheet
 * is a single horizontal strip (one row). Frames are placed left-to-right,
 * top-to-bottom.
 *
 * @throws {RangeError} when `frames` is empty, dimensions differ, or
 *         `columns` is not a positive integer.
 */
export function composeSpriteSheet(frames: EffectFrame[], columns?: number): SpriteSheet {
  if (frames.length === 0) {
    throw new RangeError("Cannot compose a sprite sheet from zero frames");
  }
  const { width: frameWidth, height: frameHeight } = frames[0]!;
  for (const frame of frames) {
    if (frame.width !== frameWidth || frame.height !== frameHeight) {
      throw new RangeError("All frames must share identical dimensions");
    }
  }

  const cols = columns ?? frames.length;
  if (!Number.isInteger(cols) || cols < 1) {
    throw new RangeError(`columns must be a positive integer, got ${columns}`);
  }
  const rows = Math.ceil(frames.length / cols);
  const width = frameWidth * cols;
  const height = frameHeight * rows;
  const rgba = new Uint8Array(width * height * 4);

  const rowBytes = frameWidth * 4;
  frames.forEach((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    for (let y = 0; y < frameHeight; y++) {
      const srcStart = y * rowBytes;
      const destStart = ((row * frameHeight + y) * width + col * frameWidth) * 4;
      rgba.set(frame.rgba.subarray(srcStart, srcStart + rowBytes), destStart);
    }
  });

  return { width, height, frameWidth, frameHeight, frameCount: frames.length, columns: cols, rows, rgba };
}

/** Build the frame-grid metadata describing a packed sprite sheet. */
export function buildSpriteSheetMetadata(sheet: SpriteSheet): SpriteSheetMetadata {
  const frames = Array.from({ length: sheet.frameCount }, (_, index) => ({
    index,
    x: (index % sheet.columns) * sheet.frameWidth,
    y: Math.floor(index / sheet.columns) * sheet.frameHeight,
  }));
  return {
    frameWidth: sheet.frameWidth,
    frameHeight: sheet.frameHeight,
    frameCount: sheet.frameCount,
    columns: sheet.columns,
    rows: sheet.rows,
    frames,
  };
}
