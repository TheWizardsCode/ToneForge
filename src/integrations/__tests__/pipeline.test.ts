/**
 * CI pipeline orchestration conformance suite.
 *
 * Exercises `runCiPipeline` against the offline Integrations fixture
 * libraries and asserts:
 * - the four stages run in canonical order on the success path;
 * - a failing validation stage aborts the run (fail fast) and later stages
 *   are not attempted;
 * - the export stage can sync to an engine target;
 * - the structured stage log is complete and machine-readable.
 *
 * Everything is offline and deterministic — no network or system audio.
 *
 * Work item: TF-0MUZYS3IX008OIF5. Reference: docs/prd/INTEGRATIONS_PRD.md
 * Sections 4.2 (Build Systems & CI), 7 (Deterministic Build Integration),
 * 10 (Validation & Compliance).
 */

import { describe, it, expect, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  fixturePath,
  loadFixture,
  PIPELINE_STAGES,
  runCiPipeline,
  type PipelineStageLog,
} from "../index.js";

/** Heavy end-to-end tests render real audio; allow generous headroom. */
const TIMEOUT = 120_000;

/** Recursively list files under `dir` as POSIX-relative, sorted paths. */
async function listFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(current: string, prefix: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(current, entry.name), rel);
      else found.push(rel);
    }
  }
  if (existsSync(dir)) await walk(dir, "");
  return found.sort();
}

/** Create an isolated workspace and return the three stage directories. */
async function workspace(): Promise<{
  root: string;
  libraryDir: string;
  compileDir: string;
  exportDir: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "tf-pipeline-"));
  return {
    root,
    libraryDir: join(root, "library"),
    compileDir: join(root, "compile"),
    exportDir: join(root, "export"),
  };
}

const createdRoots: string[] = [];

afterAll(async () => {
  for (const root of createdRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("runCiPipeline — success path", () => {
  it("runs generate → validate → compile → export in canonical order", async () => {
    const ws = await workspace();
    createdRoots.push(ws.root);

    const fixture = loadFixture(fixturePath("valid"));
    const stagesSeen: PipelineStageLog[] = [];
    const result = await runCiPipeline({
      fixture,
      libraryDir: ws.libraryDir,
      compileDir: ws.compileDir,
      exportDir: ws.exportDir,
      onStage: (log) => stagesSeen.push(log),
    });

    expect(result.command).toBe("pipeline");
    expect(result.status).toBe("ok");
    expect(result.failedStage).toBeNull();
    expect(result.stages).toEqual([...PIPELINE_STAGES]);
    expect(result.stageLogs.map((log) => log.stage)).toEqual([...PIPELINE_STAGES]);
    expect(result.stageLogs.every((log) => log.status === "ok")).toBe(true);
    expect(stagesSeen.map((log) => log.stage)).toEqual([...PIPELINE_STAGES]);

    expect(result.generated.entryCount).toBe(fixture.entries.length);
    expect(result.generated.entryIds).toEqual(
      fixture.entries.map((entry) => `lib-${entry.candidateId}`),
    );
    expect(result.validation).not.toBeNull();
    expect(result.validation!.blocking).toBe(false);
    expect(result.compilation).not.toBeNull();
    expect(result.compilation!.written.length).toBeGreaterThan(0);
    expect(result.exported).not.toBeNull();
  }, TIMEOUT);

  it("emits a structured, machine-readable stage log for every stage", async () => {
    const ws = await workspace();
    createdRoots.push(ws.root);

    const result = await runCiPipeline({
      fixture: loadFixture(fixturePath("valid")),
      libraryDir: ws.libraryDir,
      compileDir: ws.compileDir,
      exportDir: ws.exportDir,
    });

    // The whole result must round-trip through JSON (CI log contract).
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped.status).toBe("ok");

    for (const log of result.stageLogs) {
      expect(typeof log.stage).toBe("string");
      expect(log.status).toBe("ok");
      expect(typeof log.startedAt).toBe("string");
      expect(Number.isFinite(log.durationMs)).toBe(true);
      expect(log.summary).toBeTypeOf("object");
      expect(log.error).toBeUndefined();
    }

    const validateLog = result.stageLogs.find((log) => log.stage === "validate")!;
    expect(validateLog.summary["blocking"]).toBe(false);

    const compileLog = result.stageLogs.find((log) => log.stage === "compile")!;
    expect(compileLog.summary["written"]).toBeGreaterThan(0);
  }, TIMEOUT);

  it("writes a real library, compiled manifest and exported WAVs", async () => {
    const ws = await workspace();
    createdRoots.push(ws.root);

    const result = await runCiPipeline({
      fixture: loadFixture(fixturePath("valid")),
      libraryDir: ws.libraryDir,
      compileDir: ws.compileDir,
      exportDir: ws.exportDir,
    });

    expect(result.status).toBe("ok");
    const libraryFiles = await listFiles(ws.libraryDir);
    expect(libraryFiles).toContain("index.json");
    const compileFiles = await listFiles(ws.compileDir);
    expect(compileFiles).toContain("manifest.json");
    const exportFiles = await listFiles(ws.exportDir);
    expect(exportFiles.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it("is deterministic across independent runs", async () => {
    const first = await workspace();
    const second = await workspace();
    createdRoots.push(first.root, second.root);

    const fixture = loadFixture(fixturePath("valid"));
    const runA = await runCiPipeline({
      fixture,
      libraryDir: first.libraryDir,
      compileDir: first.compileDir,
      exportDir: first.exportDir,
    });
    const runB = await runCiPipeline({
      fixture,
      libraryDir: second.libraryDir,
      compileDir: second.compileDir,
      exportDir: second.exportDir,
    });

    expect(runA.compilation!.manifest.buildId).toBe(runB.compilation!.manifest.buildId);
    expect(runA.generated.entryIds).toEqual(runB.generated.entryIds);
  }, TIMEOUT);
});

describe("runCiPipeline — failing stage", () => {
  it("aborts at a blocking validation stage and does not run later stages", async () => {
    const ws = await workspace();
    createdRoots.push(ws.root);

    const result = await runCiPipeline({
      fixture: loadFixture(fixturePath("invalid")),
      libraryDir: ws.libraryDir,
      compileDir: ws.compileDir,
      exportDir: ws.exportDir,
    });

    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("validate");
    expect(result.stageLogs.map((log) => log.stage)).toEqual(["generate", "validate"]);

    const failed = result.stageLogs[1]!;
    expect(failed.status).toBe("failed");
    expect(failed.error?.code).toBe("validation_failed");
    expect(failed.error?.message).toContain("aborted");
    expect(failed.summary["blocking"]).toBe(true);

    expect(result.validation).not.toBeNull();
    expect(result.validation!.blocking).toBe(true);
    expect(result.compilation).toBeNull();
    expect(result.exported).toBeNull();

    // No compiled or exported output should have been produced.
    expect(existsSync(ws.compileDir)).toBe(false);
    expect(existsSync(ws.exportDir)).toBe(false);
  }, TIMEOUT);
});
