#!/usr/bin/env node
import { Command } from "commander";
import { main as legacyMain } from "./cli.js";

// This file provides a minimal commander-based wrapper that delegates to the
// existing `main()` implementation. It makes it easy to incrementally migrate
// commands to commander while preserving testability via `main()`.

const program = new Command();
program.name("toneforge").version("0.1.0");

program
  .command("generate")
  .description("Render and export procedural sounds")
  .allowUnknownOption(true)
  .action(async (...args) => {
    // Delegate to legacy main with the current process.argv so existing
    // parsing behaviour remains intact until we replace it completely.
    process.exitCode = await legacyMain(process.argv);
  });

program
  .command("list [resource]")
  .description("List available resources")
  .allowUnknownOption(true)
  .action(async () => {
    process.exitCode = await legacyMain(process.argv);
  });

program
  .command("show <name>")
  .description("Show recipe metadata")
  .allowUnknownOption(true)
  .action(async () => {
    process.exitCode = await legacyMain(process.argv);
  });

program
  .command("play <file>")
  .description("Play a WAV file")
  .allowUnknownOption(true)
  .action(async () => {
    process.exitCode = await legacyMain(process.argv);
  });

program
  .command("version")
  .description("Print the ToneForge version")
  .allowUnknownOption(true)
  .action(() => {
    process.exitCode = 0;
  });

export async function commanderMain(argv: string[] = process.argv): Promise<number> {
  // Let commander parse and then delegate to legacy main where appropriate.
  program.parse(argv);
  return process.exitCode ?? 0;
}

// If executed directly, run commanderMain
if (import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-console
  commanderMain().then((code) => process.exit(code)).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
