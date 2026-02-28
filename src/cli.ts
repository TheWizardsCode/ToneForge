#!/usr/bin/env node
/**
 * ToneForge CLI
 *
 * Entry point for the `toneforge` command-line tool.
 * Supports the `generate` command to render, play, and export procedural sounds,
 * the `show` command to display recipe metadata and parameters,
 * the `play` command to play WAV files from disk, and the `version` command to
 * print the current ToneForge version.
 *
 * Usage:
 *   toneforge generate --recipe <name> [--seed <number>] [--output <path.wav>]
 *   toneforge generate --recipe <name> --seed-range <start>:<end> --output <directory/>
 *   toneforge show <recipe-name> [--seed <number>]
 *   toneforge play <file.wav>
 *   toneforge version
 *   toneforge --version
 *   toneforge --help
 *
 * Reference: docs/prd/CLI_PRD.md Section 4.1, 5.1
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { renderRecipe } from "./core/renderer.js";
import { registry } from "./recipes/index.js";
import { playAudio, getPlayerCommand } from "./audio/player.js";
import { encodeWav } from "./audio/wav-encoder.js";
import { VERSION } from "./index.js";
import { createRng } from "./core/rng.js";
import { profiler } from "./core/profiler.js";
import { outputMarkdown, outputError, outputWarning, outputSuccess, outputInfo, outputTable } from "./output.js";
import type { RecipeRegistration } from "./core/recipe.js";
import { renderStack } from "./stack/renderer.js";
import type { StackDefinition } from "./stack/renderer.js";
import { loadPreset } from "./stack/preset-loader.js";
import { parseLayers } from "./stack/layer-parser.js";
import { createAnalysisEngine, registerBuiltinExtractors } from "./analyze/index.js";
import type { AnalysisResult } from "./analyze/index.js";
import { decodeWavFile } from "./audio/wav-decoder.js";
import { createClassificationEngine, registerBuiltinClassifiers, CLASSIFICATION_VERSION, createAnalysisMetricsProvider } from "./classify/index.js";
import type { ClassificationResult, RecipeContext } from "./classify/index.js";
import {
  sweep,
  mutate,
  rankCandidates,
  keepTopN,
  clusterCandidates,
  saveRunResult,
  loadRunResult,
  listRuns,
  getLatestRunId,
  generateRunId,
  promoteCandidate,
  defaultConcurrency,
  EXPLORE_VERSION,
  VALID_RANK_METRICS,
} from "./explore/index.js";
import type {
  SweepConfig,
  MutateConfig,
  ExploreRunResult,
  RankMetric,
} from "./explore/index.js";
import {
  listEntries,
  getEntry,
  countEntries,
  DEFAULT_LIBRARY_DIR,
} from "./library/index.js";
import { searchEntries } from "./library/search.js";
import type { SearchQuery } from "./library/search.js";
import { findSimilar } from "./library/similarity.js";
import { exportEntries } from "./library/export.js";
import { regenerateEntry } from "./library/regenerate.js";
import { loadSequencePreset, validateSequencePresetFile } from "./sequence/preset-loader.js";
import { simulate, formatTimeline } from "./sequence/simulator.js";
import { renderSequence } from "./sequence/renderer.js";
import type { SequenceDefinition } from "./sequence/schema.js";

/** Parse command-line arguments into a structured map. */
function parseArgs(argv: string[]): {
  command: string | undefined;
  subcommand: string | undefined;
  flags: Record<string, string | boolean>;
  layers: string[];
} {
  // Skip node and script path
  const args = argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;
  let subcommand: string | undefined;
  const layers: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--help" || arg === "-h") {
      flags["help"] = true;
    } else if (arg === "--version" || arg === "-V") {
      flags["version"] = true;
    } else if (arg === "--json") {
      flags["json"] = true;
    } else if (arg === "--profile") {
      flags["profile"] = true;
    } else if (arg === "--layer") {
      // Repeatable flag: collect all --layer values into an array
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        layers.push(next);
        i++;
      }
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

  return { command, subcommand, flags, layers };
}

/** Print general help text. */
async function printHelp(): Promise<void> {
  const md = `# ToneForge v${VERSION}

**Procedural Audio Production Platform**

## Usage

\`toneforge <command> [options]\`

## Commands

| Command | Description |
|---------|-------------|
| **generate** | Render and export procedural sounds |
| **analyze** | Analyze audio files and extract structured metrics |
| **classify** | Assign semantic labels to analyzed sounds |
| **explore** | Discover, rank, and curate sounds across seed spaces |
| **library** | Manage the curated sound library (list, search, export) |
| **sequence** | Schedule and render temporal event patterns from presets |
| **stack** | Compose layered sound events from multiple recipes |
| **show** | Display recipe metadata and parameters |
| **play** | Play a WAV file through the system audio player |
| **list** | List available resources (e.g. recipes) |
| **version** | Print the ToneForge version |

## Options

- \`--help\`, \`-h\` — Show this help message
- \`--version\`, \`-V\` — Print the ToneForge version
- \`--json\` — Output results in JSON format for machine consumption

Run \`toneforge <command> --help\` for command-specific help.`;
  await outputMarkdown(md);
}

/** Print help text for the generate command. */
async function printGenerateHelp(): Promise<void> {
  const recipes = registry.list();
  const md = `# ToneForge generate

**Render and export procedural sounds**

## Usage

\`\`\`
toneforge generate --recipe <name> [--seed <number>] [--output <path.wav>]
toneforge generate --recipe <name> --seed-range <start>:<end> --output <directory/>
\`\`\`

## Options

- \`--recipe <name>\` — Name of the recipe to generate *(required)*
- \`--seed <number>\` — Integer seed for deterministic generation (default: random)
- \`--seed-range <start:end>\` — Generate one WAV per seed in the inclusive range
- \`--output <path>\` — Write WAV file to path instead of playing audio. Use a \`.wav\` path for single file, or a directory (trailing \`/\`) for batch output with \`--seed-range\`
- \`--json\` — Output results in JSON format
- \`--profile\` — Print phase-by-phase timing breakdown to stderr
- \`--help\`, \`-h\` — Show this help message

## Available recipes

${recipes.length > 0 ? recipes.map((r) => `- \`${r}\``).join("\n") : "*(none registered)*"}

## Examples

\`\`\`
toneforge generate --recipe ui-scifi-confirm --seed 42
toneforge generate --recipe ui-scifi-confirm --seed 42 --output ./my-sound.wav
toneforge generate --recipe weapon-laser-zap --seed-range 1:10 --output ./lasers/
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the analyze command. */
async function printAnalyzeHelp(): Promise<void> {
  const recipes = registry.list();
  const md = `# ToneForge analyze

**Analyze audio files and extract structured metrics**

## Usage

\`\`\`
toneforge analyze --input <file.wav>
toneforge analyze --recipe <name> --seed <number>
toneforge analyze --input <directory> --output <dir>
toneforge analyze --input <directory> --format table
\`\`\`

## Options

- \`--input <path>\` — Path to a WAV file or directory of WAV files
- \`--recipe <name>\` — Recipe name for direct analysis (renders internally)
- \`--seed <number>\` — Seed for recipe rendering (used with \`--recipe\`)
- \`--output <dir>\` — Write one JSON file per input WAV to this directory (batch mode)
- \`--format <json|table>\` — Output format. Default is human-readable for single files, \`table\` for directories
- \`--json\` — Output structured JSON to stdout
- \`--help\`, \`-h\` — Show this help message

## Metrics

| Category | Metrics |
|----------|---------|
| **time** | duration, peak, rms, crestFactor |
| **quality** | clipping, silence |
| **envelope** | attackTime |
| **spectral** | spectralCentroid |

## Available recipes

${recipes.length > 0 ? recipes.map((r) => `- \`${r}\``).join("\n") : "*(none registered)*"}

## Examples

\`\`\`
toneforge analyze --input ./renders/weapon-laser-zap_seed-001.wav
toneforge analyze --recipe weapon-laser-zap --seed 42
toneforge analyze --input ./renders/ --format table
toneforge analyze --input ./renders/ --output ./analysis/
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the classify command. */
async function printClassifyHelp(): Promise<void> {
  const recipes = registry.list();
  const md = `# ToneForge classify

**Assign semantic labels to analyzed sounds**

## Usage

\`\`\`
toneforge classify --analysis <dir> --output <dir>
toneforge classify --input <path>
toneforge classify --recipe <name> --seed <number>
toneforge classify search --category <c> [--intensity <i>] [--texture <t>] [--dir <path>]
\`\`\`

## Modes

- **Batch from analysis** — Classify pre-analyzed JSON files in a directory
- **WAV end-to-end** — Analyze and classify WAV file(s) in one step
- **Recipe+seed** — Render, analyze, and classify a recipe directly
- **Search** — Find classified sounds by category, intensity, or texture

## Options

- \`--analysis <dir>\` — Directory of analysis JSON files to classify
- \`--input <path>\` — Path to a WAV file or directory of WAV files
- \`--recipe <name>\` — Recipe name for direct classification (renders internally)
- \`--seed <number>\` — Seed for recipe rendering (used with \`--recipe\`)
- \`--output <dir>\` — Write classification JSON files to this directory
- \`--format <json|table>\` — Output format (default: table for batch, json for single)
- \`--json\` — Output structured JSON to stdout
- \`--help\`, \`-h\` — Show this help message

## Search Options

- \`--category <c>\` — Filter by category (e.g. weapon, footstep, ui)
- \`--intensity <i>\` — Filter by intensity (soft, medium, hard, aggressive, subtle)
- \`--texture <t>\` — Filter by texture (sharp, bright, warm, dark, smooth, etc.)
- \`--dir <path>\` — Directory of classification JSON files (default: ./classification/)

## Classification Dimensions

| Dimension | Values |
|-----------|--------|
| **category** | weapon, footstep, ui, ambient, character, impact, creature, vehicle |
| **intensity** | soft, medium, hard, aggressive, subtle |
| **texture** | crunchy, smooth, noisy, tonal, harsh, warm, bright, dark, sharp |
| **material** | metal, wood, stone, organic, synthetic, energy, mechanical, magical |
| **tags** | Contextual use-case tags derived from category and recipe |

## Available recipes

${recipes.length > 0 ? recipes.map((r) => `- \`${r}\``).join("\n") : "*(none registered)*"}

## Examples

\`\`\`
toneforge classify --analysis ./analysis/ --output ./classification/
toneforge classify --input ./renders/weapon-laser-zap_seed-001.wav
toneforge classify --recipe weapon-laser-zap --seed 42
toneforge classify search --category weapon --dir ./classification/
toneforge classify search --intensity aggressive --texture sharp
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the list command. */
async function printListHelp(): Promise<void> {
  const md = `# ToneForge list

**List available resources**

## Usage

\`toneforge list [resource]\`

## Resources

- **recipes** — List all registered recipes with a one-line summary *(default)*

## Options

- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge list
toneforge list recipes
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the play command. */
async function printPlayHelp(): Promise<void> {
  const md = `# ToneForge play

**Play a WAV file through the system audio player**

## Usage

\`toneforge play <file.wav>\`

## Arguments

- \`<file.wav>\` — Path to a WAV file to play *(required)*

## Options

- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge play ./output/confirm.wav
toneforge play ./output/lasers/weapon-laser-zap-seed-1.wav
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the stack command. */
async function printStackHelp(): Promise<void> {
  const md = `# ToneForge stack

**Compose layered sound events from multiple recipes**

## Usage

\`toneforge stack <subcommand> [options]\`

## Subcommands

| Subcommand | Description |
|------------|-------------|
| **render** | Render a layered stack to a WAV file or play it directly |
| **inspect** | Display the layer structure of a preset |

Run \`toneforge stack <subcommand> --help\` for subcommand-specific help.`;
  await outputMarkdown(md);
}

/** Print help text for the stack render subcommand. */
async function printStackRenderHelp(): Promise<void> {
  const md = `# ToneForge stack render

**Render a layered stack to a WAV file or play it directly**

## Usage

\`\`\`
toneforge stack render --preset <file> --seed <number> [--output <path.wav>]
toneforge stack render --layer <spec> [--layer <spec>...] --seed <number> [--output <path.wav>]
\`\`\`

## Options

- \`--preset <file>\` — Path to a JSON preset file
- \`--layer <spec>\` — Inline layer specification (repeatable). Format: \`recipe=<name>,offset=<time>,gain=<value>\`
- \`--seed <number>\` — Integer seed for deterministic generation *(required)*
- \`--output <path.wav>\` — Output WAV file path. When omitted, audio is played directly
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Layer Specification Format

\`recipe=<name>,offset=<time>,gain=<value>,duration=<time>\`

- \`recipe\` — Recipe name *(required)*
- \`offset\` — Start time offset (default: 0). Supports \`ms\` and \`s\` suffixes; bare number = seconds
- \`gain\` — Gain multiplier (default: 1.0)
- \`duration\` — Duration override. Supports \`ms\` and \`s\` suffixes; bare number = seconds

## Examples

\`\`\`
toneforge stack render --preset presets/explosion_heavy.json --seed 42
toneforge stack render --preset presets/explosion_heavy.json --seed 42 --output ./explosion.wav
toneforge stack render \\
  --layer "recipe=impact-crack,offset=0ms,gain=0.9" \\
  --layer "recipe=rumble-body,offset=5ms,gain=0.7" \\
  --seed 42
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the stack inspect subcommand. */
async function printStackInspectHelp(): Promise<void> {
  const md = `# ToneForge stack inspect

**Display the layer structure of a preset**

## Usage

\`toneforge stack inspect --preset <file>\`

## Options

- \`--preset <file>\` — Path to a JSON preset file *(required)*
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge stack inspect --preset presets/explosion_heavy.json
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the sequence command. */
async function printSequenceHelp(): Promise<void> {
  const md = `# ToneForge sequence

**Schedule and render temporal event patterns from presets**

## Usage

\`toneforge sequence <subcommand> [options]\`

## Subcommands

| Subcommand | Description |
|------------|-------------|
| **generate** | Render a sequence preset to a WAV file or play it directly |
| **simulate** | Produce a deterministic JSON timeline from a preset |
| **inspect** | Display sequence structure and validate a preset |

Run \`toneforge sequence <subcommand> --help\` for subcommand-specific help.`;
  await outputMarkdown(md);
}

/** Print help text for the sequence generate subcommand. */
async function printSequenceGenerateHelp(): Promise<void> {
  const md = `# ToneForge sequence generate

**Render a sequence preset to a WAV file or play it directly**

## Usage

\`\`\`
toneforge sequence generate --preset <file> --seed <number> [--output <path.wav>]
\`\`\`

## Options

- \`--preset <file>\` — Path to a JSON sequence preset file *(required)*
- \`--seed <number>\` — Integer seed for deterministic generation *(required)*
- \`--duration <seconds>\` — Maximum duration in seconds (default: determined by preset)
- \`--output <path.wav>\` — Output WAV file path. When omitted, audio is played directly
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge sequence generate --preset presets/sequences/weapon_burst.json --seed 42
toneforge sequence generate --preset presets/sequences/gameover_melody.json --seed 42 --output melody.wav
toneforge sequence generate --preset presets/sequences/rhythmic_sting.json --seed 42 --duration 5
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the sequence simulate subcommand. */
async function printSequenceSimulateHelp(): Promise<void> {
  const md = `# ToneForge sequence simulate

**Produce a deterministic JSON timeline from a sequence preset**

## Usage

\`\`\`
toneforge sequence simulate --preset <file> [--seed <number>] [--duration <seconds>]
\`\`\`

## Options

- \`--preset <file>\` — Path to a JSON sequence preset file *(required)*
- \`--seed <number>\` — Integer seed for deterministic simulation (default: 42)
- \`--duration <seconds>\` — Maximum duration in seconds
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge sequence simulate --preset presets/sequences/weapon_burst.json --seed 42
toneforge sequence simulate --preset presets/sequences/weapon_burst.json --seed 42 --json
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the sequence inspect subcommand. */
async function printSequenceInspectHelp(): Promise<void> {
  const md = `# ToneForge sequence inspect

**Display sequence structure and validate a preset**

## Usage

\`\`\`
toneforge sequence inspect --preset <file> [--validate]
\`\`\`

## Options

- \`--preset <file>\` — Path to a JSON sequence preset file *(required)*
- \`--validate\` — Show detailed validation errors with field-level info
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge sequence inspect --preset presets/sequences/weapon_burst.json
toneforge sequence inspect --preset presets/sequences/weapon_burst.json --validate
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the show command. */
async function printShowHelp(): Promise<void> {
  const recipes = registry.list();
  const md = `# ToneForge show

**Display recipe metadata and parameters**

## Usage

\`toneforge show <recipe-name> [--seed <number>]\`

## Arguments

- \`<recipe-name>\` — Name of the recipe to inspect *(required)*

## Options

- \`--seed <number>\` — Show seed-specific parameter values alongside ranges
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Available recipes

${recipes.length > 0 ? recipes.map((r) => `- \`${r}\``).join("\n") : "*(none registered)*"}

## Examples

\`\`\`
toneforge show ui-scifi-confirm
toneforge show weapon-laser-zap --seed 42
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the explore command. */
async function printExploreHelp(): Promise<void> {
  const md = `# ToneForge explore

**Discover, rank, and curate sounds across seed spaces**

## Usage

\`toneforge explore <subcommand> [options]\`

## Subcommands

| Subcommand | Description |
|------------|-------------|
| **sweep** | Sweep a seed range and rank results by metrics |
| **mutate** | Generate variations around a base seed |
| **promote** | Promote a candidate to the library |
| **show** | Show details of a completed exploration run |
| **runs** | List completed exploration runs |

The \`show\` and \`promote\` subcommands accept \`--run <run-id>\` or \`--latest\` to select a run.

Run \`toneforge explore <subcommand> --help\` for subcommand-specific help.`;
  await outputMarkdown(md);
}

/** Print help text for the explore sweep subcommand. */
async function printExploreSweepHelp(): Promise<void> {
  const recipes = registry.list();
  const md = `# ToneForge explore sweep

**Sweep a seed range and rank results by analysis metrics**

## Usage

\`\`\`
toneforge explore sweep --recipe <name> [options]
\`\`\`

## Options

- \`--recipe <name>\` — Recipe to explore *(required)*
- \`--seed-range <start>:<end>\` — Seed range to sweep (default: 0:99)
- \`--keep-top <N>\` — Keep top N results after ranking (default: 10)
- \`--rank-by <metric,...>\` — Comma-separated metrics: transient-density, spectral-centroid, rms, attack-time (default: rms)
- \`--clusters <N>\` — Number of clusters, 1-8 (default: 3)
- \`--concurrency <N>\` — Max parallel renders (default: auto)
- \`--output <dir>\` — Export top results as WAV files to directory
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Available recipes

${recipes.length > 0 ? recipes.map((r) => `- \`${r}\``).join("\n") : "*(none registered)*"}

## Examples

\`\`\`
toneforge explore sweep --recipe creature-vocal --seed-range 0:999 --keep-top 20 --rank-by rms,spectral-centroid
toneforge explore sweep --recipe weapon-laser-zap --seed-range 0:5000 --rank-by transient-density --clusters 5
toneforge explore sweep --recipe footstep-gravel --keep-top 50 --output ./top-footsteps/ --json
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the explore mutate subcommand. */
async function printExploreMutateHelp(): Promise<void> {
  const md = `# ToneForge explore mutate

**Generate variations around a base seed**

## Usage

\`\`\`
toneforge explore mutate --recipe <name> --seed <N> [options]
\`\`\`

## Options

- \`--recipe <name>\` — Recipe to explore *(required)*
- \`--seed <N>\` — Base seed to generate variations from *(required)*
- \`--jitter <0-1>\` — Jitter factor controlling parameter variance (default: 0.1)
- \`--count <N>\` — Number of variations to generate (default: 20)
- \`--rank-by <metric,...>\` — Comma-separated ranking metrics (default: rms)
- \`--concurrency <N>\` — Max parallel renders (default: auto)
- \`--output <dir>\` — Export results as WAV files to directory
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge explore mutate --recipe creature-vocal --seed 4821 --jitter 0.1 --count 20
toneforge explore mutate --recipe weapon-laser-zap --seed 42 --count 50 --rank-by transient-density --json
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the explore promote subcommand. */
async function printExplorePromoteHelp(): Promise<void> {
  const md = `# ToneForge explore promote

**Promote a candidate to the library**

## Usage

\`\`\`
toneforge explore promote --run <run-id> --id <candidate-id> [options]
toneforge explore promote --latest --id <candidate-id> [options]
\`\`\`

## Options

- \`--run <run-id>\` — Exploration run ID *(required unless --latest)*
- \`--latest\` — Use the most recent exploration run *(required unless --run)*
- \`--id <candidate-id>\` — Candidate ID to promote *(required)*
- \`--category <category>\` — Override the classification-derived category
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge explore promote --run run-abc123 --id creature-vocal_seed-04821
toneforge explore promote --latest --id creature-vocal_seed-04821
toneforge explore promote --latest --id creature-vocal_seed-04821 --category weapon --json
\`\`\``;
  await outputMarkdown(md);
}

/** Print help text for the library command group. */
async function printLibraryHelp(): Promise<void> {
  const md = `# ToneForge library

**Manage the curated sound library**

Browse, search, discover similar sounds, export WAVs, and regenerate entries from stored presets.

## Subcommands

| Subcommand | Description |
|------------|-------------|
| **list** | List all library entries, optionally filtered by category |
| **search** | Search entries by attributes (intensity, texture, tags, category) |
| **similar** | Find entries similar to a given entry |
| **export** | Export library entries as WAV files by category |
| **regenerate** | Re-render an entry from its stored preset |

## Usage

\`\`\`
toneforge library list [--category <c>] [--json]
toneforge library search [--category <c>] [--intensity <i>] [--texture <t>] [--tags <t1,t2>] [--json]
toneforge library similar --id <id> [--limit <n>] [--json]
toneforge library export --output <dir> [--category <c>] --format wav [--json]
toneforge library regenerate --id <id> [--json]
\`\`\`

## Options

- \`--category <c>\` — Filter by category
- \`--intensity <i>\` — Filter by intensity (search only)
- \`--texture <t>\` — Filter by texture (search only)
- \`--tags <t1,t2>\` — Filter by tags, comma-separated (search only)
- \`--id <id>\` — Library entry ID (similar, regenerate)
- \`--limit <n>\` — Max results for similarity search (default: 10)
- \`--output <dir>\` — Output directory for export
- \`--format wav\` — Export format (currently only wav)
- \`--json\` — Output results in JSON format
- \`--help\`, \`-h\` — Show this help message

## Examples

\`\`\`
toneforge library list
toneforge library list --category weapon --json
toneforge library search --intensity high --tags hit,impact
toneforge library similar --id lib-impact-crack_seed-00042 --limit 5
toneforge library export --output ./export --category creature --format wav
toneforge library regenerate --id lib-creature-vocal_seed-04821 --json
\`\`\``;
  await outputMarkdown(md);
}

/**
 * Compute the Levenshtein edit distance between two strings.
 * Used for fuzzy recipe name matching when a recipe is not found.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }

  return dp[m]![n]!;
}

/**
 * Suggest the closest matching recipe names for a given input.
 * Returns up to 3 suggestions sorted by edit distance.
 */
function suggestRecipes(input: string, names: string[]): string[] {
  return names
    .map((name) => ({ name, dist: levenshtein(input, name) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((s) => s.name);
}

/**
 * Format the `tf show` output as raw markdown.
 */
function formatShowOutput(
  name: string,
  reg: RecipeRegistration,
  seed?: number,
): string {
  const lines: string[] = [];

  // Title
  if (seed !== undefined) {
    lines.push(`# ${name} (seed: ${seed})`);
  } else {
    lines.push(`# ${name}`);
  }
  lines.push("");

  // Category & description
  lines.push(`**Category:** ${reg.category}`);
  lines.push(`**Description:** ${reg.description}`);
  lines.push("");

  // Signal chain
  lines.push("## Signal Chain");
  lines.push("");
  lines.push(reg.signalChain);
  lines.push("");

  // Parameters table
  lines.push("## Parameters");
  lines.push("");

  // Get seed-specific values if seed is provided
  let seedValues: Record<string, number> | undefined;
  if (seed !== undefined) {
    const rng = createRng(seed);
    seedValues = reg.getParams(rng);
  }

  if (seedValues) {
    // With seed: add Value column
    lines.push("| Parameter | Min | Max | Value | Unit |");
    lines.push("|-----------|-----|-----|-------|------|");
    for (const p of reg.params) {
      const value = seedValues[p.name];
      const valueStr = value !== undefined ? formatNumber(value) : "-";
      lines.push(`| ${p.name} | ${formatNumber(p.min)} | ${formatNumber(p.max)} | ${valueStr} | ${p.unit} |`);
    }
  } else {
    // Without seed: no Value column
    lines.push("| Parameter | Min | Max | Unit |");
    lines.push("|-----------|-----|-----|------|");
    for (const p of reg.params) {
      lines.push(`| ${p.name} | ${formatNumber(p.min)} | ${formatNumber(p.max)} | ${p.unit} |`);
    }
  }
  lines.push("");

  // Duration
  lines.push("## Duration");
  lines.push("");

  // Compute min/max duration by using the param min/max ranges
  // We need to compute duration from the registration's getDuration with actual seeds
  // Instead, we can compute duration range from the param extremes
  // But getDuration depends on the RNG, so we sample a range of seeds to estimate
  const durationSamples: number[] = [];
  for (let s = 0; s < 100; s++) {
    const rng = createRng(s);
    durationSamples.push(reg.getDuration(rng));
  }
  const minDuration = Math.min(...durationSamples);
  const maxDuration = Math.max(...durationSamples);

  if (seed !== undefined) {
    const rng = createRng(seed);
    const seedDuration = reg.getDuration(rng);
    lines.push(`${formatNumber(seedDuration)}s (seed ${seed}) | Range: ${formatNumber(minDuration)}s - ${formatNumber(maxDuration)}s`);
  } else {
    lines.push(`${formatNumber(minDuration)}s - ${formatNumber(maxDuration)}s`);
  }

  return lines.join("\n");
}

/**
 * Format the `tf show` output as a JSON-serializable object.
 */
function formatShowJson(
  name: string,
  reg: RecipeRegistration,
  seed?: number,
): Record<string, unknown> {
  // Get seed-specific values if seed is provided
  let seedValues: Record<string, number> | undefined;
  if (seed !== undefined) {
    const rng = createRng(seed);
    seedValues = reg.getParams(rng);
  }

  // Build params array
  const params = reg.params.map((p) => {
    const param: Record<string, unknown> = {
      name: p.name,
      min: p.min,
      max: p.max,
      unit: p.unit,
    };
    if (seedValues) {
      param.value = seedValues[p.name];
    }
    return param;
  });

  // Compute duration range by sampling seeds
  const durationSamples: number[] = [];
  for (let s = 0; s < 100; s++) {
    const rng = createRng(s);
    durationSamples.push(reg.getDuration(rng));
  }
  const minDuration = Math.min(...durationSamples);
  const maxDuration = Math.max(...durationSamples);

  const duration: Record<string, unknown> = {
    min: minDuration,
    max: maxDuration,
  };
  if (seed !== undefined) {
    const rng = createRng(seed);
    duration.value = reg.getDuration(rng);
    duration.seed = seed;
  }

  const result: Record<string, unknown> = {
    command: "show",
    recipe: name,
    category: reg.category,
    description: reg.description,
    tags: reg.tags ?? [],
    signalChain: reg.signalChain,
    params,
    duration,
  };

  if (seed !== undefined) {
    result.seed = seed;
  }

  return result;
}

/**
 * Format a number for display: remove trailing zeros after decimal point,
 * but keep enough precision to be informative.
 */
function formatNumber(n: number): string {
  // Use up to 4 decimal places, then strip trailing zeros
  const s = n.toFixed(4);
  // Remove trailing zeros after decimal point
  if (s.includes(".")) {
    return s.replace(/0+$/, "").replace(/\.$/, "");
  }
  return s;
}

/**
 * Output a JSON object to stdout. Used by all commands when --json is active.
 */
function jsonOut(data: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(data) + "\n");
}

/**
 * Output a JSON error object to stderr. Used when --json is active and an error occurs.
 */
function jsonErr(message: string): void {
  process.stderr.write(JSON.stringify({ error: message }) + "\n");
}

/**
 * Format an analysis result as human-readable styled output.
 */
function formatAnalysisHumanReadable(result: AnalysisResult, label: string): void {
  outputInfo(`Analysis: ${label}`);
  outputInfo(`  Version: ${result.analysisVersion}`);
  outputInfo(`  Sample Rate: ${result.sampleRate} Hz`);
  outputInfo(`  Samples: ${result.sampleCount}`);

  for (const [category, metrics] of Object.entries(result.metrics)) {
    outputInfo(`  [${category}]`);
    for (const [key, value] of Object.entries(metrics)) {
      const display = value === null ? "N/A" : String(value);
      outputInfo(`    ${key}: ${display}`);
    }
  }
}

/**
 * Format batch analysis results as a summary table.
 */
function formatAnalysisBatchTable(
  results: Array<{ file: string; result: AnalysisResult }>,
): void {
  // Build table rows: filename, duration, peak, rms, crestFactor, spectralCentroid, flags
  const rows = results.map((r) => {
    const time = r.result.metrics["time"] ?? {};
    const quality = r.result.metrics["quality"] ?? {};
    const spectral = r.result.metrics["spectral"] ?? {};

    const duration = typeof time["duration"] === "number" ? time["duration"].toFixed(3) : "—";
    const peak = typeof time["peak"] === "number" ? time["peak"].toFixed(4) : "—";
    const rms = typeof time["rms"] === "number" ? time["rms"].toFixed(4) : "—";
    const crest = typeof time["crestFactor"] === "number"
      ? (Number.isFinite(time["crestFactor"]) ? (time["crestFactor"] as number).toFixed(2) : "Inf")
      : "—";
    const centroid = typeof spectral["spectralCentroid"] === "number"
      ? (spectral["spectralCentroid"] as number).toFixed(0)
      : "—";

    const flags: string[] = [];
    if (quality["clipping"] === true) flags.push("!clip");
    if (quality["silence"] === true) flags.push("!silent");
    const flagStr = flags.length > 0 ? flags.join(" ") : "ok";

    return [r.file, duration, peak, rms, crest, centroid, flagStr];
  });

  // Compute column widths
  const maxFile = Math.max(4, ...rows.map((r) => r[0]!.length));
  outputTable(
    [
      { header: "File", width: Math.min(maxFile, 40) },
      { header: "Dur(s)", width: 7 },
      { header: "Peak", width: 7 },
      { header: "RMS", width: 7 },
      { header: "Crest", width: 7 },
      { header: "Centroid", width: 9 },
      { header: "Flags", width: 10 },
    ],
    rows,
  );
}

/**
 * Format a single classification result as human-readable styled output.
 */
function formatClassificationHumanReadable(result: ClassificationResult): void {
  outputInfo(`Classification: ${result.source}`);
  outputInfo(`  Category:  ${result.category || "(none)"}`);
  outputInfo(`  Intensity: ${result.intensity || "(none)"}`);
  outputInfo(`  Texture:   ${result.texture.length > 0 ? result.texture.join(", ") : "(none)"}`);
  outputInfo(`  Material:  ${result.material ?? "(none)"}`);
  outputInfo(`  Tags:      ${result.tags.length > 0 ? result.tags.join(", ") : "(none)"}`);
  outputInfo(`  Ref:       ${result.analysisRef}`);
}

/**
 * Format batch classification results as a summary table.
 */
function formatClassificationBatchTable(
  results: Array<{ file: string; result: ClassificationResult }>,
): void {
  const rows = results.map((r) => {
    const source = r.result.source || r.file;
    const category = r.result.category || "—";
    const intensity = r.result.intensity || "—";
    const texture = r.result.texture.length > 0 ? r.result.texture.join(", ") : "—";
    const material = r.result.material ?? "—";
    const tags = r.result.tags.length > 0 ? r.result.tags.join(", ") : "—";
    return [source, category, intensity, texture, material, tags];
  });

  const maxSource = Math.max(6, ...rows.map((r) => r[0]!.length));
  const maxTexture = Math.max(7, ...rows.map((r) => r[3]!.length));
  const maxTags = Math.max(4, ...rows.map((r) => r[5]!.length));

  outputTable(
    [
      { header: "Source", width: Math.min(maxSource, 40) },
      { header: "Category", width: 10 },
      { header: "Intensity", width: 10 },
      { header: "Texture", width: Math.min(maxTexture, 25) },
      { header: "Material", width: 10 },
      { header: "Tags", width: Math.min(maxTags, 30) },
    ],
    rows,
  );
}

/** Main CLI entry point. Exported for testability. */
export async function main(argv: string[] = process.argv): Promise<number> {
  const { command, subcommand, flags, layers } = parseArgs(argv);
  const jsonMode = flags["json"] === true;

  // Enable profiling when --profile flag is set
  if (flags["profile"] === true) {
    profiler.enable();
  }
  profiler.mark("module_load");
  profiler.mark("cli_parse");

  // --version flag or `version` command
  if (flags["version"] || command === "version") {
    if (jsonMode) {
      jsonOut({ command: "version", version: VERSION });
    } else {
      outputInfo(`ToneForge v${VERSION}`);
    }
    return 0;
  }

  // Top-level help
  if (flags["help"] || command === undefined) {
    if (command === "generate") {
      await printGenerateHelp();
    } else if (command === "stack") {
      if (subcommand === "render") {
        await printStackRenderHelp();
      } else if (subcommand === "inspect") {
        await printStackInspectHelp();
      } else {
        await printStackHelp();
      }
    } else if (command === "show") {
      await printShowHelp();
    } else if (command === "list") {
      await printListHelp();
    } else if (command === "play") {
      await printPlayHelp();
    } else if (command === "analyze") {
      await printAnalyzeHelp();
    } else if (command === "classify") {
      await printClassifyHelp();
    } else if (command === "explore") {
      if (subcommand === "sweep") {
        await printExploreSweepHelp();
      } else if (subcommand === "mutate") {
        await printExploreMutateHelp();
      } else if (subcommand === "promote") {
        await printExplorePromoteHelp();
      } else {
        await printExploreHelp();
      }
    } else if (command === "library") {
      await printLibraryHelp();
    } else if (command === "sequence") {
      if (subcommand === "generate") {
        await printSequenceGenerateHelp();
      } else if (subcommand === "simulate") {
        await printSequenceSimulateHelp();
      } else if (subcommand === "inspect") {
        await printSequenceInspectHelp();
      } else {
        await printSequenceHelp();
      }
    } else {
      await printHelp();
    }
    return command === undefined && !flags["help"] ? 1 : 0;
  }

  if (command === "list") {
    if (flags["help"]) {
      await printListHelp();
      return 0;
    }

    if (subcommand !== "recipes" && subcommand !== undefined) {
      if (jsonMode) {
        jsonErr(`Unknown resource '${subcommand}'. Run 'toneforge list --help' for usage.`);
      } else {
        outputError(`Error: Unknown resource '${subcommand}'. Run 'toneforge list --help' for usage.`);
      }
      return 1;
    }

    const recipes = registry.listSummaries();
    if (jsonMode) {
      jsonOut({ command: "list", resource: "recipes", recipes });
    } else {
      const TABLE_WIDTH = 76;
      // Table row overhead: "| " + col1 + " | " + col2 + " |" = 7 chars
      const nameCol = Math.max(...recipes.map((r) => r.name.length));
      const descCol = TABLE_WIDTH - nameCol - 7;

      outputTable(
        [
          { header: "Recipe", width: nameCol },
          { header: "Description", width: descCol },
        ],
        recipes.map((r) => [r.name, r.description || "\u2014"]),
      );
    }
    return 0;
  }

  if (command === "show") {
    if (flags["help"]) {
      await printShowHelp();
      return 0;
    }

    if (subcommand === undefined) {
      if (jsonMode) {
        jsonErr("'show' requires a recipe name. Run 'toneforge show --help' for usage.");
      } else {
        outputError("Error: 'show' requires a recipe name. Run 'toneforge show --help' for usage.");
      }
      return 1;
    }

    const recipeName = subcommand;
    const reg = registry.getRegistration(recipeName);

    if (!reg) {
      const allNames = registry.list();
      const suggestions = suggestRecipes(recipeName, allNames);
      let msg = `Unknown recipe '${recipeName}'.`;
      if (suggestions.length > 0) {
        msg += ` Did you mean: ${suggestions.join(", ")}?`;
      }
      if (jsonMode) {
        jsonErr(msg);
      } else {
        outputError(`Error: Unknown recipe '${recipeName}'.`);
        if (suggestions.length > 0) {
          outputWarning(`Did you mean: ${suggestions.join(", ")}?`);
        }
      }
      return 1;
    }

    // Parse optional --seed flag
    let seed: number | undefined;
    if (flags["seed"] !== undefined && flags["seed"] !== true) {
      seed = parseInt(flags["seed"] as string, 10);
      if (Number.isNaN(seed)) {
        if (jsonMode) {
          jsonErr(`--seed must be an integer, got '${flags["seed"]}'.`);
        } else {
          outputError(`Error: --seed must be an integer, got '${flags["seed"]}'.`);
        }
        return 1;
      }
    } else if (flags["seed"] === true) {
      if (jsonMode) {
        jsonErr("--seed requires a value. Usage: toneforge show <recipe> --seed <number>");
      } else {
        outputError("Error: --seed requires a value. Usage: toneforge show <recipe> --seed <number>");
      }
      return 1;
    }

    if (jsonMode) {
      const jsonResult = formatShowJson(recipeName, reg, seed);
      jsonOut(jsonResult);
    } else {
      const output = formatShowOutput(recipeName, reg, seed);
      await outputMarkdown(output);
    }
    return 0;
  }

  if (command === "play") {
    if (flags["help"]) {
      await printPlayHelp();
      return 0;
    }

    if (subcommand === undefined) {
      if (jsonMode) {
        jsonErr("'play' requires a WAV file path. Run 'toneforge play --help' for usage.");
      } else {
        outputError("Error: 'play' requires a WAV file path. Run 'toneforge play --help' for usage.");
      }
      return 1;
    }

    const filePath = resolve(subcommand);

    if (!existsSync(filePath)) {
      if (jsonMode) {
        jsonErr(`File not found: ${subcommand}`);
      } else {
        outputError(`Error: File not found: ${subcommand}`);
      }
      return 1;
    }

    try {
      if (!jsonMode) {
        outputInfo(`Playing ${subcommand}`);
      }
      const { command: playerCmd, args } = getPlayerCommand(filePath);

      await new Promise<void>((resolvePromise, reject) => {
        execFile(playerCmd, args, (error) => {
          if (error) {
            reject(
              new Error(`Audio playback failed (${playerCmd}): ${error.message}`),
            );
          } else {
            resolvePromise();
          }
        });
      });

      if (jsonMode) {
        jsonOut({ command: "play", file: subcommand });
      }
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (jsonMode) {
        jsonErr(message);
      } else {
        outputError(`Error: ${message}`);
      }
      return 1;
    }
  }

  // ── stack command ────────────────────────────────────────────────

  if (command === "stack") {
    // Stack subcommand help
    if (flags["help"] && subcommand === undefined) {
      await printStackHelp();
      return 0;
    }

    if (subcommand === "render") {
      if (flags["help"]) {
        await printStackRenderHelp();
        return 0;
      }

      // Require --seed
      const seedRaw = flags["seed"];
      if (seedRaw === undefined || seedRaw === true) {
        const msg = "--seed is required for stack render. Run 'toneforge stack render --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }
      const seed = parseInt(seedRaw as string, 10);
      if (Number.isNaN(seed)) {
        const msg = `--seed must be an integer, got '${seedRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // --output is optional: when omitted, audio is played instead of saved
      const outputPath = typeof flags["output"] === "string" ? flags["output"] : undefined;

      // Require either --preset or --layer
      const presetPath = typeof flags["preset"] === "string" ? flags["preset"] : undefined;
      if (presetPath === undefined && layers.length === 0) {
        const msg = "Either --preset or at least one --layer is required. Run 'toneforge stack render --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        let definition: StackDefinition;

        if (presetPath !== undefined) {
          definition = await loadPreset(presetPath);
          // If --layer flags are also present, append them to the preset layers
          if (layers.length > 0) {
            const inlineDef = parseLayers(layers);
            definition = {
              ...definition,
              layers: [...definition.layers, ...inlineDef.layers],
            };
          }
        } else {
          definition = parseLayers(layers);
        }

        if (!jsonMode) {
          outputInfo(
            `Rendering stack '${definition.name || "inline"}' (${definition.layers.length} layers) with seed ${seed}...`,
          );
        }

        const startMs = performance.now();
        const result = await renderStack(definition, seed);
        const renderMs = (performance.now() - startMs).toFixed(0);

        if (!jsonMode) {
          outputInfo(
            `Rendered ${result.duration.toFixed(3)}s of audio ` +
            `(${result.sampleRate} Hz, ${result.samples.length} samples) ` +
            `in ${renderMs}ms`,
          );
        }

        if (outputPath !== undefined) {
          // Write WAV file
          await mkdir(dirname(resolve(outputPath)), { recursive: true });
          const wavBuffer = encodeWav(result.samples, { sampleRate: result.sampleRate });
          await writeFile(resolve(outputPath), wavBuffer);

          if (jsonMode) {
            jsonOut({
              command: "stack render",
              preset: presetPath || null,
              name: definition.name || "inline",
              layers: definition.layers.length,
              seed,
              output: outputPath,
              duration: result.duration,
              sampleRate: result.sampleRate,
              samples: result.samples.length,
            });
          } else {
            outputSuccess(`Wrote ${outputPath}`);
          }
        } else {
          // Play audio (default when --output is not specified)
          if (!jsonMode) {
            outputInfo("Playing...");
          }
      await playAudio(result.samples, { sampleRate: result.sampleRate });
      profiler.mark("playback_complete");
          if (jsonMode) {
            jsonOut({
              command: "stack render",
              preset: presetPath || null,
              name: definition.name || "inline",
              layers: definition.layers.length,
              seed,
              duration: result.duration,
              sampleRate: result.sampleRate,
              samples: result.samples.length,
              played: true,
            });
          } else {
            outputSuccess("Done.");
          }
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    if (subcommand === "inspect") {
      if (flags["help"]) {
        await printStackInspectHelp();
        return 0;
      }

      const presetPath = typeof flags["preset"] === "string" ? flags["preset"] : undefined;
      if (presetPath === undefined) {
        const msg = "--preset is required for stack inspect. Run 'toneforge stack inspect --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        const definition = await loadPreset(presetPath);

        // Compute estimated total duration using recipe getDuration with a default seed
        let estimatedDuration = 0;
        for (const layer of definition.layers) {
          const reg = registry.getRegistration(layer.recipe);
          if (reg) {
            const layerRng = createRng(42); // deterministic preview seed
            const recipeDuration = layer.duration ?? reg.getDuration(layerRng);
            const layerEnd = layer.startTime + recipeDuration;
            if (layerEnd > estimatedDuration) {
              estimatedDuration = layerEnd;
            }
          }
        }

        if (jsonMode) {
          jsonOut({
            command: "stack inspect",
            preset: presetPath,
            name: definition.name || "unnamed",
            layers: definition.layers.map((l, i) => ({
              index: i,
              recipe: l.recipe,
              startTime: l.startTime,
              gain: l.gain ?? 1.0,
              duration: l.duration ?? null,
            })),
            estimatedDuration,
          });
        } else {
          const name = definition.name || "unnamed";
          const layerCount = definition.layers.length;
          outputInfo(`Stack: ${name} (${layerCount} layer${layerCount !== 1 ? "s" : ""})`);

          for (let i = 0; i < definition.layers.length; i++) {
            const l = definition.layers[i]!;
            const offsetMs = Math.round(l.startTime * 1000);
            const gain = (l.gain ?? 1.0).toFixed(2);
            const recipePadded = l.recipe.padEnd(20);
            outputInfo(`  [${i}] ${recipePadded} offset: ${offsetMs}ms\tgain: ${gain}`);
          }

          outputInfo(`  Duration: ~${estimatedDuration.toFixed(3)}s (estimated, varies with seed)`);
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // Unknown stack subcommand
    if (subcommand !== undefined) {
      const msg = `Unknown stack subcommand '${subcommand}'. Run 'toneforge stack --help' for usage.`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    await printStackHelp();
    return 0;
  }

  // ── analyze command ─────────────────────────────────────────────

  if (command === "analyze") {
    if (flags["help"]) {
      await printAnalyzeHelp();
      return 0;
    }

    const inputPath = typeof flags["input"] === "string" ? flags["input"] : undefined;
    const recipeName = typeof flags["recipe"] === "string" ? flags["recipe"] : undefined;
    const seedRaw = flags["seed"];
    const formatFlag = typeof flags["format"] === "string" ? flags["format"] : undefined;
    const outputDir = typeof flags["output"] === "string" ? flags["output"] : undefined;

    // Validate --format value
    if (formatFlag !== undefined && formatFlag !== "json" && formatFlag !== "table") {
      const msg = `--format must be 'json' or 'table', got '${formatFlag}'.`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    // Mutual exclusion: --input and --recipe cannot both be specified
    if (inputPath !== undefined && recipeName !== undefined) {
      const msg = "--input and --recipe are mutually exclusive. Use one or the other.";
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    // Require at least one source
    if (inputPath === undefined && recipeName === undefined) {
      const msg = "Either --input or --recipe is required. Run 'toneforge analyze --help' for usage.";
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    // Create analysis engine with all built-in extractors
    const engine = createAnalysisEngine();
    registerBuiltinExtractors(engine);

    // ── Recipe+Seed mode ──────────────────────────────────────
    if (recipeName !== undefined) {
      // --seed is required for recipe mode
      if (seedRaw === undefined || seedRaw === true) {
        const msg = "--seed is required when using --recipe. Run 'toneforge analyze --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }
      const seed = parseInt(seedRaw as string, 10);
      if (Number.isNaN(seed)) {
        const msg = `--seed must be an integer, got '${seedRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Validate recipe exists
      if (!registry.getRegistration(recipeName)) {
        const allNames = registry.list();
        const suggestions = suggestRecipes(recipeName, allNames);
        let msg = `Unknown recipe '${recipeName}'.`;
        if (suggestions.length > 0) {
          msg += ` Did you mean: ${suggestions.join(", ")}?`;
        }
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        if (!jsonMode) {
          outputInfo(`Analyzing recipe '${recipeName}' with seed ${seed}...`);
        }

        const renderResult = await renderRecipe(recipeName, seed);
        const analysisResult = engine.analyze(renderResult.samples, renderResult.sampleRate);

        const output = {
          command: "analyze",
          source: { recipe: recipeName, seed },
          ...analysisResult,
        };

        if (jsonMode || formatFlag === "json") {
          jsonOut(output);
        } else {
          // Human-readable table for single result
          formatAnalysisHumanReadable(analysisResult, `${recipeName} (seed ${seed})`);
        }
        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // ── File/directory input mode ─────────────────────────────
    const resolvedInput = resolve(inputPath!);

    if (!existsSync(resolvedInput)) {
      const msg = `File not found: ${inputPath}`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    // Check if input is a directory
    const { statSync } = await import("node:fs");
    const inputStat = statSync(resolvedInput);

    if (inputStat.isDirectory()) {
      // ── Batch directory mode ──────────────────────────────
      const { readdirSync } = await import("node:fs");
      const entries = readdirSync(resolvedInput)
        .filter((f: string) => f.toLowerCase().endsWith(".wav"))
        .sort();

      if (entries.length === 0) {
        if (jsonMode) {
          jsonOut({ command: "analyze", input: inputPath, files: [], count: 0 });
        } else {
          outputInfo(`No .wav files found in ${inputPath}`);
        }
        return 0;
      }

      if (!jsonMode) {
        outputInfo(`Analyzing ${entries.length} WAV file${entries.length !== 1 ? "s" : ""} in ${inputPath}...`);
      }

      // If --output is specified, create the directory
      if (outputDir !== undefined) {
        await mkdir(resolve(outputDir), { recursive: true });
      }

      const batchResults: Array<{
        file: string;
        result: AnalysisResult;
      }> = [];

      for (const entry of entries) {
        const filePath = resolve(resolvedInput, entry);
        try {
          const wav = await decodeWavFile(filePath);
          const analysisResult = engine.analyze(wav.samples, wav.sampleRate);
          batchResults.push({ file: entry, result: analysisResult });

          // Write individual JSON file if --output is specified
          if (outputDir !== undefined) {
            const jsonFileName = entry.replace(/\.wav$/i, ".json");
            const jsonPath = resolve(outputDir, jsonFileName);
            const jsonContent = JSON.stringify(
              { command: "analyze", file: entry, ...analysisResult },
              null,
              2,
            );
            await writeFile(jsonPath, jsonContent);
            if (!jsonMode) {
              outputSuccess(`Wrote ${jsonPath}`);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (jsonMode) {
            jsonErr(`Failed to analyze '${entry}': ${message}`);
          } else {
            outputError(`Error: Failed to analyze '${entry}': ${message}`);
          }
          return 1;
        }
      }

      if (jsonMode || formatFlag === "json") {
        // JSON output
        jsonOut({
          command: "analyze",
          input: inputPath,
          count: batchResults.length,
          files: batchResults.map((r) => ({
            file: r.file,
            ...r.result,
          })),
        });
      } else {
        // Default: table output for batch (also covers --format table)
        formatAnalysisBatchTable(batchResults);
      }

      if (!jsonMode) {
        outputInfo(`Analyzed ${batchResults.length} file${batchResults.length !== 1 ? "s" : ""}`);
      }

      return 0;
    }

    // ── Single file mode ──────────────────────────────────────
    if (!resolvedInput.toLowerCase().endsWith(".wav")) {
      const msg = `Input file must be a .wav file, got '${inputPath}'.`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    try {
      if (!jsonMode) {
        outputInfo(`Analyzing ${inputPath}...`);
      }

      const wav = await decodeWavFile(resolvedInput);
      const analysisResult = engine.analyze(wav.samples, wav.sampleRate);

      const output = {
        command: "analyze",
        file: inputPath,
        ...analysisResult,
      };

      if (jsonMode || formatFlag === "json") {
        jsonOut(output);
      } else {
        formatAnalysisHumanReadable(analysisResult, inputPath!);
      }
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
      return 1;
    }
  }

  // ── classify command ────────────────────────────────────────────

  if (command === "classify") {
    if (flags["help"] && subcommand !== "search") {
      await printClassifyHelp();
      return 0;
    }

    const analysisDir = typeof flags["analysis"] === "string" ? flags["analysis"] : undefined;
    const inputPath = typeof flags["input"] === "string" ? flags["input"] : undefined;
    const recipeName = typeof flags["recipe"] === "string" ? flags["recipe"] : undefined;
    const seedRaw = flags["seed"];
    const formatFlag = typeof flags["format"] === "string" ? flags["format"] : undefined;
    const outputDir = typeof flags["output"] === "string" ? flags["output"] : undefined;

    // Validate --format value
    if (formatFlag !== undefined && formatFlag !== "json" && formatFlag !== "table") {
      const msg = `--format must be 'json' or 'table', got '${formatFlag}'.`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    // ── classify search subcommand ──────────────────────────────
    if (subcommand === "search") {
      if (flags["help"]) {
        await printClassifyHelp();
        return 0;
      }

      const categoryFilter = typeof flags["category"] === "string" ? flags["category"].toLowerCase() : undefined;
      const intensityFilter = typeof flags["intensity"] === "string" ? flags["intensity"].toLowerCase() : undefined;
      const textureFilter = typeof flags["texture"] === "string" ? flags["texture"].toLowerCase() : undefined;
      const searchDir = typeof flags["dir"] === "string" ? flags["dir"] : "./classification/";

      // At least one filter is required
      if (categoryFilter === undefined && intensityFilter === undefined && textureFilter === undefined) {
        const msg = "At least one filter is required: --category, --intensity, or --texture. Run 'toneforge classify --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      const resolvedSearchDir = resolve(searchDir);

      if (!existsSync(resolvedSearchDir)) {
        const msg = `Directory not found: ${searchDir}`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        const { readdirSync, readFileSync } = await import("node:fs");
        const entries = readdirSync(resolvedSearchDir)
          .filter((f: string) => f.toLowerCase().endsWith(".json"))
          .sort();

        if (entries.length === 0) {
          if (jsonMode) {
            jsonOut({ command: "classify search", dir: searchDir, matches: [], count: 0 });
          } else {
            outputInfo(`No classification JSON files found in ${searchDir}`);
          }
          return 0;
        }

        const matches: ClassificationResult[] = [];

        for (const entry of entries) {
          const filePath = resolve(resolvedSearchDir, entry);
          try {
            const raw = readFileSync(filePath, "utf-8");
            const data = JSON.parse(raw) as Record<string, unknown>;

            // Validate it looks like a classification result
            if (typeof data["category"] !== "string") continue;

            const result: ClassificationResult = {
              source: String(data["source"] ?? entry.replace(/\.json$/i, "")),
              category: String(data["category"] ?? ""),
              intensity: String(data["intensity"] ?? ""),
              texture: Array.isArray(data["texture"]) ? (data["texture"] as string[]) : [],
              material: typeof data["material"] === "string" ? data["material"] : null,
              tags: Array.isArray(data["tags"]) ? (data["tags"] as string[]) : [],
              embedding: Array.isArray(data["embedding"]) ? (data["embedding"] as number[]) : [],
              analysisRef: String(data["analysisRef"] ?? ""),
            };

            // Apply filters
            if (categoryFilter !== undefined && result.category.toLowerCase() !== categoryFilter) continue;
            if (intensityFilter !== undefined && result.intensity.toLowerCase() !== intensityFilter) continue;
            if (textureFilter !== undefined && !result.texture.some((t) => t.toLowerCase() === textureFilter)) continue;

            matches.push(result);
          } catch {
            // Skip files that cannot be parsed
            continue;
          }
        }

        if (jsonMode || formatFlag === "json") {
          jsonOut({
            command: "classify search",
            dir: searchDir,
            filters: {
              ...(categoryFilter !== undefined ? { category: categoryFilter } : {}),
              ...(intensityFilter !== undefined ? { intensity: intensityFilter } : {}),
              ...(textureFilter !== undefined ? { texture: textureFilter } : {}),
            },
            count: matches.length,
            matches,
          });
        } else if (matches.length === 0) {
          outputInfo("No matching classifications found.");
        } else {
          formatClassificationBatchTable(
            matches.map((m) => ({ file: m.source, result: m })),
          );
          outputInfo(`Found ${matches.length} match${matches.length !== 1 ? "es" : ""}`);
        }
        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // Mutual exclusion: only one source mode allowed
    const sourceCount = [analysisDir, inputPath, recipeName].filter((x) => x !== undefined).length;
    if (sourceCount > 1) {
      const msg = "--analysis, --input, and --recipe are mutually exclusive. Use one at a time.";
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }
    if (sourceCount === 0) {
      const msg = "A source is required: --analysis, --input, or --recipe. Run 'toneforge classify --help' for usage.";
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    // Create classification engine with all built-in classifiers
    const classifyEngine = createClassificationEngine();
    registerBuiltinClassifiers(classifyEngine);
    classifyEngine.setEmbeddingProvider(createAnalysisMetricsProvider());

    // ── Recipe+Seed mode ──────────────────────────────────────
    if (recipeName !== undefined) {
      if (seedRaw === undefined || seedRaw === true) {
        const msg = "--seed is required when using --recipe. Run 'toneforge classify --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }
      const seed = parseInt(seedRaw as string, 10);
      if (Number.isNaN(seed)) {
        const msg = `--seed must be an integer, got '${seedRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Validate recipe exists
      const reg = registry.getRegistration(recipeName);
      if (!reg) {
        const allNames = registry.list();
        const suggestions = suggestRecipes(recipeName, allNames);
        let msg = `Unknown recipe '${recipeName}'.`;
        if (suggestions.length > 0) {
          msg += ` Did you mean: ${suggestions.join(", ")}?`;
        }
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        if (!jsonMode) {
          outputInfo(`Classifying recipe '${recipeName}' with seed ${seed}...`);
        }

        // Render -> Analyze -> Classify
        const renderResult = await renderRecipe(recipeName, seed);
        const analysisEngine = createAnalysisEngine();
        registerBuiltinExtractors(analysisEngine);
        const analysisResult = analysisEngine.analyze(renderResult.samples, renderResult.sampleRate);

        const source = `${recipeName}_seed-${String(seed).padStart(3, "0")}`;
        const recipeContext: RecipeContext = {
          name: recipeName,
          category: reg.category,
          tags: reg.tags,
        };

        const classificationResult = classifyEngine.classify(
          analysisResult,
          source,
          `(recipe: ${recipeName}, seed: ${seed})`,
          recipeContext,
        );

        if (jsonMode || formatFlag === "json") {
          jsonOut({
            command: "classify",
            ...classificationResult,
            classificationVersion: CLASSIFICATION_VERSION,
          });
        } else {
          formatClassificationHumanReadable(classificationResult);
        }

        // Write to output dir if specified
        if (outputDir !== undefined) {
          await mkdir(resolve(outputDir), { recursive: true });
          const jsonFileName = `${source}.json`;
          const jsonPath = resolve(outputDir, jsonFileName);
          const jsonContent = JSON.stringify(
            {
              command: "classify",
              ...classificationResult,
              classificationVersion: CLASSIFICATION_VERSION,
            },
            null,
            2,
          );
          await writeFile(jsonPath, jsonContent);
          if (!jsonMode) {
            outputSuccess(`Wrote ${jsonPath}`);
          }
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // ── Batch from analysis directory ─────────────────────────
    if (analysisDir !== undefined) {
      const resolvedAnalysisDir = resolve(analysisDir);

      if (!existsSync(resolvedAnalysisDir)) {
        const msg = `Directory not found: ${analysisDir}`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      const { readdirSync, readFileSync, statSync: statSyncFs } = await import("node:fs");
      const analysisStat = statSyncFs(resolvedAnalysisDir);
      if (!analysisStat.isDirectory()) {
        const msg = `--analysis must be a directory, got '${analysisDir}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      const entries = readdirSync(resolvedAnalysisDir)
        .filter((f: string) => f.toLowerCase().endsWith(".json"))
        .sort();

      if (entries.length === 0) {
        if (jsonMode) {
          jsonOut({ command: "classify", analysis: analysisDir, files: [], count: 0 });
        } else {
          outputInfo(`No analysis JSON files found in ${analysisDir}`);
        }
        return 0;
      }

      if (!jsonMode) {
        outputInfo(`Classifying ${entries.length} analysis file${entries.length !== 1 ? "s" : ""} from ${analysisDir}...`);
      }

      if (outputDir !== undefined) {
        await mkdir(resolve(outputDir), { recursive: true });
      }

      const batchResults: Array<{
        file: string;
        result: ClassificationResult;
      }> = [];

      for (const entry of entries) {
        const filePath = resolve(resolvedAnalysisDir, entry);
        try {
          const raw = readFileSync(filePath, "utf-8");
          const data = JSON.parse(raw) as Record<string, unknown>;

          // Extract analysis result from the JSON file
          const analysisResult: AnalysisResult = {
            analysisVersion: String(data["analysisVersion"] ?? "1.0"),
            sampleRate: Number(data["sampleRate"] ?? 44100),
            sampleCount: Number(data["sampleCount"] ?? 0),
            metrics: (data["metrics"] as AnalysisResult["metrics"]) ?? {},
          };

          // Try to extract recipe context from the source filename
          const sourceName = entry.replace(/\.json$/i, "");
          let recipeContext: RecipeContext | undefined;

          // Attempt to match a recipe name from the filename
          // Filenames like "weapon-laser-zap_seed-001.json" -> recipe = "weapon-laser-zap"
          const seedMatch = sourceName.match(/^(.+?)_seed-\d+$/);
          const possibleRecipeName = seedMatch ? seedMatch[1] : sourceName;
          const reg = possibleRecipeName ? registry.getRegistration(possibleRecipeName) : undefined;
          if (reg) {
            recipeContext = {
              name: possibleRecipeName!,
              category: reg.category,
              tags: reg.tags,
            };
          }

          const analysisRef = `./${analysisDir}/${entry}`;
          const classificationResult = classifyEngine.classify(
            analysisResult,
            sourceName,
            analysisRef,
            recipeContext,
          );

          batchResults.push({ file: entry, result: classificationResult });

          // Write individual JSON file if --output is specified
          if (outputDir !== undefined) {
            const jsonFileName = entry; // same filename as the analysis file
            const jsonPath = resolve(outputDir, jsonFileName);
            const jsonContent = JSON.stringify(
              {
                command: "classify",
                ...classificationResult,
                classificationVersion: CLASSIFICATION_VERSION,
              },
              null,
              2,
            );
            await writeFile(jsonPath, jsonContent);
            if (!jsonMode) {
              outputSuccess(`Wrote ${jsonPath}`);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (jsonMode) {
            jsonErr(`Failed to classify '${entry}': ${message}`);
          } else {
            outputError(`Error: Failed to classify '${entry}': ${message}`);
          }
          return 1;
        }
      }

      if (jsonMode || formatFlag === "json") {
        jsonOut({
          command: "classify",
          analysis: analysisDir,
          count: batchResults.length,
          files: batchResults.map((r) => ({
            file: r.file,
            ...r.result,
            classificationVersion: CLASSIFICATION_VERSION,
          })),
        });
      } else {
        formatClassificationBatchTable(batchResults);
        outputInfo(`Classified ${batchResults.length} file${batchResults.length !== 1 ? "s" : ""}`);
      }

      return 0;
    }

    // ── WAV file/directory input mode ─────────────────────────
    const resolvedInput = resolve(inputPath!);

    if (!existsSync(resolvedInput)) {
      const msg = `File not found: ${inputPath}`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    const { statSync: statSyncWav } = await import("node:fs");
    const inputStat = statSyncWav(resolvedInput);

    if (inputStat.isDirectory()) {
      // ── Batch WAV directory mode ──────────────────────────
      const { readdirSync } = await import("node:fs");
      const entries = readdirSync(resolvedInput)
        .filter((f: string) => f.toLowerCase().endsWith(".wav"))
        .sort();

      if (entries.length === 0) {
        if (jsonMode) {
          jsonOut({ command: "classify", input: inputPath, files: [], count: 0 });
        } else {
          outputInfo(`No .wav files found in ${inputPath}`);
        }
        return 0;
      }

      if (!jsonMode) {
        outputInfo(`Classifying ${entries.length} WAV file${entries.length !== 1 ? "s" : ""} in ${inputPath}...`);
      }

      if (outputDir !== undefined) {
        await mkdir(resolve(outputDir), { recursive: true });
      }

      const analysisEngine = createAnalysisEngine();
      registerBuiltinExtractors(analysisEngine);

      const batchResults: Array<{
        file: string;
        result: ClassificationResult;
      }> = [];

      for (const entry of entries) {
        const filePath = resolve(resolvedInput, entry);
        try {
          const wav = await decodeWavFile(filePath);
          const analysisResult = analysisEngine.analyze(wav.samples, wav.sampleRate);

          const sourceName = entry.replace(/\.wav$/i, "");

          // Try to extract recipe context from filename
          const seedMatch = sourceName.match(/^(.+?)_seed-\d+$/);
          const possibleRecipeName = seedMatch ? seedMatch[1] : undefined;
          let recipeContext: RecipeContext | undefined;
          if (possibleRecipeName) {
            const reg = registry.getRegistration(possibleRecipeName);
            if (reg) {
              recipeContext = {
                name: possibleRecipeName,
                category: reg.category,
                tags: reg.tags,
              };
            }
          }

          const analysisRef = `./${inputPath}/${entry}`;
          const classificationResult = classifyEngine.classify(
            analysisResult,
            sourceName,
            analysisRef,
            recipeContext,
          );

          batchResults.push({ file: entry, result: classificationResult });

          if (outputDir !== undefined) {
            const jsonFileName = entry.replace(/\.wav$/i, ".json");
            const jsonPath = resolve(outputDir, jsonFileName);
            const jsonContent = JSON.stringify(
              {
                command: "classify",
                ...classificationResult,
                classificationVersion: CLASSIFICATION_VERSION,
              },
              null,
              2,
            );
            await writeFile(jsonPath, jsonContent);
            if (!jsonMode) {
              outputSuccess(`Wrote ${jsonPath}`);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (jsonMode) {
            jsonErr(`Failed to classify '${entry}': ${message}`);
          } else {
            outputError(`Error: Failed to classify '${entry}': ${message}`);
          }
          return 1;
        }
      }

      if (jsonMode || formatFlag === "json") {
        jsonOut({
          command: "classify",
          input: inputPath,
          count: batchResults.length,
          files: batchResults.map((r) => ({
            file: r.file,
            ...r.result,
            classificationVersion: CLASSIFICATION_VERSION,
          })),
        });
      } else {
        formatClassificationBatchTable(batchResults);
        outputInfo(`Classified ${batchResults.length} file${batchResults.length !== 1 ? "s" : ""}`);
      }

      return 0;
    }

    // ── Single WAV file mode ──────────────────────────────────
    if (!resolvedInput.toLowerCase().endsWith(".wav")) {
      const msg = `Input file must be a .wav file, got '${inputPath}'.`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    try {
      if (!jsonMode) {
        outputInfo(`Classifying ${inputPath}...`);
      }

      const wav = await decodeWavFile(resolvedInput);
      const analysisEngine = createAnalysisEngine();
      registerBuiltinExtractors(analysisEngine);
      const analysisResult = analysisEngine.analyze(wav.samples, wav.sampleRate);

      const sourceName = inputPath!.replace(/^.*[\\/]/, "").replace(/\.wav$/i, "");

      // Try to extract recipe context from filename
      const seedMatch = sourceName.match(/^(.+?)_seed-\d+$/);
      const possibleRecipeName = seedMatch ? seedMatch[1] : undefined;
      let recipeContext: RecipeContext | undefined;
      if (possibleRecipeName) {
        const reg = registry.getRegistration(possibleRecipeName);
        if (reg) {
          recipeContext = {
            name: possibleRecipeName,
            category: reg.category,
            tags: reg.tags,
          };
        }
      }

      const classificationResult = classifyEngine.classify(
        analysisResult,
        sourceName,
        inputPath!,
        recipeContext,
      );

      if (jsonMode || formatFlag === "json") {
        jsonOut({
          command: "classify",
          ...classificationResult,
          classificationVersion: CLASSIFICATION_VERSION,
        });
      } else {
        formatClassificationHumanReadable(classificationResult);
      }

      // Write to output dir if specified
      if (outputDir !== undefined) {
        await mkdir(resolve(outputDir), { recursive: true });
        const jsonFileName = `${sourceName}.json`;
        const jsonPath = resolve(outputDir, jsonFileName);
        const jsonContent = JSON.stringify(
          {
            command: "classify",
            ...classificationResult,
            classificationVersion: CLASSIFICATION_VERSION,
          },
          null,
          2,
        );
        await writeFile(jsonPath, jsonContent);
        if (!jsonMode) {
          outputSuccess(`Wrote ${jsonPath}`);
        }
      }

      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
      return 1;
    }
  }

  // ── explore command ─────────────────────────────────────────────

  if (command === "explore") {
    // Help routing for explore subcommands
    if (flags["help"] && subcommand === undefined) {
      await printExploreHelp();
      return 0;
    }

    // ── explore sweep ─────────────────────────────────────────
    if (subcommand === "sweep") {
      if (flags["help"]) {
        await printExploreSweepHelp();
        return 0;
      }

      const recipeName = typeof flags["recipe"] === "string" ? flags["recipe"] : undefined;
      if (recipeName === undefined) {
        const msg = "--recipe is required. Run 'toneforge explore sweep --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Validate recipe exists
      if (!registry.getRegistration(recipeName)) {
        const allNames = registry.list();
        const suggestions = suggestRecipes(recipeName, allNames);
        let msg = `Unknown recipe '${recipeName}'.`;
        if (suggestions.length > 0) {
          msg += ` Did you mean: ${suggestions.join(", ")}?`;
        }
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Parse --seed-range
      const seedRangeRaw = typeof flags["seed-range"] === "string" ? flags["seed-range"] : "0:99";
      const rangeParts = seedRangeRaw.split(":");
      if (rangeParts.length !== 2) {
        const msg = `--seed-range must be in format <start>:<end>, got '${seedRangeRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }
      const seedStart = parseInt(rangeParts[0]!, 10);
      const seedEnd = parseInt(rangeParts[1]!, 10);
      if (Number.isNaN(seedStart) || Number.isNaN(seedEnd)) {
        const msg = `--seed-range values must be integers, got '${seedRangeRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }
      if (seedStart > seedEnd) {
        const msg = `--seed-range start (${seedStart}) must be <= end (${seedEnd}).`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Parse --keep-top
      const keepTopRaw = typeof flags["keep-top"] === "string" ? flags["keep-top"] : "10";
      const keepTop = parseInt(keepTopRaw, 10);
      if (Number.isNaN(keepTop) || keepTop < 1) {
        const msg = `--keep-top must be a positive integer, got '${keepTopRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Parse --rank-by
      const rankByRaw = typeof flags["rank-by"] === "string" ? flags["rank-by"] : "rms";
      const rankByNames = rankByRaw.split(",").map((s) => s.trim());
      for (const name of rankByNames) {
        if (!VALID_RANK_METRICS.includes(name as RankMetric)) {
          const msg = `Unknown rank metric '${name}'. Valid metrics: ${VALID_RANK_METRICS.join(", ")}`;
          if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
          return 1;
        }
      }
      if (rankByNames.length > 4) {
        const msg = "Maximum 4 rank metrics allowed.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }
      const rankBy = rankByNames as RankMetric[];

      // Parse --clusters
      const clustersRaw = typeof flags["clusters"] === "string" ? flags["clusters"] : "3";
      const clusters = parseInt(clustersRaw, 10);
      if (Number.isNaN(clusters) || clusters < 1 || clusters > 8) {
        const msg = `--clusters must be 1-8, got '${clustersRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Parse --concurrency
      const concurrencyRaw = typeof flags["concurrency"] === "string" ? flags["concurrency"] : undefined;
      const concurrency = concurrencyRaw ? parseInt(concurrencyRaw, 10) : defaultConcurrency();
      if (Number.isNaN(concurrency) || concurrency < 1) {
        const msg = `--concurrency must be a positive integer, got '${concurrencyRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      const outputDir = typeof flags["output"] === "string" ? flags["output"] : undefined;

      try {
        const totalSeeds = seedEnd - seedStart + 1;
        if (!jsonMode) {
          outputInfo(`Sweeping recipe '${recipeName}' over ${totalSeeds} seeds (${seedStart}:${seedEnd})...`);
          outputInfo(`  Rank by: ${rankBy.join(", ")}  |  Keep top: ${keepTop}  |  Clusters: ${clusters}  |  Concurrency: ${concurrency}`);
        }

        const config: SweepConfig = {
          recipe: recipeName,
          seedStart,
          seedEnd,
          rankBy,
          keepTop,
          clusters,
          concurrency,
        };

        const startMs = performance.now();

        // Run sweep
        let candidates = await sweep(config, (completed, total) => {
          if (!jsonMode) {
            const pct = Math.round((completed / total) * 100);
            process.stderr.write(`\r  Progress: ${completed}/${total} (${pct}%)`);
          }
        });
        if (!jsonMode) {
          process.stderr.write("\n");
        }

        // Rank
        rankCandidates(candidates, rankBy);

        // Keep top N
        candidates = keepTopN(candidates, keepTop);

        // Cluster
        const clusterSummaries = clusterCandidates(candidates, rankBy, clusters);

        const durationMs = Math.round(performance.now() - startMs);

        // Build run result
        const runId = generateRunId();
        const now = new Date().toISOString();
        const runResult: ExploreRunResult = {
          runId,
          startedAt: now,
          completedAt: now,
          durationMs,
          type: "sweep",
          config,
          totalCandidates: totalSeeds,
          candidates,
          clusterSummaries,
          exploreVersion: EXPLORE_VERSION,
        };

        // Persist run result
        const indexPath = await saveRunResult(runResult);

        // Export WAVs if --output specified
        if (outputDir !== undefined) {
          await mkdir(resolve(outputDir), { recursive: true });
          for (const candidate of candidates) {
            const renderResult = await renderRecipe(candidate.recipe, candidate.seed);
            const wavBuffer = encodeWav(renderResult.samples, { sampleRate: renderResult.sampleRate });
            const filePath = resolve(outputDir, `${candidate.id}.wav`);
            await writeFile(filePath, wavBuffer);
            if (!jsonMode) {
              outputSuccess(`Wrote ${filePath}`);
            }
          }
        }

        if (jsonMode) {
          jsonOut({
            command: "explore sweep",
            ...runResult,
          });
        } else {
          outputSuccess(`Sweep complete in ${durationMs}ms — ${totalSeeds} seeds, ${candidates.length} kept`);
          outputInfo(`Run ID: ${runId}`);
          outputInfo(`Index: ${indexPath}`);

          // Print top results table
          const rows = candidates.slice(0, 20).map((c, i) => [
            String(i + 1),
            c.id,
            c.score.toFixed(4),
            String(c.cluster),
            Object.entries(c.metricScores).map(([k, v]) => `${k}=${v.toFixed(3)}`).join(", "),
          ]);

          outputTable(
            [
              { header: "#", width: 3 },
              { header: "Candidate", width: 35 },
              { header: "Score", width: 8 },
              { header: "Cluster", width: 7 },
              { header: "Metrics", width: 40 },
            ],
            rows,
          );

          if (clusterSummaries.length > 0) {
            outputInfo("\nCluster summaries:");
            for (const cs of clusterSummaries) {
              const centroidStr = Object.entries(cs.centroid)
                .map(([k, v]) => `${k}=${v.toFixed(3)}`)
                .join(", ");
              outputInfo(`  Cluster ${cs.index}: ${cs.size} members, centroid: ${centroidStr}`);
              outputInfo(`    Exemplars: ${cs.exemplars.join(", ")}`);
            }
          }
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // ── explore mutate ────────────────────────────────────────
    if (subcommand === "mutate") {
      if (flags["help"]) {
        await printExploreMutateHelp();
        return 0;
      }

      const recipeName = typeof flags["recipe"] === "string" ? flags["recipe"] : undefined;
      if (recipeName === undefined) {
        const msg = "--recipe is required. Run 'toneforge explore mutate --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      if (!registry.getRegistration(recipeName)) {
        const allNames = registry.list();
        const suggestions = suggestRecipes(recipeName, allNames);
        let msg = `Unknown recipe '${recipeName}'.`;
        if (suggestions.length > 0) {
          msg += ` Did you mean: ${suggestions.join(", ")}?`;
        }
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Parse --seed (required)
      const seedRaw = flags["seed"];
      if (seedRaw === undefined || seedRaw === true) {
        const msg = "--seed is required. Run 'toneforge explore mutate --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }
      const seed = parseInt(seedRaw as string, 10);
      if (Number.isNaN(seed)) {
        const msg = `--seed must be an integer, got '${seedRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Parse --jitter
      const jitterRaw = typeof flags["jitter"] === "string" ? flags["jitter"] : "0.1";
      const jitter = parseFloat(jitterRaw);
      if (Number.isNaN(jitter) || jitter < 0 || jitter > 1) {
        const msg = `--jitter must be 0-1, got '${jitterRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Parse --count
      const countRaw = typeof flags["count"] === "string" ? flags["count"] : "20";
      const count = parseInt(countRaw, 10);
      if (Number.isNaN(count) || count < 1) {
        const msg = `--count must be a positive integer, got '${countRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Parse --rank-by
      const rankByRaw = typeof flags["rank-by"] === "string" ? flags["rank-by"] : "rms";
      const rankByNames = rankByRaw.split(",").map((s) => s.trim());
      for (const name of rankByNames) {
        if (!VALID_RANK_METRICS.includes(name as RankMetric)) {
          const msg = `Unknown rank metric '${name}'. Valid metrics: ${VALID_RANK_METRICS.join(", ")}`;
          if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
          return 1;
        }
      }
      const rankBy = rankByNames as RankMetric[];

      // Parse --concurrency
      const concurrencyRaw = typeof flags["concurrency"] === "string" ? flags["concurrency"] : undefined;
      const concurrency = concurrencyRaw ? parseInt(concurrencyRaw, 10) : defaultConcurrency();

      const outputDir = typeof flags["output"] === "string" ? flags["output"] : undefined;

      try {
        if (!jsonMode) {
          outputInfo(`Mutating recipe '${recipeName}' from seed ${seed} (jitter: ${jitter}, count: ${count})...`);
        }

        const config: MutateConfig = {
          recipe: recipeName,
          seed,
          jitter,
          count,
          rankBy,
          concurrency,
        };

        const startMs = performance.now();

        let candidates = await mutate(config, (completed, total) => {
          if (!jsonMode) {
            const pct = Math.round((completed / total) * 100);
            process.stderr.write(`\r  Progress: ${completed}/${total} (${pct}%)`);
          }
        });
        if (!jsonMode) {
          process.stderr.write("\n");
        }

        // Rank
        rankCandidates(candidates, rankBy);

        const durationMs = Math.round(performance.now() - startMs);

        // Build run result
        const runId = generateRunId();
        const now = new Date().toISOString();
        const runResult: ExploreRunResult = {
          runId,
          startedAt: now,
          completedAt: now,
          durationMs,
          type: "mutate",
          config,
          totalCandidates: count,
          candidates,
          clusterSummaries: [],
          exploreVersion: EXPLORE_VERSION,
        };

        const indexPath = await saveRunResult(runResult);

        // Export WAVs if --output specified
        if (outputDir !== undefined) {
          await mkdir(resolve(outputDir), { recursive: true });
          for (const candidate of candidates) {
            const renderResult = await renderRecipe(candidate.recipe, candidate.seed);
            const wavBuffer = encodeWav(renderResult.samples, { sampleRate: renderResult.sampleRate });
            const filePath = resolve(outputDir, `${candidate.id}.wav`);
            await writeFile(filePath, wavBuffer);
            if (!jsonMode) {
              outputSuccess(`Wrote ${filePath}`);
            }
          }
        }

        if (jsonMode) {
          jsonOut({
            command: "explore mutate",
            ...runResult,
          });
        } else {
          outputSuccess(`Mutate complete in ${durationMs}ms — ${count} variations`);
          outputInfo(`Run ID: ${runId}`);
          outputInfo(`Index: ${indexPath}`);

          const rows = candidates.map((c, i) => [
            String(i + 1),
            c.id,
            c.score.toFixed(4),
            Object.entries(c.metricScores).map(([k, v]) => `${k}=${v.toFixed(3)}`).join(", "),
          ]);

          outputTable(
            [
              { header: "#", width: 3 },
              { header: "Candidate", width: 35 },
              { header: "Score", width: 8 },
              { header: "Metrics", width: 45 },
            ],
            rows,
          );
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // ── explore promote ───────────────────────────────────────
    if (subcommand === "promote") {
      if (flags["help"]) {
        await printExplorePromoteHelp();
        return 0;
      }

      const runFlag = typeof flags["run"] === "string" ? flags["run"] : undefined;
      const latestFlag = flags["latest"] === true;
      const candidateId = typeof flags["id"] === "string" ? flags["id"] : undefined;
      const categoryFlag = typeof flags["category"] === "string" ? flags["category"] : undefined;

      if (runFlag !== undefined && latestFlag) {
        const msg = "--run and --latest are mutually exclusive. Use one or the other.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      let runId: string | undefined = runFlag;
      if (latestFlag) {
        const latest = await getLatestRunId();
        if (latest === null) {
          const msg = "No exploration runs found. Run a sweep or mutate first.";
          if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
          return 1;
        }
        runId = latest;
      }

      if (runId === undefined) {
        const msg = "--run or --latest is required. Run 'toneforge explore promote --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }
      if (candidateId === undefined) {
        const msg = "--id is required. Run 'toneforge explore promote --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        const result = await promoteCandidate(runId, candidateId, ".exploration", {
          category: categoryFlag,
        });

        if (jsonMode) {
          jsonOut({
            command: "explore promote",
            ...result,
          });
        } else {
          if (result.duplicate) {
            outputWarning(`Candidate '${candidateId}' already promoted (library ID: ${result.libraryId})`);
          } else {
            outputSuccess(`Promoted '${candidateId}' to library as '${result.libraryId}'`);
            outputInfo(`  WAV: ${result.wavPath}`);
            outputInfo(`  Metadata: ${result.metadataPath}`);
          }
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // ── explore show ──────────────────────────────────────────
    if (subcommand === "show") {
      if (flags["help"]) {
        await printExploreHelp();
        return 0;
      }

      const runFlag = typeof flags["run"] === "string" ? flags["run"] : undefined;
      const latestFlag = flags["latest"] === true;

      if (runFlag !== undefined && latestFlag) {
        const msg = "--run and --latest are mutually exclusive. Use one or the other.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      let runId: string | undefined = runFlag;
      if (latestFlag) {
        const latest = await getLatestRunId();
        if (latest === null) {
          const msg = "No exploration runs found. Run a sweep or mutate first.";
          if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
          return 1;
        }
        runId = latest;
      }

      if (runId === undefined) {
        const msg = "--run or --latest is required. Usage: toneforge explore show --run <run-id> | --latest";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        const result = await loadRunResult(runId);
        if (!result) {
          const msg = `Run not found: ${runId}`;
          if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
          return 1;
        }

        if (jsonMode) {
          jsonOut({
            command: "explore show",
            ...result,
          });
        } else {
          outputInfo(`Run: ${result.runId}`);
          outputInfo(`  Type: ${result.type}`);
          outputInfo(`  Recipe: ${result.config.recipe}`);
          outputInfo(`  Started: ${result.startedAt}`);
          outputInfo(`  Duration: ${result.durationMs}ms`);
          outputInfo(`  Total candidates: ${result.totalCandidates}`);
          outputInfo(`  Kept: ${result.candidates.length}`);

          const rows = result.candidates.map((c, i) => [
            String(i + 1),
            c.id,
            c.score.toFixed(4),
            String(c.cluster),
            c.promoted ? "yes" : "no",
          ]);

          outputTable(
            [
              { header: "#", width: 3 },
              { header: "Candidate", width: 35 },
              { header: "Score", width: 8 },
              { header: "Cluster", width: 7 },
              { header: "Promoted", width: 8 },
            ],
            rows,
          );
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // ── explore runs ──────────────────────────────────────────
    if (subcommand === "runs") {
      if (flags["help"]) {
        await printExploreHelp();
        return 0;
      }

      try {
        const runs = await listRuns();

        if (jsonMode) {
          jsonOut({
            command: "explore runs",
            count: runs.length,
            runs,
          });
        } else if (runs.length === 0) {
          outputInfo("No exploration runs found.");
        } else {
          const rows = runs.map((r) => [
            r.runId,
            r.type,
            r.recipe,
            String(r.totalCandidates),
            String(r.keptCandidates),
            `${r.durationMs}ms`,
          ]);

          outputTable(
            [
              { header: "Run ID", width: 25 },
              { header: "Type", width: 6 },
              { header: "Recipe", width: 20 },
              { header: "Total", width: 6 },
              { header: "Kept", width: 5 },
              { header: "Duration", width: 10 },
            ],
            rows,
          );
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // Unknown explore subcommand
    if (subcommand !== undefined) {
      const msg = `Unknown explore subcommand '${subcommand}'. Run 'toneforge explore --help' for usage.`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    await printExploreHelp();
    return 0;
  }

  // ── library ────────────────────────────────────────────────────

  if (command === "library") {
    // Group-level help
    if (flags["help"] && subcommand === undefined) {
      await printLibraryHelp();
      return 0;
    }

    // ── library list ──────────────────────────────────────────
    if (subcommand === "list") {
      if (flags["help"]) {
        await printLibraryHelp();
        return 0;
      }

      const categoryFilter = typeof flags["category"] === "string" ? flags["category"] : undefined;

      try {
        const filter = categoryFilter ? { category: categoryFilter } : undefined;
        const entries = await listEntries(filter);

        if (jsonMode) {
          jsonOut({
            command: "library list",
            ...(categoryFilter !== undefined ? { category: categoryFilter } : {}),
            count: entries.length,
            entries: entries.map((e) => ({
              id: e.id,
              recipe: e.recipe,
              seed: e.seed,
              category: e.category,
              duration: e.duration,
              tags: e.tags,
              promotedAt: e.promotedAt,
            })),
          });
        } else if (entries.length === 0) {
          if (categoryFilter) {
            outputInfo(`No library entries found for category '${categoryFilter}'.`);
          } else {
            outputInfo("No library entries found. Promote candidates with 'toneforge explore promote'.");
          }
        } else {
          outputTable(
            [
              { header: "ID", width: 40 },
              { header: "Recipe", width: 20 },
              { header: "Category", width: 16 },
              { header: "Duration", width: 10 },
              { header: "Tags", width: 30 },
            ],
            entries.map((e) => [
              e.id,
              e.recipe,
              e.category,
              `${e.duration.toFixed(2)}s`,
              e.tags.join(", ") || "\u2014",
            ]),
          );
          outputInfo(`${entries.length} entr${entries.length !== 1 ? "ies" : "y"} listed`);
        }
        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // ── library search ────────────────────────────────────────
    if (subcommand === "search") {
      if (flags["help"]) {
        await printLibraryHelp();
        return 0;
      }

      const categoryFilter = typeof flags["category"] === "string" ? flags["category"] : undefined;
      const intensityFilter = typeof flags["intensity"] === "string" ? flags["intensity"] : undefined;
      const textureFilter = typeof flags["texture"] === "string" ? flags["texture"] : undefined;
      const tagsFlag = typeof flags["tags"] === "string" ? flags["tags"] : undefined;

      // At least one filter is required
      if (categoryFilter === undefined && intensityFilter === undefined && textureFilter === undefined && tagsFlag === undefined) {
        const msg = "At least one filter is required: --category, --intensity, --texture, or --tags. Run 'toneforge library --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        const query: SearchQuery = {};
        if (categoryFilter !== undefined) query.category = categoryFilter;
        if (intensityFilter !== undefined) query.intensity = intensityFilter;
        if (textureFilter !== undefined) query.texture = textureFilter;
        if (tagsFlag !== undefined) query.tags = tagsFlag.split(",").map((t) => t.trim());

        const matches = await searchEntries(query);

        if (jsonMode) {
          jsonOut({
            command: "library search",
            filters: {
              ...(categoryFilter !== undefined ? { category: categoryFilter } : {}),
              ...(intensityFilter !== undefined ? { intensity: intensityFilter } : {}),
              ...(textureFilter !== undefined ? { texture: textureFilter } : {}),
              ...(tagsFlag !== undefined ? { tags: tagsFlag.split(",").map((t) => t.trim()) } : {}),
            },
            count: matches.length,
            entries: matches.map((e) => ({
              id: e.id,
              recipe: e.recipe,
              seed: e.seed,
              category: e.category,
              duration: e.duration,
              tags: e.tags,
              intensity: e.classification?.intensity ?? null,
              texture: e.classification?.texture ?? [],
            })),
          });
        } else if (matches.length === 0) {
          outputInfo("No matching library entries found.");
        } else {
          outputTable(
            [
              { header: "ID", width: 40 },
              { header: "Recipe", width: 20 },
              { header: "Category", width: 16 },
              { header: "Intensity", width: 12 },
              { header: "Tags", width: 30 },
            ],
            matches.map((e) => [
              e.id,
              e.recipe,
              e.category,
              e.classification?.intensity ?? "\u2014",
              e.tags.join(", ") || "\u2014",
            ]),
          );
          outputInfo(`Found ${matches.length} match${matches.length !== 1 ? "es" : ""}`);
        }
        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // ── library similar ───────────────────────────────────────
    if (subcommand === "similar") {
      if (flags["help"]) {
        await printLibraryHelp();
        return 0;
      }

      const entryId = typeof flags["id"] === "string" ? flags["id"] : undefined;
      if (entryId === undefined) {
        const msg = "--id is required. Run 'toneforge library --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      const limitFlag = typeof flags["limit"] === "string" ? parseInt(flags["limit"], 10) : 10;
      if (isNaN(limitFlag) || limitFlag < 1) {
        const msg = "--limit must be a positive integer.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        // Verify the entry exists
        const entry = await getEntry(entryId);
        if (!entry) {
          const msg = `Library entry not found: ${entryId}`;
          if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
          return 1;
        }

        const results = await findSimilar(entryId, { limit: limitFlag });

        if (jsonMode) {
          jsonOut({
            command: "library similar",
            queryId: entryId,
            limit: limitFlag,
            count: results.length,
            results: results.map((r) => ({
              id: r.entry.id,
              recipe: r.entry.recipe,
              category: r.entry.category,
              distance: parseFloat(r.distance.toFixed(6)),
              metricDistance: parseFloat(r.metricDistance.toFixed(6)),
              tagSimilarity: parseFloat(r.tagSimilarity.toFixed(4)),
            })),
          });
        } else if (results.length === 0) {
          outputInfo("No similar entries found. Library may have too few entries for comparison.");
        } else {
          outputTable(
            [
              { header: "ID", width: 40 },
              { header: "Recipe", width: 20 },
              { header: "Category", width: 16 },
              { header: "Distance", width: 12 },
              { header: "Tag Sim", width: 10 },
            ],
            results.map((r) => [
              r.entry.id,
              r.entry.recipe,
              r.entry.category,
              r.distance.toFixed(4),
              r.tagSimilarity.toFixed(2),
            ]),
          );
          outputInfo(`${results.length} similar entr${results.length !== 1 ? "ies" : "y"} found`);
        }
        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // ── library export ────────────────────────────────────────
    if (subcommand === "export") {
      if (flags["help"]) {
        await printLibraryHelp();
        return 0;
      }

      const outputDir = typeof flags["output"] === "string" ? flags["output"] : undefined;
      if (outputDir === undefined) {
        const msg = "--output is required. Run 'toneforge library --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      const formatFlag = typeof flags["format"] === "string" ? flags["format"] : "wav";
      if (formatFlag !== "wav") {
        const msg = `Unsupported format '${formatFlag}'. Only 'wav' is supported.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      const categoryFilter = typeof flags["category"] === "string" ? flags["category"] : undefined;

      try {
        const result = await exportEntries({
          outputDir,
          category: categoryFilter,
          format: "wav",
        });

        if (jsonMode) {
          jsonOut({
            command: "library export",
            ...(categoryFilter !== undefined ? { category: categoryFilter } : {}),
            format: "wav",
            outputDir: result.outputDir,
            count: result.count,
            files: result.files,
            skipped: result.skipped,
          });
        } else {
          if (result.count === 0) {
            outputInfo("No entries to export.");
          } else {
            outputSuccess(`Exported ${result.count} WAV file${result.count !== 1 ? "s" : ""} to ${outputDir}`);
          }
          if (result.skipped.length > 0) {
            outputWarning(`Skipped ${result.skipped.length} entr${result.skipped.length !== 1 ? "ies" : "y"} (missing WAV files)`);
          }
        }
        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // ── library regenerate ────────────────────────────────────
    if (subcommand === "regenerate") {
      if (flags["help"]) {
        await printLibraryHelp();
        return 0;
      }

      const entryId = typeof flags["id"] === "string" ? flags["id"] : undefined;
      if (entryId === undefined) {
        const msg = "--id is required. Run 'toneforge library --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      try {
        const result = await regenerateEntry(entryId);

        if (jsonMode) {
          jsonOut({
            command: "library regenerate",
            ...result,
          });
        } else {
          outputSuccess(`Regenerated '${entryId}' successfully`);
          outputInfo(`  WAV: ${result.wavPath}`);
          outputInfo(`  Regenerated at: ${result.regeneratedAt}`);
        }
        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // Unknown subcommand
    if (subcommand !== undefined) {
      const msg = `Unknown library subcommand '${subcommand}'. Run 'toneforge library --help' for usage.`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    await printLibraryHelp();
    return 0;
  }

  // ── Sequence Command ─────────────────────────────────────────────
  if (command === "sequence") {
    // Sequence subcommand help
    if (flags["help"] && subcommand === undefined) {
      await printSequenceHelp();
      return 0;
    }

    if (subcommand === "generate") {
      if (flags["help"]) {
        await printSequenceGenerateHelp();
        return 0;
      }

      // Require --preset
      const presetPath = typeof flags["preset"] === "string" ? flags["preset"] : undefined;
      if (presetPath === undefined) {
        const msg = "--preset is required for sequence generate. Run 'toneforge sequence generate --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Require --seed
      const seedRaw = flags["seed"];
      if (seedRaw === undefined || seedRaw === true) {
        const msg = "--seed is required for sequence generate. Run 'toneforge sequence generate --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }
      const seed = parseInt(seedRaw as string, 10);
      if (Number.isNaN(seed)) {
        const msg = `--seed must be an integer, got '${seedRaw}'.`;
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Optional --duration
      const durationRaw = flags["duration"];
      let maxDuration: number | undefined;
      if (durationRaw !== undefined && durationRaw !== true) {
        maxDuration = parseFloat(durationRaw as string);
        if (Number.isNaN(maxDuration) || maxDuration <= 0) {
          const msg = `--duration must be a positive number, got '${durationRaw}'.`;
          if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
          return 1;
        }
      }

      // Optional --output
      const outputPath = typeof flags["output"] === "string" ? flags["output"] : undefined;

      try {
        const definition = await loadSequencePreset(presetPath);

        if (!jsonMode) {
          outputInfo(
            `Rendering sequence '${definition.name}' (${definition.events.length} events) with seed ${seed}...`,
          );
        }

        const startMs = performance.now();
        const simResult = simulate(definition, seed, {
          maxDuration,
        });
        const result = await renderSequence(simResult, {
          totalDuration: maxDuration,
        });
        const renderMs = (performance.now() - startMs).toFixed(0);

        if (!jsonMode) {
          outputInfo(
            `Rendered ${result.duration.toFixed(3)}s of audio ` +
            `(${result.sampleRate} Hz, ${result.samples.length} samples) ` +
            `in ${renderMs}ms`,
          );
        }

        if (outputPath !== undefined) {
          await mkdir(dirname(resolve(outputPath)), { recursive: true });
          const wavBuffer = encodeWav(result.samples, { sampleRate: result.sampleRate });
          await writeFile(resolve(outputPath), wavBuffer);

          if (jsonMode) {
            jsonOut({
              command: "sequence generate",
              preset: presetPath,
              name: definition.name,
              events: simResult.events.length,
              seed,
              output: outputPath,
              duration: result.duration,
              sampleRate: result.sampleRate,
              samples: result.samples.length,
            });
          } else {
            outputSuccess(`Wrote ${outputPath}`);
          }
        } else {
          if (!jsonMode) {
            outputInfo("Playing...");
          }
          await playAudio(result.samples, { sampleRate: result.sampleRate });
          if (jsonMode) {
            jsonOut({
              command: "sequence generate",
              preset: presetPath,
              name: definition.name,
              events: simResult.events.length,
              seed,
              duration: result.duration,
              sampleRate: result.sampleRate,
              samples: result.samples.length,
              played: true,
            });
          } else {
            outputSuccess("Done.");
          }
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    if (subcommand === "simulate") {
      if (flags["help"]) {
        await printSequenceSimulateHelp();
        return 0;
      }

      // Require --preset
      const presetPath = typeof flags["preset"] === "string" ? flags["preset"] : undefined;
      if (presetPath === undefined) {
        const msg = "--preset is required for sequence simulate. Run 'toneforge sequence simulate --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      // Optional --seed (default: 42)
      const seedRaw = flags["seed"];
      let seed = 42;
      if (seedRaw !== undefined && seedRaw !== true) {
        seed = parseInt(seedRaw as string, 10);
        if (Number.isNaN(seed)) {
          const msg = `--seed must be an integer, got '${seedRaw}'.`;
          if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
          return 1;
        }
      }

      // Optional --duration
      const durationRaw = flags["duration"];
      let maxDuration: number | undefined;
      if (durationRaw !== undefined && durationRaw !== true) {
        maxDuration = parseFloat(durationRaw as string);
        if (Number.isNaN(maxDuration) || maxDuration <= 0) {
          const msg = `--duration must be a positive number, got '${durationRaw}'.`;
          if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
          return 1;
        }
      }

      try {
        const definition = await loadSequencePreset(presetPath);
        const simResult = simulate(definition, seed, {
          maxDuration,
        });

        const timeline = formatTimeline(simResult);

        if (jsonMode) {
          jsonOut(timeline as Record<string, unknown>);
        } else {
          outputInfo(`Sequence: ${definition.name}`);
          outputInfo(`Seed: ${seed}`);
          outputInfo(`Events: ${simResult.events.length}`);
          outputInfo(`Duration: ${simResult.totalDuration.toFixed(3)}s`);
          outputInfo("");

          // Table of events
          const columns = [
            { header: "#", width: 4 },
            { header: "Time (ms)", width: 10 },
            { header: "Sample", width: 8 },
            { header: "Event", width: 24 },
            { header: "Seed+", width: 6 },
            { header: "ESeed", width: 8 },
            { header: "Gain", width: 6 },
            { header: "Rep", width: 4 },
          ];
          const rows = simResult.events.map((e, i) => [
            String(i),
            e.time_ms.toFixed(1),
            String(e.sampleOffset),
            e.event,
            String(e.seedOffset),
            String(e.eventSeed),
            e.gain.toFixed(2),
            String(e.repetition),
          ]);
          outputTable(columns, rows);
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    if (subcommand === "inspect") {
      if (flags["help"]) {
        await printSequenceInspectHelp();
        return 0;
      }

      // Require --preset
      const presetPath = typeof flags["preset"] === "string" ? flags["preset"] : undefined;
      if (presetPath === undefined) {
        const msg = "--preset is required for sequence inspect. Run 'toneforge sequence inspect --help' for usage.";
        if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
        return 1;
      }

      const validateMode = flags["validate"] === true;

      try {
        if (validateMode) {
          // Full validation with detailed errors
          const { errors, definition, raw } = await validateSequencePresetFile(presetPath);

          if (jsonMode) {
            jsonOut({
              command: "sequence inspect",
              preset: presetPath,
              valid: errors.length === 0,
              errors: errors.map((e) => ({ field: e.field, message: e.message })),
              ...(definition ? { name: definition.name, events: definition.events.length } : {}),
            });
          } else {
            if (errors.length > 0) {
              outputError(`Validation failed for '${presetPath}':`);
              for (const err of errors) {
                outputError(`  ${err.field}: ${err.message}`);
              }
            } else {
              outputSuccess(`Preset '${presetPath}' is valid.`);
              if (definition) {
                outputInfo(`  Name: ${definition.name}`);
                outputInfo(`  Events: ${definition.events.length}`);
                if (definition.repeat) {
                  outputInfo(`  Repeat: ${definition.repeat.count} times at ${definition.repeat.interval}s intervals`);
                }
              }
            }
          }
        } else {
          // Standard inspect: show structure
          const definition = await loadSequencePreset(presetPath);

          if (jsonMode) {
            jsonOut({
              command: "sequence inspect",
              preset: presetPath,
              name: definition.name,
              description: definition.description || null,
              tempo: definition.tempo || null,
              events: definition.events.map((e, i) => ({
                index: i,
                time: e.time,
                time_ms: e.time_ms,
                event: e.event,
                seedOffset: e.seedOffset,
                probability: e.probability,
                gain: e.gain,
                duration: e.duration ?? null,
              })),
              repeat: definition.repeat || null,
            });
          } else {
            const name = definition.name;
            const eventCount = definition.events.length;
            outputInfo(`Sequence: ${name} (${eventCount} event${eventCount !== 1 ? "s" : ""})`);
            if (definition.description) {
              outputInfo(`  ${definition.description}`);
            }
            if (definition.tempo) {
              outputInfo(`  Tempo: ${definition.tempo} BPM`);
            }
            outputInfo("");

            for (let i = 0; i < definition.events.length; i++) {
              const e = definition.events[i]!;
              const timeMs = Math.round(e.time * 1000);
              const gain = e.gain.toFixed(2);
              const eventPadded = e.event.padEnd(24);
              const prob = e.probability < 1 ? ` prob:${e.probability.toFixed(2)}` : "";
              const dur = e.duration !== undefined ? ` dur:${e.duration.toFixed(3)}s` : "";
              outputInfo(`  [${i}] ${eventPadded} time: ${timeMs}ms\tgain: ${gain}\tseed+${e.seedOffset}${prob}${dur}`);
            }

            if (definition.repeat) {
              outputInfo("");
              outputInfo(`  Repeat: ${definition.repeat.count}x at ${definition.repeat.interval}s intervals`);
            }
          }
        }

        return 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) { jsonErr(message); } else { outputError(`Error: ${message}`); }
        return 1;
      }
    }

    // Unknown subcommand
    if (subcommand !== undefined) {
      const msg = `Unknown sequence subcommand '${subcommand}'. Run 'toneforge sequence --help' for usage.`;
      if (jsonMode) { jsonErr(msg); } else { outputError(`Error: ${msg}`); }
      return 1;
    }

    await printSequenceHelp();
    return 0;
  }

  if (command !== "generate") {
    if (jsonMode) {
      jsonErr(`Unknown command '${command}'. Run 'toneforge --help' for usage.`);
    } else {
      outputError(`Error: Unknown command '${command}'. Run 'toneforge --help' for usage.`);
    }
    return 1;
  }

  // Generate command
  if (flags["help"]) {
    await printGenerateHelp();
    return 0;
  }

  const recipeName = flags["recipe"];
  if (recipeName === undefined || recipeName === true) {
    if (jsonMode) {
      jsonErr("--recipe is required. Run 'toneforge generate --help' for usage.");
    } else {
      outputError("Error: --recipe is required. Run 'toneforge generate --help' for usage.");
    }
    return 1;
  }

  // Validate recipe exists
  if (!registry.getRegistration(recipeName as string)) {
    const recipes = registry.list();
    const msg = `Unknown recipe '${recipeName}'.${
      recipes.length > 0
        ? ` Available recipes: ${recipes.join(", ")}`
        : ""
    }`;
    if (jsonMode) {
      jsonErr(msg);
    } else {
      outputError(`Error: ${msg}`);
    }
    return 1;
  }

  // Resolve seed
  const outputPath = typeof flags["output"] === "string" ? flags["output"] : undefined;
  const seedRangeRaw = typeof flags["seed-range"] === "string" ? flags["seed-range"] : undefined;

  // Validate flag combinations
  if (seedRangeRaw !== undefined && outputPath === undefined) {
    const msg = "--seed-range requires --output to specify a directory.";
    if (jsonMode) {
      jsonErr(msg);
    } else {
      outputError(
        `Error: ${msg}\n` +
        "  Example: toneforge generate --recipe <name> --seed-range 1:10 --output ./sounds/",
      );
    }
    return 1;
  }

  if (seedRangeRaw !== undefined && flags["seed"] !== undefined && flags["seed"] !== true) {
    const msg = "--seed and --seed-range are mutually exclusive. Use one or the other.";
    if (jsonMode) {
      jsonErr(msg);
    } else {
      outputError(
        `Error: ${msg}\n` +
        "  Single file: toneforge generate --recipe <name> --seed 42 --output ./sound.wav\n" +
        "  Batch:       toneforge generate --recipe <name> --seed-range 1:10 --output ./sounds/",
      );
    }
    return 1;
  }

  // Parse --seed-range if present
  let seedRangeStart: number | undefined;
  let seedRangeEnd: number | undefined;

  if (seedRangeRaw !== undefined) {
    const parts = seedRangeRaw.split(":");
    if (parts.length !== 2) {
      const msg = `--seed-range must be in the format <start>:<end>, got '${seedRangeRaw}'.`;
      if (jsonMode) {
        jsonErr(msg);
      } else {
        outputError(
          `Error: ${msg}\n` +
          "  Example: --seed-range 1:10",
        );
      }
      return 1;
    }
    seedRangeStart = parseInt(parts[0]!, 10);
    seedRangeEnd = parseInt(parts[1]!, 10);
    if (Number.isNaN(seedRangeStart) || Number.isNaN(seedRangeEnd)) {
      const msg = `--seed-range values must be integers, got '${seedRangeRaw}'.`;
      if (jsonMode) {
        jsonErr(msg);
      } else {
        outputError(
          `Error: ${msg}\n` +
          "  Example: --seed-range 1:10",
        );
      }
      return 1;
    }
    if (seedRangeStart > seedRangeEnd) {
      const msg = `--seed-range start (${seedRangeStart}) must be <= end (${seedRangeEnd}).`;
      if (jsonMode) {
        jsonErr(msg);
      } else {
        outputError(`Error: ${msg}`);
      }
      return 1;
    }
  }

  // Determine output mode
  const isOutputFile = outputPath !== undefined && outputPath.endsWith(".wav");
  const isOutputDir = outputPath !== undefined && !outputPath.endsWith(".wav");

  if (seedRangeRaw !== undefined && isOutputFile) {
    const msg = "--seed-range requires --output to be a directory (not a .wav file).";
    if (jsonMode) {
      jsonErr(msg);
    } else {
      outputError(
        `Error: ${msg}\n` +
        `  Got: --output ${outputPath}\n` +
        "  Use a directory path (trailing /) instead:\n" +
        `  Example: --output ${outputPath.replace(/\.wav$/, "/")}\n` +
        "  Or omit --seed-range for single-file export.",
      );
    }
    return 1;
  }

  if (outputPath !== undefined && !isOutputFile && !isOutputDir) {
    const msg = `--output path '${outputPath}' is ambiguous.`;
    if (jsonMode) {
      jsonErr(msg);
    } else {
      outputError(
        `Error: ${msg}\n` +
        "  For single-file export, use a .wav extension: --output ./sound.wav\n" +
        "  For batch export, use a directory path: --output ./sounds/",
      );
    }
    return 1;
  }

  // Batch generation path (--seed-range with --output <dir>)
  if (seedRangeRaw !== undefined && isOutputDir) {
    try {
      await mkdir(outputPath!, { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (jsonMode) {
        jsonErr(`Failed to create output directory '${outputPath}': ${message}`);
      } else {
        outputError(`Error: Failed to create output directory '${outputPath}': ${message}`);
      }
      return 1;
    }

    const batchFiles: Array<{ seed: number; output: string; duration: number; sampleRate: number; samples: number }> = [];

    for (let seed = seedRangeStart!; seed <= seedRangeEnd!; seed++) {
      const fileName = `${recipeName}-seed-${seed}.wav`;
      const filePath = `${outputPath!.replace(/\/$/, "")}/${fileName}`;

      try {
        const result = await renderRecipe(recipeName as string, seed);
        const wavBuffer = encodeWav(result.samples, { sampleRate: result.sampleRate });
        await writeFile(filePath, wavBuffer);
        if (!jsonMode) {
          outputSuccess(`Wrote ${filePath}`);
        }
        batchFiles.push({
          seed,
          output: filePath,
          duration: result.duration,
          sampleRate: result.sampleRate,
          samples: result.samples.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) {
          jsonErr(`Failed to generate seed ${seed}: ${message}`);
        } else {
          outputError(`Error: Failed to generate seed ${seed}: ${message}`);
        }
        return 1;
      }
    }

    if (jsonMode) {
      jsonOut({
        command: "generate",
        recipe: recipeName,
        seedRange: [seedRangeStart!, seedRangeEnd!],
        output: outputPath,
        files: batchFiles,
      });
    }

    profiler.mark("done");
    profiler.report();
    return 0;
  }

  let seed: number;
  if (flags["seed"] !== undefined && flags["seed"] !== true) {
    seed = parseInt(flags["seed"] as string, 10);
    if (Number.isNaN(seed)) {
      if (jsonMode) {
        jsonErr(`--seed must be an integer, got '${flags["seed"]}'.`);
      } else {
        outputError(`Error: --seed must be an integer, got '${flags["seed"]}'.`);
        }
        return 1;
      }
    } else {
      seed = Math.floor(Math.random() * 2147483647);
      if (!outputPath && !jsonMode) {
        outputInfo(`Using random seed: ${seed}`);
    }
  }

  // Render
  if (!outputPath && !jsonMode) {
    outputInfo(`Generating '${recipeName}' with seed ${seed}...`);
  }
  const startTime = performance.now();

  try {
    const result = await renderRecipe(recipeName as string, seed);

    const renderMs = (performance.now() - startTime).toFixed(0);
    if (!outputPath && !jsonMode) {
      outputInfo(
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
        profiler.mark("wav_encode");
        await writeFile(outputPath, wavBuffer);
        profiler.mark("file_write");
        if (jsonMode) {
          jsonOut({
            command: "generate",
            recipe: recipeName,
            seed,
            output: outputPath,
            duration: result.duration,
            sampleRate: result.sampleRate,
            samples: result.samples.length,
          });
        } else {
          outputSuccess(`Wrote ${outputPath}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) {
          jsonErr(`Failed to write '${outputPath}': ${message}`);
        } else {
          outputError(`Error: Failed to write '${outputPath}': ${message}`);
        }
        return 1;
      }
    } else if (outputPath && isOutputDir) {
      // Single seed to directory (no --seed-range, just --output <dir>)
      try {
        await mkdir(outputPath, { recursive: true });
        const fileName = `${recipeName}-seed-${seed}.wav`;
        const filePath = `${outputPath.replace(/\/$/, "")}/${fileName}`;
        const wavBuffer = encodeWav(result.samples, { sampleRate: result.sampleRate });
        profiler.mark("wav_encode");
        await writeFile(filePath, wavBuffer);
        profiler.mark("file_write");
        if (jsonMode) {
          jsonOut({
            command: "generate",
            recipe: recipeName,
            seed,
            output: filePath,
            duration: result.duration,
            sampleRate: result.sampleRate,
            samples: result.samples.length,
          });
        } else {
          outputSuccess(`Wrote ${filePath}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (jsonMode) {
          jsonErr(`Failed to write to '${outputPath}': ${message}`);
        } else {
          outputError(`Error: Failed to write to '${outputPath}': ${message}`);
        }
        return 1;
      }
    } else {
      // Play audio (default when --output is not specified)
      if (!jsonMode) {
        outputInfo("Playing...");
      }
      await playAudio(result.samples, { sampleRate: result.sampleRate });
      if (jsonMode) {
        jsonOut({
          command: "generate",
          recipe: recipeName,
          seed,
          duration: result.duration,
          sampleRate: result.sampleRate,
          samples: result.samples.length,
          played: true,
        });
      } else {
        outputSuccess("Done.");
      }
    }

    profiler.mark("done");
    profiler.report();
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
      jsonErr(message);
    } else {
      outputError(`Error: ${message}`);
    }
    profiler.report();
    return 1;
  }
}

// Run when executed directly (via ./bin/dev-cli.js or tf/toneforge commands).
// The path check uses /cli.ts and /cli.js (with separator) to avoid
// matching bin/dev-cli.js which invokes main() itself.
const resolvedArg = process.argv[1]
  ? realpathSync(process.argv[1])
  : "";
const isDirectRun =
  resolvedArg.endsWith("/cli.ts") ||
  resolvedArg.endsWith("/cli.js");

if (isDirectRun) {
  main().then((code) => {
    process.exitCode = code;
  });
}
