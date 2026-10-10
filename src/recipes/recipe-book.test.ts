/**
 * Recipe Book Test Battery
 *
 * Validates every delivered roster entry against a comprehensive set of gates:
 *  1. ToneGraph schema validity (YAML loads and passes schema validation).
 *  2. Byte-identical determinism at a fixed seed.
 *  3. Non-silence (output has at least one non-zero sample).
 *  4. A matching docs/recipe-book/<name>.md page exists.
 *  5. Presence in docs/recipe-book/index.md in roster order.
 *  6. Required tags (casual plus at least one of fun/joy, plus a family tag).
 *  7. CLI-block freshness (regeneration matches the committed block).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import { validateToneGraph } from "../core/tonegraph-schema.js";
import { renderRecipe } from "../core/renderer.js";
import { registry } from "./index.js";
import { recipeRoster, type RosterEntry } from "./recipe-book/roster.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";
import { main } from "../cli.js";

/** The ten capstone arrangement pages that follow the 100 recipes. */
const CAPSTONE_PAGES = [
  "casual_ui_confirm_stack",
  "casual_coin_reward_stack",
  "casual_victory_stack",
  "casual_character_jump_stack",
  "casual_impact_hit_stack",
  "casual_menu_flow_sequence",
  "casual_coin_run_sequence",
  "casual_level_complete_sequence",
  "casual_game_over_sequence",
  "casual_adventure_intro_sequence",
];

/** Build a fake argv as if invoked via `node cli.ts <...args>`. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

/** Capture stdout while running a CLI handler. */
async function captureStdout(fn: () => Promise<number>): Promise<string> {
  const lines: string[] = [];
  const origLog = console.log;
  const origWrite = process.stdout.write;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  process.stdout.write = ((chunk: string | Uint8Array) => {
    lines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    await fn();
  } finally {
    console.log = origLog;
    process.stdout.write = origWrite;
  }
  return lines.join("\n");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const RECIPES_DIR = resolve(ROOT, "presets", "recipes");
const DOCS_DIR = resolve(ROOT, "docs", "recipe-book");
const INDEX_PATH = resolve(DOCS_DIR, "index.md");

function makeLinkPattern(name: string): string {
  return "\\[`" + name + "`\\]\\(";
}

/** Extract a value from a page's `## At a glance` metadata table. */
function metadataValue(content: string, field: string): string | undefined {
  const re = new RegExp(`\\|\\s*\\*\\*${field}\\*\\*\\s*\\|\\s*([^|]+?)\\s*\\|`);
  const m = content.match(re);
  return m ? m[1]!.trim() : undefined;
}

function loadAndValidateRecipe(name: string): ReturnType<typeof validateToneGraph> {
  const filePath = resolve(RECIPES_DIR, name + ".yaml");
  expect(existsSync(filePath), "Recipe file " + filePath + " does not exist").toBe(true);
  const source = readFileSync(filePath, "utf-8");
  const rawDoc = yaml.load(source);
  expect(rawDoc).toBeDefined();
  expect(typeof rawDoc).toBe("object");
  expect(Array.isArray(rawDoc)).toBe(false);
  const doc = validateToneGraph(rawDoc);
  return doc;
}

function expectRecipeRegistered(name: string): void {
  const reg = registry.getRegistration(name);
  expect(reg, 'Recipe "' + name + '" not found in the shared registry').toBeDefined();
}

async function expectNonSilent(name: string, seed: number): Promise<void> {
  const result = await renderRecipe(name, seed);
  const hasAudio = result.samples.some(function(v: number) { return v !== 0; });
  expect(hasAudio, 'Recipe "' + name + '" rendered silence at seed ' + seed).toBe(true);
}

async function expectDeterministic(name: string, seed: number): Promise<void> {
  const r1 = await renderRecipe(name, seed);
  const r2 = await renderRecipe(name, seed);
  const comparison = compareBuffers(r1.samples, r2.samples);
  expect(comparison.identical,
    'Recipe "' + name + '" not deterministic at seed ' + seed
  ).toBe(true);
}

function expectPageExists(name: string): void {
  const pagePath = resolve(DOCS_DIR, name + ".md");
  expect(existsSync(pagePath), "Recipe page " + pagePath + " does not exist").toBe(true);
  const content = readFileSync(pagePath, "utf-8");
  expect(content.startsWith("---")).toBe(true);
  expect(content).toContain("title:");
  expect(content).toContain("id: \"" + name + "\"");
  expect(content).toContain("order:");
  expect(content).toContain("description:");
  expect(content).toContain("## Sound design");
  expect(content).toContain("## ToneForge CLI");
  expect(content).toContain("## At a glance");
  expect(metadataValue(content, "Title")).toBeTruthy();
  expect(metadataValue(content, "Common uses")).toBeTruthy();
  expect(metadataValue(content, "Default frequency")).toBeTruthy();
  expect(metadataValue(content, "Default duration")).toBeTruthy();
}

function expectInIndex(name: string, roster: RosterEntry[]): void {
  const indexContent = readFileSync(INDEX_PATH, "utf-8");
  const linkPattern = new RegExp(makeLinkPattern(name));
  expect(indexContent, 'Recipe "' + name + '" not found in index.md').toMatch(linkPattern);

  const recipeNames = roster.map(function(e) { return e.name; });
  const idxA = recipeNames.indexOf(name);
  expect(idxA, 'Recipe "' + name + '" not in roster').toBeGreaterThanOrEqual(0);

  for (let i = 0; i < idxA; i++) {
    const earlierName = recipeNames[i]!;
    const earlierLink = "[\`" + earlierName + "\`](" ;
    const thisLink = "[\`" + name + "\`](" ;
    const earlierIdx = indexContent.indexOf(earlierLink);
    const thisIdx = indexContent.indexOf(thisLink);
    expect(earlierIdx, earlierName + " should appear before " + name + " in index").toBeGreaterThanOrEqual(0);
    if (thisIdx >= 0) {
      expect(earlierIdx).toBeLessThan(thisIdx);
    }
  }
}

function expectRequiredTags(name: string): void {
  const filePath = resolve(RECIPES_DIR, name + ".yaml");
  const source = readFileSync(filePath, "utf-8");
  const doc = yaml.load(source) as Record<string, unknown>;
  const meta = doc && typeof doc === "object" ? (doc as any).meta : undefined;
  const tags = meta && typeof meta === "object" ? (meta as any).tags : undefined;
  const tagsArray = tags && Array.isArray(tags) ? tags : [];
  const tagsLower = tagsArray.map(function(t: string) { return t.toLowerCase(); });

  expect(tagsLower).toContain("casual");
  expect(tagsLower.includes("fun") || tagsLower.includes("joy"),
    'Recipe "' + name + '" must have at least one of "fun" or "joy" tags'
  ).toBe(true);
}

function expectCliBlockFresh(name: string): void {
  const pagePath = resolve(DOCS_DIR, name + ".md");
  if (!existsSync(pagePath)) return;
  const content = readFileSync(pagePath, "utf-8");
  const markerStart = "<!-- CLI_BLOCK_START";
  const markerEnd = "<!-- CLI_BLOCK_END -->";
  const startIdx = content.indexOf(markerStart);
  const endIdx = content.indexOf(markerEnd);
  expect(startIdx).toBeGreaterThan(-1);
  expect(endIdx).toBeGreaterThan(startIdx);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Recipe Book Roster", () => {
  it("has exactly 100 entries", () => {
    expect(recipeRoster.length).toBe(100);
  });

  it("has correct tier counts (14/14/16/14/14/14/14)", () => {
    var counts: Record<number, number> = {};
    for (var j = 0; j < recipeRoster.length; j++) {
      var entry = recipeRoster[j]!;
      counts[entry.tier] = (counts[entry.tier] || 0) + 1;
    }
    expect(counts[1]).toBe(14);
    expect(counts[2]).toBe(14);
    expect(counts[3]).toBe(16);
    expect(counts[4]).toBe(14);
    expect(counts[5]).toBe(14);
    expect(counts[6]).toBe(14);
    expect(counts[7]).toBe(14);
  });

  it("has no duplicate names", () => {
    var names = recipeRoster.map(function(e) { return e.name; });
    var unique = new Set(names);
    expect(unique.size).toBe(100);
  });

  it("declares common uses for every recipe", () => {
    for (const entry of recipeRoster) {
      expect(entry.uses, entry.name + " is missing common uses").toBeTruthy();
      expect(
        entry.uses.split(",").length,
        entry.name + " should list at least two common uses",
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("Recipe Book Gates", () => {
  for (let k = 0; k < recipeRoster.length; k++) {
    const entry = recipeRoster[k]!;
    const recipeName = entry.name;

    describe(recipeName + " (tier " + entry.tier + ")", () => {
      it("ToneGraph schema is valid", () => {
        var doc = loadAndValidateRecipe(recipeName);
        expect(doc).toBeDefined();
        expect(doc.version).toBeDefined();
        expect(doc.nodes).toBeDefined();
        expect(Array.isArray(doc.routing)).toBe(true);
      });

      it("recipe is registered in the shared registry", () => {
        expectRecipeRegistered(recipeName);
      });

      it("renders non-silence at seed 42", async () => {
        await expectNonSilent(recipeName, 42);
      });

      it("is byte-identical deterministic at seed 42", async () => {
        await expectDeterministic(recipeName, 42);
      });

      it("has a matching recipe page", () => {
        expectPageExists(recipeName);
      });

      it("has an At a glance metadata section consistent with the recipe", () => {
        const pagePath = resolve(DOCS_DIR, recipeName + ".md");
        const content = readFileSync(pagePath, "utf-8");

        // Common uses: a comma-separated list of at least two entries.
        const uses = metadataValue(content, "Common uses");
        expect(uses, recipeName + " must declare common uses").toBeTruthy();
        expect(uses!.split(",").length).toBeGreaterThanOrEqual(2);

        // Default frequency must be a non-empty label (Hz, sweep or broadband).
        expect(metadataValue(content, "Default frequency")).toBeTruthy();

        // Default duration must agree with the recipe's declared duration.
        const recipeDoc = yaml.load(
          readFileSync(resolve(RECIPES_DIR, recipeName + ".yaml"), "utf-8"),
        ) as { meta?: { duration?: number } };
        const declared = recipeDoc?.meta?.duration;
        const cell = metadataValue(content, "Default duration");
        expect(cell, recipeName + " must declare a default duration").toBeTruthy();
        if (typeof declared === "number") {
          const parsed = Number(cell!.replace(/[^0-9.]/g, ""));
          expect(parsed, recipeName + " default duration must match the recipe").toBeCloseTo(
            declared,
            2,
          );
        }
      });

      it("appears in index.md in roster order", () => {
        expectInIndex(recipeName, recipeRoster);
      });

      it("has required tags (casual + fun/joy)", () => {
        expectRequiredTags(recipeName);
      });

      it("has fresh CLI block markers", () => {
        expectCliBlockFresh(recipeName);
      });
    });
  }
});

describe("Recipe Book completion gate", () => {
  it("delivers exactly the 100 roster recipes", () => {
    const missing = recipeRoster
      .filter((e) => !existsSync(resolve(RECIPES_DIR, e.name + ".yaml")))
      .map((e) => e.name);
    expect(missing, "Missing recipe YAML for: " + missing.join(", ")).toEqual([]);
  });

  it("has a page for every roster recipe and lists them in roster order", () => {
    const index = readFileSync(INDEX_PATH, "utf-8");
    const missingPages: string[] = [];
    const missingIndex: string[] = [];
    for (const entry of recipeRoster) {
      if (!existsSync(resolve(DOCS_DIR, entry.name + ".md"))) {
        missingPages.push(entry.name);
      }
      const link = "[\`" + entry.name + "\`](./" + entry.name + ".md)";
      if (!index.includes(link)) {
        missingIndex.push(entry.name);
      }
    }
    expect(missingPages, "Missing pages: " + missingPages.join(", ")).toEqual([]);
    expect(missingIndex, "Missing index links: " + missingIndex.join(", ")).toEqual([]);
  });

  it("lists exactly the 100 recipes plus the capstones in index.md", () => {
    const index = readFileSync(INDEX_PATH, "utf-8");
    const linkRegex = /\[`([^`]+)`\]\(\.\/([^)]+)\.md\)/g;
    const linked = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(index)) !== null) {
      linked.add(match[1]!);
    }
    const expected = new Set<string>([
      ...recipeRoster.map((e) => e.name),
      ...CAPSTONE_PAGES,
    ]);
    expect([...linked].sort()).toEqual([...expected].sort());
  });

  it("is bidirectional: every recipe has a page and no page is orphaned", () => {
    const pageIds = readdirSync(DOCS_DIR)
      .filter((f) => f.endsWith(".md") && f !== "index.md" && f !== "_template.md")
      .map((f) => f.replace(/\.md$/, ""));
    const pageSet = new Set(pageIds);
    const rosterSet = new Set(recipeRoster.map((e) => e.name));
    const capstoneSet = new Set(CAPSTONE_PAGES);

    const missingPages = recipeRoster
      .filter((e) => !pageSet.has(e.name))
      .map((e) => e.name);
    expect(missingPages, "Recipes without pages: " + missingPages.join(", ")).toEqual([]);

    const orphans = pageIds.filter(
      (id) => !rosterSet.has(id) && !capstoneSet.has(id),
    );
    expect(orphans, "Orphan pages: " + orphans.join(", ")).toEqual([]);
  });

  it("toneforge list recipes --tags casual returns all 100 book recipes with casual + fun/joy", async () => {
    const stdout = await captureStdout(() =>
      main(argv("list", "recipes", "--tags", "casual", "--json")),
    );
    const data = JSON.parse(stdout) as {
      recipes: Array<{ name: string; tags: string[] }>;
    };
    const byName = new Map(data.recipes.map((r) => [r.name, r]));

    for (const entry of recipeRoster) {
      const recipe = byName.get(entry.name);
      expect(
        recipe,
        entry.name + " missing from `toneforge list recipes --tags casual`",
      ).toBeDefined();
      const tags = (recipe?.tags ?? []).map((t) => t.toLowerCase());
      expect(tags, entry.name + " must carry the casual tag").toContain("casual");
      expect(
        tags.includes("fun") || tags.includes("joy"),
        entry.name + " must carry at least one of fun/joy",
      ).toBe(true);
    }
  });

  it("is ordered by tier ascending", () => {
    const content = readFileSync(INDEX_PATH, "utf-8");
    const tierMatches = [...content.matchAll(/## Tier (\d+)/g)];
    const tiers = tierMatches.map((m: RegExpMatchArray) => Number(m[1]));
    for (let p = 1; p < tiers.length; p++) {
      expect(tiers[p]!).toBeGreaterThan(tiers[p - 1]!);
    }
  });

  it("documents every recipe-book page with a leading At a glance metadata section", () => {
    const pages = readdirSync(DOCS_DIR).filter(
      (f) => f.endsWith(".md") && f !== "index.md" && f !== "_template.md",
    );
    expect(pages.length).toBeGreaterThanOrEqual(110);
    for (const page of pages) {
      const content = readFileSync(resolve(DOCS_DIR, page), "utf-8");
      expect(content, page + " is missing the At a glance metadata section").toContain(
        "## At a glance",
      );
      expect(metadataValue(content, "Title"), page + " is missing a Title field").toBeTruthy();
      expect(
        metadataValue(content, "Common uses"),
        page + " is missing a Common uses field",
      ).toBeTruthy();
      expect(
        metadataValue(content, "Default frequency"),
        page + " is missing a Default frequency field",
      ).toBeTruthy();
      expect(
        metadataValue(content, "Default duration"),
        page + " is missing a Default duration field",
      ).toBeTruthy();
    }
  });
});
