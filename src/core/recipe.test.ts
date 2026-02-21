import { describe, it, expect } from "vitest";
import { RecipeRegistry } from "./recipe.js";
import type { Recipe, RecipeFactory } from "./recipe.js";
import { createRng } from "./rng.js";

describe("RecipeRegistry", () => {
  it("registers and retrieves a recipe factory", () => {
    const reg = new RecipeRegistry();
    const factory: RecipeFactory = (_rng) => ({
      start: () => {},
      stop: () => {},
      toDestination: () => {},
      duration: 1,
    });

    reg.register("test-recipe", factory);
    expect(reg.getRecipe("test-recipe")).toBe(factory);
  });

  it("returns undefined for unregistered recipe", () => {
    const reg = new RecipeRegistry();
    expect(reg.getRecipe("nonexistent")).toBeUndefined();
  });

  it("lists all registered recipe names", () => {
    const reg = new RecipeRegistry();
    const factory: RecipeFactory = (_rng) => ({
      start: () => {},
      stop: () => {},
      toDestination: () => {},
      duration: 1,
    });

    reg.register("alpha", factory);
    reg.register("beta", factory);

    const names = reg.list();
    expect(names).toContain("alpha");
    expect(names).toContain("beta");
    expect(names).toHaveLength(2);
  });

  it("overwrites existing factory with same name", () => {
    const reg = new RecipeRegistry();
    const factory1: RecipeFactory = (_rng) => ({
      start: () => {},
      stop: () => {},
      toDestination: () => {},
      duration: 1,
    });
    const factory2: RecipeFactory = (_rng) => ({
      start: () => {},
      stop: () => {},
      toDestination: () => {},
      duration: 2,
    });

    reg.register("same", factory1);
    reg.register("same", factory2);
    expect(reg.getRecipe("same")).toBe(factory2);
  });
});

describe("Recipe interface compliance", () => {
  it("factory returns an object with start, stop, toDestination, and duration", () => {
    const factory: RecipeFactory = (rng) => ({
      start: (_time: number) => {},
      stop: (_time: number) => {},
      toDestination: () => {},
      duration: 0.5,
    });

    const recipe: Recipe = factory(createRng(42));
    expect(typeof recipe.start).toBe("function");
    expect(typeof recipe.stop).toBe("function");
    expect(typeof recipe.toDestination).toBe("function");
    expect(typeof recipe.duration).toBe("number");
  });
});
