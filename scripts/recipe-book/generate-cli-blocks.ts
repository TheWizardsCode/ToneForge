#!/usr/bin/env tsx
/**
 * generate-cli-blocks.ts — Canonical CLI command block builders for the recipe
 * book.
 *
 * This module is the **single source of truth** for the CLI-block text on every
 * recipe and capstone page. It exports:
 *   - `buildRecipeCliBlock(name, tier)` — a **tier-aware** recipe renderer that
 *     maps a recipe's roster tier to the pipeline stage its block should
 *     demonstrate (generate/show → analyze → classify/explore →
 *     sequence/library → classify/visualize → sequence/explore →
 *     stack/visualize).
 *   - the marker helpers shared by every page (`cliBlockStartMarker`,
 *     `CLI_BLOCK_END`).
 *
 * `generate-pages.ts` and the recipe-book freshness test import these builders,
 * so a page can never drift from the generator without failing the suite.
 *
 * Capstone blocks are built by `buildCapstoneCliBlock` — the sibling function
 * delivered by TF-0MV5KHE5A0000FKA; this file hosts the shared block builder
 * surface so every generator and the tests import from one place.
 *
 * Usage:
 *   tsx scripts/recipe-book/generate-cli-blocks.ts <recipe-name>          # print block
 *   tsx scripts/recipe-book/generate-cli-blocks.ts <recipe-name> --validate  # validate page
 *
 * Idempotent: running twice produces the same output.
 *
 * The generated block is placed between markers:
 *   <!-- CLI_BLOCK_START — ... -->
 *   ...commands...
 *   <!-- CLI_BLOCK_END -->
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { recipeRoster } from "../../src/recipes/recipe-book/roster.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

/** The seven ascending recipe tiers. */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ── Markers ──────────────────────────────────────────────────────────────────

/** Opening marker for a recipe page's CLI block. */
export function cliBlockStartMarker(name: string): string {
  return `<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ${name} -->`;
}

/** Closing marker shared by recipe and capstone CLI blocks. */
export const CLI_BLOCK_END = `<!-- CLI_BLOCK_END -->`;

// ── Tier-aware recipe builder ────────────────────────────────────────────────

interface CliCommand {
  /** Short human-readable description emitted as a `#` comment. */
  desc: string;
  /** The runnable `toneforge …` command line. */
  cmd: string;
}

/**
 * The pipeline surfaces each tier's block demonstrates, in the order the book
 * teaches them. The first word of each surface is the top-level `toneforge`
 * subcommand; tests assert a tier block contains exactly these surfaces.
 */
export const TIER_SURFACES: Record<Tier, readonly string[]> = {
  1: ["generate", "show", "list recipes"],
  2: ["generate", "analyze"],
  3: ["classify", "explore"],
  4: ["sequence", "library"],
  5: ["classify", "visualize"],
  6: ["sequence", "explore"],
  7: ["stack", "visualize"],
};

/**
 * The fixed, existing presets referenced by tiers whose surface cannot take a
 * `--recipe` flag (`sequence` and `stack` require `--preset`). Chosen to be
 * topically representative and kept stable so the references never churn.
 */
export const TIER_PRESETS = {
  /** Tier 4 (melodic motifs) — a level-complete melodic sequence. */
  tier4Sequence: "presets/sequences/casual_level_complete_sequence.json",
  /** Tier 6 (ambience & loops) — a running-footsteps loop sequence. */
  tier6Sequence: "presets/sequences/footsteps_run.json",
  /** Tier 7 (multi-voice stings) — a layered victory stack. */
  tier7Stack: "presets/stacks/casual_victory_stack.json",
} as const;

/** Render a list of commands as one fenced `bash` block per command. */
function renderCommands(commands: CliCommand[]): string {
  return commands
    .map(({ desc, cmd }) => `\`\`\`bash\n# ${desc}\n${cmd}\n\`\`\``)
    .join("\n");
}

/**
 * Resolve the ordered command list for a recipe's tier.
 *
 * Blocks **replace** the previous generic four-command block rather than
 * appending to it, so each page demonstrates exactly the stage its tier
 * introduces. Every `--preset` reference points at an existing file under
 * `presets/` (asserted by the recipe-book test suite).
 *
 * @param name - The recipe name.
 * @param tier - The recipe's roster tier (1–7).
 * @returns The ordered commands for the tier.
 * @throws When *tier* is not a supported tier.
 */
function tierCommands(name: string, tier: number): CliCommand[] {
  switch (tier) {
    case 1:
      return [
        { desc: "Generate the recipe at a fixed seed", cmd: `toneforge generate --recipe ${name} --seed 42 --output ${name}.wav` },
        { desc: "Show the recipe metadata", cmd: `toneforge show ${name}` },
        { desc: "List the casual recipes", cmd: `toneforge list recipes --tags casual` },
      ];
    case 2:
      return [
        { desc: "Generate the recipe at a fixed seed", cmd: `toneforge generate --recipe ${name} --seed 42 --output ${name}.wav` },
        { desc: "Analyse the rendered shape", cmd: `toneforge analyze --recipe ${name} --seed 42` },
      ];
    case 3:
      return [
        { desc: "Classify the sound by category and texture", cmd: `toneforge classify --recipe ${name} --seed 42` },
        { desc: "Sweep seeds and rank the best variants", cmd: `toneforge explore sweep --recipe ${name} --seed-range 1:50 --keep-top 5` },
      ];
    case 4:
      return [
        { desc: "Inspect a representative melodic sequence", cmd: `toneforge sequence inspect --preset ${TIER_PRESETS.tier4Sequence}` },
        { desc: "List the curated library", cmd: `toneforge library list` },
      ];
    case 5:
      return [
        { desc: "Classify the character voice", cmd: `toneforge classify --recipe ${name} --seed 42` },
        { desc: "Export deterministic visual frames", cmd: `toneforge visualize export --recipe ${name} --seed 42 --format frames` },
      ];
    case 6:
      return [
        { desc: "Inspect a representative ambience sequence", cmd: `toneforge sequence inspect --preset ${TIER_PRESETS.tier6Sequence}` },
        { desc: "Sweep seeds and rank the best variants", cmd: `toneforge explore sweep --recipe ${name} --seed-range 1:50 --keep-top 5` },
      ];
    case 7:
      return [
        { desc: "Inspect a representative multi-voice stack", cmd: `toneforge stack inspect --preset ${TIER_PRESETS.tier7Stack}` },
        { desc: "Export deterministic visual frames", cmd: `toneforge visualize export --recipe ${name} --seed 42 --format frames` },
      ];
    default:
      throw new Error(
        `Unknown tier ${tier} for recipe "${name}"; expected 1–7.`,
      );
  }
}

/**
 * Build the tier-aware CLI command block for a recipe page.
 *
 * This is the only source of recipe-page CLI-block text: `generate-pages.ts`
 * writes it into the page, and `src/recipes/recipe-book.test.ts` regenerates it
 * to prove the committed block is fresh.
 *
 * @param name - The recipe name.
 * @param tier - The recipe's roster tier (1–7).
 * @returns The marker-free command block.
 */
export function buildRecipeCliBlock(name: string, tier: number): string {
  return renderCommands(tierCommands(name, tier));
}

// ── CLI entry point ──────────────────────────────────────────────────────────

function runCli(): void {
  const recipeName = process.argv[2];
  const validateOnly = process.argv.includes("--validate");

  if (!recipeName) {
    console.error("Usage: generate-cli-blocks.ts <recipe-name> [--validate]");
    process.exit(1);
  }

  const entry = recipeRoster.find((e) => e.name === recipeName);
  if (!entry) {
    console.error(`ERROR: Unknown recipe "${recipeName}" (not in the roster).`);
    process.exit(1);
  }

  const cliBlock = buildRecipeCliBlock(recipeName, entry.tier);
  const outputPath = resolve(ROOT, "docs", "recipe-book", `${recipeName}.md`);
  const markerStart = cliBlockStartMarker(recipeName);
  const markerEnd = CLI_BLOCK_END;

  if (validateOnly) {
    const pageContent = readFileSync(outputPath, "utf-8");
    const startIdx = pageContent.indexOf(markerStart);
    const endIdx = pageContent.indexOf(markerEnd);

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.error(`ERROR: CLI block markers not found in ${outputPath}`);
      process.exit(1);
    }

    const existingBlock = pageContent.slice(startIdx + markerStart.length, endIdx).trim();
    if (existingBlock !== cliBlock.trim()) {
      console.error(`ERROR: CLI block in ${outputPath} is stale. Run: tsx scripts/recipe-book/generate-pages.ts ${recipeName}`);
      process.exit(1);
    }

    console.log(`✓ CLI block in ${outputPath} is fresh (tier ${entry.tier})`);
    return;
  }

  // Print the generated block for inspection.
  console.log(markerStart);
  console.log(cliBlock);
  console.log(markerEnd);
}

// Only run the CLI when this module is executed directly. Importing it (from
// generate-pages.ts or the recipe-book freshness test) must not run the script.
const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  runCli();
}
