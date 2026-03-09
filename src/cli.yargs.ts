#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Load command modules. Each module exports a command definition compatible
// with yargs (see src/cli/commands/*.ts). We delegate to the existing
// implementation where appropriate to keep migration incremental.
import generateCommand from "./cli/commands/generate.js";
import listCommand from "./cli/commands/list.js";
import showCommand from "./cli/commands/show.js";
import playCommand from "./cli/commands/play.js";
import versionCommand from "./cli/commands/version.js";

export async function yargsMain(argv: string[] = process.argv): Promise<number> {
  const y = yargs(hideBin(argv)).scriptName("toneforge");

  // When used programmatically we must avoid yargs calling process.exit().
  // Disable automatic exiting and let the caller decide how to handle exit codes.
  y.exitProcess(false);

  y.command(generateCommand as any);
  y.command(listCommand as any);
  y.command(showCommand as any);
  y.command(playCommand as any);
  y.command(versionCommand as any);

  y.help().strict();

  try {
    await y.parse();
    // y.parse may set process.exitCode; prefer returning it when present.
    return process.exitCode ?? 0;
  } catch (err) {
    // yargs may throw validation errors; map to non-zero exit code for compatibility
    return 1;
  }
}

// If executed directly, run yargsMain
if (import.meta.url === `file://${process.argv[1]}`) {
  yargs.help().parse();
}
