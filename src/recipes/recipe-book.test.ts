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
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import { validateToneGraph } from "../core/tonegraph-schema.js";
import { renderRecipe } from "../core/renderer.js";
import { registry } from "./index.js";
import { recipeRoster, type RosterEntry } from "./recipe-book/roster.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";
import { main } from "../cli.js";
import { FRAMEWORK_COMMANDS } from "../cli.yargs.js";
import {
  buildCliBlock,
  cliBlockStartMarker,
  CLI_BLOCK_END,
} from "../../scripts/recipe-book/generate-cli-blocks.js";
import {
  buildCapstoneCliBlock,
  capstoneCliBlockStartMarker,
  capstoneKind,
} from "../../scripts/recipe-book/generate-capstones.js";
import {
  renderIndexContent,
  CLI_WORKFLOW_SECTION_HEADING,
  CLI_WORKFLOW_EXAMPLES,
} from "../../scripts/recipe-book/generate-index.js";

/** The twelve capstone arrangement pages that follow the 101 recipes. */
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
  "sequence-wave-end",
  "sequence-level-end",
];

/** The five capstone stacks and five capstone sequences, split by page kind. */
const CAPSTONE_STACKS = CAPSTONE_PAGES.filter((n) => n.endsWith("_stack"));
const CAPSTONE_SEQUENCES = CAPSTONE_PAGES.filter((n) => n.endsWith("_sequence"));

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
  const markerStart = cliBlockStartMarker(name);
  const startIdx = content.indexOf(markerStart);
  const endIdx = content.indexOf(CLI_BLOCK_END);
  expect(startIdx, name + " is missing the CLI_BLOCK_START marker").toBeGreaterThan(-1);
  expect(endIdx, name + " is missing the CLI_BLOCK_END marker").toBeGreaterThan(startIdx);

  // Regenerate the block with the single shared builder and compare it
  // byte-for-byte with the block committed between the markers. Editing a
  // committed block by hand (or leaving a stale generator output) fails here.
  const committed = content.slice(startIdx + markerStart.length, endIdx).trim();
  expect(
    committed,
    name + " CLI block is stale; regenerate it with scripts/recipe-book/generate-pages.ts",
  ).toBe(buildCliBlock(name).trim());
}

/**
 * Assert a capstone page carries the named CLI_BLOCK markers and that the
 * commands between them match the generator's canonical block byte-for-byte.
 * Editing a committed capstone block by hand (or leaving a stale generator
 * output) fails here, so the twelve capstone pages cannot drift.
 */
function expectCapstoneCliBlockFresh(name: string): void {
  const pagePath = resolve(DOCS_DIR, name + ".md");
  expect(existsSync(pagePath), "Capstone page " + pagePath + " does not exist").toBe(true);
  const content = readFileSync(pagePath, "utf-8");
  const markerStart = capstoneCliBlockStartMarker(name);
  const startIdx = content.indexOf(markerStart);
  const endIdx = content.indexOf(CLI_BLOCK_END);
  expect(startIdx, name + " is missing the capstone CLI_BLOCK_START marker").toBeGreaterThan(-1);
  expect(endIdx, name + " is missing the capstone CLI_BLOCK_END marker").toBeGreaterThan(startIdx);

  const kind = capstoneKind(name);
  expect(kind, name + " is not a known capstone arrangement").toBeDefined();
  if (kind === undefined) return;

  const committed = content.slice(startIdx + markerStart.length, endIdx).trim();
  expect(
    committed,
    name +
      " capstone CLI block is stale; regenerate it with scripts/recipe-book/generate-capstones.ts",
  ).toBe(buildCapstoneCliBlock(name, kind).trim());
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Recipe Book Roster", () => {
  it("has exactly 101 entries", () => {
    expect(recipeRoster.length).toBe(101);
  });

  it("has correct tier counts (14/14/16/15/14/14/14)", () => {
    var counts: Record<number, number> = {};
    for (var j = 0; j < recipeRoster.length; j++) {
      var entry = recipeRoster[j]!;
      counts[entry.tier] = (counts[entry.tier] || 0) + 1;
    }
    expect(counts[1]).toBe(14);
    expect(counts[2]).toBe(14);
    expect(counts[3]).toBe(16);
    expect(counts[4]).toBe(15);
    expect(counts[5]).toBe(14);
    expect(counts[6]).toBe(14);
    expect(counts[7]).toBe(14);
  });

  it("has no duplicate names", () => {
    var names = recipeRoster.map(function(e) { return e.name; });
    var unique = new Set(names);
    expect(unique.size).toBe(101);
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

describe("Capstone CLI block freshness", () => {
  for (const name of CAPSTONE_PAGES) {
    it(name + " has a fresh CLI block between machine-readable markers", () => {
      expectCapstoneCliBlockFresh(name);
    });
  }

  it("emits the named CLI_BLOCK_START marker with an actionable regeneration hint", () => {
    for (const name of CAPSTONE_PAGES) {
      const content = readFileSync(resolve(DOCS_DIR, name + ".md"), "utf-8");
      expect(
        content,
        name + " must carry the named CLI_BLOCK_START marker",
      ).toContain(capstoneCliBlockStartMarker(name));
    }
  });
});

describe("Capstone CLI commands", () => {
  it("runs `toneforge stack inspect` for every capstone stack", async () => {
    for (const name of CAPSTONE_STACKS) {
      const stdout = await captureStdout(() =>
        main(argv("stack", "inspect", "--preset", `presets/stacks/${name}.json`, "--json")),
      );
      const data = JSON.parse(stdout) as { command?: string; name?: string };
      expect(data.command, name + " should inspect as a stack").toBe("stack inspect");
      expect(data.name, name + " inspect returned the wrong preset").toBe(name);
    }
  });

  it("runs `toneforge sequence simulate` for every capstone sequence", async () => {
    for (const name of CAPSTONE_SEQUENCES) {
      const stdout = await captureStdout(() =>
        main(
          argv(
            "sequence",
            "simulate",
            "--preset",
            `presets/sequences/${name}.json`,
            "--seed",
            "42",
            "--json",
          ),
        ),
      );
      const data = JSON.parse(stdout) as { name?: string };
      expect(data.name, name + " simulate returned the wrong preset").toBe(name);
    }
  });

  it("runs `toneforge list stacks` and `toneforge list sequences`", async () => {
    const stacksStdout = await captureStdout(() => main(argv("list", "stacks", "--json")));
    const stacks = JSON.parse(stacksStdout) as { command?: string; resource?: string };
    expect(stacks.command).toBe("list");
    expect(stacks.resource).toBe("stacks");

    const sequencesStdout = await captureStdout(() => main(argv("list", "sequences", "--json")));
    const sequences = JSON.parse(sequencesStdout) as { command?: string; resource?: string };
    expect(sequences.command).toBe("list");
    expect(sequences.resource).toBe("sequences");
  });

  it("renders a capstone stack and sequence to temporary WAV files", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "tf-capstone-"));
    try {
      const stackName = CAPSTONE_STACKS[0]!;
      const stackOut = join(outDir, stackName + ".wav");
      let stackCode = -1;
      await captureStdout(async () => {
        stackCode = await main(
          argv(
            "stack",
            "render",
            "--preset",
            `presets/stacks/${stackName}.json`,
            "--seed",
            "42",
            "--output",
            stackOut,
            "--json",
          ),
        );
        return stackCode;
      });
      expect(stackCode, "`toneforge stack render` should exit 0").toBe(0);
      expect(existsSync(stackOut), "stack render should write the WAV").toBe(true);

      const seqName = CAPSTONE_SEQUENCES[0]!;
      const seqOut = join(outDir, seqName + ".wav");
      let seqCode = -1;
      await captureStdout(async () => {
        seqCode = await main(
          argv(
            "sequence",
            "generate",
            "--preset",
            `presets/sequences/${seqName}.json`,
            "--seed",
            "42",
            "--output",
            seqOut,
            "--json",
          ),
        );
        return seqCode;
      });
      expect(seqCode, "`toneforge sequence generate` should exit 0").toBe(0);
      expect(existsSync(seqOut), "sequence generate should write the WAV").toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

describe("Recipe Book completion gate", () => {
  it("delivers exactly the 101 roster recipes", () => {
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

  it("lists exactly the 101 recipes plus the capstones in index.md", () => {
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

  it("builds the canonical CLI block with the positional `show` form", () => {
    const block = buildCliBlock("blip-sine-ping");
    expect(block).toContain("toneforge show blip-sine-ping");
    expect(block).not.toContain("show --recipe");
  });

  it("documents the positional `toneforge show <name>` form on every recipe page", () => {
    const offenders: string[] = [];
    for (const entry of recipeRoster) {
      const content = readFileSync(resolve(DOCS_DIR, entry.name + ".md"), "utf-8");
      if (content.includes("toneforge show --recipe")) offenders.push(entry.name);
      expect(
        content,
        entry.name + " must document `toneforge show " + entry.name + "`",
      ).toContain("toneforge show " + entry.name);
    }
    expect(
      offenders,
      "Pages still using the invalid `show --recipe` form: " + offenders.join(", "),
    ).toEqual([]);
  });

  it("runs `toneforge show <recipe-name>` successfully for a sample of book recipes", async () => {
    const sample = ["blip-sine-ping", "ui-click-crisp", "sting-victory-bright"];
    for (const name of sample) {
      const stdout = await captureStdout(async () => {
        const code = await main(argv("show", name, "--json"));
        expect(code, "`toneforge show " + name + "` should exit 0").toBe(0);
        return code;
      });
      const data = JSON.parse(stdout) as { command?: string; recipe?: string };
      expect(data.command).toBe("show");
      expect(data.recipe, "`toneforge show " + name + "` returned the wrong recipe").toBe(name);
    }
  });

  it("toneforge list recipes --tags casual returns all 101 book recipes with casual + fun/joy", async () => {
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

// ── Working with the CLI section ─────────────────────────────────────────────

/**
 * The generated Working with the CLI section is the index's how-to guide. It
 * must be present, survive regeneration byte-for-byte, and only reference
 * recipe / stack / sequence names that actually resolve (registry or presets/).
 */
describe("Working with the CLI section", () => {
  it("exists in the generated index and survives regeneration byte-for-byte", () => {
    const content = readFileSync(INDEX_PATH, "utf-8");
    expect(content).toContain(CLI_WORKFLOW_SECTION_HEADING);
    expect(content).toBe(renderIndexContent());
  });

  it("references every example recipe / stack / sequence name", () => {
    const content = readFileSync(INDEX_PATH, "utf-8");
    const referenced: string[] = [
      ...CLI_WORKFLOW_EXAMPLES.recipes,
      ...CLI_WORKFLOW_EXAMPLES.stacks,
      ...CLI_WORKFLOW_EXAMPLES.sequences,
    ];
    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) {
      expect(
        content,
        "Working with the CLI section must reference " + name,
      ).toContain(name);
    }
  });

  it("resolves every referenced recipe name via the registry or presets/", () => {
    for (const name of CLI_WORKFLOW_EXAMPLES.recipes) {
      const registered = registry.getRegistration(name) !== undefined;
      const preset = existsSync(resolve(RECIPES_DIR, name + ".yaml"));
      expect(
        registered || preset,
        "Referenced recipe " + name + " must be registered or have a preset",
      ).toBe(true);
    }
  });

  it("resolves every referenced stack and sequence name via presets/", () => {
    for (const name of CLI_WORKFLOW_EXAMPLES.stacks) {
      expect(
        existsSync(resolve(ROOT, "presets", "stacks", name + ".json")),
        "Referenced stack " + name + " must have a preset",
      ).toBe(true);
    }
    for (const name of CLI_WORKFLOW_EXAMPLES.sequences) {
      expect(
        existsSync(resolve(ROOT, "presets", "sequences", name + ".json")),
        "Referenced sequence " + name + " must have a preset",
      ).toBe(true);
    }
  });
});

// ── Link integrity ───────────────────────────────────────────────────────────

/**
 * Every page whose local relative links must resolve: the generated index,
 * all 101 recipe pages, all 12 capstone pages and the hand-maintained
 * `_template.md`.
 *
 * `_template.md` has no generator (no script emits it), so it is edited
 * directly and its `## See also` target must be kept in sync with the block
 * emitted by `scripts/recipe-book/generate-pages.ts` by hand.
 */
const BOOK_PAGES: string[] = [
  "index.md",
  "_template.md",
  ...recipeRoster.map((e) => e.name + ".md"),
  ...CAPSTONE_PAGES.map((n) => n + ".md"),
];

/** Targets that must not be resolved against the filesystem. */
function isExternalTarget(target: string): boolean {
  return (
    target.startsWith("#") ||
    target.startsWith("//") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)
  );
}

/**
 * Parse the inline `[text](target)` links on a page. Image embeds
 * (`![alt](src)`) are not links and are excluded by the leading `!`.
 */
function parseInlineLinks(content: string): string[] {
  const re = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g;
  const targets: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    targets.push(match[1]!.trim());
  }
  return targets;
}

describe("Recipe Book link integrity", () => {
  it("covers index.md, the template, all 101 recipes and all 12 capstones", () => {
    expect(BOOK_PAGES.length).toBe(115);
    for (const page of BOOK_PAGES) {
      expect(existsSync(resolve(DOCS_DIR, page)), "Missing book page " + page).toBe(true);
    }
  });

  it("parses inline links only, so reference-style links cannot slip through", () => {
    let parsed = 0;
    for (const page of BOOK_PAGES) {
      parsed += parseInlineLinks(readFileSync(resolve(DOCS_DIR, page), "utf-8")).length;
    }
    // Baseline: 101 recipes x 2 + 12 capstones x 3 + index 110 + template 2
    // = 350 links. A drop means inline links went unparsed (for example, were
    // rewritten as reference-style links).
    expect(parsed).toBeGreaterThanOrEqual(342);
  });

  it("resolves every local relative link on every page", () => {
    const broken: string[] = [];
    for (const page of BOOK_PAGES) {
      const content = readFileSync(resolve(DOCS_DIR, page), "utf-8");
      for (const target of parseInlineLinks(content)) {
        if (isExternalTarget(target)) continue;
        const pathPart = decodeURIComponent(target.split("#")[0]!);
        if (pathPart === "") continue;
        const resolved = resolve(DOCS_DIR, dirname(page), pathPart);
        if (!existsSync(resolved)) {
          broken.push(page + " -> " + target);
        }
      }
    }
    expect(broken, "Broken local relative links:\n" + broken.join("\n")).toEqual([]);
  });
});

// ── Documented CLI commands ──────────────────────────────────────────────────

/**
 * Every command line in the book that begins with `toneforge`, deduplicated.
 * Lines are taken verbatim from the pages (`## ToneForge CLI` blocks and the
 * index's Working with the CLI section); the `<command> --help` placeholder is
 * skipped because it is prose, not a concrete command.
 */
function documentedCliCommands(): string[] {
  const commands = new Set<string>();
  for (const page of BOOK_PAGES) {
    const content = readFileSync(resolve(DOCS_DIR, page), "utf-8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line.startsWith("toneforge ")) continue;
      if (line.includes("<")) continue;
      commands.add(line);
    }
  }
  return [...commands].sort();
}

/**
 * The book is a reference: every command it documents must be one the CLI
 * actually accepts. Each documented line is checked against the real CLI by
 * running its `--help`, which proves the top-level command exists and that
 * every `--flag` on the line is advertised. A renamed command, a dropped flag
 * or a typo therefore fails the suite instead of reaching a reader.
 */
describe("Documented CLI commands", () => {
  it("documents only commands and flags the CLI accepts", async () => {
    const commands = documentedCliCommands();
    expect(commands.length).toBeGreaterThan(100);

    const failures: string[] = [];
    for (const line of commands) {
      const tokens = line.split(/\s+/);
      const verb = tokens[1]!;
      if (!FRAMEWORK_COMMANDS.includes(verb)) {
        failures.push(line + " -> unknown command '" + verb + "'");
        continue;
      }

      const stdout = await captureStdout(() => main(argv(...tokens.slice(1), "--help")));
      if (!stdout.includes("# ToneForge " + verb)) {
        failures.push(line + " -> `toneforge " + verb + " --help` printed no usage");
        continue;
      }
      for (const token of tokens.slice(1)) {
        if (!token.startsWith("--")) continue;
        if (!stdout.includes(token)) {
          failures.push(line + " -> flag '" + token + "' is not accepted");
        }
      }
    }

    expect(
      failures,
      "Documented commands or flags the CLI does not accept:\n" + failures.join("\n"),
    ).toEqual([]);
  });
});
