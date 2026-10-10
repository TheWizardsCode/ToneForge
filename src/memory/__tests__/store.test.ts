/**
 * Memory core conformance tests — schema, append-only store, project-local
 * isolation, determinism and the clock seam.
 *
 * Work item: TF-0MUZLVQCL009MV03 (Verify: Memory core types & append-only store).
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";

import {
  InMemoryMemoryFileSystem,
  JsonlMemoryStore,
  createMemoryStore,
  resolveMemoryDir,
} from "../store.js";
import { createMemoryRecord, createMemoryRecorder, generationEvent } from "../record.js";
import {
  MEMORY_VERSION,
  parseMemoryRecord,
  serialiseMemoryRecord,
  validateMemoryRecord,
} from "../types.js";

const frozenClock = { now: () => new Date("2026-02-20T00:12:00Z") };

function overrideInput(scope = "ui") {
  return {
    module: "mixer",
    event: "override" as const,
    category: "preference" as const,
    scope,
    details: { group: "ui", reason: "too loud" },
  };
}

describe("Memory record schema", () => {
  it("accepts the PRD record shape and rejects malformed records", () => {
    const record = createMemoryRecord(overrideInput(), { clock: frozenClock });
    expect(validateMemoryRecord(record)).toEqual([]);

    expect(() => parseMemoryRecord({ ...record, confidence: 2 })).toThrow(/confidence/);
    expect(() => parseMemoryRecord({ ...record, event: "bogus" })).toThrow(/event/);
    expect(() => parseMemoryRecord({ ...record, category: "nope" })).toThrow(/category/);
    expect(() => parseMemoryRecord({ ...record, timestamp: "not-a-date" })).toThrow(/timestamp/);
    expect(() => parseMemoryRecord({ ...record, attribution: "" })).toThrow(/attribution/);
  });

  it("is versioned, timestamped and attributable", () => {
    const record = createMemoryRecord(overrideInput(), { clock: frozenClock, attribution: "tester" });
    expect(record.version).toBe(MEMORY_VERSION);
    expect(record.timestamp).toBe("2026-02-20T00:12:00.000Z");
    expect(record.attribution).toBe("tester");
    expect(record.id).toMatch(/^mem-[0-9a-f]{16}$/);
  });

  it("produces byte-identical output for identical input with a frozen clock", () => {
    const a = createMemoryRecord(overrideInput(), { clock: frozenClock });
    const b = createMemoryRecord(overrideInput(), { clock: frozenClock });
    expect(a).toEqual(b);
    expect(serialiseMemoryRecord(a)).toBe(serialiseMemoryRecord(b));
  });
});

describe("append-only project-local store", () => {
  it("appends without mutating prior records", async () => {
    const fs = new InMemoryMemoryFileSystem();
    const store = new JsonlMemoryStore({ dir: "/proj/.toneforge/memory", fs });
    const a = createMemoryRecord(overrideInput(), { clock: frozenClock });
    const b = createMemoryRecord(generationEvent({ recipe: "ui-scifi-confirm", seed: 4 }), {
      clock: frozenClock,
    });

    await store.append(a);
    const afterFirst = fs.raw(store.location);
    await store.append(b);
    const afterSecond = fs.raw(store.location)!;

    expect(afterSecond.startsWith(afterFirst!)).toBe(true);
    expect(afterSecond).toBe(`${serialiseMemoryRecord(a)}\n${serialiseMemoryRecord(b)}\n`);
    expect(await store.readAll()).toEqual([a, b]);
  });

  it("is project-local: a fresh project reads an empty store", async () => {
    const fs = new InMemoryMemoryFileSystem();
    const store = new JsonlMemoryStore({ dir: "/project-a/.toneforge/memory", fs });
    expect(await store.readAll()).toEqual([]);
    expect(store.location).toBe(join("/project-a/.toneforge/memory", "memory.jsonl"));
    // A different project never sees project-a's records.
    const other = new JsonlMemoryStore({ dir: "/project-b/.toneforge/memory", fs });
    await store.append(createMemoryRecord(overrideInput(), { clock: frozenClock }));
    expect(await other.readAll()).toEqual([]);
  });

  it("supports explicit export and clear", async () => {
    const fs = new InMemoryMemoryFileSystem();
    const store = new JsonlMemoryStore({ dir: "/p/.toneforge/memory", fs });
    const record = createMemoryRecord(overrideInput(), { clock: frozenClock });
    await store.append(record);

    expect(await store.export()).toEqual([record]);
    await store.clear();
    expect(await store.readAll()).toEqual([]);
    expect(fs.raw(store.location)).toBe("");
  });

  it("fails fast on malformed existing data", async () => {
    const fs = new InMemoryMemoryFileSystem();
    const store = new JsonlMemoryStore({ dir: "/p/.toneforge/memory", fs });
    await fs.writeFile(store.location, "{not json}\n");
    await expect(store.readAll()).rejects.toThrow(/Malformed memory record/);
  });

  it("records via the injected recorder and resolves the default directory", async () => {
    const fs = new InMemoryMemoryFileSystem();
    const store = createMemoryStore({ dir: "/p/.toneforge/memory", fs });
    const recorder = createMemoryRecorder(store, { clock: frozenClock });
    const recorded = await recorder.record(generationEvent({ recipe: "footstep-stone", seed: 7 }));
    expect(await store.readAll()).toEqual([recorded]);
    expect(resolveMemoryDir("/x")).toBe(join("/x", ".toneforge", "memory"));
  });
});
