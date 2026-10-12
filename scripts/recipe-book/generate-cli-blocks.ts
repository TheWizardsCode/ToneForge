#!/usr/bin/env tsx
/**
 * generate-cli-blocks.ts — Canonical CLI command block builder for recipe pages.
 *
 * Exports `buildCliBlock(name)` (the single source of truth for the block text)
 * together with the marker helpers, so both this script and
 * `generate-pages.ts` emit byte-identical blocks.
 *
 * Usage:
 *   tsx scripts/recipe-book/generate-cli-blocks.ts <recipe-name>          # generate
 *   tsx scripts/recipe-book/generate-cli-blocks.ts <recipe-name> --validate  # validate against page
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

// ── Shared block builder ─────────────────────────────────────────────────────

/** Opening marker for a recipe page's CLI block. */
export function cliBlockStartMarker(name: string): string {
  return `<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ${name} -->`;
}

/** Closing marker for a recipe page's CLI block. */
export const CLI_BLOCK_END = `<!-- CLI_BLOCK_END -->`;

/**
 * Build the canonical CLI command block for a recipe page.
 *
 * This is the only source of CLI-block text: `generate-pages.ts` writes it into
 * the page, and `src/recipes/recipe-book.test.ts` regenerates it to prove the
 * committed block is fresh.
 */
export function buildCliBlock(name: string): string {
  const commands = [
    { desc: "Generate the recipe with a specific seed", cmd: `toneforge generate --recipe ${name} --seed 42 --output ${name}.wav` },
    { desc: "Show the recipe metadata", cmd: `toneforge show ${name}` },
    { desc: "List all recipes, filtered by casual tag", cmd: `toneforge list recipes --tags casual` },
    { desc: "Generate with default seed", cmd: `toneforge generate --recipe ${name} --output ${name}-default.wav` },
  ];

  return commands
    .map(({ desc, cmd }) => `\`\`\`bash\n# ${desc}\n${cmd}\n\`\`\``)
    .join("\n");
}

// ── CLI entry point ──────────────────────────────────────────────────────────

function runCli(): void {
  const recipeName = process.argv[2];
  const validateOnly = process.argv.includes("--validate");

  if (!recipeName) {
    console.error("Usage: generate-cli-blocks.ts <recipe-name> [--validate]");
    process.exit(1);
  }

  const cliBlock = buildCliBlock(recipeName);
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
      console.error(`ERROR: CLI block in ${outputPath} is stale. Run: tsx scripts/recipe-book/generate-cli-blocks.ts ${recipeName}`);
      process.exit(1);
    }

    console.log(`✓ CLI block in ${outputPath} is fresh`);
    return;
  }

  // For now, just print the generated block
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
