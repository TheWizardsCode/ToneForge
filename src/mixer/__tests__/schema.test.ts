/**
 * Mixer Rule Schema Tests
 *
 * Tests for validateMixRuleSet() / parseMixRuleSet() covering the documented
 * declarative rule schema: `when {state|context}` → `then {duck|boost|limit}`,
 * the six confirmed mix groups, and the built-in defaults (maxVoices 4,
 * duck depth 6 dB, UI duck duration 200 ms).
 *
 * Work item: TF-0MMLC8PXU0D3O594
 */

import { describe, it, expect } from "vitest";
import {
  MIX_GROUPS,
  MIXER_DEFAULTS,
  validateMixRuleSet,
  parseMixRuleSet,
  type RawMixRuleFile,
} from "../schema.js";

/** A minimal valid rule-set file for use as a test baseline. */
function validRuleSet(): RawMixRuleFile {
  return {
    version: "1.0",
    rules: [
      {
        id: "combat-focus",
        when: { state: "combat" },
        then: { duck: ["ambience"], boost: ["combat"], limit: ["ui"] },
      },
    ],
  };
}

describe("validateMixRuleSet — valid inputs", () => {
  it("accepts a minimal valid rule set", () => {
    expect(validateMixRuleSet(validRuleSet(), "rules.json")).toHaveLength(0);
  });

  it("accepts an empty rule set with only a version", () => {
    expect(validateMixRuleSet({ version: "1.0" }, "rules.json")).toHaveLength(0);
  });

  it("accepts object-form duck/boost/limit targets", () => {
    const data: RawMixRuleFile = {
      version: "1.0",
      rules: [
        {
          when: { state: "combat", context: { surface: "metal" } },
          then: {
            duck: [{ group: "ambience", depthDb: 9, durationMs: 500 }],
            boost: [{ group: "combat", gainDb: 3 }],
            limit: [{ group: "ui", maxVoices: 2 }],
          },
        },
      ],
    };
    expect(validateMixRuleSet(data, "rules.json")).toHaveLength(0);
  });

  it("accepts group names case-insensitively (e.g. UI)", () => {
    const data: RawMixRuleFile = {
      version: "1.0",
      rules: [{ when: { state: "combat" }, then: { duck: ["Ambience"], boost: ["UI"] } }],
    };
    expect(validateMixRuleSet(data, "rules.json")).toHaveLength(0);
  });
});

describe("validateMixRuleSet — rejected inputs", () => {
  it("rejects a non-object root", () => {
    const errors = validateMixRuleSet([], "rules.json");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.field).toBe("(root)");
  });

  it("rejects a missing/empty version", () => {
    const errors = validateMixRuleSet({ rules: [] }, "rules.json");
    expect(errors.some((e) => e.field === "version")).toBe(true);
  });

  it("rejects an unknown mix group in `groups`", () => {
    const data = { version: "1.0", groups: { music: { priority: 1 } } };
    const errors = validateMixRuleSet(data, "rules.json");
    expect(errors.some((e) => e.field === "groups.music")).toBe(true);
  });

  it("rejects invalid default values", () => {
    const data = { version: "1.0", defaults: { maxVoices: 0, duckDepthDb: -1 } };
    const errors = validateMixRuleSet(data, "rules.json");
    expect(errors.some((e) => e.field === "defaults.maxVoices")).toBe(true);
    expect(errors.some((e) => e.field === "defaults.duckDepthDb")).toBe(true);
  });

  it("rejects a rule that is missing `when`", () => {
    const errors = validateMixRuleSet(
      { version: "1.0", rules: [{ then: { duck: ["ambience"] } }] },
      "rules.json",
    );
    expect(errors.some((e) => e.field === "rules[0].when")).toBe(true);
  });

  it("rejects a `when` without state or context", () => {
    const errors = validateMixRuleSet(
      { version: "1.0", rules: [{ when: {}, then: { duck: ["ambience"] } }] },
      "rules.json",
    );
    expect(errors.some((e) => e.field === "rules[0].when")).toBe(true);
  });

  it("rejects an unknown group in a duck target", () => {
    const errors = validateMixRuleSet(
      { version: "1.0", rules: [{ when: { state: "combat" }, then: { duck: ["music"] } }] },
      "rules.json",
    );
    expect(errors.some((e) => e.field.includes("then.duck"))).toBe(true);
  });

  it("rejects a non-positive duck depth", () => {
    const errors = validateMixRuleSet(
      {
        version: "1.0",
        rules: [
          { when: { state: "combat" }, then: { duck: [{ group: "ambience", depthDb: 0 }] } },
        ],
      },
      "rules.json",
    );
    expect(errors.some((e) => e.field.includes("depthDb"))).toBe(true);
  });

  it("rejects a `then` without any action", () => {
    const errors = validateMixRuleSet(
      { version: "1.0", rules: [{ when: { state: "combat" }, then: {} }] },
      "rules.json",
    );
    expect(errors.some((e) => e.field === "rules[0].then")).toBe(true);
  });

  it("rejects non-string context values", () => {
    const errors = validateMixRuleSet(
      {
        version: "1.0",
        rules: [{ when: { context: { surface: 3 } }, then: { duck: ["ambience"] } }],
      },
      "rules.json",
    );
    expect(errors.some((e) => e.field === "rules[0].when.context.surface")).toBe(true);
  });
});

describe("parseMixRuleSet — normalisation", () => {
  it("fills in all six mix groups with defaults", () => {
    const set = parseMixRuleSet({ version: "1.0" }, "rules.json");
    expect(Object.keys(set.groups).sort()).toEqual([...MIX_GROUPS].sort());
    for (const group of MIX_GROUPS) {
      expect(set.groups[group].maxVoices).toBe(MIXER_DEFAULTS.maxVoices);
    }
  });

  it("exposes the confirmed built-in defaults", () => {
    const set = parseMixRuleSet({ version: "1.0" }, "rules.json");
    expect(set.defaults).toEqual({
      maxVoices: 4,
      duckDepthDb: 6,
      uiDuckDurationMs: 200,
    });
  });

  it("expands string duck targets using the default duck depth", () => {
    const set = parseMixRuleSet(validRuleSet(), "rules.json");
    const duck = set.rules[0]!.then.duck;
    expect(duck).toEqual([{ group: "ambience", depthDb: 6 }]);
  });

  it("expands string boost and limit targets", () => {
    const set = parseMixRuleSet(validRuleSet(), "rules.json");
    expect(set.rules[0]!.then.boost).toEqual([{ group: "combat" }]);
    expect(set.rules[0]!.then.limit).toEqual([{ group: "ui", maxVoices: 4 }]);
  });

  it("applies the UI duck duration default for UI-triggered rules", () => {
    const set = parseMixRuleSet(
      {
        version: "1.0",
        rules: [{ when: { state: "ui" }, then: { duck: ["ambience"] } }],
      },
      "rules.json",
    );
    expect(set.rules[0]!.then.duck[0]).toEqual({
      group: "ambience",
      depthDb: 6,
      durationMs: 200,
    });
  });

  it("does not apply the UI duck duration to non-UI rules", () => {
    const set = parseMixRuleSet(validRuleSet(), "rules.json");
    expect(set.rules[0]!.then.duck[0]!.durationMs).toBeUndefined();
  });

  it("honours explicit action overrides", () => {
    const set = parseMixRuleSet(
      {
        version: "1.0",
        defaults: { maxVoices: 8, duckDepthDb: 3 },
        groups: { combat: { priority: 99, maxVoices: 2 } },
        rules: [
          {
            when: { state: "combat" },
            then: {
              duck: [{ group: "ambience", depthDb: 12, durationMs: 50 }],
              limit: ["dialogue"],
            },
          },
        ],
      },
      "rules.json",
    );
    expect(set.groups.combat).toEqual({ priority: 99, maxVoices: 2 });
    // Unspecified groups inherit the global default maxVoices (8).
    expect(set.groups.ambience.maxVoices).toBe(8);
    expect(set.rules[0]!.then.duck[0]).toEqual({
      group: "ambience",
      depthDb: 12,
      durationMs: 50,
    });
    expect(set.rules[0]!.then.limit[0]).toEqual({ group: "dialogue", maxVoices: 8 });
  });

  it("normalises group names to lowercase", () => {
    const set = parseMixRuleSet(
      {
        version: "1.0",
        rules: [{ when: { state: "combat" }, then: { duck: ["Ambience"], boost: ["UI"] } }],
      },
      "rules.json",
    );
    expect(set.rules[0]!.then.duck[0]!.group).toBe("ambience");
    expect(set.rules[0]!.then.boost[0]!.group).toBe("ui");
  });

  it("throws an actionable error when invalid", () => {
    expect(() => parseMixRuleSet({ rules: [] }, "rules.json")).toThrow(
      /Invalid mixer rules 'rules\.json'/,
    );
  });
});
