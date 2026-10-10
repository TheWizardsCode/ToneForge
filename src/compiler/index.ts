/**
 * Compiler Module Public API
 *
 * Exposes the procedural-vs-baked decision engine, WAV output helpers,
 * and deterministic build-manifest utilities for external consumers
 * (the CLI `compile` command and integration tooling).
 *
 * Reference: docs/prd/COMPILER_PRD.md.
 */

export {
  COMPILE_DECISIONS,
  COMPILE_RULESETS,
  MANIFEST_FILE,
  compileLibrary,
  compileLibraryDir,
  decideAsset,
  getCompileRuleset,
  listCompileRulesets,
  planBuild,
} from "./engine.js";
export type {
  AssetMatchRule,
  AssetPlan,
  BuildPlan,
  CompileDecision,
  CompileDirOptions,
  CompileOptions,
  CompileResult,
  CompileRuleset,
  CompileRulesetName,
} from "./engine.js";

export { assetOutputPath, renderAsset, writeAsset } from "./output.js";
export type { CompiledAssetOutput } from "./output.js";

export {
  canonicalStringify,
  createManifest,
  hashBytes,
  parseManifest,
  serializeManifest,
} from "./manifest.js";
export type {
  BuildManifest,
  CreateManifestOptions,
  ManifestAsset,
} from "./manifest.js";
