/**
 * Mixer Runtime Tests
 *
 * Tests for the Mixer runtime: group registry, active-voice tracking,
 * rule evaluation (determinism and correctness), and latency benchmarks.
 *
 * Work item: TF-0MMLC8B3T0Z1F7ZM
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Mixer } from "../runtime.js";
import {
  BUILT_IN_MIX_RULES,
  MIX_GROUPS,
  MIXER_DEFAULTS,
  parseMixRuleSet,
  type MixRuleSet,
} from "../schema.js";

// ── Helpers ─────────────────────────────────────────────────────────

/** Minimal rule set for testing without side-effects from the seed file. */
function makeRuleSet(overrides: Partial<MixRuleSet> = {}): MixRuleSet {
  return { ...BUILT_IN_MIX_RULES, ...overrides };
}

/** Build a normalised rule set from raw rule declarations. */
function ruleSetWith(rawRules: unknown[]): MixRuleSet {
  return parseMixRuleSet({ version: "1.0", rules: rawRules }, "<test>");
}

// ── 1. MixGroup metadata (AC 1) ────────────────────────────────────

describe("MixGroup metadata", () => {
  let mixer: Mixer;

  beforeEach(() => {
    mixer = new Mixer({ ruleSet: makeRuleSet() });
  });

  it("registers all six mix groups", () => {
    const inspection = mixer.inspect();
    expect(inspection.groups).toHaveLength(MIX_GROUPS.length);
    for (const group of MIX_GROUPS) {
      expect(inspection.groups.map((g) => g.name)).toContain(group);
    }
  });

  it("assigns default priorities matching the schema", () => {
    const inspection = mixer.inspect();
    const priorities = new Map(inspection.groups.map((g) => [g.name, g.priority]));
    expect(priorities.get("dialogue")).toBe(100);
    expect(priorities.get("alerts")).toBe(90);
    expect(priorities.get("ui")).toBe(80);
    expect(priorities.get("combat")).toBe(60);
    expect(priorities.get("footsteps")).toBe(40);
    expect(priorities.get("ambience")).toBe(20);
  });

  it("sets default maxVoices to 4 for every group", () => {
    const inspection = mixer.inspect();
    for (const group of inspection.groups) {
      expect(group.maxVoices).toBe(4);
    }
  });

  it("starts all groups with gain 1 (0 dB) and zero active voices", () => {
    const inspection = mixer.inspect();
    for (const group of inspection.groups) {
      expect(group.currentGain).toBe(1);
      expect(group.activeVoices).toBe(0);
    }
  });
});

// ── 2. Active-voice tracking (AC 2) ────────────────────────────────

describe("Active-voice tracking", () => {
  let mixer: Mixer;

  beforeEach(() => {
    mixer = new Mixer({ ruleSet: makeRuleSet() });
  });

  it("admits voices up to maxVoices", () => {
    const admitted: string[] = [];
    for (let i = 0; i < 4; i++) {
      admitted.push(mixer.startVoice("combat"));
    }
    expect(admitted).toEqual(["combat-voice-0", "combat-voice-1", "combat-voice-2", "combat-voice-3"]);

    // 5th voice should be rejected
    const rejected = mixer.startVoice("combat");
    expect(rejected).toBeNull();
  });

  it("rejects voices when group is at maxVoices", () => {
    for (let i = 0; i < 4; i++) {
      mixer.startVoice("footsteps");
    }
    expect(mixer.startVoice("footsteps")).toBeNull();
  });

  it("releases a voice slot when stopVoice is called", () => {
    mixer.startVoice("combat");
    mixer.startVoice("combat");
    mixer.startVoice("combat");
    mixer.stopVoice("combat", "combat-voice-0");
    expect(mixer.startVoice("combat")).toBe("combat-voice-3");
  });

  it("throws for an unknown group when starting a voice", () => {
    expect(() => mixer.startVoice("music" as never)).toThrow(/Unknown mix group 'music'/);
  });

  it("returns false when stopping a voice that is not active", () => {
    expect(mixer.stopVoice("combat", "combat-voice-99")).toBe(false);
  });

  it("tracks active voices per group independently", () => {
    for (let i = 0; i < 4; i++) {
      mixer.startVoice("combat");
    }
    for (let i = 0; i < 3; i++) {
      mixer.startVoice("dialogue");
    }

    const inspection = mixer.inspect();
    const combat = inspection.groups.find((g) => g.name === "combat")!;
    const dialogue = inspection.groups.find((g) => g.name === "dialogue")!;
    expect(combat.activeVoices).toBe(4);
    expect(dialogue.activeVoices).toBe(3);
  });
});

// ── 3. Declarative rule evaluation (AC 3) ──────────────────────────

describe("Declarative rule evaluation", () => {
  let mixer: Mixer;

  beforeEach(() => {
    mixer = new Mixer({ ruleSet: makeRuleSet() });
  });

  it("evaluates rules when state changes to a triggering state", () => {
    // combat-focus: when state=combat → duck ambience, boost combat, limit ui
    mixer.updateState("combat");
    const inspection = mixer.inspect();

    const ambience = inspection.groups.find((g) => g.name === "ambience")!;
    expect(ambience.currentGain).toBeLessThan(1); // ducked

    const combat = inspection.groups.find((g) => g.name === "combat")!;
    expect(combat.currentGain).toBeGreaterThanOrEqual(1); // boosted

    const ui = inspection.groups.find((g) => g.name === "ui")!;
    // limit does not change gain directly; maxVoices should be capped
    expect(ui.maxVoices).toBeLessThanOrEqual(MIXER_DEFAULTS.maxVoices);
  });

  it("applies default duck depth of 6 dB", () => {
    mixer.updateState("combat");
    const inspection = mixer.inspect();
    const ambience = inspection.groups.find((g) => g.name === "ambience")!;
    // 6 dB duck: gain = 10^(-6/20) ≈ 0.5
    const expected = Math.pow(10, -6 / 20);
    expect(ambience.currentGain).toBeCloseTo(expected, 2);
  });

  it("applies UI duck with default duration of 200 ms", () => {
    mixer.updateState("ui");
    const inspection = mixer.inspect();
    const ambience = inspection.groups.find((g) => g.name === "ambience")!;
    // Check that a duration was set for the duck
    expect(ambience.duckDurationMs).toBe(200);
  });

  it("does not modify groups not mentioned in rules", () => {
    mixer.updateState("combat");
    const inspection = mixer.inspect();
    const dialogue = inspection.groups.find((g) => g.name === "dialogue")!;
    expect(dialogue.currentGain).toBe(1);
  });

  it("emits a decision for every duck/boost/limit action", () => {
    const decisions = mixer.updateState("combat");
    expect(decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "duck", group: "ambience", value: 6 }),
        expect.objectContaining({ action: "boost", group: "combat" }),
        expect.objectContaining({ action: "limit", group: "ui", value: 4 }),
      ]),
    );
  });

  it("matches context-only rules regardless of state", () => {
    const ruleSet = ruleSetWith([
      {
        id: "metal-attenuation",
        when: { context: { surface: "metal" } },
        then: { duck: [{ group: "footsteps", depthDb: 3 }] },
      },
    ]);
    const ctxMixer = new Mixer({ ruleSet });
    ctxMixer.setContext({ surface: "metal" });
    const footsteps = ctxMixer
      .inspect()
      .groups.find((g) => g.name === "footsteps")!;
    expect(footsteps.currentGain).toBeCloseTo(Math.pow(10, -3 / 20), 3);
  });

  it("requires every declared context dimension to match", () => {
    const ruleSet = ruleSetWith([
      {
        id: "indoor-metal",
        when: { context: { surface: "metal", space: "indoor" } },
        then: { duck: ["ambience"] },
      },
    ]);
    const ctxMixer = new Mixer({ ruleSet });
    ctxMixer.setContext({ surface: "metal" });
    expect(
      ctxMixer.inspect().groups.find((g) => g.name === "ambience")!.currentGain,
    ).toBe(1);
    ctxMixer.setContext({ space: "indoor" });
    expect(
      ctxMixer.inspect().groups.find((g) => g.name === "ambience")!.currentGain,
    ).toBeLessThan(1);
  });

  it("does not mutate the supplied rule set", () => {
    const ruleSet = makeRuleSet();
    const before = JSON.stringify(ruleSet);
    const local = new Mixer({ ruleSet });
    local.updateState("combat");
    local.startVoice("combat");
    expect(JSON.stringify(ruleSet)).toBe(before);
  });
});

// ── 4. Determinism (AC 4) ──────────────────────────────────────────

describe("Rule evaluation is deterministic", () => {
  it("produces identical outcomes for identical inputs", () => {
    const ruleSet = makeRuleSet();
    const mixer1 = new Mixer({ ruleSet });
    const mixer2 = new Mixer({ ruleSet });

    for (const mixer of [mixer1, mixer2]) {
      mixer.updateState("combat");
      mixer.updateState("ui");
    }

    const insp1 = mixer1.inspect();
    const insp2 = mixer2.inspect();

    for (let i = 0; i < insp1.groups.length; i++) {
      const g1 = insp1.groups[i];
      const g2 = insp2.groups[i];
      expect(g1.name).toBe(g2.name);
      expect(g1.currentGain).toBe(g2.currentGain);
      expect(g1.activeVoices).toBe(g2.activeVoices);
    }
  });

  it("produces deterministic results after voice lifecycle", () => {
    const ruleSet = makeRuleSet();
    const mixer1 = new Mixer({ ruleSet });
    const mixer2 = new Mixer({ ruleSet });

    for (const mixer of [mixer1, mixer2]) {
      mixer.updateState("combat");
      for (let i = 0; i < 2; i++) {
        mixer.startVoice("combat");
        mixer.startVoice("ambience");
      }
      mixer.updateState("ui");
    }

    const insp1 = mixer1.inspect();
    const insp2 = mixer2.inspect();

    for (let i = 0; i < insp1.groups.length; i++) {
      expect(insp1.groups[i].currentGain).toBe(insp2.groups[i].currentGain);
      expect(insp1.groups[i].activeVoices).toBe(insp2.groups[i].activeVoices);
    }
  });
});

// ── 5. Latency benchmark (AC 5) ────────────────────────────────────

describe("Rule evaluation latency", () => {
  it("evaluates rule set in constant time (≤ 5 ms)", () => {
    const ruleSet = makeRuleSet();
    const mixer = new Mixer({ ruleSet });

    const iterations = 1000;
    const states = ["combat", "ui", "idle", "explore"] as const;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const state = states[i % states.length];
      mixer.updateState(state);
      // applyRules is called implicitly by updateState
    }

    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    // 1000 iterations must complete well under 5 seconds; average < 5 ms
    expect(elapsed).toBeLessThan(5000);
    expect(avgMs).toBeLessThan(5);
  });
});

// ── 6. Integration with existing rule files ─────────────────────────

describe("Integration", () => {
  it("loads the committed seed rules file successfully", () => {
    const mixer = new Mixer({
      ruleSet: BUILT_IN_MIX_RULES,
    });
    expect(mixer.inspect().groups).toHaveLength(6);
  });

  it("handles multiple state transitions in sequence", () => {
    const mixer = new Mixer({ ruleSet: makeRuleSet() });
    mixer.updateState("combat");
    mixer.updateState("ui");
    mixer.updateState("idle");

    const inspection = mixer.inspect();
    const ambience = inspection.groups.find((g) => g.name === "ambience")!;
    // After combat→ui→idle, ambience should reflect the latest rule (idle has no rules → back to 1)
    // idle state has no matching rule, so gain should be back to 1
    expect(ambience.currentGain).toBe(1);
  });
});
