/**
 * Mixer Runtime
 *
 * Deterministic arbitration core for the ToneForge Mixer. It maintains a
 * registry of the six mix groups, tracks active voices per group, and
 * evaluates the declarative rule set (`when {state|context}` →
 * `then {duck|boost|limit}`) into a flat list of per-event decisions.
 *
 * Design goals (docs/prd/MIXER_PRD.md §3, §8, §10):
 * - behaviour-aware, deterministic decisions — the same state/context and
 *   rule set always produce the same gains, caps and decisions;
 * - low-latency, constant-time-per-rule evaluation (no allocation-heavy work
 *   in the hot path, no ML inference, no auto-applied suggestions);
 * - bounded gains — gains only move in response to an explicit rule action.
 *
 * The runtime does **not** generate or route audio; it produces the
 * decisions the Runtime/State layer applies. It is wired to the rule schema
 * and loader delivered by TF-0MMLC8PXU0D3O594.
 *
 * Work item: TF-0MMLC8B3T0Z1F7ZM
 * Reference: docs/prd/MIXER_PRD.md §4–7; docs/mixer-rules.md
 */

import { MIX_GROUPS, MIXER_DEFAULTS } from "./schema.js";
import type {
  BoostAction,
  DuckAction,
  LimitAction,
  MixGroupName,
  MixRule,
  MixRuleSet,
} from "./schema.js";

// ── Types ─────────────────────────────────────────────────────────

/** Live state of a single mix group, as exposed by {@link Mixer.inspect}. */
export interface MixGroupState {
  /** Canonical group name. */
  name: MixGroupName;

  /** Priority level; higher dominates under contention. */
  priority: number;

  /** Effective maximum concurrent voices (a `limit` action may lower this). */
  maxVoices: number;

  /** Current linear gain (1 = unity / 0 dB). */
  currentGain: number;

  /** Number of voices currently active in this group. */
  activeVoices: number;

  /** Active duck duration in ms, if a matching rule ducked this group. */
  duckDurationMs?: number;
}

/** A single mix decision produced by rule evaluation. */
export interface MixDecision {
  /** Stable rule identifier, when the rule declared one. */
  ruleId?: string;

  /** The action kind. */
  action: "duck" | "boost" | "limit";

  /** The group the action targets. */
  group: MixGroupName;

  /**
   * The action magnitude: duck depth in dB, boost gain in dB (0 when the rule
   * omitted `gainDb`), or the voice cap for a limit action.
   */
  value: number;

  /** Duck duration in ms, when the action declared one. */
  durationMs?: number;
}

/** Immutable snapshot of the Mixer, suitable for logging/inspection. */
export interface MixerInspection {
  /** Current state name (empty string when unset). */
  state: string;

  /** Current context dimensions. */
  context: Record<string, string>;

  /** Per-group state, in canonical group order. */
  groups: MixGroupState[];

  /** Decisions produced by the most recent rule evaluation. */
  decisions: MixDecision[];

  /** Total number of active voices across all groups. */
  voiceCount: number;
}

/** Options for {@link Mixer}. */
export interface MixerOptions {
  /** Normalised rule set (from {@link import("./rules-loader.js").loadMixRules}). */
  ruleSet: MixRuleSet;

  /** Initial state name (default: ""). */
  initialState?: string;

  /** Initial context dimensions (default: {}). */
  initialContext?: Record<string, string>;
}

/** Internal mutable per-group record. */
interface MutableGroupState extends MixGroupState {
  /** Configured cap before any `limit` action is applied. */
  configuredMaxVoices: number;
}

// ── Gain conversion ───────────────────────────────────────────────

/**
 * Convert a dB magnitude to a linear gain multiplier.
 *
 * @param db - Decibels (positive = boost, negative = attenuation).
 * @returns Linear gain factor (`10 ** (db / 20)`).
 */
function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

// ── Mixer ─────────────────────────────────────────────────────────

/**
 * Behaviour-aware, deterministic mix arbitration runtime.
 *
 * Typical use:
 * ```ts
 * const mixer = new Mixer({ ruleSet: loadMixRules() });
 * mixer.setContext({ surface: "metal" });
 * mixer.updateState("combat");   // evaluates rules for the new state
 * mixer.startVoice("combat");     // admitted only while under maxVoices
 * mixer.inspect();                // gains, caps, decisions
 * ```
 */
export class Mixer {
  private readonly ruleSet: MixRuleSet;
  private readonly groupsByName: Map<MixGroupName, MutableGroupState>;
  private readonly activeVoiceIds: Map<MixGroupName, Set<string>>;
  private readonly voiceCounters: Map<MixGroupName, number>;
  private currentState: string;
  private currentContext: Record<string, string>;
  private lastDecisions: MixDecision[] = [];

  constructor(options: MixerOptions) {
    this.ruleSet = options.ruleSet;
    this.currentState = options.initialState ?? "";
    this.currentContext = { ...(options.initialContext ?? {}) };
    this.groupsByName = new Map();
    this.activeVoiceIds = new Map();
    this.voiceCounters = new Map();

    for (const name of MIX_GROUPS) {
      const config = this.ruleSet.groups[name];
      this.groupsByName.set(name, {
        name,
        priority: config.priority,
        maxVoices: config.maxVoices,
        configuredMaxVoices: config.maxVoices,
        currentGain: 1,
        activeVoices: 0,
      });
      this.activeVoiceIds.set(name, new Set());
      this.voiceCounters.set(name, 0);
    }
  }

  // ── State / context ─────────────────────────────────────────────

  /**
   * Set the current state and re-evaluate rules.
   *
   * @param stateName - State name (e.g. "combat").
   * @returns The decisions produced by the evaluation.
   */
  updateState(stateName: string): MixDecision[] {
    this.currentState = stateName;
    return this.applyRules();
  }

  /**
   * Merge context dimensions and re-evaluate rules.
   *
   * @param updates - Context dimensions to set.
   * @returns The decisions produced by the evaluation.
   */
  setContext(updates: Record<string, string>): MixDecision[] {
    this.currentContext = { ...this.currentContext, ...updates };
    return this.applyRules();
  }

  /** The current state name. */
  state(): string {
    return this.currentState;
  }

  /** A copy of the current context dimensions. */
  context(): Record<string, string> {
    return { ...this.currentContext };
  }

  // ── Rule evaluation ─────────────────────────────────────────────

  /**
   * Evaluate every rule against the current state/context and recompute the
   * group gains and voice caps. Evaluation is a pure function of the rule set
   * and the current inputs: gains reset to unity and caps to their configured
   * values before each pass, so repeated calls with unchanged inputs are
   * idempotent.
   *
   * @returns The ordered list of decisions from the pass.
   */
  applyRules(): MixDecision[] {
    const decisions: MixDecision[] = [];

    for (const name of MIX_GROUPS) {
      const group = this.groupsByName.get(name)!;
      group.currentGain = 1;
      group.maxVoices = group.configuredMaxVoices;
      delete group.duckDurationMs;
    }

    for (const rule of this.ruleSet.rules) {
      if (!this.ruleMatches(rule)) continue;
      for (const action of rule.then.duck) {
        this.applyDuck(rule, action, decisions);
      }
      for (const action of rule.then.boost) {
        this.applyBoost(rule, action, decisions);
      }
      for (const action of rule.then.limit) {
        this.applyLimit(rule, action, decisions);
      }
    }

    // Never report more active voices than the cap: a cap lowered beneath the
    // current active count cannot retroactively stop live voices, so the
    // effective cap is raised to the active count until they end.
    for (const name of MIX_GROUPS) {
      const group = this.groupsByName.get(name)!;
      if (group.maxVoices < group.activeVoices) {
        group.maxVoices = group.activeVoices;
      }
    }

    this.lastDecisions = decisions;
    return decisions;
  }

  private ruleMatches(rule: MixRule): boolean {
    const when = rule.when;
    if (when.state !== undefined && when.state !== this.currentState) {
      return false;
    }
    if (when.context !== undefined) {
      for (const [key, value] of Object.entries(when.context)) {
        if (this.currentContext[key] !== value) return false;
      }
    }
    return true;
  }

  private applyDuck(
    rule: MixRule,
    action: DuckAction,
    decisions: MixDecision[],
  ): void {
    const group = this.groupsByName.get(action.group);
    if (!group) return;
    group.currentGain *= dbToGain(-action.depthDb);
    if (action.durationMs !== undefined) {
      group.duckDurationMs = action.durationMs;
    }
    const decision: MixDecision = {
      action: "duck",
      group: action.group,
      value: action.depthDb,
    };
    if (rule.id !== undefined) decision.ruleId = rule.id;
    if (action.durationMs !== undefined) decision.durationMs = action.durationMs;
    decisions.push(decision);
  }

  private applyBoost(
    rule: MixRule,
    action: BoostAction,
    decisions: MixDecision[],
  ): void {
    const group = this.groupsByName.get(action.group);
    if (!group) return;
    if (action.gainDb !== undefined) {
      group.currentGain *= dbToGain(action.gainDb);
    }
    const decision: MixDecision = {
      action: "boost",
      group: action.group,
      value: action.gainDb ?? 0,
    };
    if (rule.id !== undefined) decision.ruleId = rule.id;
    decisions.push(decision);
  }

  private applyLimit(
    rule: MixRule,
    action: LimitAction,
    decisions: MixDecision[],
  ): void {
    const group = this.groupsByName.get(action.group);
    if (!group) return;
    group.maxVoices = Math.min(group.maxVoices, action.maxVoices);
    const decision: MixDecision = {
      action: "limit",
      group: action.group,
      value: action.maxVoices,
    };
    if (rule.id !== undefined) decision.ruleId = rule.id;
    decisions.push(decision);
  }

  // ── Voice ledger ────────────────────────────────────────────────

  /**
   * Attempt to admit a voice into a group.
   *
   * @param group - Target mix group.
   * @returns A deterministic voice ID when admitted, or `null` when the group
   *   is already at its effective `maxVoices` cap.
   */
  startVoice(group: MixGroupName): string | null {
    const state = this.groupsByName.get(group);
    if (!state) {
      throw new Error(`Unknown mix group '${group}'.`);
    }
    if (state.activeVoices >= state.maxVoices) {
      return null;
    }

    const counter = this.voiceCounters.get(group) ?? 0;
    const voiceId = `${group}-voice-${counter}`;
    this.voiceCounters.set(group, counter + 1);
    this.activeVoiceIds.get(group)!.add(voiceId);
    state.activeVoices += 1;
    return voiceId;
  }

  /**
   * Release a previously admitted voice.
   *
   * @param group - Group the voice belongs to.
   * @param voiceId - Voice ID returned by {@link startVoice}.
   * @returns True when the voice was active and has been released.
   */
  stopVoice(group: MixGroupName, voiceId: string): boolean {
    const state = this.groupsByName.get(group);
    if (!state) {
      throw new Error(`Unknown mix group '${group}'.`);
    }
    const voices = this.activeVoiceIds.get(group)!;
    if (!voices.delete(voiceId)) {
      return false;
    }
    state.activeVoices -= 1;
    return true;
  }

  // ── Inspection ──────────────────────────────────────────────────

  /**
   * Snapshot the current group state and the most recent decisions.
   *
   * @returns A plain, mutable inspection object (safe to serialise as JSON).
   */
  inspect(): MixerInspection {
    const groups: MixGroupState[] = [];
    let voiceCount = 0;

    for (const name of MIX_GROUPS) {
      const group = this.groupsByName.get(name)!;
      const snapshot: MixGroupState = {
        name: group.name,
        priority: group.priority,
        maxVoices: group.maxVoices,
        currentGain: group.currentGain,
        activeVoices: group.activeVoices,
      };
      if (group.duckDurationMs !== undefined) {
        snapshot.duckDurationMs = group.duckDurationMs;
      }
      groups.push(snapshot);
      voiceCount += group.activeVoices;
    }

    return {
      state: this.currentState,
      context: { ...this.currentContext },
      groups,
      decisions: this.lastDecisions.slice(),
      voiceCount,
    };
  }
}

/** The Mixer defaults re-exported for callers that build custom runtimes. */
export { MIXER_DEFAULTS };
