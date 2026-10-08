/**
 * CLI integration tests for `toneforge intelligence audit`.
 *
 * Work item: TF-0MUZLOFFI0010MJ5 (Library audit engine + intelligence audit).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { main } from "./cli.js";
import { clearIndexCache } from "./library/index-store.js";
import { makeEntry, sampleLibrary } from "./intelligence/__tests__/helpers.js";
import type { AuditReport } from "./intelligence/types.js";

let libraryDir: string;

function writeLibrary(entries: ReturnType<typeof makeEntry>[]): void {
  writeFileSync(
    join(libraryDir, "index.json"),
    JSON.stringify({ version: "1.0", entries }, null, 2),
  );
}

async function captureOutput(fn: () => Promise<number>): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutLines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrLines.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;

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

beforeEach(() => {
  libraryDir = mkdtempSync(join(tmpdir(), "tf-intelligence-audit-"));
  mkdirSync(join(libraryDir, "ui"), { recursive: true });
  clearIndexCache();
});

afterEach(() => {
  clearIndexCache(libraryDir);
  rmSync(libraryDir, { recursive: true, force: true });
});

describe("toneforge intelligence audit", () => {
  it("emits a structured JSON audit report", async () => {
    writeLibrary(sampleLibrary());

    const { code, stdout } = await captureOutput(() =>
      main(argv("intelligence", "audit", "--library", libraryDir, "--json")),
    );

    expect(code).toBe(0);
    const report = JSON.parse(stdout) as AuditReport;
    expect(report.command).toBe("intelligence audit");
    expect(report.totalEntries).toBe(5);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.summary.entries).toBe(5);
    expect(report.summary.redundancies).toBe(1);
  });

  it("reports coverage gaps, redundancy, and quality findings end to end", async () => {
    writeLibrary(sampleLibrary());

    const { stdout } = await captureOutput(() =>
      main(argv("intelligence", "audit", "--library", libraryDir, "--json")),
    );
    const report = JSON.parse(stdout) as AuditReport;
    const kinds = new Set(report.findings.map((f) => f.kind));

    expect(kinds).toEqual(new Set(["coverage-gap", "redundancy", "quality"]));
  });

  it("leaves the library index byte-identical (read-only)", async () => {
    writeLibrary(sampleLibrary());
    const indexPath = join(libraryDir, "index.json");
    const before = readFileSync(indexPath, "utf-8");

    const { code } = await captureOutput(() =>
      main(argv("intelligence", "audit", "--library", libraryDir, "--json")),
    );

    expect(code).toBe(0);
    expect(readFileSync(indexPath, "utf-8")).toBe(before);
  });

  it("prints a readable human report", async () => {
    writeLibrary(sampleLibrary());

    const { code, stdout } = await captureOutput(() =>
      main(argv("intelligence", "audit", "--library", libraryDir)),
    );

    expect(code).toBe(0);
    expect(stdout).toContain("Library Audit Report");
    expect(stdout).toContain("Summary:");
  });

  it("fails with an error for an unknown subcommand", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("intelligence", "explode", "--json")),
    );

    expect(code).toBe(1);
    expect(stderr).toContain("Unknown intelligence subcommand");
  });
});
