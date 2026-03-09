#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { main as legacyMain } from "./cli.js";

// Minimal yargs wrapper that delegates to the existing `main()` implementation
// for now. This allows an incremental migration to yargs while preserving
// the current parsing behavior and tests.

export async function yargsMain(argv: string[] = process.argv): Promise<number> {
  const y = yargs(hideBin(argv))
    .scriptName("toneforge")
    .command(
      "generate",
      "Render and export procedural sounds",
      (yargsBuilder) => yargsBuilder,
      async (args) => {
        // Delegate to legacy main using process.argv to maintain parity while
        // migrating.
        process.exitCode = await legacyMain(process.argv);
      },
    )
    .command(
      "list [resource]",
      "List available resources",
      () => {},
      async () => {
        process.exitCode = await legacyMain(process.argv);
      },
    )
    .command(
      "show <name>",
      "Show recipe metadata",
      () => {},
      async () => {
        process.exitCode = await legacyMain(process.argv);
      },
    )
    .command(
      "play <file>",
      "Play a WAV file",
      () => {},
      async () => {
        process.exitCode = await legacyMain(process.argv);
      },
    )
    .command(
      "version",
      "Print the ToneForge version",
      () => {},
      () => {
        process.exitCode = 0;
      },
    )
    .help()
    .strict();

  await y.parse();
  return process.exitCode ?? 0;
}

// If executed directly, run yargsMain
if (import.meta.url === `file://${process.argv[1]}`) {
  yargs
    .help()
    .parse();
}
