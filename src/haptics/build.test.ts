import { describe, it, expect } from "vitest";
import { buildHapticPattern } from "./build.js";

describe("buildHapticPattern", () => {
  it("builds an audio-backed pattern and records the recipe", async () => {
    const pattern = await buildHapticPattern({
      recipe: "weapon-laser-zap",
      seed: 42,
      frameCount: 16,
    });
    expect(pattern.recipe).toBe("weapon-laser-zap");
    expect(pattern.command).toBe("haptic pattern");
    expect(pattern.pulseCount).toBeGreaterThan(0);
    expect(pattern.durationMs).toBeGreaterThan(0);
  });

  it("selects the tactile style from the recipe metadata", async () => {
    const ui = await buildHapticPattern({ recipe: "ui-scifi-confirm", seed: 7 });
    expect(ui.style).toBe("ui_tick");
  });

  it("is deterministic for the same seed and palette", async () => {
    const a = await buildHapticPattern({ recipe: "weapon-laser-zap", seed: 42 });
    const b = await buildHapticPattern({ recipe: "weapon-laser-zap", seed: 42 });
    expect(a).toEqual(b);
  });

  it("changes tactile output when the palette changes", async () => {
    const calm = await buildHapticPattern({
      recipe: "weapon-laser-zap",
      seed: 42,
      palette: "calm_ui",
    });
    const combat = await buildHapticPattern({
      recipe: "weapon-laser-zap",
      seed: 42,
      palette: "high_energy_combat",
    });
    expect(calm.pulses).not.toEqual(combat.pulses);
  });

  it("rejects unknown recipes", async () => {
    await expect(buildHapticPattern({ recipe: "nope-not-real", seed: 1 })).rejects.toThrow(
      /Recipe not found/,
    );
  });
});
