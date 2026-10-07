/**
 * ToneForge Runtime Module
 *
 * Lightweight, deterministic playback engine that ties together
 * State, Context, and Sequencer for real-time behavioral sound.
 *
 * The audio bridge (`audio.js`) composes the runtime with the existing
 * offline renderer and host playback layer for audible, render-backed
 * playback. `scenario.js` loads declarative scripted demos.
 *
 * Reference: docs/prd/RUNTIME_PRD.md
 */

export {
  createRuntime,
  type Runtime,
  type RuntimeOptions,
  type RuntimeEvent,
  type RuntimeLogEntry,
  type RuntimeInspection,
  type RuntimeListener,
  type RecipeResolver,
} from "./runtime.js";

export {
  loadRuntimeScenario,
  parseRuntimeScenario,
  validateRuntimeScenario,
  createTemplateRecipeResolver,
  resolveRecipeTemplate,
  type RuntimeScenario,
  type RuntimeScenarioContext,
  type RuntimeScenarioStep,
  type ScenarioValidationError,
} from "./scenario.js";

export {
  runRuntimeScenario,
  scheduleRuntimeBuffer,
  playRenderResultOnContext,
  type RuntimeAudioEvent,
  type RuntimeAudioRender,
  type RuntimeAudioResult,
  type RunRuntimeScenarioOptions,
  type SchedulableAudioBuffer,
  type SchedulableAudioBufferSource,
  type SchedulableAudioContext,
  type ScheduleBufferOptions,
} from "./audio.js";

export {
  createBufferCache,
  type BufferCache,
  type BufferCacheKey,
  type BufferCacheOptions,
  type BufferCacheStats,
} from "./buffer-cache.js";

export {
  createRuntimeSession,
  type RuntimeSession,
  type RuntimeSessionOptions,
  type RuntimeSessionStats,
  type SessionCommandResult,
  type SessionScheduler,
} from "./session.js";
