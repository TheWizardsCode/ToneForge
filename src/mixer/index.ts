/**
 * ToneForge Mixer Module
 *
 * Behaviour-aware mixing and routing layer. Provides the declarative rule
 * schema, the rule config loader, and the deterministic runtime arbitration
 * engine (group registry, voice ledger, rule evaluation).
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

export {
  Mixer,
  type MixGroupState,
  type MixDecision,
  type MixerInspection,
  type MixerOptions,
} from "./runtime.js";
