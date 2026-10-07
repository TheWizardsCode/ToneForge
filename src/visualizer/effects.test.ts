import { describe, it, expect } from "vitest";
import { generateEffectFrames, styleForRecipe } from "./effects.js";
import type { EffectFrame } from "./effects.js";
import { resolvePalette } from "./palette.js";

const OPTS = {
  width: 24,
  height: 24,
  frameCount: 3,
  envelope: [0, 0.5, 1],
  palette: resolvePalette("sci_fi_neon"),
  seed: 42,
  style: "radial_pulse" as const,
};

function bytes(frame: EffectFrame): number[] {
  return Array.from(frame.rgba);
}

function brightness(frame: EffectFrame): number {
  let sum = 0;
  for (let i = 0; i < frame.rgba.length; i += 4) {
    sum += frame.rgba[i]! + frame.rgba[i + 1]! + frame.rgba[i + 2]!;
  }
  return sum;
}

describe("styleForRecipe", () => {
  it("maps weapon-like sounds to a directional streak", () => {
    expect(styleForRecipe("Weapon", ["laser"])).toBe("directional_streak");
  });

  it("maps impacts and combat to an impact burst", () => {
    expect(styleForRecipe("Impact", ["slam"])).toBe("impact_burst");
    expect(styleForRecipe("Footstep", ["impact", "stone"])).toBe("impact_burst");
  });

  it("maps UI and notification sounds to a radial pulse", () => {
    expect(styleForRecipe("UI", ["notification", "chime"])).toBe("radial_pulse");
  });

  it("falls back to a radial pulse for unmatched categories", () => {
    expect(styleForRecipe("Card Game", ["shuffle"])).toBe("radial_pulse");
  });
});

describe("generateEffectFrames", () => {
  it("produces the requested number of correctly sized frames", () => {
    const frames = generateEffectFrames(OPTS);
    expect(frames).toHaveLength(3);
    for (const frame of frames) {
      expect(frame.width).toBe(24);
      expect(frame.height).toBe(24);
      expect(frame.rgba).toHaveLength(24 * 24 * 4);
    }
  });

  it("is deterministic for the same seed and options", () => {
    const a = generateEffectFrames(OPTS);
    const b = generateEffectFrames(OPTS);
    expect(a.map(bytes)).toEqual(b.map(bytes));
  });

  it("changes output when the seed changes", () => {
    const a = generateEffectFrames(OPTS);
    const b = generateEffectFrames({ ...OPTS, seed: 7 });
    expect(a.map(bytes)).not.toEqual(b.map(bytes));
  });

  it("changes output when the palette changes (palette-aware effects)", () => {
    const a = generateEffectFrames(OPTS);
    const b = generateEffectFrames({ ...OPTS, palette: resolvePalette("high_energy_combat") });
    expect(a.map(bytes)).not.toEqual(b.map(bytes));
  });

  it("scales visual brightness with the audio envelope (audio synchronisation)", () => {
    const low = generateEffectFrames({
      ...OPTS,
      frameCount: 1,
      envelope: [0.05],
    })[0]!;
    const high = generateEffectFrames({
      ...OPTS,
      frameCount: 1,
      envelope: [1],
    })[0]!;
    expect(brightness(high)).toBeGreaterThan(brightness(low));
  });

  it("renders visibly different output for each effect style", () => {
    const pulse = generateEffectFrames({ ...OPTS, frameCount: 1, envelope: [1] })[0]!;
    const burst = generateEffectFrames({
      ...OPTS,
      frameCount: 1,
      envelope: [1],
      style: "impact_burst",
    })[0]!;
    const streak = generateEffectFrames({
      ...OPTS,
      frameCount: 1,
      envelope: [1],
      style: "directional_streak",
    })[0]!;
    expect(bytes(pulse)).not.toEqual(bytes(burst));
    expect(bytes(burst)).not.toEqual(bytes(streak));
    expect(bytes(pulse)).not.toEqual(bytes(streak));
  });

  it("rejects an envelope whose length does not match frameCount", () => {
    expect(() => generateEffectFrames({ ...OPTS, envelope: [1] })).toThrow(RangeError);
  });

  it("rejects invalid dimensions", () => {
    expect(() => generateEffectFrames({ ...OPTS, width: 0 })).toThrow(RangeError);
    expect(() => generateEffectFrames({ ...OPTS, frameCount: 0 })).toThrow(RangeError);
  });
});
