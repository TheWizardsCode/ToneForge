import { describe, it, expect } from "vitest";
import {
  groupByCategory,
  extractCategories,
  formatRecipeChoice,
  toManifestEntry,
  buildFilterQuery,
} from "../stages/define.js";
import type { RecipeDetailedSummary } from "../../core/recipe.js";

/** Factory for test recipe summaries. */
function recipe(overrides: Partial<RecipeDetailedSummary> = {}): RecipeDetailedSummary {
  return {
    name: "test-recipe",
    description: "A test recipe",
    category: "test",
    tags: ["tag1", "tag2"],
    matchedTags: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// groupByCategory
// ---------------------------------------------------------------------------

describe("groupByCategory", () => {
  it("groups recipes by their category", () => {
    const recipes = [
      recipe({ name: "a", category: "weapon" }),
      recipe({ name: "b", category: "ui" }),
      recipe({ name: "c", category: "weapon" }),
      recipe({ name: "d", category: "ambient" }),
    ];

    const groups = groupByCategory(recipes);

    expect(groups.size).toBe(3);
    expect(groups.get("weapon")?.map((r) => r.name)).toEqual(["a", "c"]);
    expect(groups.get("ui")?.map((r) => r.name)).toEqual(["b"]);
    expect(groups.get("ambient")?.map((r) => r.name)).toEqual(["d"]);
  });

  it("sorts category keys alphabetically", () => {
    const recipes = [
      recipe({ name: "z", category: "weapon" }),
      recipe({ name: "a", category: "ambient" }),
      recipe({ name: "m", category: "footstep" }),
    ];

    const groups = groupByCategory(recipes);
    const keys = [...groups.keys()];

    expect(keys).toEqual(["ambient", "footstep", "weapon"]);
  });

  it("returns an empty map for an empty recipe list", () => {
    const groups = groupByCategory([]);
    expect(groups.size).toBe(0);
  });

  it("uses 'uncategorized' for recipes with empty category", () => {
    const recipes = [recipe({ name: "orphan", category: "" })];
    const groups = groupByCategory(recipes);

    expect(groups.has("uncategorized")).toBe(true);
    expect(groups.get("uncategorized")?.length).toBe(1);
  });

  it("preserves recipe order within each category", () => {
    const recipes = [
      recipe({ name: "c", category: "ui" }),
      recipe({ name: "a", category: "ui" }),
      recipe({ name: "b", category: "ui" }),
    ];

    const groups = groupByCategory(recipes);
    expect(groups.get("ui")?.map((r) => r.name)).toEqual(["c", "a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// extractCategories
// ---------------------------------------------------------------------------

describe("extractCategories", () => {
  it("extracts unique sorted category names", () => {
    const recipes = [
      recipe({ category: "weapon" }),
      recipe({ category: "ui" }),
      recipe({ category: "weapon" }),
      recipe({ category: "ambient" }),
    ];

    const cats = extractCategories(recipes);
    expect(cats).toEqual(["ambient", "ui", "weapon"]);
  });

  it("returns an empty array for no recipes", () => {
    expect(extractCategories([])).toEqual([]);
  });

  it("excludes recipes with empty category", () => {
    const recipes = [
      recipe({ category: "weapon" }),
      recipe({ category: "" }),
    ];

    const cats = extractCategories(recipes);
    expect(cats).toEqual(["weapon"]);
  });
});

// ---------------------------------------------------------------------------
// formatRecipeChoice
// ---------------------------------------------------------------------------

describe("formatRecipeChoice", () => {
  it("formats a recipe with name, description, and tags", () => {
    const r = recipe({
      name: "card-flip",
      description: "A quick card flip sound",
      tags: ["card", "ui", "quick"],
    });

    const result = formatRecipeChoice(r);

    expect(result).toContain("card-flip");
    expect(result).toContain("A quick card flip sound");
    expect(result).toContain("[card, ui, quick]");
  });

  it("truncates long descriptions to 50 chars", () => {
    const longDesc = "A".repeat(60);
    const r = recipe({ name: "long", description: longDesc });

    const result = formatRecipeChoice(r);

    // Description should be truncated with "..."
    expect(result).toContain("...");
    expect(result).not.toContain(longDesc);
  });

  it("does not truncate short descriptions", () => {
    const r = recipe({ name: "short", description: "Brief" });

    const result = formatRecipeChoice(r);
    expect(result).toContain("Brief");
    expect(result).not.toContain("...");
  });

  it("shows up to 3 tags", () => {
    const r = recipe({
      name: "many-tags",
      description: "test",
      tags: ["a", "b", "c", "d", "e"],
    });

    const result = formatRecipeChoice(r);
    expect(result).toContain("[a, b, c]");
    expect(result).not.toContain("d");
  });

  it("omits tag brackets when there are no tags", () => {
    const r = recipe({ name: "no-tags", description: "test", tags: [] });

    const result = formatRecipeChoice(r);
    expect(result).not.toContain("[");
  });
});

// ---------------------------------------------------------------------------
// toManifestEntry
// ---------------------------------------------------------------------------

describe("toManifestEntry", () => {
  it("converts a RecipeDetailedSummary to a ManifestEntry", () => {
    const r = recipe({
      name: "card-flip",
      description: "A flip sound",
      category: "card-game",
      tags: ["card", "flip"],
    });

    const entry = toManifestEntry(r);

    expect(entry.recipe).toBe("card-flip");
    expect(entry.description).toBe("A flip sound");
    expect(entry.category).toBe("card-game");
    expect(entry.tags).toEqual(["card", "flip"]);
  });

  it("creates an independent copy of tags", () => {
    const r = recipe({ tags: ["a", "b"] });
    const entry = toManifestEntry(r);

    // Mutating the original should not affect the entry
    r.tags.push("c");
    expect(entry.tags).toEqual(["a", "b"]);
  });

  it("maps name to recipe field", () => {
    const r = recipe({ name: "my-recipe" });
    const entry = toManifestEntry(r);
    expect(entry.recipe).toBe("my-recipe");
    expect((entry as unknown as Record<string, unknown>)["name"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildFilterQuery
// ---------------------------------------------------------------------------

describe("buildFilterQuery", () => {
  it("builds a search filter from text", () => {
    const query = buildFilterQuery("laser");
    expect(query).toEqual({ search: "laser" });
  });

  it("returns undefined for empty string", () => {
    expect(buildFilterQuery("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only string", () => {
    expect(buildFilterQuery("   ")).toBeUndefined();
  });

  it("trims whitespace from search text", () => {
    const query = buildFilterQuery("  flip  ");
    expect(query).toEqual({ search: "flip" });
  });
});
