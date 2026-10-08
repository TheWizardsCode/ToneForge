/**
 * Intent submission, approval gate and read-only conformance tests.
 *
 * Work item: TF-0MUZLVSVG006HJVB (Verify: Intent submit, approval gate &
 * memory-aware Intelligence).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { submitIntent } from "../submit.js";
import { resolveIntent } from "../parse.js";
import { clearIndexCache } from "../../library/index-store.js";
import { makeEntry } from "../../intelligence/__tests__/helpers.js";

let libraryDir: string;

beforeEach(() => {
  libraryDir = mkdtempSync(join(tmpdir(), "tf-intent-submit-"));
  mkdirSync(join(libraryDir, "ui"), { recursive: true });
  clearIndexCache();
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
});

afterEach(() => {
  clearIndexCache(libraryDir);
  rmSync(libraryDir, { recursive: true, force: true });
});

function intent() {
  return resolveIntent({ intent: "calm_ui", scope: "ui" });
}

function readIndex(): string {
  return readFileSync(join(libraryDir, "index.json"), "utf-8");
}

describe("intent submit approval gate", () => {
  it("prints suggestions only (no execution) without approval", async () => {
    const executed: string[] = [];
    const report = await submitIntent(intent(), {
      libraryDir,
      approve: false,
      dryRun: false,
      interactive: false,
      executor: (command) => { executed.push(command); },
    });

    expect(report.approvalRequired).toBe(true);
    expect(report.approved).toBe(false);
    expect(executed).toEqual([]);
    expect(report.executed).toEqual([]);
    expect(report.suggestions.length).toBeGreaterThan(0);
  });

  it("never executes in dry-run even with --approve", async () => {
    const executed: string[] = [];
    const report = await submitIntent(intent(), {
      libraryDir,
      approve: true,
      dryRun: true,
      executor: (command) => { executed.push(command); },
    });
    expect(report.approved).toBe(false);
    expect(executed).toEqual([]);
  });

  it("executes every suggestion when approved", async () => {
    const executed: string[] = [];
    const report = await submitIntent(intent(), {
      libraryDir,
      approve: true,
      executor: (command) => { executed.push(command); },
    });
    expect(report.approved).toBe(true);
    expect(executed.length).toBe(report.suggestions.length);
    expect(report.executed).toEqual(executed);
  });

  it("interactive gate executes only confirmed suggestions", async () => {
    const executed: string[] = [];
    const report = await submitIntent(intent(), {
      libraryDir,
      interactive: true,
      confirm: (suggestion) => suggestion.id === "intent-route",
      executor: (command) => { executed.push(command); },
    });
    expect(executed.length).toBe(1);
    expect(report.executed.length).toBe(1);
  });

  it("never mutates the library and is deterministic", async () => {
    const before = readIndex();
    const first = await submitIntent(intent(), { libraryDir, interactive: false });
    const second = await submitIntent(intent(), { libraryDir, interactive: false });
    expect(readIndex()).toBe(before);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.readOnly).toBe(true);
  });
});
