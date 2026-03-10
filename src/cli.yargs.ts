#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import * as generateCmd from "./cli/commands/generate.js";
import * as listCmd from "./cli/commands/list.js";
import * as showCmd from "./cli/commands/show.js";
import * as playCmd from "./cli/commands/play.js";
import * as versionCmd from "./cli/commands/version.js";
import * as stackCmd from "./cli/commands/stack.js";
import * as sequenceCmd from "./cli/commands/sequence.js";
import * as analyzeCmd from "./cli/commands/analyze.js";
import * as classifyCmd from "./cli/commands/classify.js";
import * as exploreCmd from "./cli/commands/explore.js";
import * as libraryCmd from "./cli/commands/library.js";
import * as tuiCmd from "./cli/commands/tui.js";

export const FRAMEWORK_COMMANDS = [
  "generate",
  "list",
  "show",
  "play",
  "version",
  "stack",
  "sequence",
  "analyze",
  "classify",
  "explore",
  "library",
  "tui",
];

export async function yargsMain(argv: string[] = process.argv): Promise<number> {
  const raw = hideBin(argv);

  const { main: coreMain } = await import("./cli.core.js");

  // When no arguments or only flags (help/version), delegate directly to coreMain.
  const firstNonFlag = raw.find((a) => !a.startsWith("-"));
  if (!firstNonFlag) {
    return coreMain(["node", "cli.ts", ...raw]);
  }

  const y = yargs(raw).scriptName("toneforge");
  let exitCode: number | undefined;

  y.exitProcess(false);
  y.showHelpOnFail(false);
  y.version(false);
  y.help(false);

  // Suppress yargs validation errors — coreMain is the authoritative error
  // handler and outputs plain-text or JSON depending on the --json flag.
  y.fail((_msg, _err) => { /* noop */ });

  // Single shared handler: all command execution is delegated to coreMain.
  // yargs provides routing structure and help-text; coreMain is the
  // authoritative implementation.
  const handle = async () => {
    exitCode = await coreMain(["node", "cli.ts", ...raw]);
  };

  // ── Simple commands ──────────────────────────────────────────────────────
  y.command(generateCmd.command, generateCmd.desc, generateCmd.builder, handle);
  y.command(listCmd.command, listCmd.desc, listCmd.builder, handle);
  y.command(showCmd.command, showCmd.desc, showCmd.builder, handle);
  y.command(playCmd.command, playCmd.desc, playCmd.builder, handle);
  y.command(versionCmd.command, versionCmd.desc, versionCmd.builder, handle);
  y.command(analyzeCmd.command, analyzeCmd.desc, analyzeCmd.builder, handle);
  y.command(tuiCmd.command, tuiCmd.desc, tuiCmd.builder, handle);

  // ── Stack (subcommands) ──────────────────────────────────────────────────
  y.command(stackCmd.command, stackCmd.desc, (y2) => {
    y2.command("render", "Render a stack preset to audio", (y3) => {
      y3.option("preset", { type: "string", describe: "Path to stack preset JSON" })
        .option("seed", { type: "string", describe: "Seed for rendering" })
        .option("output", { type: "string", describe: "Output WAV path" })
        .option("layer", { type: "array", describe: "Inline layer spec overrides" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
    y2.command("inspect", "Inspect a stack preset structure", (y3) => {
      y3.option("preset", { type: "string", describe: "Path to stack preset JSON" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
  }, handle);

  // ── Sequence (subcommands) ───────────────────────────────────────────────
  y.command(sequenceCmd.command, sequenceCmd.desc, (y2) => {
    y2.command("generate", "Render a sequence to audio", (y3) => {
      y3.option("preset", { type: "string", describe: "Path to sequence preset JSON" })
        .option("seed", { type: "number", describe: "Seed for rendering" })
        .option("output", { type: "string", describe: "Output WAV path" })
        .option("duration", { type: "number", describe: "Duration override in seconds" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
    y2.command("simulate", "Simulate a sequence and show event schedule", (y3) => {
      y3.option("preset", { type: "string", describe: "Path to sequence preset JSON" })
        .option("seed", { type: "number", describe: "Seed for simulation" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
    y2.command("inspect", "Inspect a sequence preset structure", (y3) => {
      y3.option("preset", { type: "string", describe: "Path to sequence preset JSON" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
  }, handle);

  // ── Classify (optional subcommand) ──────────────────────────────────────
  y.command(classifyCmd.command, classifyCmd.desc, (y2) => {
    y2.command("search", "Search for classified sounds in a directory", (y3) => {
      y3.option("category", { type: "string", describe: "Filter by category" })
        .option("intensity", { type: "string", describe: "Filter by intensity" })
        .option("texture", { type: "string", describe: "Filter by texture" })
        .option("dir", { type: "string", describe: "Directory to search" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
  }, handle);

  // ── Explore (subcommands) ────────────────────────────────────────────────
  y.command(exploreCmd.command, exploreCmd.desc, (y2) => {
    y2.command("sweep", "Sweep a seed range and rank candidates", (y3) => {
      y3.option("recipe", { type: "string", describe: "Recipe name" })
        .option("seed-range", { type: "string", describe: "Seed range (start:end)" })
        .option("keep-top", { type: "number", default: 5, describe: "Number of top candidates to keep" })
        .option("rank-by", { type: "string", describe: "Metric to rank by" })
        .option("clusters", { type: "number", default: 3, describe: "Number of clusters" })
        .option("concurrency", { type: "number", default: 4, describe: "Concurrency level" })
        .option("output", { type: "string", describe: "Output directory" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
    y2.command("mutate", "Mutate a seed to explore nearby sounds", (y3) => {
      y3.option("recipe", { type: "string", describe: "Recipe name" })
        .option("seed", { type: "number", describe: "Seed to mutate" })
        .option("jitter", { type: "number", default: 0.1, describe: "Jitter amount (0-1)" })
        .option("count", { type: "number", default: 20, describe: "Number of mutations" })
        .option("rank-by", { type: "string", describe: "Metric to rank by" })
        .option("output", { type: "string", describe: "Output directory" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
    y2.command("promote", "Promote a candidate to the library", (y3) => {
      y3.option("run", { type: "string", describe: "Run ID" })
        .option("latest", { type: "boolean", describe: "Use the latest run" })
        .option("id", { type: "string", describe: "Candidate ID to promote" })
        .option("category", { type: "string", describe: "Override category" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
    y2.command("show", "Show details of an exploration run", (y3) => {
      y3.option("run", { type: "string", describe: "Run ID" })
        .option("latest", { type: "boolean", describe: "Use the latest run" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
    y2.command("runs", "List all exploration runs", (y3) => {
      y3.option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
  }, handle);

  // ── Library (subcommands) ────────────────────────────────────────────────
  y.command(libraryCmd.command, libraryCmd.desc, (y2) => {
    y2.command("list", "List library entries", (y3) => {
      y3.option("category", { type: "string", describe: "Filter by category" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
    y2.command("search", "Search library entries", (y3) => {
      y3.option("category", { type: "string", describe: "Filter by category" })
        .option("intensity", { type: "string", describe: "Filter by intensity" })
        .option("texture", { type: "string", describe: "Filter by texture" })
        .option("tags", { type: "string", describe: "Filter by tags" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
    y2.command("similar", "Find similar library entries", (y3) => {
      y3.option("id", { type: "string", describe: "Entry ID to compare" })
        .option("limit", { type: "number", default: 10, describe: "Maximum results" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
    y2.command("export", "Export library entries to WAV files", (y3) => {
      y3.option("output", { type: "string", describe: "Output directory" })
        .option("category", { type: "string", describe: "Filter by category" })
        .option("format", { type: "string", default: "wav", describe: "Output format" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
    y2.command("regenerate", "Regenerate a library entry", (y3) => {
      y3.option("id", { type: "string", describe: "Entry ID to regenerate" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, handle);
  }, handle);

  try {
    await y.parse();
    if (typeof exitCode === "number") {
      return exitCode;
    }
    // No handler fired — unknown command, fall back to coreMain for proper error.
    return coreMain(["node", "cli.ts", ...raw]);
  } catch {
    return coreMain(["node", "cli.ts", ...raw]);
  }
}

// If executed directly, run yargsMain
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await yargsMain();
}
