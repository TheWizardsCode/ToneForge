/**
 * Validator Module Public API
 *
 * Re-exports the ruleset definitions, core checks, and validation
 * engine for external consumers (e.g. the CLI `validate` command and
 * the Compiler's pre-build gate).
 *
 * Reference: docs/prd/VALIDATOR_PRD.md.
 */

export {
  RULESETS,
  RULESET_NAMES,
  STRICTNESS_LEVELS,
  isRulesetName,
  listRulesets,
  getRuleset,
  resolveRuleset,
} from "./rules.js";
export type {
  AudioRules,
  DurationRule,
  PeakClippingRule,
  Ruleset,
  RulesetName,
  SilenceRatioRule,
  StrictnessLevel,
} from "./rules.js";

export {
  DEFAULT_SILENCE_THRESHOLD,
  computeSilenceRatio,
  extractAudioFacts,
  runChecks,
  checkPeakClipping,
  checkDurationBounds,
  checkSilenceRatio,
} from "./checks.js";
export type {
  AudioFacts,
  CheckName,
  CheckResult,
  CheckStatus,
} from "./checks.js";

export { CHECK_NAMES, validateLibrary, validateLibraryDir } from "./engine.js";
export type {
  AssetValidation,
  CheckCounts,
  ValidateLibraryDirOptions,
  ValidateLibraryOptions,
  ValidationReport,
} from "./engine.js";
