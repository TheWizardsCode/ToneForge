#!/usr/bin/env tsx
/**
 * generate-capstones.ts — Generate recipe-book pages for the capstone
 * arrangements (5 stacks + 5 sequences) that crown the Casual Game Recipe
 * Book.
 *
 * For each capstone preset under `presets/stacks/` or `presets/sequences/`
 * this writes `docs/recipe-book/<name>.md` with:
 *   - docs front matter (title, id, order, description),
 *   - an authored `## Sound design` narrative,
 *   - the layered/event structure derived from the preset JSON,
 *   - the exact `toneforge stack` / `toneforge sequence` CLI commands,
 *   - a `## See also` block.
 *
 * Idempotent: a second run produces byte-identical output.
 *
 * Usage:
 *   tsx scripts/recipe-book/generate-capstones.ts
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const DOCS_DIR = resolve(ROOT, "docs", "recipe-book");

interface Layer {
  recipe: string;
  startTime: number;
  gain?: number;
}

interface SequenceEvent {
  time: number;
  event: string;
  seedOffset?: number;
  gain?: number;
}

interface PresetJson {
  name: string;
  description?: string;
  layers?: Layer[];
  events?: SequenceEvent[];
}

interface CapstoneSpec {
  id: string;
  kind: "stack" | "sequence";
  title: string;
  overview: string;
  synthesis: string;
  intent: string;
}

const CAPSTONES: CapstoneSpec[] = [
  {
    id: "casual_ui_confirm_stack",
    kind: "stack",
    title: "Casual UI Confirm Stack",
    overview:
      "A stacked interface confirmation that layers a crisp selection pop, a rising confirmation tone and a magic shimmer into one satisfying acknowledgement.",
    synthesis:
      "Three file-backed recipes play within 80 ms of each other: `ui-select-pop` at full gain anchors the attack, `ui-confirm-rise` at 0.8 adds the rising gesture, and `sparkle-magic-shimmer` at 0.5 sends a bright tail upward. Mixing short, harmonically distinct recipes is what gives the stack its richness without inventing a new recipe.",
    intent: "A polished, joyful confirmation for menus and dialogue choices.",
  },
  {
    id: "casual_coin_reward_stack",
    kind: "stack",
    title: "Casual Coin Reward Stack",
    overview:
      "A coin reward stack combining a bright pickup tick, an arcing coin contour and a coin-chain jingle.",
    synthesis:
      "`collect-pickup-coin` fires first for the instant reward, `collect-coin-arc` follows 60 ms later to arc upward, and `jingle-coin-chain` at 180 ms extends the celebration into a short melodic flourish. Each layer is a separate recipe, so the arrangement stays a pure composition over the delivered palette.",
    intent: "A celebratory reward for coins, loot and collectibles.",
  },
  {
    id: "casual_victory_stack",
    kind: "stack",
    title: "Casual Victory Stack",
    overview:
      "A full victory fanfare layering a two-note motif, a level-up jingle and a bright multi-voice sting.",
    synthesis:
      "`motif-win-two-note` states the win at 0 ms, `jingle-level-up` extends it at 340 ms, and `sting-victory-bright` crowns the arrangement at 600 ms. The ascending pitches of the three recipes reinforce one another into a single triumphant gesture.",
    intent: "The definitive win cue for level ends and victories.",
  },
  {
    id: "casual_character_jump_stack",
    kind: "stack",
    title: "Casual Character Jump Stack",
    overview:
      "A lively jump layering a rising hop blip, a character jump voice and an air swish whoosh.",
    synthesis:
      "`jump-hop-blip` carries the pitch lift, `character-jump-voice` adds a vocal \\\"hup\\\" 30 ms in, and `whoosh-air-swish` supplies the air movement. Timing the whoosh slightly after the voice keeps the jump readable.",
    intent: "A characterful movement cue for jumps, hops and double-jumps.",
  },
  {
    id: "casual_impact_hit_stack",
    kind: "stack",
    title: "Casual Impact Hit Stack",
    overview:
      "A weighty hit layering a dull thud, a fleshy punch and a metallic crash.",
    synthesis:
      "`impact-thud-dull` provides the low body at 0 ms, `impact-punch-flesh` adds mid-range texture at 10 ms, and `impact-crash-metal` contributes a resonant tail at 40 ms. The staggered onsets avoid phase cancellation and read as one compound impact.",
    intent: "A satisfying hit for combat, collisions and damage feedback.",
  },
  {
    id: "casual_menu_flow_sequence",
    kind: "sequence",
    title: "Casual Menu Flow Sequence",
    overview:
      "A short interface journey: a click, a selection pop, a rising confirm and a dialog-open motif over 700 ms.",
    synthesis:
      "Each event triggers one file-backed UI recipe at a fixed time and seed offset; `ui-click-crisp` opens navigation, `ui-select-pop` commits the choice, `ui-confirm-rise` acknowledges it and `ui-dialog-open-motif` reveals the next screen. Distinct seed offsets keep repeated events subtly varied but deterministic.",
    intent: "A guided, joyful menu interaction for demos and tutorials.",
  },
  {
    id: "casual_coin_run_sequence",
    kind: "sequence",
    title: "Casual Coin Run Sequence",
    overview:
      "Four rapid coin pickups building into an arcing reward, tuned for a satisfying collection streak.",
    synthesis:
      "`collect-pickup-coin` fires every 140 ms with rising gains and unique seed offsets for a natural streak, then `collect-coin-arc` closes the run at 600 ms. The accelerating gains make the streak feel like it is building.",
    intent: "A rewarding collection loop for coin runs and combos.",
  },
  {
    id: "casual_level_complete_sequence",
    kind: "sequence",
    title: "Casual Level Complete Sequence",
    overview:
      "A quest-complete motif, a level-up jingle and a level-complete sting closing a stage with a flourish.",
    synthesis:
      "`motif-quest-complete` starts at 0 ms, `jingle-level-up` reinforces it at 250 ms and `sting-level-complete` resolves at 600 ms. The three recipes share an upward contour, so the sequence reads as one continuous fanfare.",
    intent: "The end-of-level celebration for completing a stage.",
  },
  {
    id: "casual_game_over_sequence",
    kind: "sequence",
    title: "Casual Game Over Sequence",
    overview:
      "A soft defeat sting, a gentle game-over sting and a falling cancel tone that end a run kindly.",
    synthesis:
      "`sting-defeat-soft` opens the sequence at 0 ms, `sting-game-over-gentle` deepens it at 350 ms and `ui-cancel-fall` closes with a falling sigh at 900 ms. The descending gestures keep the mood gentle rather than punishing.",
    intent: "A kind, unhurried end-of-run cue.",
  },
  {
    id: "casual_adventure_intro_sequence",
    kind: "sequence",
    title: "Casual Adventure Intro Sequence",
    overview:
      "An adventure-call sting, a short start-game fanfare and an air swish launching a new journey.",
    synthesis:
      "`sting-adventure-call` announces the start at 0 ms, `motif-start-game-fanfare-short` answers at 350 ms and `whoosh-air-swish` carries the transition at 750 ms. The swish tail leaves space for the first scene to begin.",
    intent: "An opening cue for new games, worlds and chapters.",
  },
];

function readPreset(spec: CapstoneSpec): PresetJson {
  const dir = spec.kind === "stack" ? "stacks" : "sequences";
  const path = resolve(ROOT, "presets", dir, `${spec.id}.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as PresetJson;
}

function titleCase(id: string): string {
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function renderStructure(spec: CapstoneSpec, preset: PresetJson): string {
  if (spec.kind === "stack") {
    const rows = (preset.layers ?? [])
      .map(
        (l) =>
          `| \`${l.recipe}\` | ${l.startTime.toFixed(2)} s | ${(l.gain ?? 1).toFixed(2)} |`,
      )
      .join("\n");
    return [
      "| Recipe | Start | Gain |",
      "|--------|-------|------|",
      rows,
    ].join("\n");
  }
  const rows = (preset.events ?? [])
    .map(
      (e) =>
        `| \`${e.event}\` | ${e.time.toFixed(2)} s | ${e.seedOffset ?? "-"} | ${(e.gain ?? 1).toFixed(2)} |`,
    )
    .join("\n");
  return [
    "| Recipe | Time | Seed offset | Gain |",
    "|--------|------|-------------|------|",
    rows,
  ].join("\n");
}

function renderCli(spec: CapstoneSpec): string {
  if (spec.kind === "stack") {
    const preset = `presets/stacks/${spec.id}.json`;
    return [
      "```bash",
      `# Inspect the layered structure`,
      `toneforge stack inspect --preset ${preset}`,
      "```",
      "```bash",
      `# Render the stack at a fixed seed`,
      `toneforge stack render --preset ${preset} --seed 42 --output ${spec.id}.wav`,
      "```",
      "```bash",
      `# List every stack preset`,
      `toneforge list stacks`,
      "```",
    ].join("\n");
  }
  const preset = `presets/sequences/${spec.id}.json`;
  return [
    "```bash",
    `# Simulate the event schedule`,
    `toneforge sequence simulate --preset ${preset} --seed 42`,
    "```",
    "```bash",
    `# Render the sequence at a fixed seed`,
    `toneforge sequence generate --preset ${preset} --seed 42 --output ${spec.id}.wav`,
    "```",
    "```bash",
    `# List every sequence preset`,
    `toneforge list sequences`,
    "```",
  ].join("\n");
}

function renderPage(spec: CapstoneSpec, order: number, preset: PresetJson): string {
  const kindLabel = spec.kind === "stack" ? "Stack" : "Sequence";
  return [
    "---",
    `title: "${titleCase(spec.id)}"`,
    `id: "${spec.id}"`,
    `order: ${order}`,
    `description: "${preset.description ?? spec.title}"`,
    "---",
    "",
    `# ${titleCase(spec.id)}`,
    "",
    `**Capstone ${kindLabel}** · ${spec.kind === "stack" ? "presets/stacks" : "presets/sequences"}`,
    "",
    "## Sound design",
    "",
    "### Overview",
    "",
    spec.overview,
    "",
    "### Layered structure",
    "",
    spec.synthesis,
    "",
    "### Voices",
    "",
    renderStructure(spec, preset),
    "",
    "### Seed behaviour & musical intent",
    "",
    "With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. " +
      spec.intent,
    "",
    "## ToneForge CLI",
    "",
    renderCli(spec),
    "",
    "## See also",
    "",
    "- [Recipe Book Index](./index.md)",
    "- [Stack PRD](../../prd/STACK_PRD.md)",
    "- [Sequencer PRD](../../prd/SEQUENCER_PRD.md)",
    "",
  ].join("\n");
}

let written = 0;
CAPSTONES.forEach((spec, i) => {
  const preset = readPreset(spec);
  const page = renderPage(spec, 101 + i, preset);
  writeFileSync(resolve(DOCS_DIR, `${spec.id}.md`), page, "utf-8");
  written++;
});

console.log(`Generated ${written} capstone page(s).`);
