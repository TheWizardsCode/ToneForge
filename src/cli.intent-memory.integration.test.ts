/**
 * CLI integration tests for `toneforge intent` and `toneforge memory`, plus
 * `toneforge intelligence recommend --use-memory`.
 *
 * Work item: TF-0MUZLVUA4000UGG7 (Implement: CLI command groups & event wiring).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { main } from "./cli.js";
import { clearIndexCache } from "./library/index-store.js";
import { makeEntry } from "./intelligence/__tests__/helpers.js";
import { createMemoryStore } from "./memory/index.js";
import { createMemoryRecord, generationEvent, rejectionEvent } from "./memory/record.js";
import type { IntentSubmissionReport } from "./intent/submit.js";
import type { MemoryQueryReport } from "./memory/types.js";
import type { RecommendReport } from "./intelligence/types.js";

let libraryDir: string;
let memoryDir: string;

async function captureOutput(fn: () => Promise<number>): Promise<{ code: number; stdout: string; stderr: string }> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => { stdoutLines.push(String(chunk)); return true; }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { stderrLines.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try {
    const code = await fn();
    return { code, stdout: stdoutLines.join(""), stderr: stderrLines.join("") };
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

async function seedMemory(): Promise<void> {
  const store = createMemoryStore({ dir: memoryDir });
  const clock = (iso: string) => ({ now: () => new Date(iso) });
  await store.append(createMemoryRecord(generationEvent({ recipe: "ui-scifi-confirm", seed: 4 }), { clock: clock("2026-02-01T00:00:00Z") }));
  await store.append(createMemoryRecord(generationEvent({ recipe: "ui-scifi-confirm", seed: 4 }), { clock: clock("2026-02-01T01:00:00Z") }));
  await store.append(createMemoryRecord(generationEvent({ recipe: "ui-scifi-confirm", seed: 4 }), { clock: clock("2026-02-01T02:00:00Z") }));
  await store.append(createMemoryRecord(rejectionEvent({ intent: "calm_ui", reason: "too quiet", scope: "ui" }), { clock: clock("2026-02-02T00:00:00Z") }));
}

beforeEach(() => {
  libraryDir = mkdtempSync(join(tmpdir(), "tf-intent-cli-"));
  memoryDir = mkdtempSync(join(tmpdir(), "tf-memory-cli-"));
  mkdirSync(join(libraryDir, "ui"), { recursive: true });
  writeFileSync(
    join(libraryDir, "index.json"),
    JSON.stringify({
      version: "1.0",
      entries: [
        makeEntry({ id: "lib-a", category: "ui", recipe: "ui-scifi-confirm", seed: 4 }),
        makeEntry({ id: "lib-b", category: "ui", recipe: "ui-scifi-confirm", seed: 5 }),
      ],
    }),
  );
  clearIndexCache();
});

afterEach(() => {
  clearIndexCache(libraryDir);
  rmSync(libraryDir, { recursive: true, force: true });
  rmSync(memoryDir, { recursive: true, force: true });
});

describe("toneforge intent", () => {
  it("submits a goal as JSON with an approval gate and no execution", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("intent", "submit", "--goal", "reduce repetition in footstep sounds", "--scope", "footsteps", "--json")),
    );
    expect(code).toBe(0);
    const report = JSON.parse(stdout) as IntentSubmissionReport;
    expect(report.command).toBe("intent submit");
    expect(report.intent.intent).toBe("reduce_repetition");
    expect(report.approvalRequired).toBe(true);
    expect(report.approved).toBe(false);
    expect(report.executed).toEqual([]);
    expect(report.suggestions.length).toBeGreaterThan(0);
    expect(report.suggestions[0]!.suggestedCommand).toContain("toneforge");
  });

  it("lists the controlled vocabulary", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("intent", "vocabulary", "--json")));
    expect(code).toBe(0);
    const payload = JSON.parse(stdout) as { vocabulary: Array<{ id: string }> };
    expect(payload.vocabulary.map((entry) => entry.id)).toContain("reduce_repetition");
  });

  it("fails with an actionable error for an unknown goal", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("intent", "submit", "--goal", "xyzzy plugh", "--scope", "project", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Supported intents");
  });
});

describe("toneforge memory", () => {
  it("queries the project-local store with a scope and time range", async () => {
    await seedMemory();
    const { code, stdout } = await captureOutput(() =>
      main(argv("memory", "query", "--scope", "ui-scifi-confirm", "--memory-dir", memoryDir, "--json")),
    );
    expect(code).toBe(0);
    const report = JSON.parse(stdout) as MemoryQueryReport;
    expect(report.command).toBe("memory query");
    expect(report.readOnly).toBe(true);
    expect(report.counts.generated).toBe(3);
    expect(report.mostUsedSeeds[0]!.count).toBe(3);
  });

  it("exports and clears the store", async () => {
    await seedMemory();
    const exported = await captureOutput(() =>
      main(argv("memory", "export", "--memory-dir", memoryDir, "--json")),
    );
    expect(exported.code).toBe(0);
    expect((JSON.parse(exported.stdout) as { total: number }).total).toBe(4);

    const cleared = await captureOutput(() => main(argv("memory", "clear", "--memory-dir", memoryDir, "--json")));
    expect(cleared.code).toBe(0);
    const empty = await captureOutput(() => main(argv("memory", "query", "--memory-dir", memoryDir, "--json")));
    expect((JSON.parse(empty.stdout) as MemoryQueryReport).total).toBe(0);
  });
});

describe("toneforge intelligence recommend --use-memory", () => {
  it("is unchanged without the flag", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("intelligence", "recommend", "--use-case", "calm ui menu", "--library", libraryDir, "--json")),
    );
    expect(code).toBe(0);
    const report = JSON.parse(stdout) as RecommendReport;
    expect(report.memoryContext).toBeUndefined();
  });

  it("adds historical context when --use-memory is supplied", async () => {
    await seedMemory();
    const { code, stdout } = await captureOutput(() =>
      main(argv("intelligence", "recommend", "--use-case", "calm ui menu", "--library", libraryDir, "--use-memory", "--memory-dir", memoryDir, "--json")),
    );
    expect(code).toBe(0);
    const report = JSON.parse(stdout) as RecommendReport;
    expect(report.memoryContext?.totalRecords).toBe(4);
    expect(report.memoryContext?.overRepresentedSeeds[0]).toEqual({ recipe: "ui-scifi-confirm", seed: 4, count: 3 });
  });
});
