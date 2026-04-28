import { createRng } from "@toneforge/core/rng.js";
import { registry } from "@toneforge/recipes/index.js";

let realtimeCtx: AudioContext | null = null;

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
  await registration.buildOfflineGraph(graphRng, offlineCtx as unknown as import("node-web-audio-api").OfflineAudioContext, duration);
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
