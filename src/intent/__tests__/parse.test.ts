/**
 * Intent schema and deterministic goal-to-intent parsing conformance tests.
 *
 * Work item: TF-0MUZLVR63002X120 (Verify: Intent schema & deterministic
 * goal-to-intent parsing).
 */

import { describe, it, expect } from "vitest";

import {
  INTENT_VOCABULARY,
  intentVocabularyIds,
  parseIntent,
  validateIntent,
} from "../types.js";
import {
  UnknownIntentError,
  UnknownIntentIdError,
  parseGoalToIntent,
  resolveIntent,
  tokenize,
} from "../parse.js";

describe("Intent schema", () => {
  it("enforces intent/scope/priority/constraints and rejects invalid values", () => {
    const valid = { intent: "reduce_repetition", scope: "footsteps", priority: "medium", constraints: {} };
    expect(validateIntent(valid)).toEqual([]);
    expect(parseIntent(valid)).toEqual(valid);

    expect(() => parseIntent({ ...valid, priority: "urgent" })).toThrow(/priority/);
    expect(() => parseIntent({ ...valid, scope: "" })).toThrow(/scope/);
    expect(() => parseIntent({ ...valid, constraints: [] })).toThrow(/constraints/);
  });
});

describe("deterministic goal-to-intent parsing", () => {
  it("maps representative goal phrasings consistently", () => {
    expect(parseGoalToIntent("reduce repetition in footstep sounds", { scope: "footsteps" }).intent)
      .toBe("reduce_repetition");
    expect(parseGoalToIntent("make the UI calmer and softer", { scope: "ui" }).intent)
      .toBe("calm_ui");
    expect(parseGoalToIntent("heavier impact for weapons", { scope: "impact" }).intent)
      .toBe("heavier_impact");
  });

  it("is deterministic: repeat runs produce identical structured intents", () => {
    const first = parseGoalToIntent("reduce repetition in footstep sounds", { scope: "footsteps" });
    const second = parseGoalToIntent("reduce repetition in footstep sounds", { scope: "footsteps" });
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("honours explicit priority and constraints", () => {
    const intent = parseGoalToIntent("add more variety", {
      scope: "weapon",
      priority: "high",
      constraints: { preserve_style: true },
    });
    expect(intent.priority).toBe("high");
    expect(intent.constraints).toEqual({ preserve_style: true });
  });

  it("throws an actionable error listing supported intents for unknown goals", () => {
    try {
      parseGoalToIntent("xyzzy plugh frobnicate", { scope: "project" });
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownIntentError);
      const err = error as UnknownIntentError;
      expect(err.message).toContain("Supported intents");
      expect(err.supported).toEqual(intentVocabularyIds());
    }
  });

  it("supports an explicit --intent override validated against the vocabulary", () => {
    const intent = resolveIntent({ intent: "calm_ui", scope: "ui" });
    expect(intent.intent).toBe("calm_ui");
    expect(intent.goal).toBeUndefined();
    expect(() => resolveIntent({ intent: "not_a_real_intent", scope: "ui" })).toThrow(UnknownIntentIdError);
  });

  it("exposes the controlled vocabulary and uses no NLP/LLM path", () => {
    expect(INTENT_VOCABULARY.length).toBeGreaterThanOrEqual(8);
    expect(intentVocabularyIds()).toContain("reduce_repetition");
    // Parsing is a pure token/rule match: deterministic tokenisation only.
    expect(tokenize("Reduce-Count 42!")).toEqual(["reduce", "count", "42"]);
  });
});
