/**
 * Deterministic conformance harness for the Intent & Memory engines.
 *
 * Validates each engine's JSON contract (`command`/`version`/`readOnly`),
 * determinism for identical inputs, and that every suggestion references an
 * actionable, runnable `toneforge` command.
 *
 * Work item: TF-0MUZLVUU0005MBIQ (Conformance harness, integration tests & docs).
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";

import { buildMemoryReport } from "../../memory/query.js";
import { createMemoryRecord, generationEvent, rejectionEvent } from "../../memory/record.js";
import { buildRecommendations } from "../../intelligence/recommend.js";
import { deriveMemoryContext } from "../../intelligence/memory-context.js";
import { validateActionableCommand } from "../../intelligence/commands.js";
import { parseGoalToIntent } from "../parse.js";
import { intentToUseCase } from "../submit.js";
import { makeEntry } from "../../intelligence/__tests__/helpers.js";

const clock = (iso: string) => ({ now: () => new Date(iso) });

/** Seeded, deterministic fixture library. */
function fixtureEntries() {
  return [
    makeEntry({ id: "lib-a", category: "ui", recipe: "ui-scifi-confirm", seed: 4 }),
    makeEntry({ id: "lib-b", category: "ui", recipe: "ui-scifi-confirm", seed: 5 }),
  ];
}

/** Seeded, deterministic fixture memory records. */
function fixtureRecords() {
  return [
    createMemoryRecord(generationEvent({ recipe: "ui-scifi-confirm", seed: 4 }), { clock: clock("2026-02-01T00:00:00Z") }),
    createMemoryRecord(generationEvent({ recipe: "ui-scifi-confirm", seed: 4 }), { clock: clock("2026-02-01T01:00:00Z") }),
    createMemoryRecord(generationEvent({ recipe: "ui-scifi-confirm", seed: 4 }), { clock: clock("2026-02-01T02:00:00Z") }),
    createMemoryRecord(rejectionEvent({ intent: "calm_ui", reason: "too quiet", scope: "ui" }), { clock: clock("2026-02-02T00:00:00Z") }),
  ];
}

describe("Intent & Memory conformance", () => {
  it("memory query report satisfies the shared JSON contract", () => {
    const report = buildMemoryReport(fixtureRecords(), { scope: "ui-scifi-confirm" });
    expect(report.command).toBe("memory query");
    expect(report.version).toBe("1.0");
    expect(report.readOnly).toBe(true);
    expect(JSON.stringify(buildMemoryReport(fixtureRecords(), { scope: "ui-scifi-confirm" }))).toBe(
      JSON.stringify(report),
    );
  });

  it("intent routing produces a deterministic, actionable Intelligence query", () => {
    const intent = parseGoalToIntent("reduce repetition in footstep sounds", { scope: "footsteps" });
    const useCase = intentToUseCase(intent);
    expect(useCase).toContain("reduce repetition");
    const report = buildRecommendations(fixtureEntries(), useCase);
    expect(report.command).toBe("intelligence recommend");
    expect(report.readOnly).toBe(true);
    for (const rec of report.recommendations) {
      expect(validateActionableCommand(rec.suggestedCommand).valid).toBe(true);
    }
  });

  it("memory-aware recommendations remain deterministic and actionable", () => {
    const context = deriveMemoryContext(fixtureRecords(), join("/p", ".toneforge", "memory", "memory.jsonl"));
    const first = buildRecommendations(fixtureEntries(), "calm ui menu", { memoryContext: context });
    const second = buildRecommendations(fixtureEntries(), "calm ui menu", { memoryContext: context });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    for (const rec of first.recommendations) {
      expect(validateActionableCommand(rec.suggestedCommand).valid).toBe(true);
    }
  });
});
