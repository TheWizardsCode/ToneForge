/**
 * ToneForge Visualizer — Export Pipeline
 *
 * Orchestrates deterministic visual export: render the recipe's audio, derive
 * a frame-aligned amplitude envelope, generate palette-aware effect frames,
 * and write a sprite sheet (or individual frames) plus metadata.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 13 — Visualizer)
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderRecipe } from "../core/renderer.js";
import { registry } from "../recipes/index.js";
import { buildAmplitudeEnvelope } from "./envelope.js";
import { generateEffectFrames, styleForRecipe } from "./effects.js";
import type { VisualEffectStyle } from "./effects.js";
import { resolvePalette } from "./palette.js";
import { encodePng } from "./png.js";
import { buildSpriteSheetMetadata, composeSpriteSheet } from "./spritesheet.js";

/** Supported export formats. */
export const VISUAL_FORMATS = ["spritesheet", "frames"] as const;

/** An export format name. */
export type VisualFormat = (typeof VISUAL_FORMATS)[number];

/** Default animation frame count. */
export const DEFAULT_FRAME_COUNT = 8;
/** Default frame width/height in pixels. */
export const DEFAULT_FRAME_SIZE = 64;

/** Options for {@link exportVisual}. */
export interface VisualExportOptions {
  /** Registered recipe name to visualise. */
  recipe: string;
  /** Deterministic integer seed. */
  seed: number;
  /** Export format: `spritesheet` or `frames`. */
  format: string;
  /** Output directory (created if missing). */
  outputDir: string;
  /** Palette name; defaults to `calm_ui`. */
  palette?: string;
  /** Number of animation frames (default {@link DEFAULT_FRAME_COUNT}). */
  frames?: number;
  /** Frame width in pixels (default {@link DEFAULT_FRAME_SIZE}). */
  width?: number;
  /** Frame height in pixels (default {@link DEFAULT_FRAME_SIZE}). */
  height?: number;
}

/** Result of a successful export, suitable for `--json` output. */
export interface VisualExportResult {
  command: "visualize export";
  recipe: string;
  seed: number;
  palette: string;
  effect: VisualEffectStyle;
  format: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  output: string;
  files: string[];
  spriteSheet?: string;
  metadata?: string;
}

/**
 * Export deterministic visual assets for a recipe.
 *
 * @throws {Error} on unknown recipe, invalid format, or invalid dimensions.
 */
export async function exportVisual(
  options: VisualExportOptions,
): Promise<VisualExportResult> {
  const {
    recipe,
    seed,
    format,
    outputDir,
    palette: paletteName,
    frames: frameCountRaw = DEFAULT_FRAME_COUNT,
    width: widthRaw = DEFAULT_FRAME_SIZE,
    height: heightRaw = DEFAULT_FRAME_SIZE,
  } = options;

  if (!(VISUAL_FORMATS as readonly string[]).includes(format)) {
    throw new Error(
      `Unsupported format '${format}'. Supported formats: ${VISUAL_FORMATS.join(", ")}`,
    );
  }
  if (!Number.isInteger(seed)) {
    throw new Error(`seed must be an integer, got '${seed}'`);
  }
  if (!Number.isInteger(frameCountRaw) || frameCountRaw < 1) {
    throw new Error(`frames must be a positive integer, got '${frameCountRaw}'`);
  }
  if (!Number.isInteger(widthRaw) || widthRaw < 1 || !Number.isInteger(heightRaw) || heightRaw < 1) {
    throw new Error(`width and height must be positive integers, got '${widthRaw}x${heightRaw}'`);
  }

  const registration = registry.getRegistration(recipe);
  if (!registration) {
    throw new Error(`Recipe not found: ${recipe}`);
  }

  const palette = resolvePalette(paletteName);
  const effect = styleForRecipe(registration.category, registration.tags ?? []);

  const render = await renderRecipe(recipe, seed);
  const envelope = buildAmplitudeEnvelope(render.samples, render.sampleRate, frameCountRaw);
  const frames = generateEffectFrames({
    width: widthRaw,
    height: heightRaw,
    frameCount: frameCountRaw,
    envelope,
    palette,
    seed,
    style: effect,
  });

  const dir = outputDir;
  await mkdir(dir, { recursive: true });
  const base = `${recipe}-seed-${seed}-${palette.name}`;
  const files: string[] = [];

  let spriteSheetPath: string | undefined;
  let metadataPath: string | undefined;

  if (format === "spritesheet") {
    const sheet = composeSpriteSheet(frames);
    spriteSheetPath = join(dir, `${base}-spritesheet.png`);
    await writeFile(spriteSheetPath, encodePng(sheet.width, sheet.height, sheet.rgba));
    files.push(spriteSheetPath);

    metadataPath = join(dir, `${base}-spritesheet.json`);
    const metadata = {
      command: "visualize export",
      recipe,
      seed,
      palette: palette.name,
      effect,
      format,
      width: sheet.width,
      height: sheet.height,
      ...buildSpriteSheetMetadata(sheet),
    };
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    files.push(metadataPath);
  } else {
    const framePaths: string[] = [];
    for (let index = 0; index < frames.length; index++) {
      const frame = frames[index]!;
      const framePath = join(dir, `${base}-frame-${String(index).padStart(3, "0")}.png`);
      await writeFile(framePath, encodePng(frame.width, frame.height, frame.rgba));
      framePaths.push(framePath);
    }
    files.push(...framePaths);
    metadataPath = join(dir, `${base}-frames.json`);
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          command: "visualize export",
          recipe,
          seed,
          palette: palette.name,
          effect,
          format,
          frameWidth: widthRaw,
          frameHeight: heightRaw,
          frameCount: frameCountRaw,
          frames: framePaths.map((file, index) => ({ index, file })),
        },
        null,
        2,
      ),
    );
    files.push(metadataPath);
  }

  return {
    command: "visualize export",
    recipe,
    seed,
    palette: palette.name,
    effect,
    format,
    frameCount: frameCountRaw,
    frameWidth: widthRaw,
    frameHeight: heightRaw,
    output: dir,
    files,
    ...(spriteSheetPath ? { spriteSheet: spriteSheetPath } : {}),
    ...(metadataPath ? { metadata: metadataPath } : {}),
  };
}
