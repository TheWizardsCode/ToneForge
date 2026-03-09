#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const MIGRATED_COMMANDS = new Set(["generate", "list", "show", "play", "version"]);

async function runLegacy(argv: string[]): Promise<number> {
  const legacy = await import("./cli.js");
  if (typeof legacy.main !== "function") {
    return 1;
  }
  return legacy.main(argv);
}

export async function yargsMain(argv: string[] = process.argv): Promise<number> {
  const raw = hideBin(argv);
  const command = raw[0];

  if (raw.includes("--help") || raw.includes("-h") || raw.includes("--version") || raw.includes("-V")) {
    return runLegacy(argv);
  }

  if (typeof command !== "string" || !MIGRATED_COMMANDS.has(command)) {
    return runLegacy(argv);
  }

  const y = yargs(raw).scriptName("toneforge");

  // When used programmatically we must avoid yargs calling process.exit().
  // Disable automatic exiting and let the caller decide how to handle exit codes.
  y.exitProcess(false);
  y.strictCommands();
  y.parserConfiguration({ "unknown-options-as-args": true });
  y.showHelpOnFail(false);
  y.fail((msg, err) => {
    throw err ?? new Error(msg ?? "yargs parse failed");
  });

  y.command("generate", false, () => {}, () => {});
  y.command("list [resource]", false, () => {}, () => {});
  y.command("show <recipe>", false, () => {}, () => {});
  y.command("play <file>", false, () => {}, () => {});
  y.command("version", false, () => {}, () => {});

  try {
    await y.parse();
    return runLegacy(argv);
  } catch (err) {
    // Preserve legacy UX and machine output for any parse edge cases.
    return runLegacy(argv);
  }
}

// If executed directly, run yargsMain
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await yargsMain();
}
