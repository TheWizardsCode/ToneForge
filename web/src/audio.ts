// Browser audio playback via Tone.js
// Renders recipes client-side using the same seed, plays through Web Audio API.
//
// IMPORTANT: Tone.js is loaded lazily via dynamic import() to avoid creating
// an AudioContext before a user gesture. Static imports of "tone" would trigger
// AudioContext creation on page load, which Chrome blocks with:
//   "The AudioContext was not allowed to start."
//
// Recipe factories are also lazy-loaded alongside Tone.js. All registered
// recipes are supported — the recipe name is extracted from the CLI command
// string and dispatched to the corresponding factory.

import type { RecipeFactory } from "@toneforge/core/recipe.js";

// Lazy-loaded module references (populated on first use inside a click handler)
let Tone: typeof import("tone") | null = null;
let createRng: typeof import("@toneforge/core/rng").createRng | null = null;
let recipeFactories: Record<string, RecipeFactory> | null = null;

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
 * Extract recipe name from a CLI command string.
 * Matches patterns like `--recipe weapon-laser-zap`.
 */
export function extractRecipeName(command: string): string | null {
  const match = command.match(/--recipe\s+(\S+)/);
  return match ? match[1] : null;
}

/**
 * Check if a command is a generate command with a recipe and seed.
 */
export function isGenerateCommand(command: string): boolean {
  return (
    command.includes("generate") &&
    extractRecipeName(command) !== null &&
    extractSeed(command) !== null
  );
}

/**
 * Lazily load Tone.js and all recipe dependencies.
 * Must be called from within a user gesture handler (click, etc.)
 * to satisfy the browser autoplay policy.
 */
async function loadAudioDeps(): Promise<void> {
  if (Tone) return; // already loaded

  const [
    toneModule,
    rngModule,
    uiSciFiConfirmModule,
    weaponLaserZapModule,
    footstepStoneModule,
    uiNotificationChimeModule,
    ambientWindGustModule,
  ] = await Promise.all([
    import("tone"),
    import("@toneforge/core/rng"),
    import("@toneforge/recipes/ui-scifi-confirm"),
    import("@toneforge/recipes/weapon-laser-zap"),
    import("@toneforge/recipes/footstep-stone"),
    import("@toneforge/recipes/ui-notification-chime"),
    import("@toneforge/recipes/ambient-wind-gust"),
  ]);

  Tone = toneModule;
  createRng = rngModule.createRng;
  recipeFactories = {
    "ui-scifi-confirm": uiSciFiConfirmModule.createUiSciFiConfirm,
    "weapon-laser-zap": weaponLaserZapModule.createWeaponLaserZap,
    "footstep-stone": footstepStoneModule.createFootstepStone,
    "ui-notification-chime": uiNotificationChimeModule.createUiNotificationChime,
    "ambient-wind-gust": ambientWindGustModule.createAmbientWindGust,
  };
}

/**
 * Ensure the audio context is started (satisfies autoplay policy).
 * Must be called from a user gesture handler.
 */
async function ensureAudioContext(): Promise<void> {
  await loadAudioDeps();
  if (!audioContextStarted) {
    await Tone!.start();
    audioContextStarted = true;
  }
}

/**
 * Render and play a recipe with the given seed in the browser.
 *
 * Uses Tone.Offline to render the audio graph, then plays it
 * through the browser's Web Audio API.
 */
export async function renderAndPlay(recipeName: string, seed: number): Promise<void> {
  await ensureAudioContext();

  const factory = recipeFactories![recipeName];
  if (!factory) {
    console.warn(`Unknown recipe "${recipeName}" — skipping audio playback.`);
    return;
  }

  const rng = createRng!(seed);
  const recipe = factory(rng);
  const duration = recipe.duration;

  // Render offline using Tone.Offline
  const buffer = await Tone!.Offline(({ destination }) => {
    recipe.toDestination();
    recipe.start(0);
    recipe.stop(duration);
  }, duration);

  // Play the rendered buffer
  const player = new Tone!.Player(buffer).toDestination();
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
