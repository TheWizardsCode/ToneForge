#!/usr/bin/env tsx
/**
 * generate-cli-blocks.ts — Generate or validate CLI command blocks for a recipe page.
 *
 * Reads a recipe YAML file from `presets/recipes/` and generates a markdown
 * code block with the CLI commands needed to generate, show, and list that recipe.
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

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const recipeName = process.argv[2];
const validateOnly = process.argv.includes("--validate");

if (!recipeName) {
  console.error("Usage: generate-cli-blocks.ts <recipe-name> [--validate]");
  process.exit(1);
}

// ── Generate CLI blocks ──────────────────────────────────────────────────────

function generateCliBlocks(name: string): string {
  const commands = [
    { desc: "Generate the recipe with a specific seed", cmd: `toneforge generate --recipe ${name} --seed 42 --output ${name}.wav` },
    { desc: "Show the recipe metadata", cmd: `toneforge show --recipe ${name}` },
    { desc: "List all recipes, filtered by casual tag", cmd: `toneforge list recipes --tags casual` },
    { desc: "Generate with default seed", cmd: `toneforge generate --recipe ${name} --output ${name}-default.wav` },
  ];

  let lines: string[] = [];
  for (const { desc, cmd } of commands) {
    lines.push(`\`\`\`bash\n# ${desc}\n${cmd}\n\`\`\``);
  }
  return lines.join("\n");
}

const cliBlock = generateCliBlocks(recipeName);

// ── Write or validate ────────────────────────────────────────────────────────

const outputPath = resolve(ROOT, "docs", "recipe-book", `${recipeName}.md`);
const markerStart = `<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ${recipeName} -->`;
const markerEnd = `<!-- CLI_BLOCK_END -->`;

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
} else {
  // For now, just print the generated block
  console.log(markerStart);
  console.log(cliBlock);
  console.log(markerEnd);
}
