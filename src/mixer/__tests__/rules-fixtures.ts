/**
 * Mixer Voice-Limiting Test Fixtures
 *
 * Deterministic, reusable fixtures for the Mixer voice-limiting and rule
 * outcome tests. Everything here is seeded/fixed — no wall-clock or
 * load-order dependence — so repeated runs produce byte-stable results.
 *
 * Work item: TF-0MMLC8SQ302DVYOZ
 * Reference: docs/prd/MIXER_PRD.md §4.1, §6; docs/mixer-rules.md
 */

import {
  MIX_GROUPS,
  MIXER_DEFAULTS,
  parseMixRuleSet,
  type MixGroupName,
  type MixRuleSet,
} from "../schema.js";

/** The six confirmed mix groups as a mutable array for iteration. */
export const GROUPS: MixGroupName[] = [...MIX_GROUPS];

/**
 * A fixture rule set exercising duck, boost and limit across every one of
 * the six groups. Rules are keyed off a fixture-only context dimension so a
 * test can activate exactly one capability at a time without cross-talk.
 */
export const ALL_GROUPS_RULE_SET: MixRuleSet = parseMixRuleSet(
  {
    version: "1.0",
    defaults: { ...MIXER_DEFAULTS },
    rules: [
      {
        id: "fixture-duck-all",
        when: { context: { fixture: "duck-all" } },
        then: { duck: [...GROUPS] },
      },
      {
        id: "fixture-boost-all",
        when: { context: { fixture: "boost-all" } },
        then: { boost: GROUPS.map((group) => ({ group, gainDb: 3 })) },
      },
      {
        id: "fixture-limit-all",
        when: { context: { fixture: "limit-all" } },
        then: { limit: GROUPS.map((group) => ({ group, maxVoices: 2 })) },
      },
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
  "<voice-limiting-fixture>",
);

/** Expected linear gain for a duck depth of `db` decibels. */
export function duckedGain(db: number): number {
  return Math.pow(10, -db / 20);
}

/** Expected linear gain for a boost of `db` decibels. */
export function boostedGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** The expected default duck gain (6 dB attenuation). */
export const DEFAULT_DUCK_GAIN = duckedGain(MIXER_DEFAULTS.duckDepthDb);

// ── Deterministic voice-load simulation ────────────────────────────

/** A single simulated voice-lifecycle event. */
export interface VoiceEvent {
  group: MixGroupName;
  action: "start" | "stop";
}

/**
 * A small, fast, deterministic PRNG (mulberry32). Used only to generate
 * reproducible test *input* sequences — it is not production logic.
 *
 * @param seed - 32-bit unsigned seed.
 * @returns A function yielding floats in `[0, 1)`.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a deterministic sequence of start/stop voice events across all
 * six groups for a given seed. The same seed always yields the same plan.
 *
 * @param seed - Deterministic seed.
 * @param count - Number of events to generate.
 * @returns The event plan.
 */
export function generateVoiceEvents(seed: number, count: number): VoiceEvent[] {
  const rand = mulberry32(seed);
  const events: VoiceEvent[] = [];
  for (let i = 0; i < count; i++) {
    const group = GROUPS[Math.floor(rand() * GROUPS.length)]!;
    const action = rand() < 0.6 ? "start" : "stop";
    events.push({ group, action });
  }
  return events;
}
