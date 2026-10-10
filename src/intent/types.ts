/**
 * ToneForge Intent — structured intent schema and controlled vocabulary.
 *
 * An Intent is a structured expression of a desired outcome (PRD §4.1/§4.2):
 * `intent`, `scope`, `priority`, `constraints`. Interpretation is
 * deterministic and inspectable — there is no hidden NLP/LLM inference
 * (PRD §3, §8).
 */

/** Current Intent schema version. */
export const INTENT_VERSION = "1.0";

/** Allowed intent priorities. */
export const INTENT_PRIORITIES = ["low", "medium", "high"] as const;

/** An intent priority. */
export type IntentPriority = (typeof INTENT_PRIORITIES)[number];

/** Constraint values are primitives so intents serialise deterministically. */
export type IntentConstraintValue = string | number | boolean;

/** Intent constraints. */
export type IntentConstraints = Record<string, IntentConstraintValue>;

/** A structured Intent. */
export interface Intent {
  /** Controlled-vocabulary intent id. */
  intent: string;

  /** Explicit scope (category, behaviour, layer or `project`). */
  scope: string;

  /** Priority. */
  priority: IntentPriority;

  /** Optional constraints. */
  constraints: IntentConstraints;

  /** The original freeform goal, when one was supplied. */
  goal?: string;
}

/** A controlled-vocabulary intent definition. */
export interface IntentDefinition {
  /** Stable intent id. */
  id: string;

  /** Human-readable description. */
  description: string;

  /** Keyword vocabulary that maps a freeform goal to this intent. */
  keywords: string[];

  /** Priority applied when the goal does not specify one. */
  defaultPriority: IntentPriority;

  /** Default scope hint applied when the goal mentions one. */
  defaultScope: string;
}

/**
 * The documented controlled vocabulary. `toneforge intent vocabulary`
 * exposes this list for inspection.
 */
export const INTENT_VOCABULARY: readonly IntentDefinition[] = [
  {
    id: "reduce_repetition",
    description: "Reduce repeated or fatiguing sounds within a scope",
    keywords: ["reduce", "repetition", "repetitive", "repeat", "duplicate", "fatigue", "sameness"],
    defaultPriority: "medium",
    defaultScope: "project",
  },
  {
    id: "add_variety",
    description: "Introduce more variation within a scope",
    keywords: ["variety", "diversity", "vary", "variate", "more", "distinct", "range"],
    defaultPriority: "medium",
    defaultScope: "project",
  },
  {
    id: "calm_ui",
    description: "Make UI and feedback cues calmer and softer",
    keywords: ["calm", "soften", "softer", "quiet", "gentle", "subtle", "ui", "menu"],
    defaultPriority: "medium",
    defaultScope: "ui",
  },
  {
    id: "improve_clarity",
    description: "Improve clarity and distinctiveness of sounds",
    keywords: ["clarity", "clear", "distinct", "distinctive", "recognisable", "recognizable", "improve"],
    defaultPriority: "medium",
    defaultScope: "project",
  },
  {
    id: "heavier_impact",
    description: "Make impacts and weapons feel heavier and punchier",
    keywords: ["heavy", "heavier", "harder", "impact", "punch", "weight", "powerful"],
    defaultPriority: "high",
    defaultScope: "impact",
  },
  {
    id: "optimize_mobile",
    description: "Optimise for mobile performance budgets",
    keywords: ["optimize", "optimise", "mobile", "performance", "size", "budget", "memory", "footprint"],
    defaultPriority: "medium",
    defaultScope: "project",
  },
  {
    id: "smoother_transitions",
    description: "Smooth transitions and blends",
    keywords: ["smooth", "smoother", "transition", "blend", "seamless", "fade"],
    defaultPriority: "low",
    defaultScope: "sequence",
  },
  {
    id: "brighten_tone",
    description: "Brighten the tonal character",
    keywords: ["bright", "brighter", "crisp", "shine", "sparkle"],
    defaultPriority: "medium",
    defaultScope: "project",
  },
  {
    id: "darken_tone",
    description: "Darken the tonal character",
    keywords: ["dark", "darker", "moody", "muffled", "sombre", "somber"],
    defaultPriority: "low",
    defaultScope: "project",
  },
  {
    id: "balance_mix",
    description: "Balance mix levels and loudness",
    keywords: ["balance", "mix", "level", "loudness", "masking", "clarity"],
    defaultPriority: "medium",
    defaultScope: "mixer",
  },
];

/** Look up a vocabulary entry by id. */
export function findIntentDefinition(id: string): IntentDefinition | undefined {
  return INTENT_VOCABULARY.find((entry) => entry.id === id);
}

/** All vocabulary ids, sorted for deterministic display. */
export function intentVocabularyIds(): string[] {
  return INTENT_VOCABULARY.map((entry) => entry.id).sort();
}

/** Validate an unknown value as an {@link Intent}. */
export function validateIntent(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return ["intent must be an object"];
  }
  const v = value as Record<string, unknown>;
  if (typeof v["intent"] !== "string" || v["intent"].length === 0) {
    errors.push("intent must be a non-empty string");
  }
  if (typeof v["scope"] !== "string" || v["scope"].length === 0) {
    errors.push("scope must be a non-empty string");
  }
  if (typeof v["priority"] !== "string" || !(INTENT_PRIORITIES as readonly string[]).includes(v["priority"])) {
    errors.push(`priority must be one of: ${INTENT_PRIORITIES.join(", ")}`);
  }
  if (typeof v["constraints"] !== "object" || v["constraints"] === null || Array.isArray(v["constraints"])) {
    errors.push("constraints must be an object");
  }
  return errors;
}

/**
 * Validate and return a typed {@link Intent}.
 *
 * @throws {Error} when validation fails, listing every field error.
 */
export function parseIntent(value: unknown): Intent {
  const errors = validateIntent(value);
  if (errors.length > 0) {
    throw new Error(`Invalid intent: ${errors.join("; ")}`);
  }
  return value as Intent;
}
