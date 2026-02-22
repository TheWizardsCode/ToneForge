// Browser audio playback via Tone.js
// Renders recipes client-side using the same seed, plays through Web Audio API.

import * as Tone from "tone";
import { createRng } from "@toneforge/core/rng";
import { createUiSciFiConfirm } from "@toneforge/recipes/ui-scifi-confirm";

let audioContextStarted = false;

/**
 * Extract seed from a CLI command string.
 * Matches patterns like `--seed 42` or `--seed=42`.
 */
export function extractSeed(command: string): number | null {
  const match = command.match(/--seed[= ](\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if a command is a generate command for a supported recipe.
 */
export function isGenerateCommand(command: string): boolean {
  return (
    command.includes("generate") &&
    command.includes("--recipe ui-scifi-confirm") &&
    extractSeed(command) !== null
  );
}

/**
 * Ensure the audio context is started (satisfies autoplay policy).
 * Must be called from a user gesture handler.
 */
async function ensureAudioContext(): Promise<void> {
  if (!audioContextStarted) {
    await Tone.start();
    audioContextStarted = true;
  }
}

/**
 * Render and play a recipe with the given seed in the browser.
 *
 * Uses Tone.Offline to render the audio graph, then plays it
 * through the browser's Web Audio API.
 */
export async function renderAndPlay(seed: number): Promise<void> {
  await ensureAudioContext();

  const rng = createRng(seed);
  const recipe = createUiSciFiConfirm(rng);
  const duration = recipe.duration;

  // Render offline using Tone.Offline
  const buffer = await Tone.Offline(({ destination }) => {
    recipe.toDestination();
    recipe.start(0);
    recipe.stop(duration);
  }, duration);

  // Play the rendered buffer
  const player = new Tone.Player(buffer).toDestination();
  player.start();
}

/**
 * Handle a command: if it's a generate command, render and play in the browser.
 * Returns true if audio was played, false otherwise.
 */
export async function handleCommandAudio(command: string): Promise<boolean> {
  if (!isGenerateCommand(command)) {
    return false;
  }

  const seed = extractSeed(command);
  if (seed === null) {
    return false;
  }

  try {
    await renderAndPlay(seed);
    return true;
  } catch (err) {
    console.error("Browser audio playback failed:", err);
    return false;
  }
}
