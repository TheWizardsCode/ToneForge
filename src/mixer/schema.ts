/**
 * Mixer Rule Schema
 *
 * Defines the declarative JSON schema for Mixer mix rules and provides
 * validation plus normalisation. Rules map a state/context trigger
 * (`when`) to duck/boost/limit actions (`then`), matching the shape in
 * `docs/prd/MIXER_PRD.md` §4.3:
 *
 * ```json
 * {
 *   "when": { "state": "combat" },
 *   "then": {
 *     "duck": ["ambience"],
 *     "boost": ["combat"],
 *     "limit": ["ui"]
 *   }
 * }
 * ```
 *
 * The schema is intentionally declarative (JSON only, no code execution) so
 * rule files stay auditable, version-controlled and deterministic. Built-in
 * defaults mirror the committed seed file `.toneforge/mixer/rules.json`:
 * `maxVoices` 4, duck depth 6 dB, UI duck duration 200 ms.
 *
 * Reference: docs/prd/MIXER_PRD.md §4; docs/mixer-rules.md
 */

// ── Mix groups ────────────────────────────────────────────────────

/**
 * The six confirmed mix groups (parent epic Appendix Q2.1). Groups are
 * intent-based semantic categories, not channel strips.
 */
export const MIX_GROUPS = [
  "footsteps",
  "ui",
  "combat",
  "ambience",
  "dialogue",
  "alerts",
] as const;

/** Canonical (lowercase) mix group name. */
export type MixGroupName = (typeof MIX_GROUPS)[number];

// ── Defaults ──────────────────────────────────────────────────────

/** Mixer-wide default values applied when a rule omits an explicit value. */
export interface MixerDefaults {
  /** Default maximum concurrent voices per group (default: 4). */
  maxVoices: number;

  /** Default duck depth in dB, as a positive attenuation magnitude (default: 6). */
  duckDepthDb: number;

  /** Default duck duration in ms for UI-triggered rules (default: 200). */
  uiDuckDurationMs: number;
}

/** The confirmed built-in mixer defaults. */
export const MIXER_DEFAULTS: Readonly<MixerDefaults> = {
  maxVoices: 4,
  duckDepthDb: 6,
  uiDuckDurationMs: 200,
};

/** Per-group configuration exposed to the Mixer runtime. */
export interface MixGroupConfig {
  /** Priority level; higher dominates under contention. */
  priority: number;

  /** Maximum concurrent voices admitted for this group. */
  maxVoices: number;
}

/**
 * Built-in group priorities. Ordering follows `docs/prd/MIXER_PRD.md` §4.2
 * (dialogue > UI > combat > ambience) with alerts placed above UI.
 */
export const DEFAULT_GROUP_PRIORITIES: Readonly<Record<MixGroupName, number>> = {
  dialogue: 100,
  alerts: 90,
  ui: 80,
  combat: 60,
  footsteps: 40,
  ambience: 20,
};

// ── Normalised rule types ─────────────────────────────────────────

/** A duck action: attenuate `group` by `depthDb`, optionally for `durationMs`. */
export interface DuckAction {
  group: MixGroupName;

  /** Positive attenuation magnitude in dB (e.g. 6 means −6 dB). */
  depthDb: number;

  /** Optional duck duration in ms (UI-triggered rules default this to 200). */
  durationMs?: number;
}

/** A boost action: raise the priority/gain of `group`. */
export interface BoostAction {
  group: MixGroupName;

  /** Optional explicit gain increase in dB. */
  gainDb?: number;
}

/** A limit action: cap `group` at `maxVoices` concurrent voices. */
export interface LimitAction {
  group: MixGroupName;
  maxVoices: number;
}

/** The trigger for a mix rule. At least one of `state` / `context` is required. */
export interface MixRuleWhen {
  /** State name that activates the rule (e.g. "combat"). */
  state?: string;

  /** Context dimensions that must match (all key/value pairs) to activate. */
  context?: Record<string, string>;
}

/** The actions a mix rule applies when its trigger matches. */
export interface MixRuleThen {
  duck: DuckAction[];
  boost: BoostAction[];
  limit: LimitAction[];
}

/** A single declarative mix rule. */
export interface MixRule {
  /** Optional stable identifier for inspection/debugging. */
  id?: string;

  when: MixRuleWhen;

  then: MixRuleThen;
}

/** A fully validated, normalised rule set ready for the Mixer runtime. */
export interface MixRuleSet {
  version: string;
  defaults: MixerDefaults;
  groups: Record<MixGroupName, MixGroupConfig>;
  rules: MixRule[];
}

// ── Raw (on-disk) rule types ──────────────────────────────────────

/** Raw `defaults` object as it may appear in a rule file. */
export interface RawMixDefaults {
  maxVoices?: number;
  duckDepthDb?: number;
  uiDuckDurationMs?: number;
}

/** Raw per-group config as it may appear in a rule file. */
export interface RawMixGroupConfig {
  priority?: number;
  maxVoices?: number;
}

/** Raw rule entry; action arrays are validated at parse time. */
export type RawMixRule = Record<string, unknown>;

/** Raw rule-set file shape (each `.json` file in `.toneforge/mixer/`). */
export interface RawMixRuleFile {
  version?: string;
  defaults?: RawMixDefaults;
  groups?: Record<string, RawMixGroupConfig>;
  rules?: RawMixRule[];
}

// ── Validation errors ─────────────────────────────────────────────

/** A structured validation error with field-level detail. */
export interface ValidationError {
  /** Path to the invalid field (e.g. "rules[2].then.duck[0].group"). */
  field: string;

  /** Human-readable, actionable error message. */
  message: string;
}

// ── Validation helpers ────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

/** Normalise a group name to its canonical lowercase form. */
function canonicalGroup(name: string): MixGroupName {
  return name.trim().toLowerCase() as MixGroupName;
}

/** Whether *name* (case-insensitive) is one of the six confirmed mix groups. */
function isKnownGroup(name: string): boolean {
  return (MIX_GROUPS as readonly string[]).includes(name.trim().toLowerCase());
}

/**
 * Validate a group name field, returning whether it is valid.
 *
 * @param value - The raw value to validate.
 * @param prefix - Field path for error reporting.
 * @param errors - Error accumulator.
 * @returns True when *value* is a known mix group.
 */
function validateGroupName(
  value: unknown,
  prefix: string,
  errors: ValidationError[],
): boolean {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push({
      field: prefix,
      message: `Missing or invalid group name (expected one of: ${MIX_GROUPS.join(", ")}).`,
    });
    return false;
  }
  if (!isKnownGroup(value)) {
    errors.push({
      field: prefix,
      message: `Unknown mix group '${value}' (expected one of: ${MIX_GROUPS.join(", ")}).`,
    });
    return false;
  }
  return true;
}

function validateDefaults(
  defaults: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (defaults["maxVoices"] !== undefined && !isPositiveInteger(defaults["maxVoices"])) {
    errors.push({
      field: "defaults.maxVoices",
      message: "Invalid 'maxVoices' (expected positive integer).",
    });
  }
  if (defaults["duckDepthDb"] !== undefined) {
    const depth = defaults["duckDepthDb"];
    if (!isFiniteNumber(depth) || (depth as number) < 0) {
      errors.push({
        field: "defaults.duckDepthDb",
        message: "Invalid 'duckDepthDb' (expected non-negative number).",
      });
    }
  }
  if (defaults["uiDuckDurationMs"] !== undefined) {
    const duration = defaults["uiDuckDurationMs"];
    if (!isFiniteNumber(duration) || (duration as number) < 0) {
      errors.push({
        field: "defaults.uiDuckDurationMs",
        message: "Invalid 'uiDuckDurationMs' (expected non-negative number).",
      });
    }
  }
}

function validateDuck(
  value: unknown,
  prefix: string,
  errors: ValidationError[],
): void {
  if (!Array.isArray(value)) {
    errors.push({ field: prefix, message: "Invalid 'duck' (expected array of targets)." });
    return;
  }
  value.forEach((target, i) => {
    const p = `${prefix}[${i}]`;
    if (typeof target === "string") {
      validateGroupName(target, p, errors);
      return;
    }
    if (!isPlainObject(target)) {
      errors.push({
        field: p,
        message: "Duck target must be a group name string or an object.",
      });
      return;
    }
    if (!validateGroupName(target["group"], `${p}.group`, errors)) return;
    if (target["depthDb"] !== undefined) {
      const depth = target["depthDb"];
      if (!isFiniteNumber(depth) || (depth as number) <= 0) {
        errors.push({
          field: `${p}.depthDb`,
          message: "Invalid 'depthDb' (expected positive number).",
        });
      }
    }
    if (target["durationMs"] !== undefined) {
      const duration = target["durationMs"];
      if (!isFiniteNumber(duration) || (duration as number) < 0) {
        errors.push({
          field: `${p}.durationMs`,
          message: "Invalid 'durationMs' (expected non-negative number).",
        });
      }
    }
  });
}

function validateBoost(
  value: unknown,
  prefix: string,
  errors: ValidationError[],
): void {
  if (!Array.isArray(value)) {
    errors.push({ field: prefix, message: "Invalid 'boost' (expected array of targets)." });
    return;
  }
  value.forEach((target, i) => {
    const p = `${prefix}[${i}]`;
    if (typeof target === "string") {
      validateGroupName(target, p, errors);
      return;
    }
    if (!isPlainObject(target)) {
      errors.push({
        field: p,
        message: "Boost target must be a group name string or an object.",
      });
      return;
    }
    if (!validateGroupName(target["group"], `${p}.group`, errors)) return;
    if (target["gainDb"] !== undefined && !isFiniteNumber(target["gainDb"])) {
      errors.push({
        field: `${p}.gainDb`,
        message: "Invalid 'gainDb' (expected finite number).",
      });
    }
  });
}

function validateLimit(
  value: unknown,
  prefix: string,
  errors: ValidationError[],
): void {
  if (!Array.isArray(value)) {
    errors.push({ field: prefix, message: "Invalid 'limit' (expected array of targets)." });
    return;
  }
  value.forEach((target, i) => {
    const p = `${prefix}[${i}]`;
    if (typeof target === "string") {
      validateGroupName(target, p, errors);
      return;
    }
    if (!isPlainObject(target)) {
      errors.push({
        field: p,
        message: "Limit target must be a group name string or an object.",
      });
      return;
    }
    if (!validateGroupName(target["group"], `${p}.group`, errors)) return;
    if (target["maxVoices"] !== undefined && !isPositiveInteger(target["maxVoices"])) {
      errors.push({
        field: `${p}.maxVoices`,
        message: "Invalid 'maxVoices' (expected positive integer).",
      });
    }
  });
}

function validateRule(rule: unknown, prefix: string, errors: ValidationError[]): void {
  if (!isPlainObject(rule)) {
    errors.push({ field: prefix, message: "Rule must be an object." });
    return;
  }

  if (rule["id"] !== undefined && typeof rule["id"] !== "string") {
    errors.push({ field: `${prefix}.id`, message: "Invalid 'id' (expected string)." });
  }

  const when = rule["when"];
  if (!isPlainObject(when)) {
    errors.push({
      field: `${prefix}.when`,
      message: "Missing or invalid 'when' (expected object with 'state' and/or 'context').",
    });
  } else {
    const hasState = when["state"] !== undefined;
    const hasContext = when["context"] !== undefined;
    if (!hasState && !hasContext) {
      errors.push({
        field: `${prefix}.when`,
        message: "'when' must define 'state' and/or 'context'.",
      });
    }
    if (hasState && (typeof when["state"] !== "string" || (when["state"] as string).trim() === "")) {
      errors.push({
        field: `${prefix}.when.state`,
        message: "Invalid 'state' (expected non-empty string).",
      });
    }
    if (hasContext) {
      const context = when["context"];
      if (!isPlainObject(context)) {
        errors.push({
          field: `${prefix}.when.context`,
          message: "Invalid 'context' (expected object of string values).",
        });
      } else {
        for (const [key, value] of Object.entries(context)) {
          if (typeof value !== "string") {
            errors.push({
              field: `${prefix}.when.context.${key}`,
              message: "Context values must be strings.",
            });
          }
        }
      }
    }
  }

  const then = rule["then"];
  if (!isPlainObject(then)) {
    errors.push({
      field: `${prefix}.then`,
      message: "Missing or invalid 'then' (expected object with 'duck', 'boost' and/or 'limit').",
    });
    return;
  }
  const hasDuck = then["duck"] !== undefined;
  const hasBoost = then["boost"] !== undefined;
  const hasLimit = then["limit"] !== undefined;
  if (!hasDuck && !hasBoost && !hasLimit) {
    errors.push({
      field: `${prefix}.then`,
      message: "'then' must define at least one of 'duck', 'boost', 'limit'.",
    });
    return;
  }
  if (hasDuck) validateDuck(then["duck"], `${prefix}.then.duck`, errors);
  if (hasBoost) validateBoost(then["boost"], `${prefix}.then.boost`, errors);
  if (hasLimit) validateLimit(then["limit"], `${prefix}.then.limit`, errors);
}

/**
 * Validate a parsed JSON object against the mixer rule schema.
 *
 * @param data - The parsed JSON data.
 * @param source - File path / label used in error messages.
 * @returns Array of validation errors (empty = valid).
 */
export function validateMixRuleSet(data: unknown, source: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isPlainObject(data)) {
    errors.push({
      field: "(root)",
      message: `Invalid mixer rules '${source}': expected a JSON object.`,
    });
    return errors;
  }

  if (typeof data["version"] !== "string" || (data["version"] as string).trim() === "") {
    errors.push({
      field: "version",
      message: `Missing or invalid 'version' (expected non-empty string, e.g. "1.0").`,
    });
  }

  const defaults = data["defaults"];
  if (defaults !== undefined) {
    if (!isPlainObject(defaults)) {
      errors.push({ field: "defaults", message: "Invalid 'defaults' (expected object)." });
    } else {
      validateDefaults(defaults, errors);
    }
  }

  const groups = data["groups"];
  if (groups !== undefined) {
    if (!isPlainObject(groups)) {
      errors.push({ field: "groups", message: "Invalid 'groups' (expected object)." });
    } else {
      for (const [key, value] of Object.entries(groups)) {
        if (!isKnownGroup(key)) {
          errors.push({
            field: `groups.${key}`,
            message: `Unknown mix group '${key}' (expected one of: ${MIX_GROUPS.join(", ")}).`,
          });
          continue;
        }
        if (!isPlainObject(value)) {
          errors.push({
            field: `groups.${key}`,
            message: "Invalid group config (expected object).",
          });
          continue;
        }
        if (value["priority"] !== undefined && !isFiniteNumber(value["priority"])) {
          errors.push({
            field: `groups.${key}.priority`,
            message: "Invalid 'priority' (expected finite number).",
          });
        }
        if (value["maxVoices"] !== undefined && !isPositiveInteger(value["maxVoices"])) {
          errors.push({
            field: `groups.${key}.maxVoices`,
            message: "Invalid 'maxVoices' (expected positive integer).",
          });
        }
      }
    }
  }

  const rules = data["rules"];
  if (rules !== undefined) {
    if (!Array.isArray(rules)) {
      errors.push({ field: "rules", message: "Invalid 'rules' (expected array)." });
    } else {
      rules.forEach((rule, i) => validateRule(rule, `rules[${i}]`, errors));
    }
  }

  return errors;
}

/**
 * Format validation errors into a single actionable message.
 *
 * @param source - File path / label the errors relate to.
 * @param errors - Validation errors.
 * @returns Multi-line error message.
 */
export function formatValidationErrors(
  source: string,
  errors: ValidationError[],
): string {
  const details = errors.map((e) => `  ${e.field}: ${e.message}`).join("\n");
  return `Invalid mixer rules '${source}':\n${details}`;
}

// ── Normalisation ─────────────────────────────────────────────────

function mergeDefaults(raw: unknown): MixerDefaults {
  const defaults: MixerDefaults = { ...MIXER_DEFAULTS };
  if (isPlainObject(raw)) {
    if (isPositiveInteger(raw["maxVoices"])) defaults.maxVoices = raw["maxVoices"] as number;
    if (isFiniteNumber(raw["duckDepthDb"])) defaults.duckDepthDb = raw["duckDepthDb"] as number;
    if (isFiniteNumber(raw["uiDuckDurationMs"])) {
      defaults.uiDuckDurationMs = raw["uiDuckDurationMs"] as number;
    }
  }
  return defaults;
}

function buildGroups(
  raw: unknown,
  defaults: MixerDefaults,
): Record<MixGroupName, MixGroupConfig> {
  const rawGroups = isPlainObject(raw) ? raw : {};
  const groups = {} as Record<MixGroupName, MixGroupConfig>;
  for (const name of MIX_GROUPS) {
    const rawGroup = rawGroups[name];
    const group = isPlainObject(rawGroup) ? rawGroup : {};
    groups[name] = {
      priority: isFiniteNumber(group["priority"])
        ? (group["priority"] as number)
        : DEFAULT_GROUP_PRIORITIES[name],
      maxVoices: isPositiveInteger(group["maxVoices"])
        ? (group["maxVoices"] as number)
        : defaults.maxVoices,
    };
  }
  return groups;
}

function buildDuck(
  raw: unknown,
  defaults: MixerDefaults,
  when: MixRuleWhen,
): DuckAction[] {
  if (!Array.isArray(raw)) return [];
  const uiTriggered = when.state === "ui";
  return raw.map((target) => {
    if (typeof target === "string") {
      const action: DuckAction = {
        group: canonicalGroup(target),
        depthDb: defaults.duckDepthDb,
      };
      if (uiTriggered) action.durationMs = defaults.uiDuckDurationMs;
      return action;
    }
    const obj = target as Record<string, unknown>;
    const action: DuckAction = {
      group: canonicalGroup(obj["group"] as string),
      depthDb: isFiniteNumber(obj["depthDb"])
        ? (obj["depthDb"] as number)
        : defaults.duckDepthDb,
    };
    const duration = isFiniteNumber(obj["durationMs"])
      ? (obj["durationMs"] as number)
      : uiTriggered
        ? defaults.uiDuckDurationMs
        : undefined;
    if (duration !== undefined) action.durationMs = duration;
    return action;
  });
}

function buildBoost(raw: unknown): BoostAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((target) => {
    if (typeof target === "string") {
      return { group: canonicalGroup(target) };
    }
    const obj = target as Record<string, unknown>;
    const action: BoostAction = { group: canonicalGroup(obj["group"] as string) };
    if (isFiniteNumber(obj["gainDb"])) action.gainDb = obj["gainDb"] as number;
    return action;
  });
}

function buildLimit(raw: unknown, defaults: MixerDefaults): LimitAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((target) => {
    if (typeof target === "string") {
      return { group: canonicalGroup(target), maxVoices: defaults.maxVoices };
    }
    const obj = target as Record<string, unknown>;
    return {
      group: canonicalGroup(obj["group"] as string),
      maxVoices: isPositiveInteger(obj["maxVoices"])
        ? (obj["maxVoices"] as number)
        : defaults.maxVoices,
    };
  });
}

function buildRules(raw: unknown, defaults: MixerDefaults): MixRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const rule = entry as Record<string, unknown>;
    const whenRaw = rule["when"] as Record<string, unknown>;
    const when: MixRuleWhen = {};
    if (typeof whenRaw["state"] === "string") when.state = whenRaw["state"];
    if (isPlainObject(whenRaw["context"])) {
      const context: Record<string, string> = {};
      for (const [key, value] of Object.entries(whenRaw["context"])) {
        context[key] = String(value);
      }
      when.context = context;
    }

    const thenRaw = rule["then"] as Record<string, unknown>;
    const then: MixRuleThen = {
      duck: buildDuck(thenRaw["duck"], defaults, when),
      boost: buildBoost(thenRaw["boost"]),
      limit: buildLimit(thenRaw["limit"], defaults),
    };

    const parsed: MixRule = { when, then };
    if (typeof rule["id"] === "string") parsed.id = rule["id"];
    return parsed;
  });
}

/**
 * Validate and normalise a parsed rule-set object into a `MixRuleSet`.
 *
 * String action targets are expanded using the resolved defaults; all six mix
 * groups are always present in the result. Throws with actionable field-level
 * errors when the input is invalid.
 *
 * @param data - The parsed JSON data.
 * @param source - File path / label used in error messages.
 * @returns A validated, normalised rule set.
 * @throws If validation fails.
 */
export function parseMixRuleSet(data: unknown, source: string): MixRuleSet {
  const errors = validateMixRuleSet(data, source);
  if (errors.length > 0) {
    throw new Error(formatValidationErrors(source, errors));
  }

  const obj = data as Record<string, unknown>;
  const defaults = mergeDefaults(obj["defaults"]);
  return {
    version: obj["version"] as string,
    defaults,
    groups: buildGroups(obj["groups"], defaults),
    rules: buildRules(obj["rules"], defaults),
  };
}

// ── Built-in rule set ─────────────────────────────────────────────

/**
 * The built-in rule set used when no rules file is present (mirrors the
 * committed seed file `.toneforge/mixer/rules.json`).
 */
export const BUILT_IN_MIX_RULES: MixRuleSet = parseMixRuleSet(
  {
    version: "1.0",
    defaults: { ...MIXER_DEFAULTS },
    rules: [
      {
        id: "combat-focus",
        when: { state: "combat" },
        then: { duck: ["ambience"], boost: ["combat"], limit: ["ui"] },
      },
      {
        id: "ui-clarity",
        when: { state: "ui" },
        then: { duck: ["ambience", "footsteps"] },
      },
    ],
  },
  "<built-in>",
);
