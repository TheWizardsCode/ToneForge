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

  // Diagnostic logging to help E2E debugging when running in headless browsers
  // The Playwright tests capture console messages; these logs help trace where
  // the render path may be failing.
  // eslint-disable-next-line no-console
  console.debug(`[audio] renderAndPlay: recipe=${recipeName} seed=${seed} duration=${duration} length=${length}`);

  const offlineCtx = new OfflineAudioContext(1, length, sampleRate);
  const graphRng = createRng(seed);
  try {
    await registration.buildOfflineGraph(graphRng, offlineCtx as unknown as import("node-web-audio-api").OfflineAudioContext, duration);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audio] buildOfflineGraph failed:", err);
    throw err;
  }

  let renderedBuffer: AudioBuffer | null = null;
  try {
    // eslint-disable-next-line no-console
    console.debug("[audio] starting offlineCtx.startRendering()");
    renderedBuffer = await offlineCtx.startRendering();
    // eslint-disable-next-line no-console
    console.debug("[audio] startRendering resolved: length=", (renderedBuffer && (renderedBuffer as any).length) || (renderedBuffer && (renderedBuffer as any).duration) || null);
    // Expose rendered length for E2E tests (the smoke test patches startRendering to set this)
    try {
      (globalThis as any).__tfLastRenderedLength = (renderedBuffer as any).length ?? 0;
    } catch (e) {
      // ignore assignment errors
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audio] startRendering failed:", err);
    throw err;
  }

  const ctx = await ensureAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = renderedBuffer as AudioBuffer;
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
