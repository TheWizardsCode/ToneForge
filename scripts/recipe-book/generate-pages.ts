#!/usr/bin/env tsx
/**
 * generate-pages.ts — Generate recipe-book pages for delivered recipes.
 *
 * For every roster entry whose YAML recipe exists under `presets/recipes/`,
 * this script writes `docs/recipe-book/<name>.md` with:
 *   - docs front matter (title, id, order, description),
 *   - a hand-authored `## Sound design` narrative (from the narrative map
 *     below, with a metadata-driven fallback for recipes without one),
 *   - a regenerated `## ToneForge CLI` block between machine-readable markers,
 *   - a `## Parameters` table derived from the recipe's declared parameters.
 *
 * Idempotent: a second run produces byte-identical output.
 *
 * Usage:
 *   tsx scripts/recipe-book/generate-pages.ts            # all delivered
 *   tsx scripts/recipe-book/generate-pages.ts <name>...  # specific recipes
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const RECIPES_DIR = resolve(ROOT, "presets", "recipes");
const DOCS_DIR = resolve(ROOT, "docs", "recipe-book");

interface Narrative {
  overview: string;
  synthesis: string;
  parameters: string;
  intent: string;
}

/**
 * Per-recipe sound-design narratives. Recipes absent from this map fall back
 * to a metadata-driven narrative generated from the recipe's own YAML.
 */
const narratives: Record<string, Narrative> = {
  "blip-sine-ping": {
    overview:
      "The simplest possible ToneForge recipe: a single sine oscillator gated by a fast ADSR envelope, routed directly to the output. It produces a short, bright tone ideal for casual UI confirmations \u2014 the sound a coin makes when collected, or a button click in a lighthearted interface.",
    synthesis:
      "The sine waveform produces a pure, pleasant tone with no harsh harmonics. At 880 Hz it sits comfortably in the upper-mid range: bright enough to cut through other game audio without becoming piercing. The 5 ms attack gives an instant onset and the 40 ms decay creates a snappy ping that feels responsive.",
    parameters:
      "Lower `frequency` values (around 600 Hz) give a softer, more muted blip for less important confirmations; higher values (up to 1200 Hz) are brighter and more attention-grabbing. `decay` controls perceived length \u2014 shorter feels punchier, longer feels more melodic.",
    intent:
      "A cheerful, unambiguous confirmation that a tap or press was registered, with no sustain to mask the next sound.",
  },
  "blip-square-short": {
    overview:
      "A short square-wave blip for retro feedback. It is the 8-bit cousin of the sine ping, using the buzzy odd harmonics of a square wave to read as a classic arcade acknowledgement.",
    synthesis:
      "A square oscillator at 440 Hz with a very fast attack (3 ms) and a short 30 ms decay. The square wave\u2019s rich harmonic content gives the blip an unmistakable chiptune edge while the brief decay keeps it from becoming harsh.",
    parameters:
      "`frequency` moves the blip from a low buzz (220 Hz) to a bright chirp (660 Hz). `attack` should stay near the minimum for an instant onset; `decay` (15\u201390 ms) sets how clipped the blip feels.",
    intent:
      "Retro, cheerful confirmation that fits pixel-art and arcade styling.",
  },
  "blip-triangle-soft": {
    overview:
      "A soft triangle-wave blip for gentle cues. It is the mellowest of the Tier 1 blips, with a rounded, flute-like quality suited to cosy interfaces.",
    synthesis:
      "A triangle oscillator at 350 Hz with a 6 ms attack and a 60 ms decay. The triangle\u2019s gentler harmonic series produces a warmth that the square and sawtooth lack, so it can fire often without fatigue.",
    parameters:
      "`frequency` tunes the softness \u2014 lower is a wooden knock, higher a light sparkle. `decay` (20\u2013120 ms) controls how much body the blip has; the triangle tolerates longer decays gracefully.",
    intent:
      "A gentle, non-aggressive acknowledgement for calm or cosy game moments.",
  },
  "blip-saw-buzz": {
    overview:
      "A buzzy sawtooth blip for crisp alerts. The sawtooth\u2019s dense harmonics give it more bite than the other Tier 1 blips, making it suitable for errors and urgent cues.",
    synthesis:
      "A sawtooth oscillator at 180 Hz with a 2 ms attack and a 50 ms decay. Because the sawtooth is harmonically dense, the low fundamental still carries plenty of high-frequency energy, so the blip cuts through.",
    parameters:
      "`frequency` spans 110\u2013320 Hz \u2014 lower is a growl, higher a snarl. `decay` (20\u2013100 ms) controls whether the alert reads as a short blip or a slightly longer rasor.",
    intent:
      "A sharper, more attention-grabbing blip for warnings and crisp feedback.",
  },
  "tone-chime-single": {
    overview:
      "A single-note chime for notifications, rewards and pleasant state changes. It is the first Tier 1 sound with a noticeably longer tail.",
    synthesis:
      "A sine oscillator at 1320 Hz with a 4 ms attack and a 250 ms decay. The pure waveform and long decay give the note a bell-like ring without the complexity of a true bell.",
    parameters:
      "`frequency` moves the chime from a warm 880 Hz to a sparkling 1760 Hz. `decay` (0.15\u20130.4 s) sets the ring length \u2014 shorter for frequent notifications, longer for rare rewards.",
    intent:
      "A bright, friendly chime that signals something good has happened.",
  },
  "tone-bell-tap": {
    overview:
      "A bell-like tapped tone for rewards, combining a pure sine with a long, ringing decay to suggest a struck metal bell.",
    synthesis:
      "A sine oscillator at 990 Hz with a 3 ms attack and a 300 ms decay. The instantaneous attack mimics the strike of a mallet, and the long decay produces the ringing tail.",
    parameters:
      "`frequency` (660\u20131480 Hz) sets the bell size. `decay` (0.18\u20130.45 s) is the ring time; longer decays suit rarer, more valuable rewards.",
    intent:
      "A satisfying reward tone that makes collecting feel precious.",
  },
  "ui-click-crisp": {
    overview:
      "A crisp click for button presses and menu actuation. It is deliberately very short and neutral so it can fire on every interaction.",
    synthesis:
      "A square oscillator at 700 Hz with a 1 ms attack and a 20 ms decay. The near-instant envelope makes the click percussive, while the square harmonics give it a mechanical snap.",
    parameters:
      "`frequency` (400\u20131000 Hz) tunes the click from a dull thock to a sharp tick. `decay` (10\u201350 ms) controls the snap; the minimum feels like a mouse click.",
    intent:
      "Immediate, non-fatiguing acknowledgement of a UI interaction.",
  },
  "ui-tap-soft": {
    overview:
      "A soft tap for light UI interactions \u2014 hovering a control, toggling a mild setting, or confirming a low-stakes action.",
    synthesis:
      "A triangle oscillator at 300 Hz with a 4 ms attack and a 50 ms decay. The low harmonic content keeps the tap quiet and unobtrusive, so it blends into the interface.",
    parameters:
      "`frequency` (180\u2013460 Hz) sets the warmth; lower is a soft knock, higher a light tap. `decay` (20\u2013100 ms) controls the body of the tap.",
    intent:
      "Minimal, reassuring feedback for interactions that should not draw attention.",
  },
  "ui-select-pop": {
    overview:
      "A pop-like selection tone for committing a choice. It is slightly lower and rounder than the click, signalling a confirmed selection rather than mere navigation.",
    synthesis:
      "A square oscillator at 520 Hz with a 2 ms attack and a 45 ms decay. The short, plump envelope reads as a pop, and the square harmonics give it enough presence to feel decisive.",
    parameters:
      "`frequency` (300\u2013760 Hz) sets the pitch of the selection. `decay` (20\u201390 ms) controls how emphatic the pop feels.",
    intent:
      "A confident, affirmative selection sound distinct from the lighter click.",
  },
  "ui-cancel-blip": {
    overview:
      "A downward-feeling cancel blip for backing out of menus and dismissing dialogs. It is tuned lower than the selection pop to feel like a step backwards.",
    synthesis:
      "A sine oscillator at 420 Hz with a 3 ms attack and a 50 ms decay. The pure, slightly low tone is neutral rather than harsh, so cancelling does not feel like an error.",
    parameters:
      "`frequency` (260\u2013620 Hz) sets how low and final the cancel feels. `decay` (20\u2013100 ms) controls the weight of the blip.",
    intent:
      "A gentle, clear cancellation acknowledgement that does not punish the player.",
  },
  "collect-pickup-coin": {
    overview:
      "A bright coin pickup sparkle. It is one of the highest and shortest collect sounds in Tier 1, designed to fire rapidly during coin runs.",
    synthesis:
      "A sine oscillator at 1560 Hz with a 2 ms attack and an 80 ms decay. The high pure tone reads as a sparkle, and the short decay lets successive pickups overlap without smearing.",
    parameters:
      "`frequency` (1000\u20132000 Hz) sets the sparkle brightness. `decay` (40\u2013160 ms) controls the tail; shorter decays suit rapid-fire collection.",
    intent:
      "A rewarding, energetic pickup that encourages the player to collect more.",
  },
  "collect-gem-tick": {
    overview:
      "A short gem collection tick \u2014 the higher, rarer companion to the coin sparkle. Its very high register makes it stand out from coin pickups.",
    synthesis:
      "A triangle oscillator at 1980 Hz with a 2 ms attack and a 60 ms decay. The triangle wave softens the extreme high frequency so the tick sparkles rather than pierces.",
    parameters:
      "`frequency` (1200\u20132400 Hz) sets the gem\u2019s brightness. `decay` (30\u2013120 ms) controls the tick length; short decays keep it crisp.",
    intent:
      "A precious, high-register tick that makes rare collectibles feel special.",
  },
  "ui-toggle-on": {
    overview:
      "A toggle-on confirmation blip for switches and settings that turn on. It is pitched higher than its off counterpart to feel energising.",
    synthesis:
      "A square oscillator at 660 Hz with a 3 ms attack and a 40 ms decay. The square harmonics give the blip a positive, clicky character that suits a switch snapping on.",
    parameters:
      "`frequency` (400\u2013950 Hz) sets the pitch. `decay` (20\u201390 ms) controls the snap; a short decay reads as a decisive toggle.",
    intent:
      "A clear, positive confirmation that a setting has been enabled.",
  },
  "ui-toggle-off": {
    overview:
      "A toggle-off confirmation blip for switches and settings that turn off. It pairs with the toggle-on blip at a lower pitch to feel like a power-down.",
    synthesis:
      "A square oscillator at 440 Hz with a 3 ms attack and a 40 ms decay. The lower register and square harmonics give the blip a grounded, closing character.",
    parameters:
      "`frequency` (250\u2013650 Hz) sets the pitch. `decay` (20\u201390 ms) controls the snap; matching the toggle-on decay keeps the pair coherent.",
    intent:
      "A clear, neutral confirmation that a setting has been disabled.",
  },

  // \u2500\u2500\u2500 Tier 5: Character & critter voices \u2500\u2500\u2500
  "character-jump-voice": {
    overview:
      "A short, upward character utterance for a jump \u2014 a cheerful \"hup!\" that reads as effort leaving the ground. A sawtooth voice bent upward through a bandpass gives it a vowel-like, cartoonish lift.",
    synthesis:
      "A sawtooth oscillator rises exponentially from 180 Hz to 520 Hz while a bandpass filter at 900 Hz (Q 4) emphasises a single formant region, so the sweep reads as a spoken vowel rather than a plain glide. A fast 5 ms attack and a 220 ms decay keep the hop snappy.",
    parameters:
      "`startFreq`/`endFreq` set the register and span of the lift; `filterFreq` moves the formant that shapes the vowel; `attack`/`decay` tune the punch and length.",
    intent:
      "A joyful acknowledgement of a jump input that stays short enough to fire on every hop.",
  },
  "character-hurt-voice": {
    overview:
      "A pained character exclamation \u2014 an FM yelp that falls away as the character recoils, the descending brightness suggesting a flinch.",
    synthesis:
      "An `fmPattern` voice (carrier 300 Hz, modulator 450 Hz, index 9) carries a buzzy, vocal timbre while a lowpass filter sweeps from 1200 Hz down to 350 Hz, darkening the tone as it fades over 280 ms.",
    parameters:
      "`carrierFreq`/`modulatorFreq`/`modIndex` set the voice's timbre; `filterStart`/`filterEnd` set how quickly it darkens; `attack`/`decay` control the wince.",
    intent:
      "A readable hurt reaction that is expressive but never harsh on repeated playback.",
  },
  "character-happy-voice": {
    overview:
      "A bright, approving character chirp for a happy reaction \u2014 a short, bell-like FM \"yay\".",
    synthesis:
      "An `fmPattern` voice (carrier 520 Hz, modulator 780 Hz, index 4) produces a bell-like but still vocal tone; a quick 6 ms attack and a 240 ms decay give it a bouncy, cheerful shape.",
    parameters:
      "`carrierFreq`/`modulatorFreq` set the register and harmonic ratio; `modIndex` controls brightness and roughness; `attack`/`decay` tune the bounce.",
    intent:
      "A perky positive cue for rewards, greetings and friendly moments.",
  },
  "character-effort-grunt": {
    overview:
      "A low, breathy grunt for physical effort \u2014 a short burst of voice plus breath that reads as exertion.",
    synthesis:
      "A 120 Hz sine carries the pitched part of the grunt while white noise through a 600 Hz lowpass supplies the breath; the two are summed before a 200 ms envelope. This noise-plus-tonal blend is one of the tier's defining techniques.",
    parameters:
      "`toneFreq` sets the pitch of the voice; `noiseLevel` balances breath against tone; `filterFreq` darkens the noise; `attack`/`decay` shape the effort.",
    intent:
      "A grounded, physical effort cue for pushes, lifts, hits and landings.",
  },
  "character-sigh-voice": {
    overview:
      "A soft, deflating sigh \u2014 the sound of relief or resignation, with a falling pitch and a long breath tail.",
    synthesis:
      "A 320 Hz sine glides down to 180 Hz over 400 ms while pink noise at 0.35 passes through a 700 Hz bandpass and mixes with the tone. The slow 30 ms attack and 400 ms decay let the breath out gradually.",
    parameters:
      "`startFreq`/`endFreq` set the fall; `filterFreq` places the breath; `noiseLevel` balances air against voice; `attack`/`decay` control the length of the exhalation.",
    intent:
      "A gentle downward cue for letting go, disappointment or calm after action.",
  },
  "creature-blob-squish": {
    overview:
      "A gooey squish for a soft-bodied creature \u2014 a wet, downward thump with no pitched layer.",
    synthesis:
      "Pink noise through a resonant lowpass (Q 6) sweeps from 900 Hz down to 180 Hz, so the texture darkens and thickens as it closes. All of the character is in the filter movement, not a tonal carrier.",
    parameters:
      "`startFreq`/`endFreq` set the squash depth; `attack`/`decay` set how quickly the blob collapses.",
    intent:
      "A tactile, squishy impact for blobs, slimes and jelly enemies.",
  },
  "creature-bat-squeak": {
    overview:
      "A high, warbling bat squeak produced by rapid pitch modulation.",
    synthesis:
      "A sine at 1800 Hz is modulated by a 35 Hz LFO with \u00b1500 Hz depth, giving a fast vibrato that reads as a squeak rather than a steady tone. A very short 3 ms attack and 180 ms decay keep it in the high, chattery register.",
    parameters:
      "`lfoRate` sets the chatter speed; `lfoDepth` sets the warble width; `lfoOffset` shifts the whole squeak up or down; `attack`/`decay` trim the burst.",
    intent:
      "A nimble critter cry for small flying creatures.",
  },
  "creature-frog-croak": {
    overview:
      "A low, rattly frog croak with a distinctly non-musical timbre.",
    synthesis:
      "An `fmPattern` voice with a low 140 Hz carrier and an 85 Hz modulator at index 14 produces a dense, inharmonic rattle \u2014 the classic croak. A short 10 ms attack and a 300 ms decay give it the throaty push.",
    parameters:
      "`carrierFreq`/`modulatorFreq` set the pitch and rattle; `modIndex` controls the rasp; `attack`/`decay` tune the push and release.",
    intent:
      "A characterful low croak for amphibian creatures and swamp ambience.",
  },
  "creature-bird-chirp": {
    overview:
      "A quick, stepped bird chirp \u2014 three or four tiny notes that rise and fall like birdsong.",
    synthesis:
      "A sine begins at 2200 Hz, steps up to 3200 Hz, dips to 2400 Hz and finally rises to 3000 Hz via `set`/`linearRamp` automation. The stepped contour, rather than a smooth glide, is what makes it read as a chirp.",
    parameters:
      "`chirpLow`/`chirpHigh` set the register and the birdsong range; `attack`/`decay` set the note length.",
    intent:
      "A bright, friendly bird call for forest and meadow critters.",
  },
  "creature-slime-bounce": {
    overview:
      "A bouncy slime hop with a springy pitch contour and a soft filter.",
    synthesis:
      "A 400 Hz sine leaps to 700 Hz in 80 ms and settles back to 300 Hz, tracing the arc of a bounce. A 1200 Hz lowpass (Q 3) rounds off the top end so the bounce stays gooey rather than glassy.",
    parameters:
      "`startFreq`/`peakFreq` set the bounce height; `filterFreq` sets the softness; `attack`/`decay` trim the hop.",
    intent:
      "A playful movement cue for gelatinous creatures and balls.",
  },
  "critter-squeak-toy": {
    overview:
      "A bright, toy-like squeak for a cute critter \u2014 the sound of a rubber toy being squeezed.",
    synthesis:
      "An `fmPattern` voice at a high 1200 Hz carrier with a 1900 Hz modulator at index 7 gives the squeak its plasticky, hollow character. A 4 ms attack and a 200 ms decay keep it toylike.",
    parameters:
      "`carrierFreq`/`modulatorFreq` set the pitch and hollow tone; `modIndex` controls the squeakiness; `attack`/`decay` trim the squeeze.",
    intent:
      "A cheerful, compact squeak for mascots, pets and toy creatures.",
  },
  "critter-purr-soft": {
    overview:
      "A warm, continuous purr \u2014 a low rumble with a gentle amplitude flutter.",
    synthesis:
      "A 90 Hz sine and pink noise through a 450 Hz lowpass are summed, and the mix gain is modulated by a 24 Hz LFO, so the purr pulses rather than hisses. A slow 80 ms attack and a long 450 ms decay make it feel sustained.",
    parameters:
      "`toneFreq` sets the rumble pitch; `noiseLevel` balances breath; `filterFreq` darkens the texture; `purrRate`/`purrDepth` set the flutter; `attack`/`decay` shape the swell.",
    intent:
      "A comforting, contented purr for friendly critters and companions.",
  },
  "creature-ghost-whisper": {
    overview:
      "A breathy ghostly whisper, airy and unsettling but gentle rather than scary.",
    synthesis:
      "White noise through a bandpass that rises from 800 Hz to 2000 Hz supplies the breath, while a 600 Hz sine slides to 500 Hz underneath. The 60 ms attack and 500 ms decay let it emerge and fade like a whisper.",
    parameters:
      "`toneFreq` sets the underlying tone; `noiseLevel` balances air; `filterStart`/`filterEnd` set the breath sweep; `attack`/`decay` shape the fade.",
    intent:
      "A spooky-but-playful supernatural cue for ghosts and haunted spaces.",
  },
  "creature-dragon-huff": {
    overview:
      "A low, rasping dragon huff \u2014 a short breathy growl from a large creature.",
    synthesis:
      "An 80 Hz sawtooth and brown noise through a 400 Hz lowpass (Q 2) are summed, and the filter sweeps down to 150 Hz, so the huff darkens and settles. The low register conveys size and weight.",
    parameters:
      "`toneFreq` sets the growl pitch; `noiseLevel` balances the huff; `filterStart`/`filterEnd` set the darkening sweep; `attack`/`decay` trim the breath.",
    intent:
      "A weighty, imposing creature breath for dragons and beasts.",
  },
};

function describeContour(contour: ContourEvent[]): string {
  if (contour.length < 2) return "";
  const first = contour[0]!;
  const last = contour[contour.length - 1]!;
  const rising = last.value > first.value;
  const steps = contour.slice(1).map((e) => e.kind);
  const stepped = steps.length > 0 && steps.every((k) => k === "set");
  const waypoints = contour.map((e) => `${e.value} Hz`).join(" → ");
  if (stepped) {
    return `The pitch steps through a ${contour.length}-note figure (${waypoints}) via scheduled set events on the frequency AudioParam, while a gain gate shapes each note into a short articulated motif.`;
  }
  const direction = rising ? "rising" : "falling";
  const shape = steps.some((k) => k.includes("exponential")) ? "exponential" : "linear";
  return `The pitch follows a ${shape} ${direction} contour (${waypoints}) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.`;
}

function fallbackNarrative(name: string, meta: RecipeMeta): Narrative {
  const { description, tags, kind, parameters, contour, envelope, waveform } = meta;
  const sourceKind = meta.sourceKind ?? kind;
  const contourText = contour && contour.length > 1 ? describeContour(contour) : "";
  const envText = envelope
    ? `an amplitude envelope (attack ${envelope.attack}s, decay ${envelope.decay}s, sustain ${envelope.sustain}), which opens quickly and then settles`
    : "a compact amplitude envelope";
  const source = sourceKind === "noise"
    ? `a ${meta.noiseColor ?? "filtered"}-noise source through a ${meta.filterType ?? "biquad"} filter${meta.filterQ !== undefined ? ` (Q=${meta.filterQ})` : ""}`
    : sourceKind === "fmPattern"
      ? "an FM (fmPattern) voice"
      : `a single ${waveform ?? sourceKind} tone`;
  const synth = contourText
    ? `It is built from ${source}, shaped by ${envText}. ${contourText}`
    : `It is built from ${source}, shaped by ${envText}. No additional processing is required, so it renders quickly and deterministically.`;
  const paramNames = parameters.map((p) => `\`${p.name}\``).join(", ");
  return {
    overview: `\`${name}\` provides ${description.toLowerCase()}. It belongs to the casual recipe family (${tags.join(", ")}) and is designed to be short, characterful and easy to layer.`,
    synthesis: synth,
    parameters: `The declared parameters (${paramNames}) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.`,
    intent:
      "A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.",
  };
}

// ── Data loading ─────────────────────────────────────────────────────────────

function parseRosterNames(): string[] {
  const rosterPath = resolve(ROOT, "src", "recipes", "recipe-book", "roster.ts");
  const source = readFileSync(rosterPath, "utf-8");
  const names: string[] = [];
  const re = /\{\s*name:\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    names.push(m[1]);
  }
  return names;
}

interface ContourEvent {
  kind: string;
  time: number;
  value: number;
}

interface EnvelopeShape {
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

interface RecipeMeta {
  description: string;
  tags: string[];
  kind: string;
  category: string;
  waveform?: string;
  parameters: Array<{ name: string; type: string; min?: number; max?: number; unit?: string; default?: unknown }>;
  contour?: ContourEvent[];
  envelope?: EnvelopeShape;
  sourceKind?: string;
  noiseColor?: string;
  filterType?: string;
  filterQ?: number;
}

function loadRecipe(name: string): RecipeMeta | null {
  const filePath = resolve(RECIPES_DIR, `${name}.yaml`);
  if (!existsSync(filePath)) return null;
  const doc = yaml.load(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  const meta = (doc.meta ?? {}) as Record<string, unknown>;
  const nodes = (doc.nodes ?? {}) as Record<string, any>;
  const kinds = Object.values(nodes).map((n) => (n && typeof n === "object" ? n.kind : "") ?? "");
  const kind =
    kinds.find((k) => ["oscillator", "noise", "fmPattern", "bufferSource", "lfo"].includes(k)) ??
    "oscillator";

  // First oscillator/noise/FM source, plus any frequency automation and envelope
  let waveform: string | undefined;
  let noiseColor: string | undefined;
  let filterType: string | undefined;
  let filterQ: number | undefined;
  let fmIndex: number | undefined;
  let contour: ContourEvent[] | undefined;
  let envelope: EnvelopeShape | undefined;
  const extractContour = (events: unknown): ContourEvent[] | undefined => {
    if (!Array.isArray(events)) return undefined;
    const out = events
      .filter((e: any) => e && typeof e.value === "number")
      .map((e: any) => ({ kind: String(e.kind), time: Number(e.time), value: Number(e.value) }));
    return out.length > 1 ? out : undefined;
  };
  for (const node of Object.values(nodes)) {
    if (!node || typeof node !== "object") continue;
    if (node.kind === "oscillator" && waveform === undefined) {
      waveform = node.params?.type;
    }
    if (node.kind === "noise" && noiseColor === undefined) {
      noiseColor = node.params?.color;
    }
    if (node.kind === "fmPattern" && fmIndex === undefined) {
      fmIndex = node.params?.modulationIndex;
    }
    if (node.kind === "biquadFilter" && filterType === undefined) {
      filterType = node.params?.type;
      filterQ = node.params?.Q;
    }
    if (contour === undefined) {
      contour = extractContour(node.automation?.frequency);
    }
    if (node.kind === "envelope" && !envelope) {
      envelope = node.params as EnvelopeShape;
    }
  }

  const params = (meta.parameters as RecipeMeta["parameters"]) ?? [];
  return {
    description: String(meta.description ?? name),
    tags: (meta.tags as string[]) ?? [],
    kind: kind === "oscillator" ? "oscillator" : kind,
    category: String(meta.category ?? "UI"),
    waveform: waveform ?? noiseColor ?? (fmIndex !== undefined ? "fmPattern" : undefined),
    parameters: params,
    contour,
    envelope,
    sourceKind: kind,
    noiseColor,
    filterType,
    filterQ,
  };
}

function generateCliBlock(name: string): string {
  const commands = [
    { desc: "Generate the recipe with a specific seed", cmd: `toneforge generate --recipe ${name} --seed 42 --output ${name}.wav` },
    { desc: "Show the recipe metadata", cmd: `toneforge show --recipe ${name}` },
    { desc: "List all recipes, filtered by casual tag", cmd: `toneforge list recipes --tags casual` },
    { desc: "Generate with default seed", cmd: `toneforge generate --recipe ${name} --output ${name}-default.wav` },
  ];
  return commands.map(({ desc, cmd }) => "```bash\n# " + desc + "\n" + cmd + "\n```").join("\n");
}

function titleCase(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function renderParameters(params: RecipeMeta["parameters"]): string {
  if (params.length === 0) return "_No declared parameters._";
  const rows = params
    .map((p) => {
      const range =
        p.min !== undefined && p.max !== undefined ? `${p.min}–${p.max}${p.unit ? " " + p.unit : ""}` : "—";
      const def = p.default !== undefined ? `${p.default}${p.unit && typeof p.default === "number" ? " " + p.unit : ""}` : "—";
      return `| \`${p.name}\` | ${p.type} | ${range} | ${def} |`;
    })
    .join("\n");
  return [
    "| Parameter | Type | Range | Default |",
    "|-----------|------|-------|---------|",
    rows,
  ].join("\n");
}

function renderPage(name: string, order: number, meta: RecipeMeta, narrative: Narrative): string {
  const markerStart = `<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ${name} -->`;
  const markerEnd = `<!-- CLI_BLOCK_END -->`;
  const cliBlock = generateCliBlock(name);
  return [
    "---",
    `title: "${titleCase(name)}"`,
    `id: "${name}"`,
    `order: ${order}`,
    `description: "${meta.description}"`,
    "---",
    "",
    `# ${titleCase(name)}`,
    "",
    `**Category: ${meta.category}** · Tags: ${meta.tags.join(", ")}`,
    "",
    "## Sound design",
    "",
    "### Overview",
    "",
    narrative.overview,
    "",
    "### Synthesis",
    "",
    narrative.synthesis,
    "",
    "### Parameters",
    "",
    narrative.parameters,
    "",
    "### Seed behaviour & musical intent",
    "",
    `With a fixed seed (e.g. \`--seed 42\`) this recipe renders byte-identical audio on every platform and run. ${narrative.intent}`,
    "",
    "## ToneForge CLI",
    "",
    markerStart,
    cliBlock,
    markerEnd,
    "",
    "## Parameters",
    "",
    renderParameters(meta.parameters),
    "",
    "## See also",
    "",
    "- [Recipe Book Index](./index.md)",
    "- [ToneGraph Schema](../../tonegraph.md)",
    "",
  ].join("\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────

const requested = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const rosterNames = parseRosterNames();
const orderIndex = new Map(rosterNames.map((n, i) => [n, i + 1]));

const targets = requested.length > 0 ? requested : rosterNames;
let written = 0;
let skipped = 0;

for (const name of targets) {
  const meta = loadRecipe(name);
  if (!meta) {
    skipped++;
    continue;
  }
  const narrative = narratives[name] ?? fallbackNarrative(name, meta);
  const page = renderPage(name, orderIndex.get(name) ?? 0, meta, narrative);
  writeFileSync(resolve(DOCS_DIR, `${name}.md`), page, "utf-8");
  written++;
}

console.log(`Generated ${written} recipe page(s); skipped ${skipped} (no recipe YAML).`);
