/**
 * Tests for the shared SoundEditor fixtures.
 *
 * AC (TF-0MUV11IXS007W29J): the fixtures module exports representative cases
 * covering at least one oscillator recipe (weapon-laser-zap), one noise/filter
 * recipe (footstep-stone) and one file-backed ToneGraph recipe; each fixture
 * carries its seed and declared parameter descriptors sourced from the shared
 * recipe registry.
 */
import { describe, it, expect } from "vitest";
import {
  EDITOR_FIXTURES,
  descriptorsFor,
  getEditorFixture,
  type EditorFixtureKind,
} from "./fixtures/editor-fixtures.js";
import { registry } from "../../src/recipes/index.js";

describe("editor fixtures", () => {
  it("covers every required synthesis category", () => {
    const kinds = new Set<EditorFixtureKind>(
      EDITOR_FIXTURES.map((fixture) => fixture.kind),
    );
    expect(kinds).toEqual(
      new Set<EditorFixtureKind>(["oscillator", "noise-filter", "file-backed"]),
    );
  });

  it("references the named representative recipes", () => {
    const recipes = EDITOR_FIXTURES.map((fixture) => fixture.recipe);
    expect(recipes).toContain("weapon-laser-zap");
    expect(recipes).toContain("footstep-stone");
    // A recipe that is only available through file-backed ToneGraph discovery.
    expect(recipes).toContain("ambient-wind-gust");
  });

  it("resolves every fixture recipe in the shared registry", () => {
    for (const fixture of EDITOR_FIXTURES) {
      expect(registry.getRegistration(fixture.recipe)).toBeDefined();
    }
  });

  it("gives every fixture a finite integer seed", () => {
    for (const fixture of EDITOR_FIXTURES) {
      expect(Number.isInteger(fixture.seed)).toBe(true);
      expect(Number.isFinite(fixture.seed)).toBe(true);
    }
  });

  it("exposes non-empty, well-formed parameter descriptors for every fixture", () => {
    for (const fixture of EDITOR_FIXTURES) {
      expect(fixture.descriptors.length).toBeGreaterThan(0);
      for (const descriptor of fixture.descriptors) {
        expect(descriptor.name).toBeTruthy();
        expect(descriptor.unit).toBeTruthy();
        expect(descriptor.max).toBeGreaterThan(descriptor.min);
      }
    }
  });

  it("keeps fixture descriptors identical to the registry's declared params", () => {
    for (const fixture of EDITOR_FIXTURES) {
      const registration = registry.getRegistration(fixture.recipe);
      expect(registration).toBeDefined();
      expect(fixture.descriptors).toEqual(registration?.params);
    }
  });

  it("returns copies of descriptors so callers cannot mutate the registry", () => {
    const recipe = "footstep-stone";
    const first = descriptorsFor(recipe);
    first[0].min = -999;
    const second = descriptorsFor(recipe);
    expect(second[0].min).not.toBe(-999);
  });

  it("looks fixtures up by id and rejects unknown ids", () => {
    const fixture = getEditorFixture("oscillator-laser");
    expect(fixture.recipe).toBe("weapon-laser-zap");
    expect(() => getEditorFixture("does-not-exist")).toThrow(/Unknown editor fixture/);
  });

  it("fails descriptively when a recipe is not registered", () => {
    expect(() => descriptorsFor("not-a-real-recipe")).toThrow(/not registered/);
  });
});
