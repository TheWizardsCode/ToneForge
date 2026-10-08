/**
 * `--use-memory` historical-context conformance tests.
 *
 * Work item: TF-0MUZLVSVG006HJVB (Verify: Intent submit, approval gate &
 * memory-aware Intelligence).
 */

import { describe, it, expect } from "vitest";

import { buildRecommendations } from "../recommend.js";
import { deriveMemoryContext } from "../memory-context.js";
import { createMemoryRecord, generationEvent, rejectionEvent } from "../../memory/record.js";
import { makeEntry } from "./helpers.js";

const clockAt = (iso: string) => ({ now: () => new Date(iso) });

function fixtureEntries() {
  return [
    makeEntry({ id: "lib-a", category: "ui", recipe: "ui-scifi-confirm", seed: 4 }),
    makeEntry({ id: "lib-b", category: "ui", recipe: "ui-scifi-confirm", seed: 5 }),
  ];
}

describe("memory-aware recommendations", () => {
  it("is unchanged without --use-memory (no memoryContext key)", () => {
    const report = buildRecommendations(fixtureEntries(), "calm ui menu");
    expect(report.memoryContext).toBeUndefined();
    expect(report.recommendations.every((r) => r.memoryNotes === undefined)).toBe(true);
  });

  it("adds historical context and notes when memory is supplied", () => {
    const records = [
      createMemoryRecord(generationEvent({ recipe: "ui-scifi-confirm", seed: 4 }), { clock: clockAt("2026-02-01T00:00:00Z") }),
      createMemoryRecord(generationEvent({ recipe: "ui-scifi-confirm", seed: 4 }), { clock: clockAt("2026-02-01T01:00:00Z") }),
      createMemoryRecord(generationEvent({ recipe: "ui-scifi-confirm", seed: 4 }), { clock: clockAt("2026-02-01T02:00:00Z") }),
      createMemoryRecord(rejectionEvent({ intent: "calm_ui", reason: "too quiet", scope: "ui" }), { clock: clockAt("2026-02-02T00:00:00Z") }),
    ];
    const context = deriveMemoryContext(records, "/p/.toneforge/memory/memory.jsonl");

    expect(context.overRepresentedSeeds).toEqual([
      { recipe: "ui-scifi-confirm", seed: 4, count: 3 },
    ]);

    const report = buildRecommendations(fixtureEntries(), "calm ui menu", { memoryContext: context });
    expect(report.memoryContext?.totalRecords).toBe(4);
    const demoted = report.recommendations.find((r) => r.seed === 4);
    expect(demoted?.memoryNotes?.[0]).toContain("over-represented");
  });

  it("is deterministic for identical library + memory inputs", () => {
    const records = [
      createMemoryRecord(generationEvent({ recipe: "ui-scifi-confirm", seed: 4 }), { clock: clockAt("2026-02-01T00:00:00Z") }),
    ];
    const context = deriveMemoryContext(records, "/p/memory.jsonl");
    const first = buildRecommendations(fixtureEntries(), "calm ui menu", { memoryContext: context });
    const second = buildRecommendations(fixtureEntries(), "calm ui menu", { memoryContext: context });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
