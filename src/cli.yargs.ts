#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { Arguments } from "yargs";
import { dispatchCommand, parseArgs } from "./cli.runtime.js";
import { truncateTags } from "./cli/helpers.js";

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

/**
 * Build a flags Record from a yargs argv object.
 *
 * @param argv   - Parsed yargs arguments for the matched command.
 * @param extras - Additional flag key/value pairs to merge in (take precedence).
 * @returns      A `Record<string, string|boolean>` compatible with `dispatchCommand`.
 *
 * Common boolean flags (`--json`, `--help`) are always captured automatically.
 * Numeric yargs values must be stringified before passing as `extras` because
 * `dispatchCommand` uses `parseInt` / `parseFloat` internally.
 */
function buildFlags(
  argv: Arguments,
  extras: Record<string, string | boolean> = {},
): Record<string, string | boolean> {
  const f: Record<string, string | boolean> = {};
  if (argv.json === true) f.json = true;
  if (argv.help === true) f.help = true;
  Object.assign(f, extras);
  return f;
}

export async function yargsMain(argv: string[] = process.argv): Promise<number> {
  const raw = hideBin(argv);

  // When no positional command is present (e.g. `--help`, `--version`, or bare
  // invocation), dispatch with the global flags only — yargs routing is not needed.
  const firstNonFlag = raw.find((a) => !a.startsWith("-"));
  if (!firstNonFlag) {
    const globalFlags: Record<string, string | boolean> = {};
    if (raw.includes("--help") || raw.includes("-h")) globalFlags.help = true;
    if (raw.includes("--version") || raw.includes("-V")) globalFlags.version = true;
    if (raw.includes("--json")) globalFlags.json = true;
    return dispatchCommand(undefined, undefined, globalFlags, []);
  }

  const y = yargs(raw).scriptName("toneforge");
  let exitCode: number | undefined;

  // Prevent yargs from calling process.exit() or printing its own error messages.
  // dispatchCommand is the authoritative error handler for all commands.
  y.exitProcess(false);
  y.showHelpOnFail(false);
  y.version(false);
  y.help(false);
  y.fail((_msg, _err) => { /* noop */ });

  // ── generate ──────────────────────────────────────────────────────────────
  y.command(generateCmd.command, generateCmd.desc, generateCmd.builder, async (argv) => {
    exitCode = await dispatchCommand("generate", undefined, buildFlags(argv, {
      ...(argv.recipe !== undefined ? { recipe: String(argv.recipe) } : {}),
      ...(argv.seed !== undefined ? { seed: String(argv.seed) } : {}),
      ...(argv["seed-range"] !== undefined ? { "seed-range": String(argv["seed-range"]) } : {}),
      ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
    }), []);
  });

  // ── list ──────────────────────────────────────────────────────────────────
  y.command(listCmd.command, listCmd.desc, listCmd.builder, async (argv) => {
    exitCode = await dispatchCommand(
      "list",
      argv.resource as string | undefined,
      buildFlags(argv, {
        ...(argv.search !== undefined ? { search: String(argv.search) } : {}),
        ...(argv.category !== undefined ? { category: String(argv.category) } : {}),
        ...(argv.tags !== undefined ? { tags: String(argv.tags) } : {}),
      }),
      [],
    );
  });

  // ── show ──────────────────────────────────────────────────────────────────
  y.command(showCmd.command, showCmd.desc, showCmd.builder, async (argv) => {
    exitCode = await dispatchCommand(
      "show",
      argv.name as string | undefined,
      buildFlags(argv, {
        ...(argv.seed !== undefined ? { seed: String(argv.seed) } : {}),
      }),
      [],
    );
  });

  // ── play ──────────────────────────────────────────────────────────────────
  y.command(playCmd.command, playCmd.desc, playCmd.builder, async (argv) => {
    exitCode = await dispatchCommand("play", argv.file as string | undefined, buildFlags(argv), []);
  });

  // ── version ───────────────────────────────────────────────────────────────
  y.command(versionCmd.command, versionCmd.desc, versionCmd.builder, async (argv) => {
    exitCode = await dispatchCommand("version", undefined, buildFlags(argv), []);
  });

  // ── analyze ───────────────────────────────────────────────────────────────
  y.command(analyzeCmd.command, analyzeCmd.desc, analyzeCmd.builder, async (argv) => {
    exitCode = await dispatchCommand("analyze", undefined, buildFlags(argv, {
      ...(argv.input !== undefined ? { input: String(argv.input) } : {}),
      ...(argv.recipe !== undefined ? { recipe: String(argv.recipe) } : {}),
      ...(argv.seed !== undefined ? { seed: String(argv.seed) } : {}),
      ...(argv.format !== undefined ? { format: String(argv.format) } : {}),
      ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
    }), []);
  });

  // ── tui ───────────────────────────────────────────────────────────────────
  y.command(tuiCmd.command, tuiCmd.desc, tuiCmd.builder, async (argv) => {
    exitCode = await dispatchCommand("tui", undefined, buildFlags(argv, {
      ...(argv.resume !== undefined ? { resume: String(argv.resume) } : {}),
      ...(argv["session-file"] !== undefined ? { "session-file": String(argv["session-file"]) } : {}),
    }), []);
  });

  // ── stack ─────────────────────────────────────────────────────────────────
  y.command(stackCmd.command, stackCmd.desc, (y2) => {
    y2.command("render", "Render a stack preset to audio", (y3) => {
      y3.option("preset", { type: "string", describe: "Path to stack preset JSON" })
        .option("seed", { type: "string", describe: "Seed for rendering" })
        .option("output", { type: "string", describe: "Output WAV path" })
        .option("layer", { type: "array", describe: "Inline layer spec overrides" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("stack", "render", buildFlags(argv, {
        ...(argv.preset !== undefined ? { preset: String(argv.preset) } : {}),
        ...(argv.seed !== undefined ? { seed: String(argv.seed) } : {}),
        ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
      }), (argv.layer as string[] | undefined) ?? []);
    });
    y2.command("inspect", "Inspect a stack preset structure", (y3) => {
      y3.option("preset", { type: "string", describe: "Path to stack preset JSON" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("stack", "inspect", buildFlags(argv, {
        ...(argv.preset !== undefined ? { preset: String(argv.preset) } : {}),
      }), []);
    });
  }, async (_argv) => {
    // Re-parse raw argv so dispatchCommand receives the unknown subcommand name
    // for proper error output. yargs only calls this handler when no subcommand
    // matched, so `argv._` isn't reliable; `raw` (captured in outer scope) is.
    const parsed = parseArgs(["node", "cli.ts", ...raw]);
    exitCode = await dispatchCommand(parsed.command, parsed.subcommand, parsed.flags, parsed.layers);
  });

  // ── sequence ──────────────────────────────────────────────────────────────
  y.command(sequenceCmd.command, sequenceCmd.desc, (y2) => {
    y2.command("generate", "Render a sequence to audio", (y3) => {
      y3.option("preset", { type: "string", describe: "Path to sequence preset JSON" })
        .option("seed", { type: "number", describe: "Seed for rendering" })
        .option("output", { type: "string", describe: "Output WAV path" })
        .option("duration", { type: "number", describe: "Duration override in seconds" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("sequence", "generate", buildFlags(argv, {
        ...(argv.preset !== undefined ? { preset: String(argv.preset) } : {}),
        ...(argv.seed !== undefined ? { seed: String(argv.seed) } : {}),
        ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
        ...(argv.duration !== undefined ? { duration: String(argv.duration) } : {}),
      }), []);
    });
    y2.command("simulate", "Simulate a sequence and show event schedule", (y3) => {
      y3.option("preset", { type: "string", describe: "Path to sequence preset JSON" })
        .option("seed", { type: "number", describe: "Seed for simulation" })
        .option("duration", { type: "number", describe: "Maximum simulated duration in seconds" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("sequence", "simulate", buildFlags(argv, {
        ...(argv.preset !== undefined ? { preset: String(argv.preset) } : {}),
        ...(argv.seed !== undefined ? { seed: String(argv.seed) } : {}),
        ...(argv.duration !== undefined ? { duration: String(argv.duration) } : {}),
      }), []);
    });
    y2.command("inspect", "Inspect a sequence preset structure", (y3) => {
      y3.option("preset", { type: "string", describe: "Path to sequence preset JSON" })
        .option("validate", { type: "boolean", describe: "Validate the preset and report errors" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("sequence", "inspect", buildFlags(argv, {
        ...(argv.preset !== undefined ? { preset: String(argv.preset) } : {}),
        ...(argv.validate === true ? { validate: true } : {}),
      }), []);
    });
  }, async (_argv) => {
    // Re-parse raw argv so dispatchCommand receives the unknown subcommand name
    // for proper error output. yargs only calls this handler when no subcommand
    // matched, so `argv._` isn't reliable; `raw` (captured in outer scope) is.
    const parsed = parseArgs(["node", "cli.ts", ...raw]);
    exitCode = await dispatchCommand(parsed.command, parsed.subcommand, parsed.flags, parsed.layers);
  });

  // ── classify ──────────────────────────────────────────────────────────────
  y.command(classifyCmd.command, classifyCmd.desc, (y2) => {
    y2.command("search", "Search for classified sounds in a directory", (y3) => {
      y3.option("category", { type: "string", describe: "Filter by category" })
        .option("intensity", { type: "string", describe: "Filter by intensity" })
        .option("texture", { type: "string", describe: "Filter by texture" })
        .option("dir", { type: "string", describe: "Directory to search" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("classify", "search", buildFlags(argv, {
        ...(argv.category !== undefined ? { category: String(argv.category) } : {}),
        ...(argv.intensity !== undefined ? { intensity: String(argv.intensity) } : {}),
        ...(argv.texture !== undefined ? { texture: String(argv.texture) } : {}),
        ...(argv.dir !== undefined ? { dir: String(argv.dir) } : {}),
      }), []);
    });
  }, async (argv) => {
    // Pass classify without subcommand (for recipe/input/analysis modes); only
    // use parseArgs when an unrecognized positional is present (argv._[0] != "classify").
    const sub = (argv._ as string[])[1] as string | undefined;
    exitCode = await dispatchCommand("classify", sub, buildFlags(argv, {
      ...(argv.recipe !== undefined ? { recipe: String(argv.recipe) } : {}),
      ...(argv.input !== undefined ? { input: String(argv.input) } : {}),
      ...(argv.analysis !== undefined ? { analysis: String(argv.analysis) } : {}),
      ...(argv.seed !== undefined ? { seed: String(argv.seed) } : {}),
      ...(argv.format !== undefined ? { format: String(argv.format) } : {}),
      ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
    }), []);
  });

  // ── explore ───────────────────────────────────────────────────────────────
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
    }, async (argv) => {
      exitCode = await dispatchCommand("explore", "sweep", buildFlags(argv, {
        ...(argv.recipe !== undefined ? { recipe: String(argv.recipe) } : {}),
        ...(argv["seed-range"] !== undefined ? { "seed-range": String(argv["seed-range"]) } : {}),
        ...(argv["keep-top"] !== undefined ? { "keep-top": String(argv["keep-top"]) } : {}),
        ...(argv["rank-by"] !== undefined ? { "rank-by": String(argv["rank-by"]) } : {}),
        ...(argv.clusters !== undefined ? { clusters: String(argv.clusters) } : {}),
        ...(argv.concurrency !== undefined ? { concurrency: String(argv.concurrency) } : {}),
        ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
      }), []);
    });
    y2.command("mutate", "Mutate a seed to explore nearby sounds", (y3) => {
      y3.option("recipe", { type: "string", describe: "Recipe name" })
        .option("seed", { type: "number", describe: "Seed to mutate" })
        .option("jitter", { type: "number", default: 0.1, describe: "Jitter amount (0-1)" })
        .option("count", { type: "number", default: 20, describe: "Number of mutations" })
        .option("rank-by", { type: "string", describe: "Metric to rank by" })
        .option("output", { type: "string", describe: "Output directory" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("explore", "mutate", buildFlags(argv, {
        ...(argv.recipe !== undefined ? { recipe: String(argv.recipe) } : {}),
        ...(argv.seed !== undefined ? { seed: String(argv.seed) } : {}),
        ...(argv.jitter !== undefined ? { jitter: String(argv.jitter) } : {}),
        ...(argv.count !== undefined ? { count: String(argv.count) } : {}),
        ...(argv["rank-by"] !== undefined ? { "rank-by": String(argv["rank-by"]) } : {}),
        ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
      }), []);
    });
    y2.command("promote", "Promote a candidate to the library", (y3) => {
      y3.option("run", { type: "string", describe: "Run ID" })
        .option("latest", { type: "boolean", describe: "Use the latest run" })
        .option("id", { type: "string", describe: "Candidate ID to promote" })
        .option("category", { type: "string", describe: "Override category" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("explore", "promote", buildFlags(argv, {
        ...(argv.run !== undefined ? { run: String(argv.run) } : {}),
        ...(argv.latest === true ? { latest: true } : {}),
        ...(argv.id !== undefined ? { id: String(argv.id) } : {}),
        ...(argv.category !== undefined ? { category: String(argv.category) } : {}),
      }), []);
    });
    y2.command("show", "Show details of an exploration run", (y3) => {
      y3.option("run", { type: "string", describe: "Run ID" })
        .option("latest", { type: "boolean", describe: "Use the latest run" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("explore", "show", buildFlags(argv, {
        ...(argv.run !== undefined ? { run: String(argv.run) } : {}),
        ...(argv.latest === true ? { latest: true } : {}),
      }), []);
    });
    y2.command("runs", "List all exploration runs", (y3) => {
      y3.option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("explore", "runs", buildFlags(argv), []);
    });
  }, async (_argv) => {
    // Re-parse raw argv so dispatchCommand receives the unknown subcommand name
    // for proper error output. yargs only calls this handler when no subcommand
    // matched, so `argv._` isn't reliable; `raw` (captured in outer scope) is.
    const parsed = parseArgs(["node", "cli.ts", ...raw]);
    exitCode = await dispatchCommand(parsed.command, parsed.subcommand, parsed.flags, parsed.layers);
  });

  // ── library ───────────────────────────────────────────────────────────────
  y.command(libraryCmd.command, libraryCmd.desc, (y2) => {
    y2.command("list", "List library entries", (y3) => {
      y3.option("category", { type: "string", describe: "Filter by category" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("library", "list", buildFlags(argv, {
        ...(argv.category !== undefined ? { category: String(argv.category) } : {}),
      }), []);
    });
    y2.command("search", "Search library entries", (y3) => {
      y3.option("category", { type: "string", describe: "Filter by category" })
        .option("intensity", { type: "string", describe: "Filter by intensity" })
        .option("texture", { type: "string", describe: "Filter by texture" })
        .option("tags", { type: "string", describe: "Filter by tags" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("library", "search", buildFlags(argv, {
        ...(argv.category !== undefined ? { category: String(argv.category) } : {}),
        ...(argv.intensity !== undefined ? { intensity: String(argv.intensity) } : {}),
        ...(argv.texture !== undefined ? { texture: String(argv.texture) } : {}),
        ...(argv.tags !== undefined ? { tags: String(argv.tags) } : {}),
      }), []);
    });
    y2.command("similar", "Find similar library entries", (y3) => {
      y3.option("id", { type: "string", describe: "Entry ID to compare" })
        .option("limit", { type: "number", default: 10, describe: "Maximum results" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("library", "similar", buildFlags(argv, {
        ...(argv.id !== undefined ? { id: String(argv.id) } : {}),
        ...(argv.limit !== undefined ? { limit: String(argv.limit) } : {}),
      }), []);
    });
    y2.command("export", "Export library entries to WAV files", (y3) => {
      y3.option("output", { type: "string", describe: "Output directory" })
        .option("category", { type: "string", describe: "Filter by category" })
        .option("format", { type: "string", describe: "Output format" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("library", "export", buildFlags(argv, {
        ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
        ...(argv.category !== undefined ? { category: String(argv.category) } : {}),
        ...(argv.format !== undefined ? { format: String(argv.format) } : {}),
      }), []);
    });
    y2.command("regenerate", "Regenerate a library entry", (y3) => {
      y3.option("id", { type: "string", describe: "Entry ID to regenerate" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("library", "regenerate", buildFlags(argv, {
        ...(argv.id !== undefined ? { id: String(argv.id) } : {}),
      }), []);
    });
  }, async (_argv) => {
    // Re-parse raw argv so dispatchCommand receives the unknown subcommand name
    // for proper error output. yargs only calls this handler when no subcommand
    // matched, so `argv._` isn't reliable; `raw` (captured in outer scope) is.
    const parsed = parseArgs(["node", "cli.ts", ...raw]);
    exitCode = await dispatchCommand(parsed.command, parsed.subcommand, parsed.flags, parsed.layers);
  });

  try {
    await y.parse();
    if (typeof exitCode === "number") {
      return exitCode;
    }
    // No handler matched (e.g. unknown command) — re-parse and dispatch so
    // dispatchCommand can output the proper error message.
    const parsed = parseArgs(["node", "cli.ts", ...raw]);
    return dispatchCommand(parsed.command, parsed.subcommand, parsed.flags, parsed.layers);
  } catch {
    // Edge-case yargs parse error — fall through to dispatchCommand for
    // consistent error output.
    const parsed = parseArgs(["node", "cli.ts", ...raw]);
    return dispatchCommand(parsed.command, parsed.subcommand, parsed.flags, parsed.layers);
  }
}

// If executed directly, run yargsMain
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await yargsMain();
}
