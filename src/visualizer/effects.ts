/**
 * ToneForge Visualizer — Deterministic Effect Generation
 *
 * Renders procedural, audio-synchronised visual effect frames. Every frame is
 * driven by (a) the palette's colour range and motion/particle intensity and
 * (b) the audio amplitude envelope for that frame, so visuals stay locked to
 * the sound while remaining byte-identical for the same seed + palette.
 *
 * Reference: docs/prd/VISUALIZE_PRD.md §6 (Deterministic Visual Recipes),
 *            docs/prd/DEMO_ROADMAP.md (Demo 13)
 */

import { createRng } from "../core/rng.js";
import { lerpColor, parseHexColor } from "./palette.js";
import type { PaletteDefinition, Rgb } from "./palette.js";

/** Visual effect families the generator can render. */
export type VisualEffectStyle =
  | "radial_pulse"
  | "impact_burst"
  | "directional_streak";

/** A single rendered animation frame. */
export interface EffectFrame {
  /** Frame width in pixels. */
  width: number;
  /** Frame height in pixels. */
  height: number;
  /** Row-major RGBA8 pixels, length `width * height * 4`. */
  rgba: Uint8Array;
}

/** Options for {@link generateEffectFrames}. */
export interface GenerateFramesOptions {
  /** Frame width in pixels (must be >= 1). */
  width: number;
  /** Frame height in pixels (must be >= 1). */
  height: number;
  /** Number of frames to generate (must be >= 1). */
  frameCount: number;
  /** Per-frame intensity in [0, 1]; length must equal `frameCount`. */
  envelope: number[];
  /** Palette controlling colour and motion. */
  palette: PaletteDefinition;
  /** Deterministic integer seed. */
  seed: number;
  /** Effect family to render. */
  style: VisualEffectStyle;
}

/**
 * Map a recipe's category/tags to a visual effect family.
 *
 * The mapping is intentionally simple and inspectable: weapons and projectiles
 * streak, impacts and explosions burst, UI/notification sounds pulse, and
 * everything else falls back to a radial pulse.
 */
export function styleForRecipe(
  category: string,
  tags: readonly string[] = [],
): VisualEffectStyle {
  const haystack = [category, ...tags].map((v) => v.toLowerCase());
  const has = (...needles: string[]): boolean =>
    haystack.some((value) => needles.some((n) => value.includes(n)));

  if (has("weapon", "laser", "projectile", "gun", "sword", "strike")) {
    return "directional_streak";
  }
  if (has("impact", "explosion", "combat", "hit", "crack", "slam", "rumble")) {
    return "impact_burst";
  }
  if (has("ui", "notification", "confirm", "alert", "chime", "click")) {
    return "radial_pulse";
  }
  return "radial_pulse";
}

/**
 * Generate a deterministic sequence of effect frames.
 *
 * @throws {RangeError} when dimensions are invalid or the envelope length
 *         does not match `frameCount`.
 */
export function generateEffectFrames(options: GenerateFramesOptions): EffectFrame[] {
  const { width, height, frameCount, envelope, palette, seed, style } = options;
  if (!Number.isInteger(width) || width < 1) {
    throw new RangeError(`width must be a positive integer, got ${width}`);
  }
  if (!Number.isInteger(height) || height < 1) {
    throw new RangeError(`height must be a positive integer, got ${height}`);
  }
  if (!Number.isInteger(frameCount) || frameCount < 1) {
    throw new RangeError(`frameCount must be a positive integer, got ${frameCount}`);
  }
  if (envelope.length !== frameCount) {
    throw new RangeError(
      `envelope length ${envelope.length} does not match frameCount ${frameCount}`,
    );
  }

  const colorLow = parseHexColor(palette.visual.colorRange[0]);
  const colorHigh = parseHexColor(palette.visual.colorRange[1]);
  const motion = clamp01(palette.visual.motionIntensity);
  const density = clamp01(palette.visual.particleDensity);

  const frames: EffectFrame[] = [];
  for (let frame = 0; frame < frameCount; frame++) {
    const intensity = clamp01(envelope[frame] ?? 0);
    const rgba = new Uint8Array(width * height * 4);
    paintBackground(rgba, width, height, colorLow);
    const rng = createRng((seed ^ Math.imul(frame + 1, 0x9e3779b1)) >>> 0);

    if (style === "impact_burst") {
      drawImpactBurst(rgba, width, height, intensity, motion, density, colorLow, colorHigh, rng);
    } else if (style === "directional_streak") {
      drawDirectionalStreak(rgba, width, height, intensity, motion, density, colorLow, colorHigh, rng);
    } else {
      drawRadialPulse(rgba, width, height, intensity, motion, density, colorLow, colorHigh, rng);
    }

    frames.push({ width, height, rgba });
  }
  return frames;
}

/** Fill the frame with a dark tint of the palette's low colour. */
function paintBackground(
  rgba: Uint8Array,
  width: number,
  height: number,
  colorLow: Rgb,
): void {
  const [r, g, b] = colorLow.map((c) => Math.round(c * 0.12)) as Rgb;
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    rgba[idx] = r;
    rgba[idx + 1] = g;
    rgba[idx + 2] = b;
    rgba[idx + 3] = 255;
  }
}

/** Source-over blend of `color` at `alpha` into the frame at pixel `idx`. */
function blendPixel(
  rgba: Uint8Array,
  idx: number,
  color: Rgb,
  alpha: number,
): void {
  const a = clamp01(alpha);
  if (a <= 0) {
    return;
  }
  const inv = 1 - a;
  rgba[idx] = clamp255(color[0] * a + (rgba[idx] ?? 0) * inv);
  rgba[idx + 1] = clamp255(color[1] * a + (rgba[idx + 1] ?? 0) * inv);
  rgba[idx + 2] = clamp255(color[2] * a + (rgba[idx + 2] ?? 0) * inv);
  rgba[idx + 3] = 255;
}

/** Radial pulse: an expanding soft disc with a sparse particle halo. */
function drawRadialPulse(
  rgba: Uint8Array,
  width: number,
  height: number,
  intensity: number,
  motion: number,
  density: number,
  colorLow: Rgb,
  colorHigh: Rgb,
  rng: () => number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) / 2;
  const radius = maxR * (0.15 + 0.75 * intensity * (0.4 + 0.6 * motion));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (dist > radius) {
        continue;
      }
      const t = radius === 0 ? 0 : dist / radius;
      const color = lerpColor(colorHigh, colorLow, t);
      const alpha = (1 - t) * (0.35 + 0.65 * intensity);
      blendPixel(rgba, (y * width + x) * 4, color, alpha);
    }
  }

  const particles = Math.round(density * 40 * intensity);
  for (let p = 0; p < particles; p++) {
    const angle = rng() * Math.PI * 2;
    const dist = radius * (0.6 + rng() * 0.9);
    const px = Math.round(cx + Math.cos(angle) * dist);
    const py = Math.round(cy + Math.sin(angle) * dist);
    plot(rgba, width, height, px, py, colorHigh, 0.6 + 0.4 * intensity);
  }
}

/** Impact burst: radial spikes plus a bright core, scaled by intensity. */
function drawImpactBurst(
  rgba: Uint8Array,
  width: number,
  height: number,
  intensity: number,
  motion: number,
  density: number,
  colorLow: Rgb,
  colorHigh: Rgb,
  rng: () => number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) / 2;
  const rays = 8 + Math.round(density * 8);
  const length = maxR * (0.3 + 0.7 * intensity * (0.4 + 0.6 * motion));
  const rotation = rng() * Math.PI * 2;

  for (let r = 0; r < rays; r++) {
    const angle = rotation + (r / rays) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (let step = 0; step <= length; step++) {
      const t = length === 0 ? 0 : step / length;
      const widthPx = Math.max(1, Math.round((1 - t) * (1 + intensity * 2)));
      const color = lerpColor(colorHigh, colorLow, t);
      const alpha = (1 - t) * (0.4 + 0.6 * intensity);
      for (let off = -widthPx; off <= widthPx; off++) {
        const px = Math.round(cx + dx * step - dy * off);
        const py = Math.round(cy + dy * step + dx * off);
        plot(rgba, width, height, px, py, color, alpha);
      }
    }
  }

  // Bright core.
  const coreR = Math.max(1, maxR * 0.12 * (0.5 + intensity));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (dist <= coreR) {
        blendPixel(rgba, (y * width + x) * 4, colorHigh, (1 - dist / coreR) * (0.5 + 0.5 * intensity));
      }
    }
  }
}

/** Directional streak: a tapered horizontal band with trailing particles. */
function drawDirectionalStreak(
  rgba: Uint8Array,
  width: number,
  height: number,
  intensity: number,
  motion: number,
  density: number,
  colorLow: Rgb,
  colorHigh: Rgb,
  rng: () => number,
): void {
  const cy = height / 2;
  const direction = rng() < 0.5 ? 1 : -1;
  const length = width * (0.25 + 0.7 * intensity * (0.4 + 0.6 * motion));
  const bandHalf = Math.max(1, (height * (0.08 + 0.25 * intensity)) / 2);
  const startX = direction > 0 ? 0 : width - 1;
  const endX = direction > 0 ? Math.round(length) : width - 1 - Math.round(length);

  for (let x = Math.min(startX, endX); x <= Math.max(startX, endX); x++) {
    const travelled = Math.abs(x - startX);
    const t = length === 0 ? 0 : Math.min(1, travelled / length);
    const color = lerpColor(colorLow, colorHigh, t);
    const alpha = (1 - t) * (0.35 + 0.65 * intensity);
    const taper = Math.max(0, 1 - t);
    const half = Math.max(1, Math.round(bandHalf * (0.4 + 0.6 * taper)));
    for (let off = -half; off <= half; off++) {
      const y = Math.round(cy + off);
      plot(rgba, width, height, x, y, color, alpha * (1 - Math.abs(off) / (half + 1)));
    }
  }

  const particles = Math.round(density * 30 * intensity);
  for (let p = 0; p < particles; p++) {
    const px = Math.round(startX + direction * rng() * length);
    const py = Math.round(cy + (rng() * 2 - 1) * bandHalf * 1.5);
    plot(rgba, width, height, px, py, colorHigh, 0.4 + 0.5 * intensity);
  }
}

/** Plot a single pixel with bounds checking. */
function plot(
  rgba: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  color: Rgb,
  alpha: number,
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }
  blendPixel(rgba, (y * width + x) * 4, color, alpha);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function clamp255(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded > 255 ? 255 : rounded;
}
