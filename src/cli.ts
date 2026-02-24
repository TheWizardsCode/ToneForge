#!/usr/bin/env node
/**
 * ToneForge CLI
 *
 * Entry point for the `toneforge` command-line tool.
 * Supports the `generate` command to render, play, and export procedural sounds,
 * the `show` command to display recipe metadata and parameters,
 * the `play` command to play WAV files from disk, and the `version` command to
 * print the current ToneForge version.
 *
 * Usage:
 *   toneforge generate --recipe <name> [--seed <number>] [--output <path.wav>]
 *   toneforge generate --recipe <name> --seed-range <start>:<end> --output <directory/>
 *   toneforge show <recipe-name> [--seed <number>]
 *   toneforge play <file.wav>
 *   toneforge version
 *   toneforge --version
 *   toneforge --help
 *
 * Reference: docs/prd/CLI_PRD.md Section 4.1, 5.1
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { renderRecipe } from "./core/renderer.js";
import { registry } from "./recipes/index.js";
import { playAudio, getPlayerCommand } from "./audio/player.js";
import { encodeWav } from "./audio/wav-encoder.js";
import { VERSION } from "./index.js";
import { createRng } from "./core/rng.js";
import { outputMarkdown, outputError, outputWarning, outputSuccess, outputInfo, outputTable } from "./output.js";
import type { RecipeRegistration } from "./core/recipe.js";
import { renderStack } from "./stack/renderer.js";
import type { StackDefinition } from "./stack/renderer.js";
import { loadPreset } from "./stack/preset-loader.js";
import { parseLayers } from "./stack/layer-parser.js";
import { createAnalysisEngine, registerBuiltinExtractors } from "./analyze/index.js";
import type { AnalysisResult } from "./analyze/index.js";
import { decodeWavFile } from "./audio/wav-decoder.js";

/** Parse command-line arguments into a structured map. */
function parseArgs(argv: string[]): {
  command: string | undefined;
  subcommand: string | undefined;
  flags: Record<string, string | boolean>;
  layers: string[];
} {
  // Skip node and script path
  const args = argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;
  let subcommand: string | undefined;
  const layers: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--help" || arg === "-h") {
      flags["help"] = true;
    } else if (arg === "--version" || arg === "-V") {
      flags["version"] = true;
    } else if (arg === "--json") {
      flags["json"] = true;
    } else if (arg === "--layer") {
      // Repeatable flag: collect all --layer values into an array
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        layers.push(next);
        i++;
      }
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (command === undefined) {
      command = arg;
    } else if (subcommand === undefined) {
      subcommand = arg;
    }
  }

  return { command, subcommand, flags, layers };
}

/** Print general help text. */
function printHelp(): void {
  const md = `# ToneForge v${VERSION}

**Procedural Audio Production Platform**

## Usage

\`toneforge <command> [options]\`

## Commands

| Command | Description |
|---------|-------------|
| **generate** | Render and export procedural sounds |
| **analyze** | Analyze audio files and extract structured metrics |
| **stack** | Compose layered sound events from multiple recipes |
| **show** | Display recipe metadata and parameters |
| **play** | Play a WAV file through the system audio player |
| **list** | List available resources (e.g. recipes) |
| **version** | Print the ToneForge version |

## Options

- \`--help\`, \`-h\` — Show this help message
- \`--version\`, \`-V\` — Print the ToneForge version
- \`--json\` — Output results in JSON format for machine consumption

Run \`toneforge <command> --help\` for command-specific help.`;
  outputMarkdown(md);
}

/** Print help text for the generate command. */
function printGenerateHelp(): void {
  const recipes = registry.list();
  const md = `# ToneForge generate

**Render and export procedural sounds**

## Usage

\`\`\`
toneforge generate --recipe <name> [--seed <number>] [--output <path.wav>]
toneforge generate --recipe <name> --seed-range <start>:<end> --output <directory/>
\`\`\`

## Options

- \`--recipe <name>\` — Name of the recipe to generate *(required)*
- \`--seed <number>\` — Integer seed for deterministic generation (default: random)
- \`--seed-range <start:end>\` — Generate one WAV per seed in the inclusive range
- \`--output <path>\` — Write WAV file to path instead of playing audio. Use a \`.wav\` path for single file, or a directory (trailing \`/\`) for batch output with \`--seed-range\`
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Available recipes

${recipes.length > 0 ? recipes.map((r) => `- \`${r}\``).join("\n") : "*(none registered)*"}

## Examples

\`\`\`
toneforge generate --recipe ui-scifi-confirm --seed 42
toneforge generate --recipe ui-scifi-confirm --seed 42 --output ./my-sound.wav
toneforge generate --recipe weapon-laser-zap --seed-range 1:10 --output ./lasers/
\`\`\``;
  outputMarkdown(md);
}

/** Print help text for the analyze command. */
function printAnalyzeHelp(): void {
  const recipes = registry.list();
  const md = `# ToneForge analyze

**Analyze audio files and extract structured metrics**

## Usage

\`\`\`
toneforge analyze --input <file.wav>
toneforge analyze --recipe <name> --seed <number>
toneforge analyze --input <directory> --output <dir>
toneforge analyze --input <directory> --format table
\`\`\`

## Options

- \`--input <path>\` — Path to a WAV file or directory of WAV files
- \`--recipe <name>\` — Recipe name for direct analysis (renders internally)
- \`--seed <number>\` — Seed for recipe rendering (used with \`--recipe\`)
- \`--output <dir>\` — Write one JSON file per input WAV to this directory (batch mode)
- \`--format <json|table>\` — Output format. \`json\` (default for single file), \`table\` for batch summary
- \`--json\` — Output structured JSON to stdout
- \`--help\`, \`-h\` — Show this help message

## Metrics

| Category | Metrics |
|----------|---------|
| **time** | duration, peak, rms, crestFactor |
| **quality** | clipping, silence |
| **envelope** | attackTime |
| **spectral** | spectralCentroid |

## Available recipes

${recipes.length > 0 ? recipes.map((r) => `- \`${r}\``).join("\n") : "*(none registered)*"}

## Examples

\`\`\`
toneforge analyze --input ./renders/weapon-laser-zap_seed-001.wav
toneforge analyze --recipe weapon-laser-zap --seed 42
toneforge analyze --input ./renders/ --format table
toneforge analyze --input ./renders/ --output ./analysis/
\`\`\``;
  outputMarkdown(md);
}

/** Print help text for the list command. */
function printListHelp(): void {
  const md = `# ToneForge list

**List available resources**

## Usage

\`toneforge list [resource]\`

## Resources

- **recipes** — List all registered recipes with a one-line summary *(default)*

## Options

- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge list
toneforge list recipes
\`\`\``;
  outputMarkdown(md);
}

/** Print help text for the play command. */
function printPlayHelp(): void {
  const md = `# ToneForge play

**Play a WAV file through the system audio player**

## Usage

\`toneforge play <file.wav>\`

## Arguments

- \`<file.wav>\` — Path to a WAV file to play *(required)*

## Options

- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge play ./output/confirm.wav
toneforge play ./output/lasers/weapon-laser-zap-seed-1.wav
\`\`\``;
  outputMarkdown(md);
}

/** Print help text for the stack command. */
function printStackHelp(): void {
  const md = `# ToneForge stack

**Compose layered sound events from multiple recipes**

## Usage

\`toneforge stack <subcommand> [options]\`

## Subcommands

| Subcommand | Description |
|------------|-------------|
| **render** | Render a layered stack to a WAV file or play it directly |
| **inspect** | Display the layer structure of a preset |

Run \`toneforge stack <subcommand> --help\` for subcommand-specific help.`;
  outputMarkdown(md);
}

/** Print help text for the stack render subcommand. */
function printStackRenderHelp(): void {
  const md = `# ToneForge stack render

**Render a layered stack to a WAV file or play it directly**

## Usage

\`\`\`
toneforge stack render --preset <file> --seed <number> [--output <path.wav>]
toneforge stack render --layer <spec> [--layer <spec>...] --seed <number> [--output <path.wav>]
\`\`\`

## Options

- \`--preset <file>\` — Path to a JSON preset file
- \`--layer <spec>\` — Inline layer specification (repeatable). Format: \`recipe=<name>,offset=<time>,gain=<value>\`
- \`--seed <number>\` — Integer seed for deterministic generation *(required)*
- \`--output <path.wav>\` — Output WAV file path. When omitted, audio is played directly
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Layer Specification Format

\`recipe=<name>,offset=<time>,gain=<value>,duration=<time>\`

- \`recipe\` — Recipe name *(required)*
- \`offset\` — Start time offset (default: 0). Supports \`ms\` and \`s\` suffixes; bare number = seconds
- \`gain\` — Gain multiplier (default: 1.0)
- \`duration\` — Duration override. Supports \`ms\` and \`s\` suffixes; bare number = seconds

## Examples

\`\`\`
toneforge stack render --preset presets/explosion_heavy.json --seed 42
toneforge stack render --preset presets/explosion_heavy.json --seed 42 --output ./explosion.wav
toneforge stack render \\
  --layer "recipe=impact-crack,offset=0ms,gain=0.9" \\
  --layer "recipe=rumble-body,offset=5ms,gain=0.7" \\
  --seed 42
\`\`\``;
  outputMarkdown(md);
}

/** Print help text for the stack inspect subcommand. */
function printStackInspectHelp(): void {
  const md = `# ToneForge stack inspect

**Display the layer structure of a preset**

## Usage

\`toneforge stack inspect --preset <file>\`

## Options

- \`--preset <file>\` — Path to a JSON preset file *(required)*
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge stack inspect --preset presets/explosion_heavy.json
\`\`\``;
  outputMarkdown(md);
}

/** Print help text for the show command. */
function printShowHelp(): void {
  const recipes = registry.list();
  const md = `# ToneForge show

**Display recipe metadata and parameters**

## Usage

\`toneforge show <recipe-name> [--seed <number>]\`

## Arguments

- \`<recipe-name>\` — Name of the recipe to inspect *(required)*

## Options

- \`--seed <number>\` — Show seed-specific parameter values alongside ranges
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Available recipes

${recipes.length > 0 ? recipes.map((r) => `- \`${r}\``).join("\n") : "*(none registered)*"}

## Examples

\`\`\`
toneforge show ui-scifi-confirm
toneforge show weapon-laser-zap --seed 42
\`\`\``;
  outputMarkdown(md);
}

/**
 * Compute the Levenshtein edit distance between two strings.
 * Used for fuzzy recipe name matching when a recipe is not found.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }

  return dp[m]![n]!;
}

/**
 * Suggest the closest matching recipe names for a given input.
 * Returns up to 3 suggestions sorted by edit distance.
 */
function suggestRecipes(input: string, names: string[]): string[] {
  return names
    .map((name) => ({ name, dist: levenshtein(input, name) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((s) => s.name);
}

/**
 * Format the `tf show` output as raw markdown.
 */
function formatShowOutput(
  name: string,
  reg: RecipeRegistration,
  seed?: number,
): string {
  const lines: string[] = [];

  // Title
  if (seed !== undefined) {
    lines.push(`# ${name} (seed: ${seed})`);
  } else {
    lines.push(`# ${name}`);
  }
  lines.push("");

  // Category & description
  lines.push(`**Category:** ${reg.category}`);
  lines.push(`**Description:** ${reg.description}`);
  lines.push("");

  // Signal chain
  lines.push("## Signal Chain");
  lines.push("");
  lines.push(reg.signalChain);
  lines.push("");

  // Parameters table
  lines.push("## Parameters");
  lines.push("");

  // Get seed-specific values if seed is provided
  let seedValues: Record<string, number> | undefined;
  if (seed !== undefined) {
    const rng = createRng(seed);
    seedValues = reg.getParams(rng);
  }

  if (seedValues) {
    // With seed: add Value column
    lines.push("| Parameter | Min | Max | Value | Unit |");
    lines.push("|-----------|-----|-----|-------|------|");
    for (const p of reg.params) {
      const value = seedValues[p.name];
      const valueStr = value !== undefined ? formatNumber(value) : "-";
      lines.push(`| ${p.name} | ${formatNumber(p.min)} | ${formatNumber(p.max)} | ${valueStr} | ${p.unit} |`);
    }
  } else {
    // Without seed: no Value column
    lines.push("| Parameter | Min | Max | Unit |");
    lines.push("|-----------|-----|-----|------|");
    for (const p of reg.params) {
      lines.push(`| ${p.name} | ${formatNumber(p.min)} | ${formatNumber(p.max)} | ${p.unit} |`);
    }
  }
  lines.push("");

  // Duration
  lines.push("## Duration");
  lines.push("");

  // Compute min/max duration by using the param min/max ranges
  // We need to compute duration from the registration's getDuration with actual seeds
  // Instead, we can compute duration range from the param extremes
  // But getDuration depends on the RNG, so we sample a range of seeds to estimate
  const durationSamples: number[] = [];
  for (let s = 0; s < 100; s++) {
    const rng = createRng(s);
    durationSamples.push(reg.getDuration(rng));
  }
  const minDuration = Math.min(...durationSamples);
  const maxDuration = Math.max(...durationSamples);

  if (seed !== undefined) {
    const rng = createRng(seed);
    const seedDuration = reg.getDuration(rng);
    lines.push(`${formatNumber(seedDuration)}s (seed ${seed}) | Range: ${formatNumber(minDuration)}s - ${formatNumber(maxDuration)}s`);
  } else {
    lines.push(`${formatNumber(minDuration)}s - ${formatNumber(maxDuration)}s`);
  }

  return lines.join("\n");
}

/**
 * Format the `tf show` output as a JSON-serializable object.
 */
function formatShowJson(
  name: string,
  reg: RecipeRegistration,
  seed?: number,
): Record<string, unknown> {
  // Get seed-specific values if seed is provided
  let seedValues: Record<string, number> | undefined;
  if (seed !== undefined) {
    const rng = createRng(seed);
    seedValues = reg.getParams(rng);
  }

  // Build params array
  const params = reg.params.map((p) => {
    const param: Record<string, unknown> = {
      name: p.name,
      min: p.min,
      max: p.max,
      unit: p.unit,
    };
    if (seedValues) {
      param.value = seedValues[p.name];
    }
    return param;
  });

  // Compute duration range by sampling seeds
  const durationSamples: number[] = [];
  for (let s = 0; s < 100; s++) {
    const rng = createRng(s);
    durationSamples.push(reg.getDuration(rng));
  }
  const minDuration = Math.min(...durationSamples);
  const maxDuration = Math.max(...durationSamples);

  const duration: Record<string, unknown> = {
    min: minDuration,
    max: maxDuration,
  };
  if (seed !== undefined) {
    const rng = createRng(seed);
    duration.value = reg.getDuration(rng);
    duration.seed = seed;
  }

  const result: Record<string, unknown> = {
    command: "show",
    recipe: name,
    category: reg.category,
    description: reg.description,
    tags: reg.tags ?? [],
    signalChain: reg.signalChain,
    params,
    duration,
  };

  if (seed !== undefined) {
    result.seed = seed;
  }

  return result;
}

/**
 * Format a number for display: remove trailing zeros after decimal point,
 * but keep enough precision to be informative.
 */
function formatNumber(n: number): string {
  // Use up to 4 decimal places, then strip trailing zeros
  const s = n.toFixed(4);
  // Remove trailing zeros after decimal point
  if (s.includes(".")) {
    return s.replace(/0+$/, "").replace(/\.$/, "");
  }
  return s;
}

/**
 * Output a JSON object to stdout. Used by all commands when --json is active.
 */
function jsonOut(data: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(data) + "\n");
}

/**
 * Output a JSON error object to stderr. Used when --json is active and an error occurs.
 */
function jsonErr(message: string): void {
  process.stderr.write(JSON.stringify({ error: message }) + "\n");
}

/**
 * Format an analysis result as human-readable styled output.
 */
function formatAnalysisHumanReadable(result: AnalysisResult, label: string): void {
  outputInfo(`Analysis: ${label}`);
  outputInfo(`  Version: ${result.analysisVersion}`);
  outputInfo(`  Sample Rate: ${result.sampleRate} Hz`);
  outputInfo(`  Samples: ${result.sampleCount}`);

  for (const [category, metrics] of Object.entries(result.metrics)) {
    outputInfo(`  [${category}]`);
    for (const [key, value] of Object.entries(metrics)) {
      const display = value === null ? "N/A" : String(value);
      outputInfo(`    ${key}: ${display}`);
    }
  }
}

/**
 * Format batch analysis results as a summary table.
 */
function formatAnalysisBatchTable(
  results: Array<{ file: string; result: AnalysisResult }>,
): void {
  // Build table rows: filename, duration, peak, rms, crestFactor, spectralCentroid, flags
  const rows = results.map((r) => {
    const time = r.result.metrics["time"] ?? {};
    const quality = r.result.metrics["quality"] ?? {};
    const spectral = r.result.metrics["spectral"] ?? {};

    const duration = typeof time["duration"] === "number" ? time["duration"].toFixed(3) : "—";
    const peak = typeof time["peak"] === "number" ? time["peak"].toFixed(4) : "—";
    const rms = typeof time["rms"] === "number" ? time["rms"].toFixed(4) : "—";
    const crest = typeof time["crestFactor"] === "number"
      ? (Number.isFinite(time["crestFactor"]) ? (time["crestFactor"] as number).toFixed(2) : "Inf")
      : "—";
    const centroid = typeof spectral["spectralCentroid"] === "number"
      ? (spectral["spectralCentroid"] as number).toFixed(0)
      : "—";

    const flags: string[] = [];
    if (quality["clipping"] === true) flags.push("!clip");
    if (quality["silence"] === true) flags.push("!silent");
    const flagStr = flags.length > 0 ? flags.join(" ") : "ok";

    return [r.file, duration, peak, rms, crest, centroid, flagStr];
  });

  // Compute column widths
  const maxFile = Math.max(4, ...rows.map((r) => r[0]!.length));
  outputTable(
    [
      { header: "File", width: Math.min(maxFile, 40) },
      { header: "Dur(s)", width: 7 },
      { header: "Peak", width: 7 },
      { header: "RMS", width: 7 },
      { header: "Crest", width: 7 },
      { header: "Centroid", width: 9 },
      { header: "Flags", width: 10 },
    ],
    rows,
  );
}

/** Main CLI entry point. Exported for testability. */
export async function main(argv: string[] = process.argv): Promise<number> {
  const { command, subcommand, flags, layers } = parseArgs(argv);
  const jsonMode = flags["json"] === true;

  // --version flag or `version` command
  if (flags["version"] || command === "version") {
    if (jsonMode) {
      jsonOut({ command: "version", version: VERSION });
    } else {
      outputInfo(`ToneForge v${VERSION}`);
    }
    return 0;
  }

  // Top-level help
  if (flags["help"] || command === undefined) {
    if (command === "generate") {
      printGenerateHelp();
    } else if (command === "stack") {
      if (subcommand === "render") {
        printStackRenderHelp();
      } else if (subcommand === "inspect") {
        printStackInspectHelp();
      } else {
        printStackHelp();
      }
    } else if (command === "show") {
      printShowHelp();
    } else if (command === "list") {
      printListHelp();
    } else if (command === "play") {
      printPlayHelp();
    } else if (command === "analyze") {
      printAnalyzeHelp();
    } else {
      printHelp();
    }
    return command === undefined && !flags["help"] ? 1 : 0;
  }

  if (command === "list") {
    if (flags["help"]) {
      printListHelp();
      return 0;
    }

    if (subcommand !== "recipes" && subcommand !== undefined) {
      if (jsonMode) {
        jsonErr(`Unknown resource '${subcommand}'. Run 'toneforge list --help' for usage.`);
      } else {
        outputError(`Error: Unknown resource '${subcommand}'. Run 'toneforge list --help' for usage.`);
      }
      return 1;
    }

    const recipes = registry.listSummaries();
    if (jsonMode) {
      jsonOut({ command: "list", resource: "recipes", recipes });
    } else {
      const TABLE_WIDTH = 76;
      // Table row overhead: "| " + col1 + " | " + col2 + " |" = 7 chars
      const nameCol = Math.max(...recipes.map((r) => r.name.length));
      const descCol = TABLE_WIDTH - nameCol - 7;

      outputTable(
        [
          { header: "Recipe", width: nameCol },
          { header: "Description", width: descCol },
        ],
        recipes.map((r) => [r.name, r.description || "\u2014"]),
      );
    }
    return 0;
  }

  if (command === "show") {
    if (flags["help"]) {
      printShowHelp();
      return 0;
    }

    if (subcommand === undefined) {
      if (jsonMode) {
        jsonErr("'show' requires a recipe name. Run 'toneforge show --help' for usage.");
      } else {
        outputError("Error: 'show' requires a recipe name. Run 'toneforge show --help' for usage.");
      }
      return 1;
    }

    const recipeName = subcommand;
    const reg = registry.getRegistration(recipeName);

    if (!reg) {
      const allNames = registry.list();
      const suggestions = suggestRecipes(recipeName, allNames);
      let msg = `Unknown recipe '${recipeName}'.`;
      if (suggestions.length > 0) {
        msg += ` Did you mean: ${suggestions.join(", ")}?`;
      }
      if (jsonMode) {
        jsonErr(msg);
      } else {
        outputError(`Error: Unknown recipe '${recipeName}'.`);
        if (suggestions.length > 0) {
          outputWarning(`Did you mean: ${suggestions.join(", ")}?`);
        }
      }
      return 1;
    }

    // Parse optional --seed flag
    let seed: number | undefined;
    if (flags["seed"] !== undefined && flags["seed"] !== true) {
      seed = parseInt(flags["seed"] as string, 10);
      if (Number.isNaN(seed)) {
        if (jsonMode) {
          jsonErr(`--seed must be an integer, got '${flags["seed"]}'.`);
        } else {
          outputError(`Error: --seed must be an integer, got '${flags["seed"]}'.`);
        }
        return 1;
      }
    } else if (flags["seed"] === true) {
      if (jsonMode) {
        jsonErr("--seed requires a value. Usage: toneforge show <recipe> --seed <number>");
      } else {
        outputError("Error: --seed requires a value. Usage: toneforge show <recipe> --seed <number>");
      }
      return 1;
    }

    if (jsonMode) {
      const jsonResult = formatShowJson(recipeName, reg, seed);
      jsonOut(jsonResult);
    } else {
      const output = formatShowOutput(recipeName, reg, seed);
      outputMarkdown(output);
    }
    return 0;
  }

  if (command === "play") {
    if (flags["help"]) {
      printPlayHelp();
      return 0;
    }

    if (subcommand === undefined) {
      if (jsonMode) {
        jsonErr("'play' requires a WAV file path. Run 'toneforge play --help' for usage.");
      } else {
        outputError("Error: 'play' requires a WAV file path. Run 'toneforge play --help' for usage.");
      }
      return 1;
    }

    const filePath = resolve(subcommand);

    if (!existsSync(filePath)) {
      if (jsonMode) {
        jsonErr(`File not found: ${subcommand}`);
      } else {
        outputError(`Error: File not found: ${subcommand}`);
      }
      return 1;
    }

    try {
      if (!jsonMode) {
        outputInfo(`Playing ${subcommand}`);
      }
      const { command: playerCmd, args } = getPlayerCommand(filePath);

      await new Promise<void>((resolvePromise, reject) => {
        execFile(playerCmd, args, (error) => {
          if (error) {
            reject(
              new Error(`Audio playback failed (${playerCmd}): ${error.message}`),
            );
          } else {
            resolvePromise();
          }
        });
      });

      if (jsonMode) {
        jsonOut({ command: "play", file: subcommand });
      }
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (jsonMode) {
        jsonErr(message);
      } else {
        outputError(`Error: ${message}`);
      }
      return 1;
    }
  }

  // ── stack command ────────────────────────────────────────────────

  if (command === "stack") {
    // Stack subcommand help
    if (flags["help"] && subcommand === undefined) {
      printStackHelp();
      return 0;
    }

    if (subcommand === "render") {
      if (flags["help"]) {
        printStackRenderHelp();
        return 0;
      }

      // Require --seed
      const seedRaw = flags["seed"];
      if (seedRaw === undefined || seedRaw === true) {
        const msg = "--seed is required for stack render. Run 'toneforge stack render --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }
      const seed = parseInt(seedRaw as string, 10);
      if (Number.isNaN(seed)) {
        const msg = `--seed must be an integer, got '${seedRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // --output is optional: when omitted, audio is played instead of saved
      const outputPath = typeof flags["output"] === "string" ? flags["output"] : undefined;

      // Require either --preset or --layer
      const presetPath = typeof flags["preset"] === "string" ? flags["preset"] : undefined;
      if (presetPath === undefined && layers.length === 0) {
        const msg = "Either --preset or at least one --layer is required. Run 'toneforge stack render --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        let definition: StackDefinition;

        if (presetPath !== undefined) {
          definition = await loadPreset(presetPath);
          // If --layer flags are also present, append them to the preset layers
          if (layers.length > 0) {
            const inlineDef = parseLayers(layers);
            definition = {
              ...definition,
              layers: [...definition.layers, ...inlineDef.layers],
            };
          }
        } else {
          definition = parseLayers(layers);
        }

        if (!jsonMode) {
          outputInfo(
            `Rendering stack '${definition.name || "inline"}' (${definition.layers.length} layers) with seed ${seed}...`,
          );
        }

        const startMs = performance.now();
        const result = await renderStack(definition, seed);
        const renderMs = (performance.now() - startMs).toFixed(0);

        if (!jsonMode) {
          outputInfo(
            `Rendered ${result.duration.toFixed(3)}s of audio ` +
            `(${result.sampleRate} Hz, ${result.samples.length} samples) ` +
            `in ${renderMs}ms`,
          );
        }

        if (outputPath !== undefined) {
          // Write WAV file
          await mkdir(dirname(resolve(outputPath)), { recursive: true });
          const wavBuffer = encodeWav(result.samples, { sampleRate: result.sampleRate });
          await writeFile(resolve(outputPath), wavBuffer);

          if (jsonMode) {
            jsonOut({
              command: "stack render",
              preset: presetPath || null,
              name: definition.name || "inline",
              layers: definition.layers.length,
              seed,
              output: outputPath,
              duration: result.duration,
              sampleRate: result.sampleRate,
              samples: result.samples.length,
            });
          } else {
            outputSuccess(`Wrote ${outputPath}`);
          }
        } else {
          // Play audio (default when --output is not specified)
          if (!jsonMode) {
            outputInfo("Playing...");
          }
          await playAudio(result.samples, { sampleRate: result.sampleRate });
          if (jsonMode) {
            jsonOut({
              command: "stack render",
              preset: presetPath || null,
              name: definition.name || "inline",
              layers: definition.layers.length,
              seed,
              duration: result.duration,
              sampleRate: result.sampleRate,
              samples: result.samples.length,
              played: true,
            });
          } else {
            outputSuccess("Done.");
          }
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    if (subcommand === "inspect") {
      if (flags["help"]) {
        printStackInspectHelp();
        return 0;
      }

      const presetPath = typeof flags["preset"] === "string" ? flags["preset"] : undefined;
      if (presetPath === undefined) {
        const msg = "--preset is required for stack inspect. Run 'toneforge stack inspect --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        const definition = await loadPreset(presetPath);

        // Compute estimated total duration using recipe getDuration with a default seed
        let estimatedDuration = 0;
        for (const layer of definition.layers) {
          const reg = registry.getRegistration(layer.recipe);
          if (reg) {
            const layerRng = createRng(42); // deterministic preview seed
            const recipeDuration = layer.duration ?? reg.getDuration(layerRng);
            const layerEnd = layer.startTime + recipeDuration;
            if (layerEnd > estimatedDuration) {
              estimatedDuration = layerEnd;
            }
          }
        }

        if (jsonMode) {
          jsonOut({
            command: "stack inspect",
            preset: presetPath,
            name: definition.name || "unnamed",
            layers: definition.layers.map((l, i) => ({
              index: i,
              recipe: l.recipe,
              startTime: l.startTime,
              gain: l.gain ?? 1.0,
              duration: l.duration ?? null,
            })),
            estimatedDuration,
          });
        } else {
          const name = definition.name || "unnamed";
          const layerCount = definition.layers.length;
          outputInfo(`Stack: ${name} (${layerCount} layer${layerCount !== 1 ? "s" : ""})`);

          for (let i = 0; i < definition.layers.length; i++) {
            const l = definition.layers[i]!;
            const offsetMs = Math.round(l.startTime * 1000);
            const gain = (l.gain ?? 1.0).toFixed(2);
            const recipePadded = l.recipe.padEnd(20);
            outputInfo(`  [${i}] ${recipePadded} offset: ${offsetMs}ms\tgain: ${gain}`);
          }

          outputInfo(`  Duration: ~${estimatedDuration.toFixed(3)}s (estimated, varies with seed)`);
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // Unknown stack subcommand
    if (subcommand !== undefined) {
      const msg = `Unknown stack subcommand '${subcommand}'. Run 'toneforge stack --help' for usage.`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    printStackHelp();
    return 0;
  }

  // ── analyze command ─────────────────────────────────────────────

  if (command === "analyze") {
    if (flags["help"]) {
      printAnalyzeHelp();
      return 0;
    }

    const inputPath = typeof flags["input"] === "string" ? flags["input"] : undefined;
    const recipeName = typeof flags["recipe"] === "string" ? flags["recipe"] : undefined;
    const seedRaw = flags["seed"];
    const formatFlag = typeof flags["format"] === "string" ? flags["format"] : undefined;
    const outputDir = typeof flags["output"] === "string" ? flags["output"] : undefined;

    // Validate --format value
    if (formatFlag !== undefined && formatFlag !== "json" && formatFlag !== "table") {
      const msg = `--format must be 'json' or 'table', got '${formatFlag}'.`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    // Mutual exclusion: --input and --recipe cannot both be specified
    if (inputPath !== undefined && recipeName !== undefined) {
      const msg = "--input and --recipe are mutually exclusive. Use one or the other.";
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    // Require at least one source
    if (inputPath === undefined && recipeName === undefined) {
      const msg = "Either --input or --recipe is required. Run 'toneforge analyze --help' for usage.";
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    // Create analysis engine with all built-in extractors
    const engine = createAnalysisEngine();
    registerBuiltinExtractors(engine);

    // ── Recipe+Seed mode ──────────────────────────────────────
    if (recipeName !== undefined) {
      // --seed is required for recipe mode
      if (seedRaw === undefined || seedRaw === true) {
        const msg = "--seed is required when using --recipe. Run 'toneforge analyze --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }
      const seed = parseInt(seedRaw as string, 10);
      if (Number.isNaN(seed)) {
        const msg = `--seed must be an integer, got '${seedRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Validate recipe exists
      if (!registry.getRegistration(recipeName)) {
        const allNames = registry.list();
        const suggestions = suggestRecipes(recipeName, allNames);
        let msg = `Unknown recipe '${recipeName}'.`;
        if (suggestions.length > 0) {
          msg += ` Did you mean: ${suggestions.join(", ")}?`;
        }
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        if (!jsonMode) {
          outputInfo(`Analyzing recipe '${recipeName}' with seed ${seed}...`);
        }

        const renderResult = await renderRecipe(recipeName, seed);
        const analysisResult = engine.analyze(renderResult.samples, renderResult.sampleRate);

        const output = {
          command: "analyze",
          source: { recipe: recipeName, seed },
          ...analysisResult,
        };

        if (jsonMode || formatFlag === "json" || formatFlag === undefined) {
          jsonOut(output);
        } else {
          // Human-readable table for single result
          formatAnalysisHumanReadable(analysisResult, `${recipeName} (seed ${seed})`);
        }
        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // ── File/directory input mode ─────────────────────────────
    const resolvedInput = resolve(inputPath!);

    if (!existsSync(resolvedInput)) {
      const msg = `File not found: ${inputPath}`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    // Check if input is a directory
    const { statSync } = await import("node:fs");
    const inputStat = statSync(resolvedInput);

    if (inputStat.isDirectory()) {
      // ── Batch directory mode ──────────────────────────────
      const { readdirSync } = await import("node:fs");
      const entries = readdirSync(resolvedInput)
        .filter((f: string) => f.toLowerCase().endsWith(".wav"))
        .sort();

      if (entries.length === 0) {
        if (jsonMode) {
          jsonOut({ command: "analyze", input: inputPath, files: [], count: 0 });
        } else {
          outputInfo(`No .wav files found in ${inputPath}`);
        }
        return 0;
      }

      if (!jsonMode) {
        outputInfo(`Analyzing ${entries.length} WAV file${entries.length !== 1 ? "s" : ""} in ${inputPath}...`);
      }

      // If --output is specified, create the directory
      if (outputDir !== undefined) {
        await mkdir(resolve(outputDir), { recursive: true });
      }

      const batchResults: Array<{
        file: string;
        result: AnalysisResult;
      }> = [];

      for (const entry of entries) {
        const filePath = resolve(resolvedInput, entry);
        try {
          const wav = await decodeWavFile(filePath);
          const analysisResult = engine.analyze(wav.samples, wav.sampleRate);
          batchResults.push({ file: entry, result: analysisResult });

          // Write individual JSON file if --output is specified
          if (outputDir !== undefined) {
            const jsonFileName = entry.replace(/\.wav$/i, ".json");
            const jsonPath = resolve(outputDir, jsonFileName);
            const jsonContent = JSON.stringify(
              { command: "analyze", file: entry, ...analysisResult },
              null,
              2,
            );
            await writeFile(jsonPath, jsonContent);
            if (!jsonMode) {
              outputSuccess(`Wrote ${jsonPath}`);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (jsonMode) {
            jsonErr(`Failed to analyze '${entry}': ${message}`);
          } else {
            outputError(`Error: Failed to analyze '${entry}': ${message}`);
          }
          return 1;
        }
      }

      if (formatFlag === "table" && !jsonMode) {
        // Table output
        formatAnalysisBatchTable(batchResults);
      } else if (jsonMode || formatFlag === "json" || formatFlag === undefined) {
        // JSON output
        jsonOut({
          command: "analyze",
          input: inputPath,
          count: batchResults.length,
          files: batchResults.map((r) => ({
            file: r.file,
            ...r.result,
          })),
        });
      } else if (formatFlag === "table" && jsonMode) {
        // --json takes priority over --format table
        jsonOut({
          command: "analyze",
          input: inputPath,
          count: batchResults.length,
          files: batchResults.map((r) => ({
            file: r.file,
            ...r.result,
          })),
        });
      }

      if (!jsonMode) {
        outputInfo(`Analyzed ${batchResults.length} file${batchResults.length !== 1 ? "s" : ""}`);
      }

      return 0;
    }

    // ── Single file mode ──────────────────────────────────────
    if (!resolvedInput.toLowerCase().endsWith(".wav")) {
      const msg = `Input file must be a .wav file, got '${inputPath}'.`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    try {
      if (!jsonMode) {
        outputInfo(`Analyzing ${inputPath}...`);
      }

      const wav = await decodeWavFile(resolvedInput);
      const analysisResult = engine.analyze(wav.samples, wav.sampleRate);

      const output = {
        command: "analyze",
        file: inputPath,
        ...analysisResult,
      };

      if (jsonMode || formatFlag === "json" || formatFlag === undefined) {
        jsonOut(output);
      } else {
        formatAnalysisHumanReadable(analysisResult, inputPath!);
      }
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
      return 1;
    }
  }

  if (command !== "generate") {
    if (jsonMode) {
      jsonErr(`Unknown command '${command}'. Run 'toneforge --help' for usage.`);
    } else {
      outputError(`Error: Unknown command '${command}'. Run 'toneforge --help' for usage.`);
    }
    return 1;
  }

  // Generate command
  if (flags["help"]) {
    printGenerateHelp();
    return 0;
  }

  const recipeName = flags["recipe"];
  if (recipeName === undefined || recipeName === true) {
    if (jsonMode) {
      jsonErr("--recipe is required. Run 'toneforge generate --help' for usage.");
    } else {
      outputError("Error: --recipe is required. Run 'toneforge generate --help' for usage.");
    }
    return 1;
  }

  // Validate recipe exists
  if (!registry.getRegistration(recipeName as string)) {
    const recipes = registry.list();
    const msg = `Unknown recipe '${recipeName}'.${
      recipes.length > 0
        ? ` Available recipes: ${recipes.join(", ")}`
        : ""
    }`;
    if (jsonMode) {
      jsonErr(msg);
    } else {
      outputError(`Error: ${msg}`);
    }
    return 1;
  }

  // Resolve seed
  const outputPath = typeof flags["output"] === "string" ? flags["output"] : undefined;
  const seedRangeRaw = typeof flags["seed-range"] === "string" ? flags["seed-range"] : undefined;

  // Validate flag combinations
  if (seedRangeRaw !== undefined && outputPath === undefined) {
    const msg = "--seed-range requires --output to specify a directory.";
    if (jsonMode) {
      jsonErr(msg);
    } else {
      outputError(
        `Error: ${msg}\n` +
        "  Example: toneforge generate --recipe <name> --seed-range 1:10 --output ./sounds/",
      );
    }
    return 1;
  }

  if (seedRangeRaw !== undefined && flags["seed"] !== undefined && flags["seed"] !== true) {
    const msg = "--seed and --seed-range are mutually exclusive. Use one or the other.";
    if (jsonMode) {
      jsonErr(msg);
    } else {
      outputError(
        `Error: ${msg}\n` +
        "  Single file: toneforge generate --recipe <name> --seed 42 --output ./sound.wav\n" +
        "  Batch:       toneforge generate --recipe <name> --seed-range 1:10 --output ./sounds/",
      );
    }
    return 1;
  }

  // Parse --seed-range if present
  let seedRangeStart: number | undefined;
  let seedRangeEnd: number | undefined;

  if (seedRangeRaw !== undefined) {
    const parts = seedRangeRaw.split(":");
    if (parts.length !== 2) {
      const msg = `--seed-range must be in the format <start>:<end>, got '${seedRangeRaw}'.`;
      if (jsonMode) {
        jsonErr(msg);
      } else {
        outputError(
          `Error: ${msg}\n` +
          "  Example: --seed-range 1:10",
        );
      }
      return 1;
    }
    seedRangeStart = parseInt(parts[0]!, 10);
    seedRangeEnd = parseInt(parts[1]!, 10);
    if (Number.isNaN(seedRangeStart) || Number.isNaN(seedRangeEnd)) {
      const msg = `--seed-range values must be integers, got '${seedRangeRaw}'.`;
      if (jsonMode) {
        jsonErr(msg);
      } else {
        outputError(
          `Error: ${msg}\n` +
          "  Example: --seed-range 1:10",
        );
      }
      return 1;
    }
    if (seedRangeStart > seedRangeEnd) {
      const msg = `--seed-range start (${seedRangeStart}) must be <= end (${seedRangeEnd}).`;
      if (jsonMode) {
        jsonErr(msg);
      } else {
        outputError(`Error: ${msg}`);
      }
      return 1;
    }
  }

  // Determine output mode
  const isOutputFile = outputPath !== undefined && outputPath.endsWith(".wav");
  const isOutputDir = outputPath !== undefined && !outputPath.endsWith(".wav");

  if (seedRangeRaw !== undefined && isOutputFile) {
    const msg = "--seed-range requires --output to be a directory (not a .wav file).";
    if (jsonMode) {
      jsonErr(msg);
    } else {
      outputError(
        `Error: ${msg}\n` +
        `  Got: --output ${outputPath}\n` +
        "  Use a directory path (trailing /) instead:\n" +
        `  Example: --output ${outputPath.replace(/\.wav$/, "/")}\n` +
        "  Or omit --seed-range for single-file export.",
      );
    }
    return 1;
  }

  if (outputPath !== undefined && !isOutputFile && !isOutputDir) {
    const msg = `--output path '${outputPath}' is ambiguous.`;
    if (jsonMode) {
      jsonErr(msg);
    } else {
      outputError(
        `Error: ${msg}\n` +
        "  For single-file export, use a .wav extension: --output ./sound.wav\n" +
        "  For batch export, use a directory path: --output ./sounds/",
      );
    }
    return 1;
  }

  // Batch generation path (--seed-range with --output <dir>)
  if (seedRangeRaw !== undefined && isOutputDir) {
    try {
      await mkdir(outputPath!, { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (jsonMode) {
        jsonErr(`Failed to create output directory '${outputPath}': ${message}`);
      } else {
        outputError(`Error: Failed to create output directory '${outputPath}': ${message}`);
      }
      return 1;
    }

    const batchFiles: Array<{ seed: number; output: string; duration: number; sampleRate: number; samples: number }> = [];

    for (let seed = seedRangeStart!; seed <= seedRangeEnd!; seed++) {
      const fileName = `${recipeName}-seed-${seed}.wav`;
      const filePath = `${outputPath!.replace(/\/$/, "")}/${fileName}`;

      try {
        const result = await renderRecipe(recipeName as string, seed);
        const wavBuffer = encodeWav(result.samples, { sampleRate: result.sampleRate });
        await writeFile(filePath, wavBuffer);
        if (!jsonMode) {
          outputSuccess(`Wrote ${filePath}`);
        }
        batchFiles.push({
          seed,
          output: filePath,
          duration: result.duration,
          sampleRate: result.sampleRate,
          samples: result.samples.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) {
          jsonErr(`Failed to generate seed ${seed}: ${message}`);
        } else {
          outputError(`Error: Failed to generate seed ${seed}: ${message}`);
        }
        return 1;
      }
    }

    if (jsonMode) {
      jsonOut({
        command: "generate",
        recipe: recipeName,
        seedRange: [seedRangeStart!, seedRangeEnd!],
        output: outputPath,
        files: batchFiles,
      });
    }

    return 0;
  }

  let seed: number;
  if (flags["seed"] !== undefined && flags["seed"] !== true) {
    seed = parseInt(flags["seed"] as string, 10);
    if (Number.isNaN(seed)) {
      if (jsonMode) {
        jsonErr(`--seed must be an integer, got '${flags["seed"]}'.`);
      } else {
        outputError(`Error: --seed must be an integer, got '${flags["seed"]}'.`);
        }
        return 1;
      }
    } else {
      seed = Math.floor(Math.random() * 2147483647);
      if (!outputPath && !jsonMode) {
        outputInfo(`Using random seed: ${seed}`);
    }
  }

  // Render
  if (!outputPath && !jsonMode) {
    outputInfo(`Generating '${recipeName}' with seed ${seed}...`);
  }
  const startTime = performance.now();

  try {
    const result = await renderRecipe(recipeName as string, seed);

    const renderMs = (performance.now() - startTime).toFixed(0);
    if (!outputPath && !jsonMode) {
      outputInfo(
        `Rendered ${result.duration.toFixed(3)}s of audio ` +
          `(${result.sampleRate} Hz, ${result.samples.length} samples) ` +
          `in ${renderMs}ms`,
      );
    }

    if (outputPath && isOutputFile) {
      // Single-file WAV export
      try {
        await mkdir(dirname(outputPath), { recursive: true });
        const wavBuffer = encodeWav(result.samples, { sampleRate: result.sampleRate });
        await writeFile(outputPath, wavBuffer);
        if (jsonMode) {
          jsonOut({
            command: "generate",
            recipe: recipeName,
            seed,
            output: outputPath,
            duration: result.duration,
            sampleRate: result.sampleRate,
            samples: result.samples.length,
          });
        } else {
          outputSuccess(`Wrote ${outputPath}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) {
          jsonErr(`Failed to write '${outputPath}': ${message}`);
        } else {
          outputError(`Error: Failed to write '${outputPath}': ${message}`);
        }
        return 1;
      }
    } else if (outputPath && isOutputDir) {
      // Single seed to directory (no --seed-range, just --output <dir>)
      try {
        await mkdir(outputPath, { recursive: true });
        const fileName = `${recipeName}-seed-${seed}.wav`;
        const filePath = `${outputPath.replace(/\/$/, "")}/${fileName}`;
        const wavBuffer = encodeWav(result.samples, { sampleRate: result.sampleRate });
        await writeFile(filePath, wavBuffer);
        if (jsonMode) {
          jsonOut({
            command: "generate",
            recipe: recipeName,
            seed,
            output: filePath,
            duration: result.duration,
            sampleRate: result.sampleRate,
            samples: result.samples.length,
          });
        } else {
          outputSuccess(`Wrote ${filePath}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) {
          jsonErr(`Failed to write to '${outputPath}': ${message}`);
        } else {
          outputError(`Error: Failed to write to '${outputPath}': ${message}`);
        }
        return 1;
      }
    } else {
      // Play audio (default when --output is not specified)
      if (!jsonMode) {
        outputInfo("Playing...");
      }
      await playAudio(result.samples, { sampleRate: result.sampleRate });
      if (jsonMode) {
        jsonOut({
          command: "generate",
          recipe: recipeName,
          seed,
          duration: result.duration,
          sampleRate: result.sampleRate,
          samples: result.samples.length,
          played: true,
        });
      } else {
        outputSuccess("Done.");
      }
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
      jsonErr(message);
    } else {
      outputError(`Error: ${message}`);
    }
    return 1;
  }
}

// Run when executed directly (via ./bin/dev-cli.js or tf/toneforge commands).
// The path check uses /cli.ts and /cli.js (with separator) to avoid
// matching bin/dev-cli.js which invokes main() itself.
const resolvedArg = process.argv[1]
  ? realpathSync(process.argv[1])
  : "";
const isDirectRun =
  resolvedArg.endsWith("/cli.ts") ||
  resolvedArg.endsWith("/cli.js");

if (isDirectRun) {
  main().then((code) => {
    process.exitCode = code;
  });
}
