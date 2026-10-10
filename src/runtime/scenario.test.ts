/**
 * Runtime Scenario Tests
 *
 * Tests for parsing/validating declarative runtime scenarios and the
 * template recipe resolver that drives context-based recipe switching.
 *
 * Work item: TF-0MUXW66870013DOL
 */

import { describe, it, expect } from "vitest";
import {
  parseRuntimeScenario,
  validateRuntimeScenario,
  loadRuntimeScenario,
  resolveRecipeTemplate,
  createTemplateRecipeResolver,
} from "./scenario.js";

// ── Fixtures ──────────────────────────────────────────────────────

function validScenarioData(): Record<string, unknown> {
  return {
    version: "1.0",
    name: "test_scenario",
    seed: 42,
    stateMachine: {
      name: "movement",
      initial: "idle",
      states: [
        { name: "idle" },
        { name: "walk", sequencer: "walk_seq" },
      ],
      transitions: [{ from: "idle", to: "walk" }],
    },
    context: {
      dimensions: { surface: ["stone", "gravel"] },
      initial: { surface: "stone" },
    },
    sequences: {
      walk_seq: {
        version: "1.0",
        name: "walk_seq",
        events: [{ time: 0, event: "footstep", seedOffset: 0, gain: 0.7 }],
      },
    },
    recipeResolver: { footstep: "footstep-{surface}" },
    steps: [{ time: 0, state: "walk" }],
  };
}

// ── Template resolver ─────────────────────────────────────────────

describe("resolveRecipeTemplate", () => {
  it("substitutes a context dimension", () => {
    expect(resolveRecipeTemplate("footstep-{surface}", { surface: "gravel" })).toBe(
      "footstep-gravel",
    );
  });

  it("substitutes multiple dimensions", () => {
    expect(
      resolveRecipeTemplate("{creature}-{action}", {
        creature: "goblin",
        action: "attack",
      }),
    ).toBe("goblin-attack");
  });

  it("leaves templates without placeholders unchanged", () => {
    expect(resolveRecipeTemplate("ui-scifi-confirm", {})).toBe("ui-scifi-confirm");
  });

  it("throws when a referenced dimension is missing", () => {
    expect(() => resolveRecipeTemplate("footstep-{surface}", {})).toThrow(
      /surface/,
    );
  });
});

describe("createTemplateRecipeResolver", () => {
  it("resolves mapped events against the context", () => {
    const resolver = createTemplateRecipeResolver({
      footstep: "footstep-{surface}",
    });
    expect(resolver("footstep", { surface: "stone" })).toBe("footstep-stone");
    expect(resolver("footstep", { surface: "gravel" })).toBe("footstep-gravel");
  });

  it("passes unmapped events through unchanged (identity default)", () => {
    const resolver = createTemplateRecipeResolver({ footstep: "footstep-{surface}" });
    expect(resolver("weapon-laser-zap", { surface: "stone" })).toBe(
      "weapon-laser-zap",
    );
  });
});

// ── Validation ────────────────────────────────────────────────────

describe("validateRuntimeScenario", () => {
  it("accepts a valid scenario", () => {
    expect(validateRuntimeScenario(validScenarioData(), "test")).toEqual([]);
  });

  it("rejects a non-object root", () => {
    const errors = validateRuntimeScenario("nope", "test");
    expect(errors[0]!.field).toBe("(root)");
  });

  it("reports missing version, name, and seed", () => {
    const data = validScenarioData();
    delete data["version"];
    delete data["name"];
    delete data["seed"];
    const fields = validateRuntimeScenario(data, "test").map((e) => e.field);
    expect(fields).toContain("version");
    expect(fields).toContain("name");
    expect(fields).toContain("seed");
  });

  it("reports missing state machine", () => {
    const data = validScenarioData();
    delete data["stateMachine"];
    const fields = validateRuntimeScenario(data, "test").map((e) => e.field);
    expect(fields).toContain("stateMachine");
  });

  it("reports an empty sequences object", () => {
    const data = validScenarioData();
    data["sequences"] = {};
    const fields = validateRuntimeScenario(data, "test").map((e) => e.field);
    expect(fields).toContain("sequences");
  });

  it("surfaces nested sequence-schema errors", () => {
    const data = validScenarioData();
    data["sequences"] = {
      walk_seq: { version: "1.0", name: "walk_seq", events: "bad" },
    };
    const fields = validateRuntimeScenario(data, "test").map((e) => e.field);
    expect(fields.some((f) => f.startsWith("sequences.walk_seq.events"))).toBe(
      true,
    );
  });

  it("reports an invalid seed", () => {
    const data = validScenarioData();
    data["seed"] = "forty-two";
    const fields = validateRuntimeScenario(data, "test").map((e) => e.field);
    expect(fields).toContain("seed");
  });

  it("reports invalid steps", () => {
    const data = validScenarioData();
    data["steps"] = [{ time: -1 }, { time: 0, state: 5 }];
    const fields = validateRuntimeScenario(data, "test").map((e) => e.field);
    expect(fields).toContain("steps[0].time");
    expect(fields).toContain("steps[1].state");
  });

  it("requires each step to change state or context", () => {
    const data = validScenarioData();
    data["steps"] = [{ time: 0 }];
    const fields = validateRuntimeScenario(data, "test").map((e) => e.field);
    expect(fields).toContain("steps[0]");
  });

  it("reports invalid context dimensions", () => {
    const data = validScenarioData();
    data["context"] = { dimensions: { surface: [1, 2] } };
    const fields = validateRuntimeScenario(data, "test").map((e) => e.field);
    expect(fields).toContain("context.dimensions.surface");
  });
});

// ── Parsing ───────────────────────────────────────────────────────

describe("parseRuntimeScenario", () => {
  it("normalises sequences into SequenceDefinitions", () => {
    const scenario = parseRuntimeScenario(validScenarioData(), "test");
    expect(scenario.name).toBe("test_scenario");
    expect(scenario.seed).toBe(42);
    expect(scenario.sequences["walk_seq"]!.events).toHaveLength(1);
    expect(scenario.sequences["walk_seq"]!.events[0]!.event).toBe("footstep");
    expect(scenario.recipeResolver).toEqual({ footstep: "footstep-{surface}" });
  });

  it("defaults an omitted recipe resolver to an empty map", () => {
    const data = validScenarioData();
    delete data["recipeResolver"];
    const scenario = parseRuntimeScenario(data, "test");
    expect(scenario.recipeResolver).toEqual({});
  });

  it("throws with field-level detail for invalid input", () => {
    const data = validScenarioData();
    delete data["name"];
    expect(() => parseRuntimeScenario(data, "test")).toThrow(/name/);
  });
});

// ── Loading the shipped demo scenario ─────────────────────────────

describe("loadRuntimeScenario (shipped demo)", () => {
  it("loads presets/runtime/footsteps.json", async () => {
    const scenario = await loadRuntimeScenario("presets/runtime/footsteps.json");
    expect(scenario.name).toBe("runtime_footsteps");
    expect(scenario.seed).toBe(42);
    expect(Object.keys(scenario.sequences).sort()).toEqual([
      "footsteps_run",
      "footsteps_sprint",
      "footsteps_walk",
    ]);
    expect(scenario.recipeResolver["footstep"]).toBe("footstep-{surface}");
    expect(scenario.steps.length).toBeGreaterThanOrEqual(3);
  });

  it("reports a clear error for a missing file", async () => {
    await expect(loadRuntimeScenario("presets/runtime/missing.json")).rejects.toThrow(
      /Failed to read runtime scenario/,
    );
  });
});
