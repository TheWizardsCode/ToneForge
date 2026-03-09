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

  y.command(generateCommand as any);
  y.command(listCommand as any);
  y.command(showCommand as any);
  y.command(playCommand as any);
  y.command(versionCommand as any);

  y.help().strict();

  await y.parse();
  return process.exitCode ?? 0;
}

// If executed directly, run yargsMain
if (import.meta.url === `file://${process.argv[1]}`) {
  yargs.help().parse();
}
