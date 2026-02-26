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
 * Check if a command is an audio-producing command with a recipe and seed.
 * Matches both `generate --recipe` and `sequence generate --recipe` patterns.
 */
export function isGenerateCommand(command: string): boolean {
  return (
    command.includes("generate") &&
    extractRecipeName(command) !== null &&
    extractSeed(command) !== null
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
    command.includes("stack") &&
    command.includes("render") &&
    extractPresetName(command) !== null &&
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
    footstepGravelModule,
    creatureVocalModule,
    vehicleEngineModule,
    characterJumpStep1Module,
    characterJumpStep2Module,
    characterJumpStep3Module,
    characterJumpStep4Module,
    characterJumpModule,
    impactCrackModule,
    rumbleBodyModule,
    debrisTailModule,
    slamTransientModule,
    resonanceBodyModule,
    rattleDecayModule,
  ] = await Promise.all([
    import("tone"),
    import("@toneforge/core/rng"),
    import("@toneforge/recipes/ui-scifi-confirm"),
    import("@toneforge/recipes/weapon-laser-zap"),
    import("@toneforge/recipes/footstep-stone"),
    import("@toneforge/recipes/ui-notification-chime"),
    import("@toneforge/recipes/ambient-wind-gust"),
    import("@toneforge/recipes/footstep-gravel"),
    import("@toneforge/recipes/creature-vocal"),
    import("@toneforge/recipes/vehicle-engine"),
    import("@toneforge/recipes/character-jump-step1"),
    import("@toneforge/recipes/character-jump-step2"),
    import("@toneforge/recipes/character-jump-step3"),
    import("@toneforge/recipes/character-jump-step4"),
    import("@toneforge/recipes/character-jump"),
    import("@toneforge/recipes/impact-crack"),
    import("@toneforge/recipes/rumble-body"),
    import("@toneforge/recipes/debris-tail"),
    import("@toneforge/recipes/slam-transient"),
    import("@toneforge/recipes/resonance-body"),
    import("@toneforge/recipes/rattle-decay"),
  ]);

  Tone = toneModule;
  createRng = rngModule.createRng;
  recipeFactories = {
    "ui-scifi-confirm": uiSciFiConfirmModule.createUiSciFiConfirm,
    "weapon-laser-zap": weaponLaserZapModule.createWeaponLaserZap,
    "footstep-stone": footstepStoneModule.createFootstepStone,
    "ui-notification-chime": uiNotificationChimeModule.createUiNotificationChime,
    "ambient-wind-gust": ambientWindGustModule.createAmbientWindGust,
    "footstep-gravel": footstepGravelModule.createFootstepGravel,
    "creature-vocal": creatureVocalModule.createCreatureVocal,
    "vehicle-engine": vehicleEngineModule.createVehicleEngine,
    "character-jump-step1": characterJumpStep1Module.createCharacterJumpStep1,
    "character-jump-step2": characterJumpStep2Module.createCharacterJumpStep2,
    "character-jump-step3": characterJumpStep3Module.createCharacterJumpStep3,
    "character-jump-step4": characterJumpStep4Module.createCharacterJumpStep4,
    "character-jump": characterJumpModule.createCharacterJump,
    "impact-crack": impactCrackModule.createImpactCrack,
    "rumble-body": rumbleBodyModule.createRumbleBody,
    "debris-tail": debrisTailModule.createDebrisTail,
    "slam-transient": slamTransientModule.createSlamTransient,
    "resonance-body": resonanceBodyModule.createResonanceBody,
    "rattle-decay": rattleDecayModule.createRattleDecay,
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

  // Render offline using Tone.Offline.
  // Tone.js sets the offline context as the global context during the callback,
  // so recipe.toDestination() correctly routes to the offline destination.
  const buffer = await Tone!.Offline(() => {
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
 * Stack render commands are detected but gracefully skipped (browser-side
 * multi-layer rendering from preset files is not yet supported).
 * Returns true if audio was played, false otherwise.
 */
export async function handleCommandAudio(command: string): Promise<boolean> {
  // Stack render commands: detected but not yet supported in the browser.
  // Log a visible notice so the user understands why there's no audio.
  if (isStackRenderCommand(command)) {
    console.info(
      "Stack render detected — browser audio playback for stacked presets is not yet supported. " +
      "Audio will play from the CLI output only.",
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
