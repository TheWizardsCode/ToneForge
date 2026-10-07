import { describe, it, expect } from "vitest";
import { generateHapticPattern, hapticStyleForRecipe } from "./pattern.js";
import { resolvePalette } from "../visualizer/palette.js";

const OPTS = {
  envelope: [0, 0, 0.5, 1, 0.5, 0, 0, 0],
  durationSeconds: 0.8,
  palette: resolvePalette("calm_ui"),
  seed: 42,
  style: "impact_thump" as const,
};

describe("hapticStyleForRecipe", () => {
  it("maps UI sounds to a tick", () => {
    expect(hapticStyleForRecipe("UI", ["notification", "chime"])).toBe("ui_tick");
  });

  it("maps footsteps to a footstep pulse", () => {
    expect(hapticStyleForRecipe("Footstep", ["stone"])).toBe("footstep_pulse");
  });

  it("maps impacts to an impact thump", () => {
    expect(hapticStyleForRecipe("Impact", ["slam"])).toBe("impact_thump");
  });

  it("maps sustained sources to a rumble", () => {
    expect(hapticStyleForRecipe("Vehicle", ["engine"])).toBe("sustained_rumble");
  });

  it("falls back to a generic pulse", () => {
    expect(hapticStyleForRecipe("Card Game", ["shuffle"])).toBe("pulse");
  });
});

describe("generateHapticPattern", () => {
  it("emits no pulses for silence", () => {
    const pattern = generateHapticPattern({ ...OPTS, envelope: [0, 0, 0, 0] });
    expect(pattern.pulseCount).toBe(0);
    expect(pattern.totalIntensity).toBe(0);
    expect(pattern.pulses).toEqual([]);
  });

  it("aligns pulse timing to the audio's active region", () => {
    const pattern = generateHapticPattern(OPTS);
    // Frame 2 of 8 over 800 ms → 200 ms.
    expect(pattern.pulses[0]!.atMs).toBe(200);
    for (const pulse of pattern.pulses) {
      expect(pulse.atMs).toBeGreaterThanOrEqual(0);
      expect(pulse.atMs).toBeLessThanOrEqual(pattern.durationMs);
    }
  });

  it("keeps intensities and sharpness bounded in [0, 1]", () => {
    const pattern = generateHapticPattern(OPTS);
    for (const pulse of pattern.pulses) {
      expect(pulse.intensity).toBeGreaterThan(0);
      expect(pulse.intensity).toBeLessThanOrEqual(1);
      expect(pulse.sharpness).toBeGreaterThanOrEqual(0);
      expect(pulse.sharpness).toBeLessThanOrEqual(1);
      expect(pulse.durationMs).toBeGreaterThanOrEqual(10);
    }
  });

  it("scales pulse intensity with the audio amplitude", () => {
    const quiet = generateHapticPattern({ ...OPTS, envelope: [0, 0, 0.2, 0.25, 0, 0, 0, 0] });
    const loud = generateHapticPattern({ ...OPTS, envelope: [0, 0, 0.9, 1, 0, 0, 0, 0] });
    expect(loud.pulses[0]!.intensity).toBeGreaterThan(quiet.pulses[0]!.intensity);
  });

  it("is deterministic for the same seed and palette", () => {
    const a = generateHapticPattern(OPTS);
    const b = generateHapticPattern(OPTS);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("alters tactile characteristics when the palette changes", () => {
    const calm = generateHapticPattern(OPTS);
    const combat = generateHapticPattern({ ...OPTS, palette: resolvePalette("high_energy_combat") });
    expect(combat.pulses).not.toEqual(calm.pulses);
    // Denser, more energetic palette yields more sub-pulses.
    expect(combat.pulseCount).toBeGreaterThan(calm.pulseCount);
    expect(combat.pulses[0]!.sharpness).toBeGreaterThan(calm.pulses[0]!.sharpness);
  });

  it("rejects an empty envelope or non-positive duration", () => {
    expect(() => generateHapticPattern({ ...OPTS, envelope: [] })).toThrow(RangeError);
    expect(() => generateHapticPattern({ ...OPTS, durationSeconds: 0 })).toThrow(RangeError);
  });
});
