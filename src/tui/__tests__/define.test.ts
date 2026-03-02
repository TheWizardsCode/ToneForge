import { describe, it, expect } from "vitest";
import {
  groupByCategory,
  extractCategories,
  formatRecipeChoice,
  toManifestEntry,
  buildFilterQuery,
  formatManifestSummary,
} from "../stages/define.js";
import type { RecipeDetailedSummary } from "../../core/recipe.js";
import type { ManifestEntry } from "../types.js";

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

// ---------------------------------------------------------------------------
// formatManifestSummary
// ---------------------------------------------------------------------------

/** Factory for test manifest entries. */
function manifestEntry(overrides: Partial<ManifestEntry> = {}): ManifestEntry {
  return {
    recipe: "test-recipe",
    description: "A test recipe",
    category: "test",
    tags: ["tag1"],
    ...overrides,
  };
}

describe("formatManifestSummary", () => {
  it("returns an empty string for an empty manifest", () => {
    expect(formatManifestSummary([])).toBe("");
  });

  it("formats a single entry with 1-based index", () => {
    const entries = [manifestEntry({ recipe: "card-flip", category: "card-game" })];
    const result = formatManifestSummary(entries);
    expect(result).toBe("  1. card-flip (card-game)");
  });

  it("formats multiple entries with sequential numbering", () => {
    const entries = [
      manifestEntry({ recipe: "card-flip", category: "card-game" }),
      manifestEntry({ recipe: "coin-collect", category: "reward" }),
      manifestEntry({ recipe: "laser-blast", category: "weapon" }),
    ];
    const result = formatManifestSummary(entries);
    const lines = result.split("\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("  1. card-flip (card-game)");
    expect(lines[1]).toBe("  2. coin-collect (reward)");
    expect(lines[2]).toBe("  3. laser-blast (weapon)");
  });

  it("uses 'uncategorized' for entries with empty category", () => {
    const entries = [manifestEntry({ recipe: "orphan", category: "" })];
    const result = formatManifestSummary(entries);
    expect(result).toBe("  1. orphan (uncategorized)");
  });

  it("preserves entry order", () => {
    const entries = [
      manifestEntry({ recipe: "z-recipe", category: "z" }),
      manifestEntry({ recipe: "a-recipe", category: "a" }),
    ];
    const result = formatManifestSummary(entries);
    const lines = result.split("\n");

    expect(lines[0]).toContain("z-recipe");
    expect(lines[1]).toContain("a-recipe");
  });

  it("indents each line with two spaces", () => {
    const entries = [manifestEntry({ recipe: "test", category: "cat" })];
    const result = formatManifestSummary(entries);
    expect(result).toMatch(/^ {2}\d+\./);
  });
});
