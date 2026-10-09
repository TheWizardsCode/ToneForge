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
import * as runtimeCmd from "./cli/commands/runtime.js";
import * as analyzeCmd from "./cli/commands/analyze.js";
import * as classifyCmd from "./cli/commands/classify.js";
import * as exploreCmd from "./cli/commands/explore.js";
import * as libraryCmd from "./cli/commands/library.js";
import * as intelligenceCmd from "./cli/commands/intelligence.js";
import * as intentCmd from "./cli/commands/intent.js";
import * as memoryCmd from "./cli/commands/memory.js";
import * as tuiCmd from "./cli/commands/tui.js";
import * as visualizeCmd from "./cli/commands/visualize.js";
import * as validateCmd from "./cli/commands/validate.js";
import * as compileCmd from "./cli/commands/compile.js";
import * as syncCmd from "./cli/commands/sync.js";
import * as pipelineCmd from "./cli/commands/pipeline.js";
import * as marketplaceCmd from "./cli/commands/marketplace.js";

export const FRAMEWORK_COMMANDS = [
  "generate",
  "list",
  "show",
  "play",
  "version",
  "stack",
  "sequence",
  "runtime",
  "analyze",
  "classify",
  "explore",
  "library",
  "intelligence",
  "intent",
  "memory",
  "tui",
  "visualize",
  "validate",
  "compile",
  "sync",
  "pipeline",
  "marketplace",
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
        ...(argv.dir !== undefined ? { dir: String(argv.dir) } : {}),
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

  // ── runtime ───────────────────────────────────────────────────────────────
  y.command(runtimeCmd.command, runtimeCmd.desc, (y2) => {
    y2.command("start", "Start a live, interactive runtime session", (y3) => {
      y3.option("scenario", { type: "string", describe: "Path to a runtime scenario JSON file" })
        .option("seed", { type: "number", describe: "Override the scenario seed" })
        .option("script", { type: "string", describe: "Replay a command-per-line script and exit" })
        .option("serve", { type: "boolean", describe: "Run as a long-running service (no TTY; clean shutdown on SIGINT/SIGTERM)" })
        .option("json", { type: "boolean", describe: "Stream runtime events as JSON (no audio)" })
        .option("cache-size", { type: "number", describe: "Maximum cached renders" })
        .option("iterations", { type: "number", describe: "Stop the transport after n loop iterations" })
        .option("seed-variation", { type: "boolean", default: true, describe: "Vary the event seed on each transport iteration" });
    }, async (argv) => {
      exitCode = await dispatchCommand("runtime", "start", buildFlags(argv, {
        ...(argv.scenario !== undefined ? { scenario: String(argv.scenario) } : {}),
        ...(argv.seed !== undefined ? { seed: String(argv.seed) } : {}),
        ...(argv.script !== undefined ? { script: String(argv.script) } : {}),
        ...(argv.serve === true ? { serve: true } : {}),
        ...(argv["cache-size"] !== undefined ? { "cache-size": String(argv["cache-size"]) } : {}),
        ...(argv.iterations !== undefined ? { iterations: String(argv.iterations) } : {}),
        ...(argv["seed-variation"] === false ? { "seed-variation": false } : {}),
      }), []);
    });
    y2.command("demo", "Run a scripted runtime audio demo", (y3) => {
      y3.option("scenario", { type: "string", describe: "Path to a runtime scenario JSON file" })
        .option("seed", { type: "number", describe: "Override the scenario seed" })
        .option("output", { type: "string", describe: "Directory to export rendered WAVs and the timeline" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("runtime", "demo", buildFlags(argv, {
        ...(argv.scenario !== undefined ? { scenario: String(argv.scenario) } : {}),
        ...(argv.seed !== undefined ? { seed: String(argv.seed) } : {}),
        ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
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
    y2.command("add", "Register a new ToneGraph recipe from an external file", (y3) => {
      y3.option("file", { type: "string", describe: "Path to a ToneGraph YAML or JSON file" })
        .option("inline", { type: "string", describe: "Inline ToneGraph YAML/JSON definition" })
        .option("stdin", { type: "boolean", describe: "Read the ToneGraph definition from stdin" })
        .option("name", { type: "string", describe: "Override recipe name (defaults to filename without extension)" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("library", "add", buildFlags(argv, {
        ...(argv.file !== undefined ? { file: String(argv.file) } : {}),
        ...(argv.inline !== undefined ? { inline: String(argv.inline) } : {}),
        ...(argv.stdin === true ? { stdin: true } : {}),
        ...(argv.name !== undefined ? { name: String(argv.name) } : {}),
        ...(argv.destination !== undefined ? { destination: String(argv.destination) } : {}),
      }), []);
    });
  }, async (_argv) => {
    // Re-parse raw argv so dispatchCommand receives the unknown subcommand name
    // for proper error output. yargs only calls this handler when no subcommand
    // matched, so `argv._` isn't reliable; `raw` (captured in outer scope) is.
    const parsed = parseArgs(["node", "cli.ts", ...raw]);
    exitCode = await dispatchCommand(parsed.command, parsed.subcommand, parsed.flags, parsed.layers);
  });

  // ── intelligence ──────────────────────────────────────────────────────────
  y.command(intelligenceCmd.command, intelligenceCmd.desc, (y2) => {
    y2.command("audit", "Audit a library for coverage gaps, redundancy, and quality issues", (y3) => {
      y3.option("library", { type: "string", describe: "Library directory to audit" })
        .option("use-memory", { type: "boolean", describe: "Add historical context from the Memory store" })
        .option("memory-dir", { type: "string", describe: "Override the project-local memory directory" })
        .option("dry-run", { type: "boolean", default: true, describe: "Read-only dry-run (always on)" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("intelligence", "audit", buildFlags(argv, {
        ...(argv.library !== undefined ? { library: String(argv.library) } : {}),
        ...(argv["use-memory"] === true ? { "use-memory": true } : {}),
        ...(argv["memory-dir"] !== undefined ? { "memory-dir": String(argv["memory-dir"]) } : {}),
        ...(argv["dry-run"] === false ? { "dry-run": false } : {}),
      }), []);
    });
    y2.command("recommend", "Recommend ranked sounds for a use case", (y3) => {
      y3.option("use-case", { type: "string", describe: "Use case description" })
        .option("max-results", { type: "number", default: 5, describe: "Maximum recommendations" })
        .option("library", { type: "string", describe: "Library directory to search" })
        .option("use-memory", { type: "boolean", describe: "Add historical context from the Memory store" })
        .option("memory-dir", { type: "string", describe: "Override the project-local memory directory" })
        .option("dry-run", { type: "boolean", default: true, describe: "Read-only dry-run (always on)" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("intelligence", "recommend", buildFlags(argv, {
        ...(argv["use-case"] !== undefined ? { "use-case": String(argv["use-case"]) } : {}),
        ...(argv["max-results"] !== undefined ? { "max-results": String(argv["max-results"]) } : {}),
        ...(argv.library !== undefined ? { library: String(argv.library) } : {}),
        ...(argv["use-memory"] === true ? { "use-memory": true } : {}),
        ...(argv["memory-dir"] !== undefined ? { "memory-dir": String(argv["memory-dir"]) } : {}),
        ...(argv["dry-run"] === false ? { "dry-run": false } : {}),
      }), []);
    });
    y2.command("suggest-exploration", "Suggest exploration targets for a recipe", (y3) => {
      y3.option("recipe", { type: "string", describe: "Recipe to explore" })
        .option("library", { type: "string", describe: "Library directory to inspect" })
        .option("use-memory", { type: "boolean", describe: "Add historical context from the Memory store" })
        .option("memory-dir", { type: "string", describe: "Override the project-local memory directory" })
        .option("dry-run", { type: "boolean", default: true, describe: "Read-only dry-run (always on)" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("intelligence", "suggest-exploration", buildFlags(argv, {
        ...(argv.recipe !== undefined ? { recipe: String(argv.recipe) } : {}),
        ...(argv.library !== undefined ? { library: String(argv.library) } : {}),
        ...(argv["use-memory"] === true ? { "use-memory": true } : {}),
        ...(argv["memory-dir"] !== undefined ? { "memory-dir": String(argv["memory-dir"]) } : {}),
        ...(argv["dry-run"] === false ? { "dry-run": false } : {}),
      }), []);
    });
  }, async (_argv) => {
    // Re-parse raw argv so dispatchCommand receives the unknown subcommand name
    // for proper error output. yargs only calls this handler when no subcommand
    // matched, so `argv._` isn't reliable; `raw` (captured in outer scope) is.
    const parsed = parseArgs(["node", "cli.ts", ...raw]);
    exitCode = await dispatchCommand(parsed.command, parsed.subcommand, parsed.flags, parsed.layers);
  });

  // ── intent ────────────────────────────────────────────────────────────────
  y.command(intentCmd.command, intentCmd.desc, (y2) => {
    y2.command("submit", "Submit an intent and receive an Intelligence analysis", (y3) => {
      y3.option("goal", { type: "string", describe: "Freeform goal" })
        .option("scope", { type: "string", describe: "Explicit scope" })
        .option("intent", { type: "string", describe: "Explicit intent id override" })
        .option("priority", { type: "string", describe: "Priority: low, medium or high" })
        .option("constraint", { type: "array", describe: "Constraint as key=value (repeatable)" })
        .option("library", { type: "string", describe: "Library directory" })
        .option("memory-dir", { type: "string", describe: "Override the memory directory" })
        .option("approve", { type: "boolean", describe: "Approve and execute suggestions" })
        .option("dry-run", { type: "boolean", describe: "Never execute" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("intent", "submit", buildFlags(argv, {
        ...(argv.goal !== undefined ? { goal: String(argv.goal) } : {}),
        ...(argv.scope !== undefined ? { scope: String(argv.scope) } : {}),
        ...(argv.intent !== undefined ? { intent: String(argv.intent) } : {}),
        ...(argv.priority !== undefined ? { priority: String(argv.priority) } : {}),
        ...(argv.constraint !== undefined ? { constraint: (argv.constraint as string[]).join("\n") } : {}),
        ...(argv.library !== undefined ? { library: String(argv.library) } : {}),
        ...(argv["memory-dir"] !== undefined ? { "memory-dir": String(argv["memory-dir"]) } : {}),
        ...(argv.approve === true ? { approve: true } : {}),
        ...(argv["dry-run"] === true ? { "dry-run": true } : {}),
      }), []);
    });
    y2.command("vocabulary", "List the controlled intent vocabulary", (y3) => {
      y3.option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("intent", "vocabulary", buildFlags(argv), []);
    });
  }, async (_argv) => {
    const parsed = parseArgs(["node", "cli.ts", ...raw]);
    exitCode = await dispatchCommand(parsed.command, parsed.subcommand, parsed.flags, parsed.layers);
  });

  // ── memory ────────────────────────────────────────────────────────────────
  y.command(memoryCmd.command, memoryCmd.desc, (y2) => {
    y2.command("query", "Query Memory by scope and time range", (y3) => {
      y3.option("scope", { type: "string", describe: "Scope filter" })
        .option("time-range", { type: "string", describe: "<from>:<to> ISO dates, or 'all'" })
        .option("memory-dir", { type: "string", describe: "Override the memory directory" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("memory", "query", buildFlags(argv, {
        ...(argv.scope !== undefined ? { scope: String(argv.scope) } : {}),
        ...(argv["time-range"] !== undefined ? { "time-range": String(argv["time-range"]) } : {}),
        ...(argv["memory-dir"] !== undefined ? { "memory-dir": String(argv["memory-dir"]) } : {}),
      }), []);
    });
    y2.command("export", "Export every Memory record", (y3) => {
      y3.option("memory-dir", { type: "string", describe: "Override the memory directory" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("memory", "export", buildFlags(argv, {
        ...(argv["memory-dir"] !== undefined ? { "memory-dir": String(argv["memory-dir"]) } : {}),
      }), []);
    });
    y2.command("clear", "Clear the Memory store", (y3) => {
      y3.option("memory-dir", { type: "string", describe: "Override the memory directory" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("memory", "clear", buildFlags(argv, {
        ...(argv["memory-dir"] !== undefined ? { "memory-dir": String(argv["memory-dir"]) } : {}),
      }), []);
    });
  }, async (_argv) => {
    const parsed = parseArgs(["node", "cli.ts", ...raw]);
    exitCode = await dispatchCommand(parsed.command, parsed.subcommand, parsed.flags, parsed.layers);
  });

  // ── visualize ─────────────────────────────────────────────────────────────
  y.command(visualizeCmd.command, visualizeCmd.desc, (y2) => {
    y2.command("export", "Export deterministic visual effects for a recipe", (y3) => {
      y3.option("recipe", { type: "string", describe: "Recipe name" })
        .option("seed", { type: "number", describe: "Seed for deterministic output" })
        .option("format", { type: "string", describe: "Export format: spritesheet or frames" })
        .option("output", { type: "string", describe: "Output directory" })
        .option("palette", { type: "string", describe: "Aesthetic palette name" })
        .option("frames", { type: "number", describe: "Number of animation frames" })
        .option("width", { type: "number", describe: "Frame width in pixels" })
        .option("height", { type: "number", describe: "Frame height in pixels" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("visualize", "export", buildFlags(argv, {
        ...(argv.recipe !== undefined ? { recipe: String(argv.recipe) } : {}),
        ...(argv.seed !== undefined ? { seed: String(argv.seed) } : {}),
        ...(argv.format !== undefined ? { format: String(argv.format) } : {}),
        ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
        ...(argv.palette !== undefined ? { palette: String(argv.palette) } : {}),
        ...(argv.frames !== undefined ? { frames: String(argv.frames) } : {}),
        ...(argv.width !== undefined ? { width: String(argv.width) } : {}),
        ...(argv.height !== undefined ? { height: String(argv.height) } : {}),
      }), []);
    });
  }, async (_argv) => {
    // Re-parse raw argv so dispatchCommand receives the unknown subcommand name
    // for proper error output. yargs only calls this handler when no subcommand
    // matched, so `argv._` isn't reliable; `raw` (captured in outer scope) is.
    const parsed = parseArgs(["node", "cli.ts", ...raw]);
    exitCode = await dispatchCommand(parsed.command, parsed.subcommand, parsed.flags, parsed.layers);
  });

  // ── validate ──────────────────────────────────────────────────────────────
  y.command(validateCmd.command, validateCmd.desc, validateCmd.builder, async (argv) => {
    exitCode = await dispatchCommand("validate", undefined, buildFlags(argv, {
      ...(argv.library !== undefined ? { library: String(argv.library) } : {}),
      ...(argv.ruleset !== undefined ? { ruleset: String(argv.ruleset) } : {}),
      ...(argv.strictness !== undefined ? { strictness: String(argv.strictness) } : {}),
    }), []);
  });

  // ── compile ───────────────────────────────────────────────────────────────
  y.command(compileCmd.command, compileCmd.desc, compileCmd.builder, async (argv) => {
    exitCode = await dispatchCommand("compile", undefined, buildFlags(argv, {
      ...(argv.library !== undefined ? { library: String(argv.library) } : {}),
      ...(argv.target !== undefined ? { target: String(argv.target) } : {}),
      ...(argv.rules !== undefined ? { rules: String(argv.rules) } : {}),
      ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
      ...(argv["dry-run"] === true ? { "dry-run": true } : {}),
    }), []);
  });

  // ── sync ──────────────────────────────────────────────────────────────────
  y.command(syncCmd.command, syncCmd.desc, syncCmd.builder, async (argv) => {
    exitCode = await dispatchCommand("sync", undefined, buildFlags(argv, {
      ...(argv.target !== undefined ? { target: String(argv.target) } : {}),
      ...(argv.library !== undefined ? { library: String(argv.library) } : {}),
      ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
    }), []);
  });

  // ── pipeline ────────────────────────────────────────────────────────────
  y.command(pipelineCmd.command, pipelineCmd.desc, pipelineCmd.builder, async (argv) => {
    exitCode = await dispatchCommand("pipeline", undefined, buildFlags(argv, {
      ...(argv.sounds !== undefined ? { sounds: String(argv.sounds) } : {}),
      ...(argv.library !== undefined ? { library: String(argv.library) } : {}),
      ...(argv.output !== undefined ? { output: String(argv.output) } : {}),
      ...(argv["compile-dir"] !== undefined ? { "compile-dir": String(argv["compile-dir"]) } : {}),
      ...(argv.ruleset !== undefined ? { ruleset: String(argv.ruleset) } : {}),
      ...(argv.strictness !== undefined ? { strictness: String(argv.strictness) } : {}),
    }), []);
  });

  // ── marketplace ────────────────────────────────────────────────────────
  y.command(marketplaceCmd.command, marketplaceCmd.desc, (y2) => {
    y2.command("search", "Search the Marketplace for packages", (y3) => {
      y3.option("category", { type: "string", describe: "Filter by category" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("marketplace", "search", buildFlags(argv, {
        ...(argv.category !== undefined ? { category: String(argv.category) } : {}),
      }), []);
    });
    y2.command("install", "Install a Marketplace package", (y3) => {
      y3.positional("package", { type: "string", describe: "Package name and version (e.g. industrial_lasers@2.1.0)" });
      y3.option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("marketplace", "install", buildFlags(argv, {
        ...(argv.package !== undefined ? { package: String(argv.package) } : {}),
      }), []);
    });
    y2.command("publish", "Publish a package to the Marketplace", (y3) => {
      y3.option("package", { type: "string", describe: "Package directory" })
        .option("name", { type: "string", describe: "Package name" })
        .option("version", { type: "string", describe: "Package version (semver)" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    }, async (argv) => {
      exitCode = await dispatchCommand("marketplace", "publish", buildFlags(argv, {
        ...(argv.package !== undefined ? { package: String(argv.package) } : {}),
        ...(argv.name !== undefined ? { name: String(argv.name) } : {}),
        ...(argv.version !== undefined ? { version: String(argv.version) } : {}),
      }), []);
    });
  }, async (_argv) => {
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
