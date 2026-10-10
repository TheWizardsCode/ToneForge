/**
 * ToneForge Visualizer — Aesthetic Palettes
 *
 * Named collections of visual style constraints (colour range, motion
 * intensity, particle density) applied deterministically to generated
 * visual effects. Palettes are semantic, inspectable, and free of hidden
 * randomness, mirroring the Palette PRD.
 *
 * Reference: docs/prd/PALLETE_PRD.md, docs/prd/DEMO_ROADMAP.md (Demo 13)
 */

/** An RGB colour with components in the inclusive 0–255 range. */
export type Rgb = [number, number, number];

/** Visual style dimensions a palette constrains. */
export interface VisualStyle {
  /** Low/high ends of the palette's colour range, as `#RRGGBB` hex. */
  colorRange: [string, string];
  /** Scales effect motion (radius/length). 0 = still, 1 = maximum. */
  motionIntensity: number;
  /** Scales emitted particle count. 0 = none, 1 = dense. */
  particleDensity: number;
}

/** A named, semantic aesthetic palette. */
export interface PaletteDefinition {
  /** Stable palette identifier (snake_case). */
  name: string;
  /** One-line description shown in help/JSON output. */
  description: string;
  /** Visual style constraints. */
  visual: VisualStyle;
}

/** Raised when an unknown palette name is requested. */
export class PaletteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaletteError";
  }
}

/** Palette applied when the caller does not select one. */
export const DEFAULT_PALETTE_NAME = "calm_ui";

/**
 * Built-in palettes.
 *
 * `calm_ui`, `high_energy_combat`, `mystical_magic`, and
 * `industrial_mechanical` come from the Palette PRD §4.1 examples;
 * `sci_fi_neon` and `organic_forest` mirror the Demo 13 roadmap walkthrough.
 */
export const BUILTIN_PALETTES: readonly PaletteDefinition[] = [
  {
    name: "calm_ui",
    description: "Soft blue-grey tones, restrained motion, sparse particles",
    visual: { colorRange: ["#88AABB", "#CCDDEE"], motionIntensity: 0.3, particleDensity: 0.2 },
  },
  {
    name: "high_energy_combat",
    description: "Hot red/amber tones, aggressive motion, dense particles",
    visual: { colorRange: ["#FF3B30", "#FFD60A"], motionIntensity: 0.95, particleDensity: 0.85 },
  },
  {
    name: "mystical_magic",
    description: "Violet/cyan tones, sweeping motion, moderate particles",
    visual: { colorRange: ["#7C3AED", "#22D3EE"], motionIntensity: 0.6, particleDensity: 0.6 },
  },
  {
    name: "industrial_mechanical",
    description: "Steel grey/amber tones, measured motion, moderate particles",
    visual: { colorRange: ["#6B7280", "#F59E0B"], motionIntensity: 0.5, particleDensity: 0.4 },
  },
  {
    name: "sci_fi_neon",
    description: "Blue/cyan neon tones, sharp motion, high contrast",
    visual: { colorRange: ["#0EA5E9", "#22D3EE"], motionIntensity: 0.7, particleDensity: 0.5 },
  },
  {
    name: "organic_forest",
    description: "Green/brown tones, soft motion, low contrast",
    visual: { colorRange: ["#4D7C0F", "#A16207"], motionIntensity: 0.35, particleDensity: 0.35 },
  },
];

/** Return all built-in palettes (a defensive copy). */
export function listPalettes(): PaletteDefinition[] {
  return BUILTIN_PALETTES.map((p) => ({
    ...p,
    visual: { ...p.visual, colorRange: [...p.visual.colorRange] as [string, string] },
  }));
}

/**
 * Resolve a palette by name.
 *
 * @param name - Palette identifier; defaults to {@link DEFAULT_PALETTE_NAME}.
 * @throws {PaletteError} when the name is unknown.
 */
export function resolvePalette(name: string = DEFAULT_PALETTE_NAME): PaletteDefinition {
  const palette = BUILTIN_PALETTES.find((p) => p.name === name);
  if (!palette) {
    const known = BUILTIN_PALETTES.map((p) => p.name).join(", ");
    throw new PaletteError(`Unknown palette '${name}'. Known palettes: ${known}`);
  }
  return {
    ...palette,
    visual: { ...palette.visual, colorRange: [...palette.visual.colorRange] as [string, string] },
  };
}

/**
 * Parse a `#RRGGBB` (or bare `RRGGBB`) hex colour into an {@link Rgb}.
 *
 * @throws {PaletteError} when the value is not a six-digit hex colour.
 */
export function parseHexColor(hex: string): Rgb {
  const value = hex.startsWith("#") ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new PaletteError(`Invalid hex colour '${hex}'. Expected #RRGGBB.`);
  }
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/**
 * Linearly interpolate between two RGB colours.
 *
 * @param a - Colour at `t = 0`.
 * @param b - Colour at `t = 1`.
 * @param t - Interpolation factor (clamped to 0–1).
 */
export function lerpColor(a: Rgb, b: Rgb, t: number): Rgb {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    Math.round(a[0] + (b[0] - a[0]) * clamped),
    Math.round(a[1] + (b[1] - a[1]) * clamped),
    Math.round(a[2] + (b[2] - a[2]) * clamped),
  ];
}
