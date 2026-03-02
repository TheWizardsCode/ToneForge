import { describe, it, expect } from "vitest";
import { RecipeRegistry } from "./recipe.js";
import type {
  Recipe,
  RecipeFactory,
  RecipeRegistration,
  LazyRecipeRegistration,
} from "./recipe.js";
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

/** Helper: create a full RecipeRegistration for tests. */
function makeRegistration(
  overrides: Partial<RecipeRegistration> = {},
): RecipeRegistration {
  return {
    factory: (_rng) => ({
      start: () => {},
      stop: () => {},
      toDestination: () => {},
      duration: 1,
    }),
    getDuration: () => 1,
    buildOfflineGraph: () => {},
    description: overrides.description ?? "A test recipe",
    category: overrides.category ?? "weapon",
    tags: overrides.tags ?? ["sharp", "bright"],
    signalChain: "Oscillator -> Destination",
    params: [],
    getParams: () => ({}),
    ...overrides,
  };
}

/** Helper: create a LazyRecipeRegistration for tests. */
function makeLazyRegistration(
  overrides: Partial<LazyRecipeRegistration> = {},
): LazyRecipeRegistration {
  return {
    factoryLoader: async () =>
      (_rng) => ({
        start: () => {},
        stop: () => {},
        toDestination: () => {},
        duration: 1,
      }),
    getDuration: () => 1,
    buildOfflineGraph: () => {},
    description: overrides.description ?? "A lazy test recipe",
    category: overrides.category ?? "ui",
    tags: overrides.tags ?? ["click", "interface"],
    signalChain: "Oscillator -> Destination",
    params: [],
    getParams: () => ({}),
    ...overrides,
  };
}

describe("RecipeRegistry.listDetailed", () => {
  it("returns all recipes with name, description, category, and tags", () => {
    const reg = new RecipeRegistry();
    reg.register(
      "weapon-laser",
      makeRegistration({
        description: "Sci-fi laser blast",
        category: "Weapon",
        tags: ["laser", "sci-fi"],
      }),
    );
    reg.register(
      "ui-click",
      makeRegistration({
        description: "Simple UI click",
        category: "UI",
        tags: ["click", "interface"],
      }),
    );

    const results = reg.listDetailed();

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      name: "weapon-laser",
      description: "Sci-fi laser blast",
      category: "Weapon",
      tags: ["laser", "sci-fi"],
      matchedTags: [],
    });
    expect(results[1]).toEqual({
      name: "ui-click",
      description: "Simple UI click",
      category: "UI",
      tags: ["click", "interface"],
      matchedTags: [],
    });
  });

  it("handles lazy registry entries", () => {
    const reg = new RecipeRegistry();
    reg.register(
      "lazy-recipe",
      makeLazyRegistration({
        description: "A lazy recipe",
        category: "Ambient",
        tags: ["nature", "wind"],
      }),
    );

    const results = reg.listDetailed();

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      name: "lazy-recipe",
      description: "A lazy recipe",
      category: "Ambient",
      tags: ["nature", "wind"],
      matchedTags: [],
    });
  });

  it("handles missing category (treats as empty string)", () => {
    const reg = new RecipeRegistry();
    const bareFactory: RecipeFactory = (_rng) => ({
      start: () => {},
      stop: () => {},
      toDestination: () => {},
      duration: 1,
    });
    reg.register("bare", bareFactory);

    const results = reg.listDetailed();

    expect(results).toHaveLength(1);
    expect(results[0]!.category).toBe("");
    expect(results[0]!.tags).toEqual([]);
  });

  it("handles recipes with undefined tags (treats as empty array)", () => {
    const reg = new RecipeRegistry();
    reg.register(
      "no-tags",
      makeRegistration({
        description: "No tags recipe",
        category: "Impact",
        tags: undefined,
      }),
    );

    const results = reg.listDetailed();

    expect(results).toHaveLength(1);
    expect(results[0]!.tags).toEqual([]);
  });

  describe("search filter", () => {
    it("matches by recipe name (case-insensitive substring)", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "weapon-laser-blast",
        makeRegistration({ description: "A blast", category: "Weapon" }),
      );
      reg.register(
        "ui-click",
        makeRegistration({ description: "A click", category: "UI" }),
      );

      const results = reg.listDetailed({ search: "Laser" });

      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("weapon-laser-blast");
    });

    it("matches by description (case-insensitive substring)", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "weapon-laser",
        makeRegistration({
          description: "Sci-fi laser blast with echo",
          category: "Weapon",
        }),
      );
      reg.register(
        "ui-click",
        makeRegistration({
          description: "Simple button click",
          category: "UI",
        }),
      );

      const results = reg.listDetailed({ search: "echo" });

      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("weapon-laser");
    });

    it("matches by category (case-insensitive substring)", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({ description: "A", category: "Card Game" }),
      );
      reg.register(
        "recipe-b",
        makeRegistration({ description: "B", category: "Weapon" }),
      );

      const results = reg.listDetailed({ search: "card" });

      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("recipe-a");
    });

    it("matches by tag value (case-insensitive substring)", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({
          description: "A",
          category: "Weapon",
          tags: ["laser", "sci-fi"],
        }),
      );
      reg.register(
        "recipe-b",
        makeRegistration({
          description: "B",
          category: "Weapon",
          tags: ["sword", "fantasy"],
        }),
      );

      const results = reg.listDetailed({ search: "SCI" });

      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("recipe-a");
    });
  });

  describe("category filter", () => {
    it("filters by exact category match (case-insensitive)", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({ category: "Weapon" }),
      );
      reg.register(
        "recipe-b",
        makeRegistration({ category: "UI" }),
      );
      reg.register(
        "recipe-c",
        makeRegistration({ category: "Weapon" }),
      );

      const results = reg.listDetailed({ category: "weapon" });

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.name)).toEqual(["recipe-a", "recipe-c"]);
    });

    it("normalizes spaces to hyphens for matching", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "card-recipe",
        makeRegistration({ category: "Card Game" }),
      );

      // All of these should match
      expect(reg.listDetailed({ category: "card-game" })).toHaveLength(1);
      expect(reg.listDetailed({ category: "Card Game" })).toHaveLength(1);
      expect(reg.listDetailed({ category: "card game" })).toHaveLength(1);
      expect(reg.listDetailed({ category: "CARD-GAME" })).toHaveLength(1);
    });

    it("does not match substring of category", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({ category: "Card Game" }),
      );

      const results = reg.listDetailed({ category: "card" });

      expect(results).toHaveLength(0);
    });
  });

  describe("tags filter", () => {
    it("filters by exact tag match (case-insensitive)", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({ tags: ["laser", "sci-fi"] }),
      );
      reg.register(
        "recipe-b",
        makeRegistration({ tags: ["sword", "fantasy"] }),
      );

      const results = reg.listDetailed({ tags: ["LASER"] });

      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("recipe-a");
    });

    it("uses AND logic (all tags must be present)", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({ tags: ["laser", "sci-fi", "bright"] }),
      );
      reg.register(
        "recipe-b",
        makeRegistration({ tags: ["laser", "fantasy"] }),
      );

      const results = reg.listDetailed({ tags: ["laser", "sci-fi"] });

      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("recipe-a");
    });

    it("does not match substring of tag (exact match only)", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({ tags: ["laser-beam", "sci-fi"] }),
      );

      const results = reg.listDetailed({ tags: ["laser"] });

      expect(results).toHaveLength(0);
    });

    it("ignores empty tags in filter array", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({ tags: ["laser"] }),
      );
      reg.register(
        "recipe-b",
        makeRegistration({ tags: ["sword"] }),
      );

      // Empty strings in tags array should be ignored -> returns all
      const results = reg.listDetailed({ tags: ["", "  "] });

      expect(results).toHaveLength(2);
    });
  });

  describe("combined filters", () => {
    it("combines search and category with AND logic", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "weapon-laser",
        makeRegistration({
          description: "Laser blast",
          category: "Weapon",
          tags: ["laser"],
        }),
      );
      reg.register(
        "ui-laser-button",
        makeRegistration({
          description: "Laser-styled button",
          category: "UI",
          tags: ["laser"],
        }),
      );

      const results = reg.listDetailed({
        search: "laser",
        category: "weapon",
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("weapon-laser");
    });

    it("combines category and tags with AND logic", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "weapon-a",
        makeRegistration({
          category: "Weapon",
          tags: ["laser", "sci-fi"],
        }),
      );
      reg.register(
        "weapon-b",
        makeRegistration({
          category: "Weapon",
          tags: ["sword", "fantasy"],
        }),
      );
      reg.register(
        "ui-a",
        makeRegistration({
          category: "UI",
          tags: ["laser", "click"],
        }),
      );

      const results = reg.listDetailed({
        category: "weapon",
        tags: ["laser"],
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("weapon-a");
    });

    it("combines all three filters with AND logic", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "weapon-laser",
        makeRegistration({
          description: "A powerful blast",
          category: "Weapon",
          tags: ["laser", "sci-fi"],
        }),
      );
      reg.register(
        "weapon-sword",
        makeRegistration({
          description: "A powerful swing",
          category: "Weapon",
          tags: ["sword", "fantasy"],
        }),
      );

      const results = reg.listDetailed({
        search: "powerful",
        category: "weapon",
        tags: ["laser"],
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("weapon-laser");
    });
  });

  describe("edge cases", () => {
    it("returns empty array when no recipes match", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({ category: "Weapon" }),
      );

      const results = reg.listDetailed({ category: "footstep" });

      expect(results).toEqual([]);
    });

    it("returns empty array when registry is empty", () => {
      const reg = new RecipeRegistry();

      const results = reg.listDetailed();

      expect(results).toEqual([]);
    });

    it("ignores empty search string", () => {
      const reg = new RecipeRegistry();
      reg.register("recipe-a", makeRegistration());
      reg.register("recipe-b", makeRegistration());

      const results = reg.listDetailed({ search: "" });

      expect(results).toHaveLength(2);
    });

    it("ignores whitespace-only search string", () => {
      const reg = new RecipeRegistry();
      reg.register("recipe-a", makeRegistration());
      reg.register("recipe-b", makeRegistration());

      const results = reg.listDetailed({ search: "   " });

      expect(results).toHaveLength(2);
    });

    it("ignores empty category string", () => {
      const reg = new RecipeRegistry();
      reg.register("recipe-a", makeRegistration());

      const results = reg.listDetailed({ category: "" });

      expect(results).toHaveLength(1);
    });

    it("ignores whitespace-only category string", () => {
      const reg = new RecipeRegistry();
      reg.register("recipe-a", makeRegistration());

      const results = reg.listDetailed({ category: "   " });

      expect(results).toHaveLength(1);
    });

    it("ignores empty tags array", () => {
      const reg = new RecipeRegistry();
      reg.register("recipe-a", makeRegistration());

      const results = reg.listDetailed({ tags: [] });

      expect(results).toHaveLength(1);
    });

    it("returns all recipes when filter is an empty object", () => {
      const reg = new RecipeRegistry();
      reg.register("recipe-a", makeRegistration());
      reg.register("recipe-b", makeRegistration());

      const results = reg.listDetailed({});

      expect(results).toHaveLength(2);
    });

    it("handles mixed eager and lazy entries", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "eager-recipe",
        makeRegistration({
          description: "Eager",
          category: "Weapon",
          tags: ["sharp"],
        }),
      );
      reg.register(
        "lazy-recipe",
        makeLazyRegistration({
          description: "Lazy",
          category: "Weapon",
          tags: ["sharp"],
        }),
      );

      const results = reg.listDetailed({ category: "weapon" });

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.name)).toEqual([
        "eager-recipe",
        "lazy-recipe",
      ]);
    });
  });

  describe("matchedTags metadata", () => {
    it("returns empty matchedTags when no filter is active", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({
          description: "A recipe",
          category: "Weapon",
          tags: ["laser", "sci-fi"],
        }),
      );

      const results = reg.listDetailed();

      expect(results).toHaveLength(1);
      expect(results[0]!.matchedTags).toEqual([]);
    });

    it("returns empty matchedTags when only --category filter is active", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({
          description: "A recipe",
          category: "Weapon",
          tags: ["laser", "sci-fi"],
        }),
      );

      const results = reg.listDetailed({ category: "weapon" });

      expect(results).toHaveLength(1);
      expect(results[0]!.matchedTags).toEqual([]);
    });

    it("populates matchedTags for --tags filter (exact case-insensitive)", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({
          description: "A recipe",
          category: "Weapon",
          tags: ["laser", "sci-fi", "bright"],
        }),
      );

      const results = reg.listDetailed({ tags: ["LASER", "SCI-FI"] });

      expect(results).toHaveLength(1);
      expect(results[0]!.matchedTags).toEqual(["laser", "sci-fi"]);
    });

    it("populates matchedTags for --search filter (substring case-insensitive)", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({
          description: "A recipe",
          category: "Weapon",
          tags: ["laser-beam", "sci-fi", "arcade"],
        }),
      );

      // "laser" matches "laser-beam" by substring
      const results = reg.listDetailed({ search: "laser" });

      expect(results).toHaveLength(1);
      expect(results[0]!.matchedTags).toEqual(["laser-beam"]);
    });

    it("computes union of matchedTags when both --search and --tags are active", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({
          description: "A recipe",
          category: "Weapon",
          tags: ["laser-beam", "sci-fi", "arcade"],
        }),
      );

      // --tags "sci-fi" matches "sci-fi" exactly
      // --search "laser" matches "laser-beam" by substring
      const results = reg.listDetailed({
        search: "laser",
        tags: ["sci-fi"],
      });

      expect(results).toHaveLength(1);
      // Union: laser-beam (from search) + sci-fi (from tags), preserving order
      expect(results[0]!.matchedTags).toEqual(["laser-beam", "sci-fi"]);
    });

    it("deduplicates matchedTags when a tag matches both --search and --tags", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({
          description: "A recipe",
          category: "Weapon",
          tags: ["laser", "sci-fi"],
        }),
      );

      // --tags "laser" exact matches "laser"
      // --search "laser" substring also matches "laser"
      const results = reg.listDetailed({
        search: "laser",
        tags: ["laser"],
      });

      expect(results).toHaveLength(1);
      // "laser" should appear only once despite matching both filters
      expect(results[0]!.matchedTags).toEqual(["laser"]);
    });

    it("preserves original tag casing in matchedTags", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({
          description: "A recipe",
          category: "Weapon",
          tags: ["LaserBeam", "Sci-Fi"],
        }),
      );

      const results = reg.listDetailed({ tags: ["laserbeam"] });

      expect(results).toHaveLength(1);
      expect(results[0]!.matchedTags).toEqual(["LaserBeam"]);
    });

    it("returns empty matchedTags for recipe with no tags when filter is active", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "recipe-a",
        makeRegistration({
          description: "Laser recipe",
          category: "Weapon",
          tags: [],
        }),
      );

      // search matches by description but no tags to match
      const results = reg.listDetailed({ search: "laser" });

      expect(results).toHaveLength(1);
      expect(results[0]!.matchedTags).toEqual([]);
    });

    it("returns empty matchedTags when search matches non-tag fields only", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "weapon-laser",
        makeRegistration({
          description: "A powerful blast",
          category: "Weapon",
          tags: ["bright", "sci-fi"],
        }),
      );

      // "powerful" matches description but none of the tags
      const results = reg.listDetailed({ search: "powerful" });

      expect(results).toHaveLength(1);
      expect(results[0]!.matchedTags).toEqual([]);
    });

    it("works with lazy registry entries", () => {
      const reg = new RecipeRegistry();
      reg.register(
        "lazy-recipe",
        makeLazyRegistration({
          description: "Lazy",
          category: "Weapon",
          tags: ["laser", "sci-fi"],
        }),
      );

      const results = reg.listDetailed({ tags: ["laser"] });

      expect(results).toHaveLength(1);
      expect(results[0]!.matchedTags).toEqual(["laser"]);
    });
  });
});
