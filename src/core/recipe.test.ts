import { describe, it, expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OfflineAudioContext } from "node-web-audio-api";
import { createRng } from "./rng.js";
import { RecipeRegistry, discoverFileBackedRecipes } from "./recipe.js";

function makeRegistration(overrides: Record<string, unknown> = {}) {
  return {
    getDuration: () => 1,
    buildOfflineGraph: () => {},
    description: "A test recipe",
    category: "weapon",
    tags: ["sharp", "bright"],
    signalChain: "Oscillator -> Destination",
    params: [],
    getParams: () => ({}),
    ...overrides,
  };
}

describe("RecipeRegistry", () => {
  it("registers and retrieves a recipe registration", () => {
    const reg = new RecipeRegistry();
    const registration = makeRegistration();

    reg.register("test-recipe", registration);
    expect(reg.getRegistration("test-recipe")).toBe(registration);
  });

  it("returns undefined for unregistered recipe", () => {
    const reg = new RecipeRegistry();
    expect(reg.getRegistration("nonexistent")).toBeUndefined();
  });

  it("lists all registered recipe names", () => {
    const reg = new RecipeRegistry();

    reg.register("alpha", makeRegistration());
    reg.register("beta", makeRegistration());

    const names = reg.list();
    expect(names).toContain("alpha");
    expect(names).toContain("beta");
    expect(names).toHaveLength(2);
  });

  it("overwrites existing registration with same name", () => {
    const reg = new RecipeRegistry();
    const registration1 = makeRegistration({ description: "one" });
    const registration2 = makeRegistration({ description: "two" });

    reg.register("same", registration1);
    reg.register("same", registration2);
    expect(reg.getRegistration("same")).toBe(registration2);
  });
});

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

      const results = reg.listDetailed({
        search: "laser",
        tags: ["sci-fi"],
      });

      expect(results).toHaveLength(1);
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

      const results = reg.listDetailed({
        search: "laser",
        tags: ["laser"],
      });

      expect(results).toHaveLength(1);
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

      const results = reg.listDetailed({ search: "powerful" });

      expect(results).toHaveLength(1);
      expect(results[0]!.matchedTags).toEqual([]);
    });
  });
});

describe("discoverFileBackedRecipes", () => {
  it("discovers valid JSON/YAML ToneGraph files and skips invalid files with warning", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "toneforge-recipes-"));
    const warnMessages: string[] = [];
    const logger = {
      warn: (message: string) => {
        warnMessages.push(message);
      },
    };

    try {
      await writeFile(join(tempRoot, "file-backed-json.json"), JSON.stringify({
        version: "0.1",
        meta: {
          description: "JSON file-backed recipe",
          category: "UI",
          tags: ["file-backed", "json"],
          duration: 0.08,
        },
        nodes: {
          osc: {
            kind: "oscillator",
            params: { type: "sine", frequency: 440 },
            parameters: {
              frequency: { min: 220, max: 880, unit: "Hz", default: 550, type: "number" },
            },
          },
          amp: {
            kind: "gain",
            params: { gain: 0.2 },
            parameters: {
              gain: { min: 0.1, max: 0.8, unit: "amplitude", default: 0.2, type: "number" },
            },
          },
          out: { kind: "destination" },
        },
        routing: [{ chain: ["osc", "amp", "out"] }],
      }, null, 2), "utf-8");

      await writeFile(join(tempRoot, "file-backed-yaml.yaml"), `version: "0.1"
meta:
  description: "YAML file-backed recipe"
  category: "UI"
  tags: ["file-backed", "yaml"]
nodes:
  osc:
    kind: oscillator
    params:
      type: triangle
      frequency: 330
  env:
    kind: envelope
    params:
      attack: 0.02
      decay: 0.08
      sustain: 0.0
      release: 0.05
  out:
    kind: destination
routing:
  - chain: [osc, env, out]
`, "utf-8");

      await writeFile(join(tempRoot, "invalid.json"), JSON.stringify({
        version: "0.2",
        nodes: {
          bad: { kind: "oscillator" },
        },
        routing: [],
      }, null, 2), "utf-8");

      const registry = new RecipeRegistry();
      registry.register("built-in-stub", makeRegistration());

      const discovered = await discoverFileBackedRecipes(registry, {
        recipeDirectory: tempRoot,
        logger,
      });

      expect(discovered.sort()).toEqual(["file-backed-json", "file-backed-yaml"]);
      expect(registry.list()).toContain("built-in-stub");
      expect(registry.list()).toContain("file-backed-json");
      expect(registry.list()).toContain("file-backed-yaml");
      expect(registry.list()).not.toContain("invalid");
      expect(warnMessages.some((message) => message.includes("invalid.json"))).toBe(true);

      const jsonReg = registry.getRegistration("file-backed-json");
      expect(jsonReg).toBeDefined();
      expect(jsonReg!.params.map((p) => p.name).sort()).toEqual(["frequency", "gain"]);
      expect(jsonReg!.getParams(createRng(7))).toEqual({ frequency: 550, gain: 0.2 });
      expect(jsonReg!.getDuration(createRng(1))).toBeCloseTo(0.08, 6);

      const yamlReg = registry.getRegistration("file-backed-yaml");
      expect(yamlReg).toBeDefined();
      expect(yamlReg!.getDuration(createRng(1))).toBeCloseTo(0.15, 6);

      const renderDuration = jsonReg!.getDuration(createRng(42));
      const sampleRate = 44100;
      const ctx = new OfflineAudioContext(
        1,
        Math.ceil(sampleRate * renderDuration),
        sampleRate,
      );
      await jsonReg!.buildOfflineGraph(createRng(42), ctx, renderDuration);
      const rendered = await ctx.startRendering();
      const samples = new Float32Array(rendered.getChannelData(0));
      expect(samples.some((sample) => sample !== 0)).toBe(true);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
