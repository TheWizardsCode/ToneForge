/**
 * ToneForge Integrations — public module surface.
 *
 * Combines the conformance harness (four-stage generate → validate →
 * compile → export pipeline) with the engine-adapter layer that maps
 * ToneForge metadata onto a target engine's audio system and syncs assets
 * via `toneforge sync --target <engine>`.
 *
 * Importing this module registers the built-in `unity` and `web` adapters.
 *
 * Reference: docs/prd/INTEGRATIONS_PRD.md, docs/integrations.md.
 *
 * Work item: TF-0MUZYS2VP007O99D.
 */

export {
  ENGINE_BUILD_ID_PREFIX,
  ENGINE_MANIFEST_FILE,
  SyncValidationError,
  UnsupportedTargetError,
  buildEngineManifest,
  getAdapter,
  listTargets,
  registerAdapter,
  safeSegment,
  syncLibrary,
  unregisterAdapter,
} from "./adapter.js";
export type {
  EngineAdapter,
  EngineAsset,
  EngineManifest,
  SyncOptions,
  SyncResult,
} from "./adapter.js";

export {
  UNITY_CATEGORY_AUDIO_GROUPS,
  UNITY_DEFAULT_AUDIO_GROUP,
  UNITY_DEFAULT_MIXER_BUS,
  UNITY_TAG_MIXER_BUSES,
  unityAdapter,
} from "./unity.js";

export {
  WEB_CATEGORY_AUDIO_GROUPS,
  WEB_DEFAULT_AUDIO_GROUP,
  WEB_DEFAULT_MIXER_BUS,
  WEB_TAG_MIXER_BUSES,
  webAdapter,
} from "./web.js";

export {
  PIPELINE_STAGES,
  fixturePath,
  generateLibrary,
  loadFixture,
  parseFixture,
  readCompiledManifest,
  runPipeline,
  runPipelineFromFixture,
} from "./harness.js";
export type {
  FixtureCompileConfig,
  FixtureValidationConfig,
  GenerateStageResult,
  IntegrationFixture,
  IntegrationFixtureEntry,
  PipelineResult,
  PipelineRunOptions,
  PipelineStage,
} from "./harness.js";

import { registerAdapter } from "./adapter.js";
import { unityAdapter } from "./unity.js";
import { webAdapter } from "./web.js";

// Register the built-in adapters once, on module load. Third-party adapters
// can register additional targets via `registerAdapter` without core changes.
registerAdapter(unityAdapter);
registerAdapter(webAdapter);
