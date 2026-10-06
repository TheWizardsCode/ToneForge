/**
 * Mixer Voice-Limiting & Rule-Outcome Tests
 *
 * Dedicated regression suite for the safety-critical Mixer behaviour:
 * per-group voice limits under seeded simulated load, fixture-verified
 * duck/boost/limit outcomes for all six groups, the combat/UI default rules,
 * and byte-stable determinism.
 *
 * The lower-level API shape is covered by `runtime.test.ts`; this suite owns
 * the load/limit invariants and the six-group fixture contract.
 *
 * Work item: TF-0MMLC8SQ302DVYOZ
 * Reference: docs/prd/MIXER_PRD.md §4.1, §6; docs/mixer-rules.md
 */

import { describe, it, expect } from "vitest";
import { Mixer } from "../runtime.js";
import { MIX_GROUPS, MIXER_DEFAULTS, type MixGroupName } from "../schema.js";
import {
  ALL_GROUPS_RULE_SET,
  DEFAULT_DUCK_GAIN,
  GROUPS,
  boostedGain,
  duckedGain,
  generateVoiceEvents,
  type VoiceEvent,
} from "./rules-fixtures.js";

/** Find a group's state in an inspection by name. */
function group(mixer: Mixer, name: MixGroupName) {
  const found = mixer.inspect().groups.find((g) => g.name === name);
  if (!found) throw new Error(`Group '${name}' missing from inspection`);
  return found;
}

/**
 * Drive a deterministic event plan through a fresh mixer, maintaining the
 * expected active-voice ledger, and assert the limit invariant after every
 * single event.
 */
function runVoicePlan(seed: number, count: number): Mixer {
  const mixer = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
  const events: VoiceEvent[] = generateVoiceEvents(seed, count);
  const active = new Map<MixGroupName, string[]>(
    GROUPS.map((g) => [g, [] as string[]]),
  );

  for (const event of events) {
    if (event.action === "start") {
      const id = mixer.startVoice(event.group);
      if (id !== null) active.get(event.group)!.push(id);
    } else {
      const id = active.get(event.group)!.shift();
      if (id !== undefined) mixer.stopVoice(event.group, id);
    }

    const inspection = mixer.inspect();
    for (const g of inspection.groups) {
      // Safety invariant: a group never admits or reports more than its cap.
      expect(g.activeVoices).toBeLessThanOrEqual(g.maxVoices);
      // The mixer's ledger matches the test's independent ledger.
      expect(g.activeVoices).toBe(active.get(g.name)!.length);
    }
  }

  return mixer;
}

// ── 1. Default maxVoices and load invariant (AC 1) ─────────────────

describe("Per-group voice limits", () => {
  it("defaults maxVoices to 4 for every one of the six groups", () => {
    const mixer = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    const inspection = mixer.inspect();
    expect(inspection.groups).toHaveLength(MIX_GROUPS.length);
    for (const g of inspection.groups) {
      expect(g.maxVoices).toBe(4);
    }
  });

  it("rejects the (maxVoices + 1)-th voice for every group", () => {
    const mixer = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    for (const name of GROUPS) {
      for (let i = 0; i < 4; i++) {
        expect(mixer.startVoice(name)).not.toBeNull();
      }
      expect(mixer.startVoice(name)).toBeNull();
      expect(group(mixer, name).activeVoices).toBe(4);
    }
  });

  it("never exceeds the limit under a seeded simulated load", () => {
    // 600 deterministic events across all six groups.
    runVoicePlan(0xc0ffee, 600);
  });

  it("holds the invariant across several independent seeds", () => {
    for (const seed of [1, 7, 42, 1337, 999999]) {
      runVoicePlan(seed, 300);
    }
  });

  it("frees capacity for a new voice after a released one", () => {
    const mixer = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    for (let i = 0; i < 4; i++) mixer.startVoice("combat");
    expect(mixer.startVoice("combat")).toBeNull();

    const first = "combat-voice-0";
    expect(mixer.stopVoice("combat", first)).toBe(true);
    expect(mixer.startVoice("combat")).toBe("combat-voice-4");
    expect(group(mixer, "combat").activeVoices).toBe(4);
  });
});

// ── 2. Six-group duck/boost/limit fixtures (AC 2) ──────────────────

describe("Six-group rule fixtures", () => {
  it("ducks all six groups by the default 6 dB", () => {
    const mixer = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    const decisions = mixer.setContext({ fixture: "duck-all" });

    for (const name of GROUPS) {
      expect(group(mixer, name).currentGain).toBeCloseTo(DEFAULT_DUCK_GAIN, 6);
    }
    expect(decisions.filter((d) => d.action === "duck")).toHaveLength(
      GROUPS.length,
    );
  });

  it("boosts all six groups by the fixture's explicit gainDb", () => {
    const mixer = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    const decisions = mixer.setContext({ fixture: "boost-all" });

    for (const name of GROUPS) {
      expect(group(mixer, name).currentGain).toBeCloseTo(boostedGain(3), 6);
    }
    expect(decisions.filter((d) => d.action === "boost")).toHaveLength(
      GROUPS.length,
    );
  });

  it("limits all six groups to the fixture's explicit cap", () => {
    const mixer = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    const decisions = mixer.setContext({ fixture: "limit-all" });

    for (const name of GROUPS) {
      expect(group(mixer, name).maxVoices).toBe(2);
      // The lowered cap is enforced at admission.
      expect(mixer.startVoice(name)).not.toBeNull();
      expect(mixer.startVoice(name)).not.toBeNull();
      expect(mixer.startVoice(name)).toBeNull();
      expect(group(mixer, name).activeVoices).toBe(2);
    }
    expect(decisions.filter((d) => d.action === "limit")).toHaveLength(
      GROUPS.length,
    );
  });

  it("resets gains and caps when the fixture context is cleared", () => {
    const mixer = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    mixer.setContext({ fixture: "duck-all" });
    expect(group(mixer, "combat").currentGain).toBeLessThan(1);

    // A context-only rule is dropped once its dimension no longer matches.
    mixer.setContext({ fixture: "none" });
    for (const name of GROUPS) {
      expect(group(mixer, name).currentGain).toBe(1);
      expect(group(mixer, name).maxVoices).toBe(4);
    }
  });
});

// ── 3. Combat and UI default rules (AC 3) ──────────────────────────

describe("Combat and UI rules", () => {
  it("ducks ambience by 6 dB and boosts combat on the combat state", () => {
    const mixer = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    const decisions = mixer.updateState("combat");

    expect(group(mixer, "ambience").currentGain).toBeCloseTo(duckedGain(6), 6);
    expect(decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "combat-focus", action: "duck", group: "ambience", value: 6 }),
        expect.objectContaining({ ruleId: "combat-focus", action: "boost", group: "combat" }),
        expect.objectContaining({ ruleId: "combat-focus", action: "limit", group: "ui" }),
      ]),
    );
    // The `limit: ["ui"]` default keeps the built-in cap.
    expect(group(mixer, "ui").maxVoices).toBe(MIXER_DEFAULTS.maxVoices);
  });

  it("applies the UI duck at 6 dB for 200 ms", () => {
    const mixer = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    mixer.updateState("ui");

    for (const name of ["ambience", "footsteps"] as const) {
      const g = group(mixer, name);
      expect(g.currentGain).toBeCloseTo(duckedGain(MIXER_DEFAULTS.duckDepthDb), 6);
      expect(g.duckDurationMs).toBe(MIXER_DEFAULTS.uiDuckDurationMs);
      expect(MIXER_DEFAULTS.uiDuckDurationMs).toBe(200);
    }
    // Groups outside the UI rule are untouched.
    expect(group(mixer, "combat").currentGain).toBe(1);
  });
});

// ── 4. Determinism: byte-stable outcomes (AC 4) ────────────────────

describe("Determinism", () => {
  /** Run a fixed state/context/voice scenario and snapshot the inspection. */
  function scenario(): string {
    const mixer = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    const active = new Map<MixGroupName, string[]>(
      GROUPS.map((g) => [g, [] as string[]]),
    );

    for (const event of generateVoiceEvents(2024, 200)) {
      if (event.action === "start") {
        const id = mixer.startVoice(event.group);
        if (id !== null) active.get(event.group)!.push(id);
      } else {
        const id = active.get(event.group)!.shift();
        if (id !== undefined) mixer.stopVoice(event.group, id);
      }
    }

    mixer.updateState("combat");
    mixer.setContext({ fixture: "duck-all" });
    mixer.updateState("ui");

    return JSON.stringify(mixer.inspect());
  }

  it("produces byte-identical snapshots across repeated runs", () => {
    expect(scenario()).toBe(scenario());
  });

  it("produces byte-identical decisions for identical inputs", () => {
    const a = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    const b = new Mixer({ ruleSet: ALL_GROUPS_RULE_SET });
    expect(JSON.stringify(a.updateState("combat"))).toBe(
      JSON.stringify(b.updateState("combat")),
    );
  });
});
