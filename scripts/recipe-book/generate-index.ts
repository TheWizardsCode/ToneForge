#!/usr/bin/env tsx
/**
 * generate-index.ts — Generate the recipe-book index from the roster manifest.
 *
 * Reads `src/recipes/recipe-book/roster.ts`, sorts entries by tier then name,
 * and writes `docs/recipe-book/index.md` with front matter, a Working with the
 * CLI section, and an ordered list of all recipes grouped by tier.
 *
 * Idempotent: a second run produces byte-identical output.
 *
 * Importing this module (for example from the recipe-book freshness test) does
 * not write the index — the write happens only when the script is executed
 * directly.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

// ── Working with the CLI examples ────────────────────────────────────────────

/** Heading of the generated CLI-workflow section. */
export const CLI_WORKFLOW_SECTION_HEADING = "## Working with the CLI";

/**
 * Recipe / stack / sequence names referenced by the Working with the CLI
 * section. Kept beside the section builder so the generated text and the test
 * that proves every referenced name resolves share one source of truth.
 */
export const CLI_WORKFLOW_EXAMPLES = {
  recipes: ["blip-sine-ping"],
  stacks: ["casual_ui_confirm_stack"],
  sequences: ["casual_menu_flow_sequence"],
} as const;

// ── Load roster ──────────────────────────────────────────────────────────────

interface RosterEntry {
  name: string;
  tier: number;
  family: string;
  intent: string;
}

// Parse the roster entries from the TypeScript array literal.
// Each entry looks like: { name: "...", tier: N, family: "...", intent: "..." },
function parseRosterEntries(text: string): RosterEntry[] {
  const entries: RosterEntry[] = [];
  const entryRegex = /\{\s*name:\s*["']([^"']+)["'],\s*tier:\s*(\d),\s*family:\s*["']([^"']+)["'],\s*intent:\s*["']([^"']+)["'][^}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(text)) !== null) {
    entries.push({ name: m[1], tier: Number(m[2]), family: m[3], intent: m[4] });
  }
  return entries;
}

function loadRoster(): RosterEntry[] {
  const rosterPath = resolve(ROOT, "src", "recipes", "recipe-book", "roster.ts");
  const rosterSource = readFileSync(rosterPath, "utf-8");

  // Extract the roster array by parsing the TypeScript source.
  // We look for the `recipeRoster` variable assignment and extract its content.
  const match = rosterSource.match(/export\s+const\s+recipeRoster\s*:\s*RosterEntry\s*\[\]\s*=\s*\[([\s\S]*?)\];/);
  if (!match) {
    console.error("ERROR: Could not find recipeRoster array in roster.ts");
    process.exit(1);
  }

  const entries = parseRosterEntries(match[1]!);

  if (entries.length !== 101) {
    console.error(`ERROR: Roster has ${entries.length} entries, expected 101`);
    process.exit(1);
  }

  // Preserve the roster's authored order within each tier (ascending complexity).
  // The roster is already tier-grouped and ordered; a stable sort by tier only
  // keeps the intended within-tier progression instead of re-sorting names
  // alphabetically, which would break the ascending-complexity contract and the
  // index-order gate in recipe-book.test.ts.
  entries.sort((a, b) => a.tier - b.tier);
  return entries;
}

// ── Working with the CLI section ─────────────────────────────────────────────

/**
 * The generated "Working with the CLI" section: find / evaluate / understand
 * the recipes from the command line. Every command is copy-pasteable and valid
 * against the current CLI.
 */
function renderCliWorkflowSection(): string[] {
  const recipe = CLI_WORKFLOW_EXAMPLES.recipes[0]!;
  const stack = CLI_WORKFLOW_EXAMPLES.stacks[0]!;
  const sequence = CLI_WORKFLOW_EXAMPLES.sequences[0]!;
  return [
    CLI_WORKFLOW_SECTION_HEADING,
    "",
    "Every recipe in this book is reachable from the `toneforge` CLI. The three",
    "subsections below cover the whole loop — **find** a sound, **evaluate** it",
    "and **understand how it was created**. Each command is copy-pasteable; run",
    "`toneforge <command> --help` for the full option list.",
    "",
    "### Find a sound",
    "",
    "```bash",
    "# Search names, descriptions, categories and tags",
    "toneforge list recipes --search coin",
    "",
    "# Narrow by category or by tags (filters combine with AND)",
    "toneforge list recipes --category Collect",
    "toneforge list recipes --tags casual,fun",
    "",
    "# Machine-readable output for scripts",
    "toneforge list recipes --tags casual --json",
    "",
    "# Inspect one recipe's metadata and parameters",
    `toneforge show ${recipe}`,
    "",
    "# Browse the curated library",
    "toneforge library list --json",
    "toneforge library search --category Collect --json",
    "```",
    "",
    "### Evaluate a sound",
    "",
    "```bash",
    "# Render a deterministic WAV at a fixed seed",
    `toneforge generate --recipe ${recipe} --seed 42 --output ${recipe}.wav`,
    "",
    "# Listen to the rendered file",
    `toneforge play ${recipe}.wav`,
    "",
    "# Measure and then label the audio",
    `toneforge analyze --input ${recipe}.wav --json`,
    `toneforge classify --input ${recipe}.wav --json`,
    "",
    "# Explore seed-space variations, visualise, or curate interactively",
    `toneforge explore sweep --recipe ${recipe} --seed-range 0:19 --json`,
    `toneforge visualize export --recipe ${recipe} --seed 42 --output viz/`,
    "toneforge tui",
    "```",
    "",
    "### Understand how a sound was created",
    "",
    "```bash",
    "# Read the recipe's generation metadata",
    `toneforge show ${recipe}`,
    "```",
    "",
    "Every page in this book carries a `## Sound design` section that explains the",
    "synthesis. The underlying graphs live in",
    "[`presets/recipes/`](../../presets/recipes/) and are described by the",
    "[ToneGraph schema](../tonegraph.md) and the",
    "[Sound Module Index](../modules/index.md).",
    "",
    "Layered arrangements use the same workflow. Inspect the capstone stack",
    `[\`${stack}\`](./${stack}.md) and the sequence`,
    `[\`${sequence}\`](./${sequence}.md):`,
    "",
    "```bash",
    `toneforge stack inspect --preset presets/stacks/${stack}.json`,
    `toneforge sequence simulate --preset presets/sequences/${sequence}.json --seed 42`,
    "```",
    "",
  ];
}

// ── Generate index ───────────────────────────────────────────────────────────

const tierNames: Record<number, string> = {
  1: "Pure tones & blips",
  2: "Shaped events",
  3: "Textured & filtered",
  4: "Melodic motifs",
  5: "Character & critter voices",
  6: "Ambience & loops",
  7: "Multi-voice stings",
};

interface CapstoneEntry {
  kind: "stacks" | "sequences";
  name: string;
}

const capstones: CapstoneEntry[] = [
  { kind: "stacks", name: "casual_ui_confirm_stack" },
  { kind: "stacks", name: "casual_coin_reward_stack" },
  { kind: "stacks", name: "casual_victory_stack" },
  { kind: "stacks", name: "casual_character_jump_stack" },
  { kind: "stacks", name: "casual_impact_hit_stack" },
  { kind: "sequences", name: "casual_menu_flow_sequence" },
  { kind: "sequences", name: "casual_coin_run_sequence" },
  { kind: "sequences", name: "casual_level_complete_sequence" },
  { kind: "sequences", name: "casual_game_over_sequence" },
  { kind: "sequences", name: "casual_adventure_intro_sequence" },
  { kind: "sequences", name: "sequence-wave-end" },
  { kind: "sequences", name: "sequence-level-end" },
];

/**
 * Render the complete `docs/recipe-book/index.md` content. Exposed so the
 * freshness test can prove the committed index matches the generator
 * byte-for-byte without writing to disk.
 */
export function renderIndexContent(): string {
  const entries = loadRoster();
  const lines: string[] = [];

  lines.push("---");
  lines.push('title: "Casual Game Recipe Book"');
  lines.push('id: "recipe-book-index"');
  lines.push("order: 0");
  lines.push('description: "101 documented casual game sound recipes, ascending from single-oscillator blips to multi-layered stings."');
  lines.push("---");
  lines.push("");
  lines.push("# Casual Game Recipe Book");
  lines.push("");
  lines.push("A curated collection of **101 procedural sound recipes** for casual and arcade games,");
  lines.push("organised into seven ascending tiers of increasing complexity:");
  lines.push("");
  lines.push("Every recipe page opens with an **At a glance** metadata table — title, common uses,");
  lines.push("default frequency and duration — so a recipe can be scanned before reading its full");
  lines.push("sound-design notes and ToneForge CLI commands.");
  lines.push("");

  let idx = 1;
  let currentTier = 0;

  for (const entry of entries) {
    if (entry.tier !== currentTier) {
      currentTier = entry.tier;
      lines.push(`## Tier ${currentTier}: ${tierNames[currentTier]}`);
      lines.push("");
    }

    lines.push(`${idx}. [\`${entry.name}\`](./${entry.name}.md) — ${entry.intent}`);
    idx++;
  }

  lines.push("");
  lines.push(`**Total: ${entries.length} recipes** across 7 tiers.`);
  lines.push("");

  // ── Capstone arrangements (after the 101 recipes) ──────────────────

  lines.push("## Capstones: Layered arrangements");
  lines.push("");
  lines.push(
    "Twelve capstone arrangements composed from the recipes above using `toneforge stack` and `toneforge sequence`:",
  );
  lines.push("");

  capstones.forEach((cap, i) => {
    const presetPath = resolve(ROOT, "presets", cap.kind, `${cap.name}.json`);
    const preset = JSON.parse(readFileSync(presetPath, "utf-8")) as {
      description?: string;
    };
    lines.push(
      `${i + 1}. [\`${cap.name}\`](./${cap.name}.md) — ${preset.description ?? cap.name}`,
    );
  });
  lines.push("");

  // Working with the CLI — how to find, evaluate and understand the recipes.
  // Emitted after the catalogue so the capstone links above remain the first
  // occurrence of each capstone name (asserted by recipe-book-capstones.test.ts).
  lines.push(...renderCliWorkflowSection());

  return lines.join("\n") + "\n";
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const content = renderIndexContent();
  const outputPath = resolve(ROOT, "docs", "recipe-book", "index.md");
  writeFileSync(outputPath, content, "utf-8");
  console.log(`Generated ${outputPath} (101 recipes + ${capstones.length} capstones)`);
}

// Only run the generator when this module is executed directly. Importing it
// (for example from the recipe-book freshness test) must not write the index.
const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  main();
}
