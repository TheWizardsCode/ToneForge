#!/usr/bin/env tsx
/**
 * generate-index.ts — Generate the recipe-book index from the roster manifest.
 *
 * Reads `src/recipes/recipe-book/roster.ts`, sorts entries by tier then name,
 * and writes `docs/recipe-book/index.md` with front matter and an ordered list
 * of all recipes grouped by tier.
 *
 * Idempotent: a second run produces byte-identical output.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

// ── Load roster ──────────────────────────────────────────────────────────────

const rosterPath = resolve(ROOT, "src", "recipes", "recipe-book", "roster.ts");
const rosterSource = readFileSync(rosterPath, "utf-8");

// Extract the roster array by parsing the TypeScript source.
// We look for the `recipeRoster` variable assignment and extract its content.
const match = rosterSource.match(/export\s+const\s+recipeRoster\s*:\s*RosterEntry\s*\[\]\s*=\s*\[([\s\S]*?)\];/);
if (!match) {
  console.error("ERROR: Could not find recipeRoster array in roster.ts");
  process.exit(1);
}

// Parse the roster entries from the TypeScript array literal.
// Each entry looks like: { name: "...", tier: N, family: "...", intent: "..." },
function parseRosterEntries(text: string): Array<{ name: string; tier: number; family: string; intent: string }> {
  const entries: Array<{ name: string; tier: number; family: string; intent: string }> = [];
  const entryRegex = /\{\s*name:\s*["']([^"']+)["'],\s*tier:\s*(\d),\s*family:\s*["']([^"']+)["'],\s*intent:\s*["']([^"']+)["']\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(text)) !== null) {
    entries.push({ name: m[1], tier: Number(m[2]), family: m[3], intent: m[4] });
  }
  return entries;
}

const entries = parseRosterEntries(match[1]);

if (entries.length !== 100) {
  console.error(`ERROR: Roster has ${entries.length} entries, expected 100`);
  process.exit(1);
}

// Sort by tier then name for deterministic order
entries.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

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

let lines: string[] = [];
lines.push("---");
lines.push('title: "Casual Game Recipe Book"');
lines.push('id: "recipe-book-index"');
lines.push("order: 0");
lines.push('description: "100 documented casual game sound recipes, ascending from single-oscillator blips to multi-layered stings."');
lines.push("---");
lines.push("");
lines.push("# Casual Game Recipe Book");
lines.push("");
lines.push("A curated collection of **100 procedural sound recipes** for casual and arcade games,");
lines.push("organised into seven ascending tiers of increasing complexity:");
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

const outputPath = resolve(ROOT, "docs", "recipe-book", "index.md");
writeFileSync(outputPath, lines.join("\n") + "\n", "utf-8");
console.log(`Generated ${outputPath} (${entries.length} entries)`);
