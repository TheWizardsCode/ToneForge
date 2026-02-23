#!/usr/bin/env node
/**
 * ToneForge CLI
 *
 * Entry point for the `toneforge` command-line tool.
 * Supports the `generate` command to render, play, and export procedural sounds.
 *
 * Usage:
 *   toneforge generate --recipe <name> [--seed <number>] [--output <path.wav>]
 *   toneforge generate --recipe <name> --seed-range <start>:<end> --output <directory/>
 *   toneforge --help
 *
 * Reference: docs/prd/CLI_PRD.md Section 4.1, 5.1
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { renderRecipe } from "./core/renderer.js";
import { registry } from "./recipes/index.js";
import { playAudio } from "./audio/player.js";
import { encodeWav } from "./audio/wav-encoder.js";
import { VERSION } from "./index.js";

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
  console.log(`ToneForge v${VERSION} — Procedural Audio Production Platform

Usage:
  toneforge <command> [options]

Commands:
  generate    Render and export procedural sounds
  list        List available resources (e.g. recipes)

Options:
  --help, -h  Show this help message

Run 'toneforge <command> --help' for command-specific help.`);
}

/** Print help text for the generate command. */
function printGenerateHelp(): void {
  const recipes = registry.list();
  console.log(`ToneForge generate — Render and export procedural sounds

Usage:
  toneforge generate --recipe <name> [--seed <number>] [--output <path.wav>]
  toneforge generate --recipe <name> --seed-range <start>:<end> --output <directory/>

Options:
  --recipe <name>          Name of the recipe to generate (required)
  --seed <number>          Integer seed for deterministic generation (default: random)
  --seed-range <start:end> Generate one WAV per seed in the inclusive range
  --output <path>          Write WAV file to path instead of playing audio
                           Use a .wav path for single file, or a directory
                           (trailing /) for batch output with --seed-range
  --help, -h               Show this help message

Available recipes:
  ${recipes.join(", ") || "(none registered)"}

Examples:
  toneforge generate --recipe ui-scifi-confirm --seed 42
  toneforge generate --recipe ui-scifi-confirm --seed 42 --output ./my-sound.wav
  toneforge generate --recipe weapon-laser-zap --seed-range 1:10 --output ./lasers/`);
}

/** Print help text for the list command. */
function printListHelp(): void {
  console.log(`ToneForge list — List available resources

Usage:
  toneforge list <resource>

Resources:
  recipes     List all registered recipe names

Options:
  --help, -h  Show this help message

Examples:
  toneforge list recipes`);
}

/** Main CLI entry point. Exported for testability. */
export async function main(argv: string[] = process.argv): Promise<number> {
  const { command, subcommand, flags } = parseArgs(argv);

  // Top-level help
  if (flags["help"] || command === undefined) {
    if (command === "generate") {
      printGenerateHelp();
    } else if (command === "list") {
      printListHelp();
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

    if (subcommand !== "recipes") {
      if (subcommand === undefined) {
        console.error("Error: 'list' requires a resource type. Run 'toneforge list --help' for usage.");
      } else {
        console.error(`Error: Unknown resource '${subcommand}'. Run 'toneforge list --help' for usage.`);
      }
      return 1;
    }

    const recipes = registry.list();
    for (const name of recipes) {
      console.log(name);
    }
    return 0;
  }

  if (command !== "generate") {
    console.error(`Error: Unknown command '${command}'. Run 'toneforge --help' for usage.`);
    return 1;
  }

  // Generate command
  if (flags["help"]) {
    printGenerateHelp();
    return 0;
  }

  const recipeName = flags["recipe"];
  if (recipeName === undefined || recipeName === true) {
    console.error("Error: --recipe is required. Run 'toneforge generate --help' for usage.");
    return 1;
  }

  // Validate recipe exists
  if (!registry.getRegistration(recipeName as string)) {
    const recipes = registry.list();
    console.error(
      `Error: Unknown recipe '${recipeName}'.${
        recipes.length > 0
          ? ` Available recipes: ${recipes.join(", ")}`
          : ""
      }`,
    );
    return 1;
  }

  // Resolve seed
  const outputPath = typeof flags["output"] === "string" ? flags["output"] : undefined;
  const seedRangeRaw = typeof flags["seed-range"] === "string" ? flags["seed-range"] : undefined;

  // Validate flag combinations
  if (seedRangeRaw !== undefined && outputPath === undefined) {
    console.error(
      "Error: --seed-range requires --output to specify a directory.\n" +
      "  Example: toneforge generate --recipe <name> --seed-range 1:10 --output ./sounds/",
    );
    return 1;
  }

  if (seedRangeRaw !== undefined && flags["seed"] !== undefined && flags["seed"] !== true) {
    console.error(
      "Error: --seed and --seed-range are mutually exclusive. Use one or the other.\n" +
      "  Single file: toneforge generate --recipe <name> --seed 42 --output ./sound.wav\n" +
      "  Batch:       toneforge generate --recipe <name> --seed-range 1:10 --output ./sounds/",
    );
    return 1;
  }

  // Parse --seed-range if present
  let seedRangeStart: number | undefined;
  let seedRangeEnd: number | undefined;

  if (seedRangeRaw !== undefined) {
    const parts = seedRangeRaw.split(":");
    if (parts.length !== 2) {
      console.error(
        `Error: --seed-range must be in the format <start>:<end>, got '${seedRangeRaw}'.\n` +
        "  Example: --seed-range 1:10",
      );
      return 1;
    }
    seedRangeStart = parseInt(parts[0]!, 10);
    seedRangeEnd = parseInt(parts[1]!, 10);
    if (Number.isNaN(seedRangeStart) || Number.isNaN(seedRangeEnd)) {
      console.error(
        `Error: --seed-range values must be integers, got '${seedRangeRaw}'.\n` +
        "  Example: --seed-range 1:10",
      );
      return 1;
    }
    if (seedRangeStart > seedRangeEnd) {
      console.error(
        `Error: --seed-range start (${seedRangeStart}) must be <= end (${seedRangeEnd}).`,
      );
      return 1;
    }
  }

  // Determine output mode
  const isOutputFile = outputPath !== undefined && outputPath.endsWith(".wav");
  const isOutputDir = outputPath !== undefined && !outputPath.endsWith(".wav");

  if (seedRangeRaw !== undefined && isOutputFile) {
    console.error(
      "Error: --seed-range requires --output to be a directory (not a .wav file).\n" +
      `  Got: --output ${outputPath}\n` +
      "  Use a directory path (trailing /) instead:\n" +
      `  Example: --output ${outputPath.replace(/\.wav$/, "/")}\n` +
      "  Or omit --seed-range for single-file export.",
    );
    return 1;
  }

  if (outputPath !== undefined && !isOutputFile && !isOutputDir) {
    // This shouldn't happen since everything not ending in .wav is treated as dir
    // but kept as a safety check
    console.error(
      `Error: --output path '${outputPath}' is ambiguous.\n` +
      "  For single-file export, use a .wav extension: --output ./sound.wav\n" +
      "  For batch export, use a directory path: --output ./sounds/",
    );
    return 1;
  }

  // Batch generation path (--seed-range with --output <dir>)
  if (seedRangeRaw !== undefined && isOutputDir) {
    try {
      await mkdir(outputPath!, { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: Failed to create output directory '${outputPath}': ${message}`);
      return 1;
    }

    for (let seed = seedRangeStart!; seed <= seedRangeEnd!; seed++) {
      const fileName = `${recipeName}-seed-${seed}.wav`;
      const filePath = `${outputPath!.replace(/\/$/, "")}/${fileName}`;

      try {
        const result = await renderRecipe(recipeName as string, seed);
        const wavBuffer = encodeWav(result.samples, { sampleRate: result.sampleRate });
        await writeFile(filePath, wavBuffer);
        console.log(`Wrote ${filePath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: Failed to generate seed ${seed}: ${message}`);
        return 1;
      }
    }

    return 0;
  }

  let seed: number;
  if (flags["seed"] !== undefined && flags["seed"] !== true) {
    seed = parseInt(flags["seed"] as string, 10);
    if (Number.isNaN(seed)) {
      console.error(`Error: --seed must be an integer, got '${flags["seed"]}'.`);
      return 1;
    }
  } else {
    seed = Math.floor(Math.random() * 2147483647);
    if (!outputPath) {
      console.log(`Using random seed: ${seed}`);
    }
  }

  // Render
  if (!outputPath) {
    console.log(`Generating '${recipeName}' with seed ${seed}...`);
  }
  const startTime = performance.now();

  try {
    const result = await renderRecipe(recipeName as string, seed);

    const renderMs = (performance.now() - startTime).toFixed(0);
    if (!outputPath) {
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
        console.log(`Wrote ${outputPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: Failed to write '${outputPath}': ${message}`);
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
        console.log(`Wrote ${filePath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: Failed to write to '${outputPath}': ${message}`);
        return 1;
      }
    } else {
      // Play audio (default when --output is not specified)
      console.log("Playing...");
      await playAudio(result.samples, { sampleRate: result.sampleRate });
      console.log("Done.");
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    return 1;
  }
}

// Run when executed directly
const isDirectRun =
  process.argv[1]?.endsWith("cli.ts") ||
  process.argv[1]?.endsWith("cli.js");

if (isDirectRun) {
  main().then((code) => {
    process.exitCode = code;
  });
}
