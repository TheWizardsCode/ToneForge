/**
 * ToneForge Mixer Module
 *
 * Behaviour-aware mixing and routing layer. This module currently provides
 * the declarative rule schema and the rule config loader; the runtime
 * arbitration engine is delivered separately (TF-0MMLC8B3T0Z1F7ZM).
 *
 * Reference: docs/prd/MIXER_PRD.md; docs/mixer-rules.md
 */

export {
  MIX_GROUPS,
  MIXER_DEFAULTS,
  DEFAULT_GROUP_PRIORITIES,
  BUILT_IN_MIX_RULES,
  validateMixRuleSet,
  parseMixRuleSet,
  formatValidationErrors,
  type MixGroupName,
  type MixerDefaults,
  type MixGroupConfig,
  type DuckAction,
  type BoostAction,
  type LimitAction,
  type MixRuleWhen,
  type MixRuleThen,
  type MixRule,
  type MixRuleSet,
  type RawMixDefaults,
  type RawMixGroupConfig,
  type RawMixRule,
  type RawMixRuleFile,
  type ValidationError,
} from "./schema.js";

export {
  MIX_RULES_DIR_PARTS,
  loadMixRules,
  resolveMixRulesDir,
  type LoadMixRulesOptions,
} from "./rules-loader.js";
