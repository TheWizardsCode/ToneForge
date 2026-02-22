#!/usr/bin/env node
/**
 * ToneForge CLI
 *
 * Entry point for the `toneforge` command-line tool.
 * Supports the `generate` command to render and play procedural sounds.
 *
 * Usage:
 *   toneforge generate --recipe <name> [--seed <number>]
 *   toneforge --help
 *
 * Reference: docs/prd/CLI_PRD.md Section 4.1, 5.1
 */

import { renderRecipe } from "./core/renderer.js";
import { registry } from "./recipes/index.js";
import { playAudio } from "./audio/player.js";
import { VERSION } from "./index.js";

/** Parse command-line arguments into a structured map. */
function parseArgs(argv: string[]): {
  command: string | undefined;
  flags: Record<string, string | boolean>;
} {
  // Skip node and script path
  const args = argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;

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
    }
  }

  return { command, flags };
}

/** Print general help text. */
function printHelp(): void {
  console.log(`ToneForge v${VERSION} — Procedural Audio Production Platform

Usage:
  toneforge <command> [options]

Commands:
  generate    Render and play a procedural sound

Options:
  --help, -h  Show this help message

Run 'toneforge <command> --help' for command-specific help.`);
}

/** Print help text for the generate command. */
function printGenerateHelp(): void {
  const recipes = registry.list();
  console.log(`ToneForge generate — Render and play a procedural sound

Usage:
  toneforge generate --recipe <name> [--seed <number>]

Options:
  --recipe <name>   Name of the recipe to generate (required)
  --seed <number>   Integer seed for deterministic generation (default: random)
  --help, -h        Show this help message

Available recipes:
  ${recipes.join(", ") || "(none registered)"}

Examples:
  toneforge generate --recipe ui-scifi-confirm --seed 42
  toneforge generate --recipe ui-scifi-confirm`);
}

/** Main CLI entry point. Exported for testability. */
export async function main(argv: string[] = process.argv): Promise<number> {
  const { command, flags } = parseArgs(argv);

  // Top-level help
  if (flags["help"] || command === undefined) {
    if (command === "generate") {
      printGenerateHelp();
    } else {
      printHelp();
    }
    return command === undefined && !flags["help"] ? 1 : 0;
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
  let seed: number;
  if (flags["seed"] !== undefined && flags["seed"] !== true) {
    seed = parseInt(flags["seed"] as string, 10);
    if (Number.isNaN(seed)) {
      console.error(`Error: --seed must be an integer, got '${flags["seed"]}'.`);
      return 1;
    }
  } else {
    seed = Math.floor(Math.random() * 2147483647);
    console.log(`Using random seed: ${seed}`);
  }

  // Render
  console.log(`Generating '${recipeName}' with seed ${seed}...`);
  const startTime = performance.now();

  try {
    const result = await renderRecipe(recipeName as string, seed);

    const renderMs = (performance.now() - startTime).toFixed(0);
    console.log(
      `Rendered ${result.duration.toFixed(3)}s of audio ` +
        `(${result.sampleRate} Hz, ${result.samples.length} samples) ` +
        `in ${renderMs}ms`,
    );

    // Play
    console.log("Playing...");
    await playAudio(result.samples, { sampleRate: result.sampleRate });
    console.log("Done.");

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
