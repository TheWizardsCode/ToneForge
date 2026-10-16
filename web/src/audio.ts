import { createRng } from "@toneforge/core/rng.js";
import { registry } from "@toneforge/recipes/index.js";
import { OfflineAudioContext } from "@toneforge/audio/web-audio.js";
import {
  createRealtimeInstrument,
  type InstrumentDefinition,
} from "@toneforge/instruments/index.js";
import { registerBrowserRecipes } from "./browser-recipe-registry.js";

/**
 * Ensure the file-backed recipe registry is populated before a lookup.
 *
 * In the browser `discoverFileBackedRecipes()` is a no-op, so the inlined
 * recipe bundle (see `browser-recipe-registry`) must be registered first.
 * Registration is idempotent and cheap after the first call.
 */
let browserRecipesRegistered = false;
function ensureBrowserRecipes(): void {
  if (browserRecipesRegistered) {
    return;
  }
  registerBrowserRecipes();
  browserRecipesRegistered = true;
}

let realtimeCtx: AudioContext | null = null;

/**
 * Real-time instruments created for browser playback, keyed by definition id.
 *
 * The engine's real-time renderer (`createRealtimeInstrument`) is registered
 * here lazily: the first {@link getRealtimeInstrument} call creates the
 * instrument (and its `AudioContext`) once, then reuses the live voice graph
 * for every subsequent note. All Web Audio creation funnels through
 * `src/audio/web-audio.ts`, so this module never imports
 * `node-web-audio-api` directly.
 */
const realtimeInstruments = new Map<
  string,
  ReturnType<typeof createRealtimeInstrument>
>();

/**
 * Get (and lazily register) the real-time instrument for a definition.
 *
 * @param definition - The instrument definition.
 * @returns The live instrument, ready for `noteOn` / `noteOff`.
 */
export function getRealtimeInstrument(
  definition: InstrumentDefinition,
): ReturnType<typeof createRealtimeInstrument> {
  let instrument = realtimeInstruments.get(definition.id);
  if (!instrument) {
    instrument = createRealtimeInstrument(definition);
    realtimeInstruments.set(definition.id, instrument);
  }
  return instrument;
}

/**
 * Play a single note through the engine's real-time renderer.
 *
 * Creates the browser `AudioContext` on first use (via
 * {@link getRealtimeInstrument}) and schedules a Note On; the release is
 * applied on the same graph so the voice decays instead of clicking.
 *
 * @param definition - The instrument definition.
 * @param note - MIDI note number (0–127).
 * @param velocity - MIDI velocity (0–127).
 * @returns True when Web Audio is available and the note was scheduled.
 */
export function playInstrumentNote(
  definition: InstrumentDefinition,
  note: number,
  velocity: number,
): boolean {
  if (typeof AudioContext === "undefined") {
    console.warn("Web Audio is not available in this environment.");
    return false;
  }
  const instrument = getRealtimeInstrument(definition);
  instrument.noteOn(note, velocity);
  instrument.noteOff(note);
  return true;
}

/**
 * Extract seed from a CLI command string.
 * Matches patterns like `--seed 42` or `--seed=42`.
 */
export function extractSeed(command: string): number | null {
  const match = command.match(/--seed[= ](\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract recipe name from a CLI command string.
 * Matches patterns like `--recipe weapon-laser-zap`.
 */
export function extractRecipeName(command: string): string | null {
  const match = command.match(/--recipe\s+(\S+)/);
  return match ? match[1] : null;
}

/**
 * Check if a command is an audio-producing command with a recipe and seed.
 * Matches both `generate --recipe` and `sequence generate --recipe` patterns.
 */
export function isGenerateCommand(command: string): boolean {
  return (
    command.includes("generate")
    && extractRecipeName(command) !== null
    && extractSeed(command) !== null
  );
}

/**
 * Extract preset name from a stack render command string.
 * Matches patterns like `stack render --preset explosion-basic`.
 */
export function extractPresetName(command: string): string | null {
  const match = command.match(/--preset\s+(\S+)/);
  return match ? match[1] : null;
}

/**
 * Check if a command is a stack render command.
 * Stack render uses --preset and --seed but not --recipe.
 */
export function isStackRenderCommand(command: string): boolean {
  return (
    command.includes("stack")
    && command.includes("render")
    && extractPresetName(command) !== null
    && extractSeed(command) !== null
  );
}

function getRealtimeContext(): AudioContext {
  if (!realtimeCtx) {
    realtimeCtx = new AudioContext();
  }
  return realtimeCtx;
}

async function ensureAudioContext(): Promise<AudioContext> {
  const ctx = getRealtimeContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

/**
 * Render and play a recipe with the given seed in the browser.
 */
export async function renderAndPlay(recipeName: string, seed: number): Promise<void> {
  // File-backed recipes are inlined into the browser bundle rather than
  // discovered from disk; make sure they are registered before the lookup.
  ensureBrowserRecipes();

  const registration = registry.getRegistration(recipeName);
  if (!registration) {
    console.warn(`Unknown recipe "${recipeName}" - skipping audio playback.`);
    return;
  }

  const durationRng = createRng(seed);
  const duration = registration.getDuration(durationRng);
  const sampleRate = 44100;
  const length = Math.ceil(sampleRate * duration);

  const offlineCtx = new OfflineAudioContext(1, length, sampleRate);
  const graphRng = createRng(seed);
  await registration.buildOfflineGraph(graphRng, offlineCtx, duration);
  const renderedBuffer = await offlineCtx.startRendering();

  const ctx = await ensureAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = renderedBuffer;
  source.connect(ctx.destination);
  source.start(0);
}

/**
 * Handle a command: if it's a generate command, render and play in the browser.
 * Stack render commands are detected but gracefully skipped (browser-side
 * multi-layer rendering from preset files is not yet supported).
 * Returns true if audio was played, false otherwise.
 */
export async function handleCommandAudio(command: string): Promise<boolean> {
  if (isStackRenderCommand(command)) {
    console.info(
      "Stack render detected - browser audio playback for stacked presets is not yet supported. "
      + "Audio will play from the CLI output only.",
    );
    return false;
  }

  if (!isGenerateCommand(command)) {
    return false;
  }

  const recipeName = extractRecipeName(command);
  const seed = extractSeed(command);
  if (recipeName === null || seed === null) {
    return false;
  }

  try {
    await renderAndPlay(recipeName, seed);
    return true;
  } catch (err) {
    console.error("Browser audio playback failed:", err);
    return false;
  }
}
