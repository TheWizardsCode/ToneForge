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
import { renderMarkdown } from "./output.js";
import type { RecipeRegistration } from "./core/recipe.js";

/** Parse command-line arguments into a structured map. */
function parseArgs(argv: string[]): {
  command: string | undefined;
  subcommand: string | undefined;
  flags: Record<string, string | boolean>;
} {
  // Skip node and script path
  const args = argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;
  let subcommand: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--help" || arg === "-h") {
      flags["help"] = true;
    } else if (arg === "--version" || arg === "-V") {
      flags["version"] = true;
    } else if (arg === "--json") {
      flags["json"] = true;
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

  return { command, subcommand, flags };
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
| **show** | Display recipe metadata and parameters |
| **play** | Play a WAV file through the system audio player |
| **list** | List available resources (e.g. recipes) |
| **version** | Print the ToneForge version |

## Options

- \`--help\`, \`-h\` — Show this help message
- \`--version\`, \`-V\` — Print the ToneForge version
- \`--json\` — Output results in JSON format for machine consumption

Run \`toneforge <command> --help\` for command-specific help.`;
  console.log(renderMarkdown(md));
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
  console.log(renderMarkdown(md));
}

/** Print help text for the list command. */
function printListHelp(): void {
  const md = `# ToneForge list

**List available resources**

## Usage

\`toneforge list [resource]\`

## Resources

- **recipes** — List all registered recipe names *(default)*

## Options

- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge list
toneforge list recipes
\`\`\``;
  console.log(renderMarkdown(md));
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
  console.log(renderMarkdown(md));
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
  console.log(renderMarkdown(md));
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
  console.log(JSON.stringify(data));
}

/**
 * Output a JSON error object to stderr. Used when --json is active and an error occurs.
 */
function jsonErr(message: string): void {
  console.error(JSON.stringify({ error: message }));
}

/** Main CLI entry point. Exported for testability. */
export async function main(argv: string[] = process.argv): Promise<number> {
  const { command, subcommand, flags } = parseArgs(argv);
  const jsonMode = flags["json"] === true;

  // --version flag or `version` command
  if (flags["version"] || command === "version") {
    if (jsonMode) {
      jsonOut({ command: "version", version: VERSION });
    } else {
      console.log(`ToneForge v${VERSION}`);
    }
    return 0;
  }

  // Top-level help
  if (flags["help"] || command === undefined) {
    if (command === "generate") {
      printGenerateHelp();
    } else if (command === "show") {
      printShowHelp();
    } else if (command === "list") {
      printListHelp();
    } else if (command === "play") {
      printPlayHelp();
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
        console.error(`Error: Unknown resource '${subcommand}'. Run 'toneforge list --help' for usage.`);
      }
      return 1;
    }

    const recipes = registry.list();
    if (jsonMode) {
      jsonOut({ command: "list", resource: "recipes", recipes });
    } else {
      for (const name of recipes) {
        console.log(name);
      }
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
        console.error("Error: 'show' requires a recipe name. Run 'toneforge show --help' for usage.");
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
        console.error(`Error: ${msg}`);
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
          console.error(`Error: --seed must be an integer, got '${flags["seed"]}'.`);
        }
        return 1;
      }
    } else if (flags["seed"] === true) {
      if (jsonMode) {
        jsonErr("--seed requires a value. Usage: toneforge show <recipe> --seed <number>");
      } else {
        console.error("Error: --seed requires a value. Usage: toneforge show <recipe> --seed <number>");
      }
      return 1;
    }

    if (jsonMode) {
      const jsonResult = formatShowJson(recipeName, reg, seed);
      jsonOut(jsonResult);
    } else {
      const output = formatShowOutput(recipeName, reg, seed);
      console.log(output);
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
        console.error("Error: 'play' requires a WAV file path. Run 'toneforge play --help' for usage.");
      }
      return 1;
    }

    const filePath = resolve(subcommand);

    if (!existsSync(filePath)) {
      if (jsonMode) {
        jsonErr(`File not found: ${subcommand}`);
      } else {
        console.error(`Error: File not found: ${subcommand}`);
      }
      return 1;
    }

    try {
      if (!jsonMode) {
        console.log(`Playing ${subcommand}`);
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
        console.error(`Error: ${message}`);
      }
      return 1;
    }
  }

  if (command !== "generate") {
    if (jsonMode) {
      jsonErr(`Unknown command '${command}'. Run 'toneforge --help' for usage.`);
    } else {
      console.error(`Error: Unknown command '${command}'. Run 'toneforge --help' for usage.`);
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
      console.error("Error: --recipe is required. Run 'toneforge generate --help' for usage.");
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
      console.error(`Error: ${msg}`);
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
      console.error(
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
      console.error(
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
        console.error(
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
        console.error(
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
        console.error(`Error: ${msg}`);
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
      console.error(
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
      console.error(
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
        console.error(`Error: Failed to create output directory '${outputPath}': ${message}`);
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
          console.log(`Wrote ${filePath}`);
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
          console.error(`Error: Failed to generate seed ${seed}: ${message}`);
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
        console.error(`Error: --seed must be an integer, got '${flags["seed"]}'.`);
      }
      return 1;
    }
  } else {
    seed = Math.floor(Math.random() * 2147483647);
    if (!outputPath && !jsonMode) {
      console.log(`Using random seed: ${seed}`);
    }
  }

  // Render
  if (!outputPath && !jsonMode) {
    console.log(`Generating '${recipeName}' with seed ${seed}...`);
  }
  const startTime = performance.now();

  try {
    const result = await renderRecipe(recipeName as string, seed);

    const renderMs = (performance.now() - startTime).toFixed(0);
    if (!outputPath && !jsonMode) {
      console.log(
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
          console.log(`Wrote ${outputPath}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) {
          jsonErr(`Failed to write '${outputPath}': ${message}`);
        } else {
          console.error(`Error: Failed to write '${outputPath}': ${message}`);
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
          console.log(`Wrote ${filePath}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) {
          jsonErr(`Failed to write to '${outputPath}': ${message}`);
        } else {
          console.error(`Error: Failed to write to '${outputPath}': ${message}`);
        }
        return 1;
      }
    } else {
      // Play audio (default when --output is not specified)
      if (!jsonMode) {
        console.log("Playing...");
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
        console.log("Done.");
      }
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
      jsonErr(message);
    } else {
      console.error(`Error: ${message}`);
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
