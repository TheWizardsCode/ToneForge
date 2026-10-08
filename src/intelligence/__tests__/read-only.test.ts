/**
 * Read-only guarantee tests.
 *
 * Proves — via directory hashing — that Intelligence never mutates library
 * data, at both the engine and CLI levels.
 *
 * Work item: TF-0MUZLOGCW006O8LH (Safety, determinism & explainability hardening).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  snapshotLibrary,
  assertLibraryUnchanged,
  withReadOnlyGuard,
  ReadOnlyViolationError,
} from "../read-only.js";
import { clearIndexCache } from "../../library/index-store.js";
import { main } from "../../cli.js";
import { makeEntry } from "./helpers.js";

let libraryDir: string;

beforeEach(() => {
  libraryDir = mkdtempSync(join(tmpdir(), "tf-intelligence-readonly-"));
  writeFileSync(
    join(libraryDir, "index.json"),
    JSON.stringify({ version: "1.0", entries: [makeEntry({ id: "lib-a", recipe: "ui-scifi-confirm" })] }, null, 2),
  );
  clearIndexCache();
});

afterEach(() => {
  clearIndexCache(libraryDir);
  rmSync(libraryDir, { recursive: true, force: true });
});

async function captureOutput(fn: () => Promise<number>): Promise<{ code: number; stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => { stdout.push(String(chunk)); return true; }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { stderr.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try {
    const code = await fn();
    return { code, stdout: stdout.join(""), stderr: stderr.join("") };
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

describe("snapshotLibrary / assertLibraryUnchanged", () => {
  it("detects added files", () => {
    const before = snapshotLibrary(libraryDir);
    writeFileSync(join(libraryDir, "extra.txt"), "new");
    const after = snapshotLibrary(libraryDir);

    expect(() => assertLibraryUnchanged(before, after, "test")).toThrow(ReadOnlyViolationError);
  });

  it("detects changed files", () => {
    const before = snapshotLibrary(libraryDir);
    writeFileSync(join(libraryDir, "index.json"), JSON.stringify({ version: "1.0", entries: [] }));
    const after = snapshotLibrary(libraryDir);

    expect(() => assertLibraryUnchanged(before, after, "test")).toThrow(ReadOnlyViolationError);
  });

  it("detects removed files", () => {
    writeFileSync(join(libraryDir, "doomed.txt"), "bye");
    const before = snapshotLibrary(libraryDir);
    rmSync(join(libraryDir, "doomed.txt"));
    const after = snapshotLibrary(libraryDir);

    expect(() => assertLibraryUnchanged(before, after, "test")).toThrow(ReadOnlyViolationError);
  });

  it("does not throw when nothing changed", () => {
    const before = snapshotLibrary(libraryDir);
    const after = snapshotLibrary(libraryDir);
    expect(() => assertLibraryUnchanged(before, after, "test")).not.toThrow();
  });

  it("treats a missing directory as an empty snapshot", () => {
    expect(snapshotLibrary(join(libraryDir, "does-not-exist"))).toEqual({});
  });
});

describe("withReadOnlyGuard", () => {
  it("returns the action result when the library is untouched", async () => {
    const result = await withReadOnlyGuard(libraryDir, "test", async () => 42);
    expect(result).toBe(42);
  });

  it("throws ReadOnlyViolationError when the action writes to the library", async () => {
    await expect(
      withReadOnlyGuard(libraryDir, "test", async () => {
        writeFileSync(join(libraryDir, "sneaky.txt"), "oops");
      }),
    ).rejects.toBeInstanceOf(ReadOnlyViolationError);
  });
});

describe("intelligence CLI read-only guarantee", () => {
  it("leaves the library byte-identical for all three commands", async () => {
    const indexPath = join(libraryDir, "index.json");
    const beforeContent = readFileSync(indexPath, "utf-8");
    const before = snapshotLibrary(libraryDir);

    const audit = await captureOutput(() =>
      main(["node", "cli.ts", "intelligence", "audit", "--library", libraryDir, "--json"]),
    );
    const recommend = await captureOutput(() =>
      main(["node", "cli.ts", "intelligence", "recommend", "--use-case", "ui", "--library", libraryDir, "--json"]),
    );
    const suggest = await captureOutput(() =>
      main(["node", "cli.ts", "intelligence", "suggest-exploration", "--recipe", "ui-scifi-confirm", "--library", libraryDir, "--json"]),
    );

    expect(audit.code).toBe(0);
    expect(recommend.code).toBe(0);
    expect(suggest.code).toBe(0);

    const after = snapshotLibrary(libraryDir);
    expect(after).toEqual(before);
    expect(readFileSync(indexPath, "utf-8")).toBe(beforeContent);
  });

  it("refuses to disable the dry-run / read-only guarantee", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(["node", "cli.ts", "intelligence", "audit", "--library", libraryDir, "--no-dry-run", "--json"]),
    );

    expect(code).toBe(1);
    expect(stderr).toContain("always read-only");
  });
});
