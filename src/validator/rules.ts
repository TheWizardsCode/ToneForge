/**
 * Validator Ruleset Definitions
 *
 * Declarative, platform-specific audio quality rules consumed by the
 * Validator check engine (see `checks.ts` and `engine.ts`).
 *
 * Rules are pure data: they never mutate assets and produce the same
 * result for the same input on every platform.
 *
 * Reference: docs/prd/VALIDATOR_PRD.md Sections 5-6,
 *            docs/prd/COMPILER_PRD.md Section 8.
 */

/** Strictness levels applied to rule violations. */
export type StrictnessLevel = "info" | "warning" | "error";

/**
 * Ordered strictness levels from least to most severe.
 *
 * A violation is emitted at the active strictness level; only `error`
 * findings block a build (see `engine.ts`).
 */
export const STRICTNESS_LEVELS: readonly StrictnessLevel[] = [
  "info",
  "warning",
  "error",
] as const;

/** Supported platform ruleset names. */
export type RulesetName = "mobile" | "web" | "console" | "desktop";

/** All supported ruleset names, in canonical order. */
export const RULESET_NAMES: readonly RulesetName[] = [
  "mobile",
  "web",
  "console",
  "desktop",
] as const;

/** Peak-clipping rule: flags assets whose peak amplitude exceeds the limit. */
export interface PeakClippingRule {
  /** Peak amplitude above which the asset is flagged. */
  readonly maxPeak: number;
}

/** Duration-bounds rule: flags assets outside the allowed duration window. */
export interface DurationRule {
  /** Minimum allowed duration in seconds (inclusive). */
  readonly min: number;
  /** Maximum allowed duration in seconds (inclusive). */
  readonly max: number;
}

/** Silence-ratio rule: flags assets with too much near-silent audio. */
export interface SilenceRatioRule {
  /** Maximum allowed proportion of near-silent samples, in [0, 1]. */
  readonly maxRatio: number;
  /** Per-sample amplitude below which a sample counts as silent. */
  readonly threshold: number;
}

/** The complete set of audio rules for a platform. */
export interface AudioRules {
  readonly peakClipping: PeakClippingRule;
  readonly duration: DurationRule;
  readonly silenceRatio: SilenceRatioRule;
}

/** A named platform ruleset bundling the audio rules for that target. */
export interface Ruleset {
  /** Platform name this ruleset applies to. */
  readonly name: RulesetName;
  /** Audio quality rules enforced for the platform. */
  readonly audio: AudioRules;
}

/**
 * Built-in platform rulesets.
 *
 * Mobile targets are the most constrained (short, headroom-limited
 * assets); desktop/console targets allow the widest duration and peak
 * range before flagging.
 */
export const RULESETS: Readonly<Record<RulesetName, Ruleset>> = {
  mobile: {
    name: "mobile",
    audio: {
      peakClipping: { maxPeak: 0.95 },
      duration: { min: 0.02, max: 1.5 },
      silenceRatio: { maxRatio: 0.35, threshold: 0.001 },
    },
  },
  web: {
    name: "web",
    audio: {
      peakClipping: { maxPeak: 0.98 },
      duration: { min: 0.02, max: 5.0 },
      silenceRatio: { maxRatio: 0.4, threshold: 0.001 },
    },
  },
  console: {
    name: "console",
    audio: {
      peakClipping: { maxPeak: 0.99 },
      duration: { min: 0.02, max: 10.0 },
      silenceRatio: { maxRatio: 0.5, threshold: 0.001 },
    },
  },
  desktop: {
    name: "desktop",
    audio: {
      peakClipping: { maxPeak: 0.99 },
      duration: { min: 0.02, max: 8.0 },
      silenceRatio: { maxRatio: 0.5, threshold: 0.001 },
    },
  },
};

/**
 * Type guard for a ruleset name.
 *
 * Used to reject unknown `--ruleset` values at runtime with an
 * actionable error rather than silently falling back.
 */
export function isRulesetName(value: string): value is RulesetName {
  return (RULESET_NAMES as readonly string[]).includes(value);
}

/** List all built-in ruleset names in canonical order. */
export function listRulesets(): RulesetName[] {
  return [...RULESET_NAMES];
}

/**
 * Look up a built-in ruleset by name.
 *
 * @throws If the name is not a supported ruleset.
 */
export function getRuleset(name: RulesetName): Ruleset {
  const ruleset = RULESETS[name];
  if (!ruleset) {
    throw new Error(
      `Unknown ruleset '${name}'. Supported rulesets: ${RULESET_NAMES.join(", ")}.`,
    );
  }
  return ruleset;
}

/**
 * Resolve a ruleset reference to a concrete `Ruleset`.
 *
 * Accepts either a built-in name or an already-resolved ruleset (for
 * custom, project-specific overrides supplied by callers).
 */
export function resolveRuleset(ref: RulesetName | Ruleset): Ruleset {
  return typeof ref === "string" ? getRuleset(ref) : ref;
}
