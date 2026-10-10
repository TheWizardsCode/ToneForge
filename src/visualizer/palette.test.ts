import { describe, it, expect } from "vitest";
import {
  BUILTIN_PALETTES,
  DEFAULT_PALETTE_NAME,
  PaletteError,
  lerpColor,
  listPalettes,
  parseHexColor,
  resolvePalette,
} from "./palette.js";

describe("visualizer palettes", () => {
  it("lists the built-in palettes including the documented examples", () => {
    const names = listPalettes().map((p) => p.name);
    expect(names).toContain(DEFAULT_PALETTE_NAME);
    expect(names).toContain("high_energy_combat");
    expect(names).toContain("mystical_magic");
    expect(names).toContain("industrial_mechanical");
    expect(names).toContain("sci_fi_neon");
    expect(names).toContain("organic_forest");
    expect(names.length).toBe(BUILTIN_PALETTES.length);
  });

  it("resolves the default palette when no name is supplied", () => {
    expect(resolvePalette().name).toBe(DEFAULT_PALETTE_NAME);
  });

  it("resolves a palette by name with its visual constraints", () => {
    const palette = resolvePalette("high_energy_combat");
    expect(palette.visual.colorRange).toEqual(["#FF3B30", "#FFD60A"]);
    expect(palette.visual.motionIntensity).toBeGreaterThan(0.5);
    expect(palette.visual.particleDensity).toBeGreaterThan(0.5);
  });

  it("throws PaletteError with the known names for an unknown palette", () => {
    expect(() => resolvePalette("does_not_exist")).toThrow(PaletteError);
    expect(() => resolvePalette("does_not_exist")).toThrow(/calm_ui/);
  });

  it("returns a defensive copy so callers cannot mutate the built-ins", () => {
    const first = resolvePalette("calm_ui");
    first.visual.colorRange[0] = "#000000";
    expect(resolvePalette("calm_ui").visual.colorRange[0]).toBe("#88AABB");
  });

  it("parses hex colours with and without a leading hash", () => {
    expect(parseHexColor("#FF3B30")).toEqual([255, 59, 48]);
    expect(parseHexColor("22D3EE")).toEqual([34, 211, 238]);
  });

  it("rejects malformed hex colours", () => {
    expect(() => parseHexColor("#12345")).toThrow(PaletteError);
    expect(() => parseHexColor("zzzzzz")).toThrow(PaletteError);
  });

  it("linearly interpolates between two colours and clamps out-of-range factors", () => {
    expect(lerpColor([0, 0, 0], [255, 255, 255], 0)).toEqual([0, 0, 0]);
    expect(lerpColor([0, 0, 0], [255, 255, 255], 1)).toEqual([255, 255, 255]);
    expect(lerpColor([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25]);
    expect(lerpColor([0, 0, 0], [255, 255, 255], -5)).toEqual([0, 0, 0]);
    expect(lerpColor([0, 0, 0], [255, 255, 255], 5)).toEqual([255, 255, 255]);
  });
});
