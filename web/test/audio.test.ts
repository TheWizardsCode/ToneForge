/**
 * Unit tests for browser audio utility functions.
 *
 * Tests extractSeed, extractRecipeName, and isGenerateCommand — the pure
 * functions in audio.ts that don't require a browser or Tone.js runtime.
 *
 * Since audio.ts now uses dynamic import() for tone (lazy-loaded on first
 * user gesture), these pure functions can be imported without triggering
 * any AudioContext creation.
 */
import { describe, it, expect } from "vitest";
import { extractSeed, extractRecipeName, isGenerateCommand } from "../src/audio.js";

describe("extractSeed", () => {
  it("extracts seed from --seed 42 format", () => {
    expect(extractSeed("tf generate --recipe ui-scifi-confirm --seed 42")).toBe(42);
  });

  it("extracts seed from --seed=42 format", () => {
    expect(extractSeed("tf generate --recipe ui-scifi-confirm --seed=42")).toBe(42);
  });

  it("extracts large seed values", () => {
    expect(extractSeed("generate --seed 9999")).toBe(9999);
  });

  it("returns null when no seed is present", () => {
    expect(extractSeed("tf generate --recipe ui-scifi-confirm")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractSeed("")).toBeNull();
  });
});

describe("extractRecipeName", () => {
  it("extracts recipe name from --recipe ui-scifi-confirm", () => {
    expect(
      extractRecipeName("tf generate --recipe ui-scifi-confirm --seed 42"),
    ).toBe("ui-scifi-confirm");
  });

  it("extracts recipe name from --recipe weapon-laser-zap", () => {
    expect(
      extractRecipeName("tf generate --recipe weapon-laser-zap --seed 7"),
    ).toBe("weapon-laser-zap");
  });

  it("extracts recipe name from --recipe footstep-stone", () => {
    expect(
      extractRecipeName("generate --recipe footstep-stone --seed 100"),
    ).toBe("footstep-stone");
  });

  it("extracts recipe name from --recipe ui-notification-chime", () => {
    expect(
      extractRecipeName("generate --recipe ui-notification-chime --seed 1"),
    ).toBe("ui-notification-chime");
  });

  it("extracts recipe name from --recipe ambient-wind-gust", () => {
    expect(
      extractRecipeName("generate --recipe ambient-wind-gust --seed 55"),
    ).toBe("ambient-wind-gust");
  });

  it("returns null when no --recipe is present", () => {
    expect(extractRecipeName("tf generate --seed 42")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractRecipeName("")).toBeNull();
  });
});

describe("isGenerateCommand", () => {
  it("returns true for a valid generate command with ui-scifi-confirm", () => {
    expect(isGenerateCommand("tf generate --recipe ui-scifi-confirm --seed 42")).toBe(
      true,
    );
  });

  it("returns true for a valid generate command with weapon-laser-zap", () => {
    expect(isGenerateCommand("tf generate --recipe weapon-laser-zap --seed 7")).toBe(
      true,
    );
  });

  it("returns true for a valid generate command with footstep-stone", () => {
    expect(isGenerateCommand("generate --recipe footstep-stone --seed 100")).toBe(true);
  });

  it("returns true for a valid generate command with ui-notification-chime", () => {
    expect(isGenerateCommand("generate --recipe ui-notification-chime --seed 1")).toBe(true);
  });

  it("returns true for a valid generate command with ambient-wind-gust", () => {
    expect(isGenerateCommand("generate --recipe ambient-wind-gust --seed 55")).toBe(true);
  });

  it("returns false when missing --seed", () => {
    expect(isGenerateCommand("tf generate --recipe ui-scifi-confirm")).toBe(false);
  });

  it("returns false when missing --recipe", () => {
    expect(isGenerateCommand("tf generate --seed 42")).toBe(false);
  });

  it("returns false for non-generate commands", () => {
    expect(isGenerateCommand("npx vitest run src/core/renderer.test.ts")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isGenerateCommand("")).toBe(false);
  });
});
