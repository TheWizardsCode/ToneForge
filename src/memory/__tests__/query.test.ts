/**
 * Memory record API and query engine conformance tests.
 *
 * Work item: TF-0MUZLVS0J005KUSE (Verify: Memory record API & query engine).
 */

import { describe, it, expect } from "vitest";

import { InMemoryMemoryFileSystem, JsonlMemoryStore } from "../store.js";
import {
  createMemoryRecord,
  createMemoryRecorder,
  generationEvent,
  promotionEvent,
  qualityEvent,
  rejectionEvent,
  overrideEvent,
} from "../record.js";
import { buildMemoryReport, queryMemory, exportMemory, clearMemory } from "../query.js";
import type { MemoryRecord } from "../types.js";

function clockAt(iso: string) {
  return { now: () => new Date(iso) };
}

function seedStore(): { fs: InMemoryMemoryFileSystem; store: JsonlMemoryStore; records: MemoryRecord[] } {
  const fs = new InMemoryMemoryFileSystem();
  const store = new JsonlMemoryStore({ dir: "/p/.toneforge/memory", fs });
  const records = [
    createMemoryRecord(generationEvent({ recipe: "footstep-stone", seed: 1 }), { clock: clockAt("2026-02-01T10:00:00Z") }),
    createMemoryRecord(generationEvent({ recipe: "footstep-stone", seed: 1 }), { clock: clockAt("2026-02-01T11:00:00Z") }),
    createMemoryRecord(generationEvent({ recipe: "footstep-stone", seed: 1 }), { clock: clockAt("2026-02-02T10:00:00Z") }),
    createMemoryRecord(generationEvent({ recipe: "weapon-laser-zap", seed: 9, scope: "weapon" }), { clock: clockAt("2026-02-02T12:00:00Z") }),
    createMemoryRecord(promotionEvent({ entryId: "lib-a", recipe: "footstep-stone", seed: 1 }), { clock: clockAt("2026-02-03T09:00:00Z") }),
    createMemoryRecord(rejectionEvent({ intent: "reduce_repetition", reason: "no budget", scope: "footsteps" }), { clock: clockAt("2026-02-03T10:00:00Z") }),
    createMemoryRecord(qualityEvent({ entryId: "lib-a", issue: "clipping", confidence: 0.9 }), { clock: clockAt("2026-02-04T09:00:00Z") }),
    createMemoryRecord(qualityEvent({ entryId: "lib-a", issue: "clipping", confidence: 0.7 }), { clock: clockAt("2026-02-05T09:00:00Z") }),
    createMemoryRecord(overrideEvent({ group: "ui", reason: "too loud" }), { clock: clockAt("2026-02-05T12:00:00Z") }),
  ];
  return { fs, store, records };
}

async function seedSeededStore() {
  const seeded = seedStore();
  const recorder = createMemoryRecorder(seeded.store);
  for (const record of seeded.records) {
    await seeded.store.append(record);
  }
  void recorder;
  return seeded;
}

describe("memory query engine", () => {
  it("produces a deterministic scope-filtered report", async () => {
    const { store } = await seedSeededStore();
    const report = await queryMemory(store, { scope: "footstep-stone" });

    expect(report.command).toBe("memory query");
    expect(report.readOnly).toBe(true);
    expect(report.scope).toBe("footstep-stone");
    expect(report.counts.generated).toBe(3);
    expect(report.counts.promoted).toBe(1);
    expect(report.mostUsedSeeds).toEqual([{ recipe: "footstep-stone", seed: 1, count: 3 }]);
    // Quality events carry the entry id as scope, so they are excluded here.
    expect(report.recurringIssues).toEqual([]);

    // Determinism: identical input → identical report.
    const again = await queryMemory(store, { scope: "footstep-stone" });
    expect(JSON.stringify(again)).toBe(JSON.stringify(report));
  });

  it("honours a time range and assembles the full report", async () => {
    const { store } = await seedSeededStore();
    const report = await queryMemory(store, {
      timeRange: { from: "2026-02-03T00:00:00Z", to: "2026-02-05T23:59:59Z" },
    });

    expect(report.counts.rejected).toBe(1);
    expect(report.counts.overrides).toBe(1);
    expect(report.rejectedIntents).toEqual([
      { intent: "reduce_repetition", scope: "footsteps", reason: "no budget", timestamp: "2026-02-03T10:00:00.000Z" },
    ]);
    expect(report.qualityTrend.map((point) => point.date)).toEqual(["2026-02-04", "2026-02-05"]);
    expect(report.qualityTrend[0]!.averageConfidence).toBeCloseTo(0.9, 4);
    expect(report.recurringIssues).toEqual([{ issue: "clipping", count: 2 }]);
    expect(report.mostUsedSeeds).toEqual([]);
  });

  it("never mutates the store during a query (read-only guarantee)", async () => {
    const { fs, store } = await seedSeededStore();
    const before = fs.raw(store.location);
    await queryMemory(store, { scope: "footstep-stone" });
    expect(fs.raw(store.location)).toBe(before);
  });

  it("buildMemoryReport is pure over an explicit record list", () => {
    const { records } = seedStore();
    const report = buildMemoryReport(records, { scope: "weapon" });
    expect(report.counts.generated).toBe(1);
    expect(report.total).toBe(1);
  });

  it("supports explicit export and clear", async () => {
    const { store } = await seedSeededStore();
    expect((await exportMemory(store)).length).toBe(9);
    await clearMemory(store);
    expect(await exportMemory(store)).toEqual([]);
  });
});
