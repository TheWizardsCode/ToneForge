/**
 * Unit tests for browser audio utility functions.
 *
 * Tests extractSeed and isGenerateCommand — the pure functions in audio.ts
 * that don't require a browser or Tone.js runtime.
 */
import { describe, it, expect, vi } from "vitest";

// Mock the tone module since it requires a browser environment
vi.mock("tone", () => ({
  start: vi.fn(),
  Offline: vi.fn(),
  Player: vi.fn(() => ({
    toDestination: vi.fn().mockReturnThis(),
    start: vi.fn(),
  })),
}));

const { extractSeed, isGenerateCommand } = await import("../src/audio.js");

describe("extractSeed", () => {
  it("extracts seed from --seed 42 format", () => {
    expect(extractSeed("node dist/cli.js generate --recipe ui-scifi-confirm --seed 42")).toBe(42);
  });

  it("extracts seed from --seed=42 format", () => {
    expect(extractSeed("node dist/cli.js generate --recipe ui-scifi-confirm --seed=42")).toBe(42);
  });

  it("extracts large seed values", () => {
    expect(extractSeed("generate --seed 9999")).toBe(9999);
  });

  it("returns null when no seed is present", () => {
    expect(extractSeed("node dist/cli.js generate --recipe ui-scifi-confirm")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractSeed("")).toBeNull();
  });
});

describe("isGenerateCommand", () => {
  it("returns true for a valid generate command", () => {
    expect(isGenerateCommand("node dist/cli.js generate --recipe ui-scifi-confirm --seed 42")).toBe(
      true,
    );
  });

  it("returns false when missing --seed", () => {
    expect(isGenerateCommand("node dist/cli.js generate --recipe ui-scifi-confirm")).toBe(false);
  });

  it("returns false when missing --recipe", () => {
    expect(isGenerateCommand("node dist/cli.js generate --seed 42")).toBe(false);
  });

  it("returns false for non-generate commands", () => {
    expect(isGenerateCommand("npx vitest run src/core/renderer.test.ts")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isGenerateCommand("")).toBe(false);
  });
});
