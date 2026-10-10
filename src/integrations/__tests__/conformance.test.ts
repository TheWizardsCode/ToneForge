/**
 * Integrations Pipeline Conformance Suite
 *
 * Exercises the full Integrations pipeline — generate → validate →
 * compile → export — against the offline fixture libraries and asserts
 * deterministic, platform-appropriate output. Golden assertions cover
 * both the on-disk output file structure and the compiled
 * `manifest.json` contents.
 *
 * Work item: TF-0MUZYS1UF0071NLP (Integrations conformance harness and
 * fixture library). Reference: docs/prd/INTEGRATIONS_PRD.md Sections
 * 4.2 (Build Systems & CI), 7 (Deterministic Build Integration),
 * 9 (Library Synchronization).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readdir, readFile, rm, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  fixturePath,
  loadFixture,
  readCompiledManifest,
  runPipelineFromFixture,
  PIPELINE_STAGES,
  type IntegrationFixture,
  type PipelineResult,
} from "../harness.js";
import { hashBytes } from "../../compiler/index.js";

/** Heavy end-to-end tests render real audio; allow generous headroom. */
const TIMEOUT = 120_000;

/** Golden expectations stored alongside the valid fixture. */
interface GoldenExpectations {
  compileDecisions: Record<string, string>;
  compileFiles: string[];
  manifestFiles: string[];
  exportFiles: string[];
}

/** Read the golden expectation block from a fixture file. */
async function readExpectations(path: string): Promise<GoldenExpectations> {
  const raw = JSON.parse(await readFile(path, "utf-8")) as {
    expected: GoldenExpectations;
  };
  return raw.expected;
}

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

describe("Integrations conformance", () => {
  let workspaceA: string;
  let workspaceB: string;
  let valid: IntegrationFixture;
  let golden: GoldenExpectations;
  let runA: PipelineResult;
  let runB: PipelineResult;

  beforeAll(async () => {
    valid = loadFixture(fixturePath("valid"));
    golden = await readExpectations(fixturePath("valid"));
    workspaceA = await mkdtemp(join(tmpdir(), "tf-integrations-a-"));
    workspaceB = await mkdtemp(join(tmpdir(), "tf-integrations-b-"));
    runA = await runPipelineFromFixture(valid, { workspaceDir: workspaceA });
    runB = await runPipelineFromFixture(valid, { workspaceDir: workspaceB });
  }, TIMEOUT);

  afterAll(async () => {
    await rm(workspaceA, { recursive: true, force: true });
    await rm(workspaceB, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // AC1 — fixture library + harness run all four stages offline
  // -------------------------------------------------------------------------

  describe("AC1 — fixture library and four-stage pipeline", () => {
    it("loads a valid fixture library with the expected entries", () => {
      expect(valid.name).toBe("integrations-valid-library");
      expect(valid.entries.length).toBeGreaterThanOrEqual(3);
      for (const entry of valid.entries) {
        expect(entry.candidateId).toBeTruthy();
        expect(entry.recipe).toBeTruthy();
        expect(entry.duration).toBeGreaterThan(0);
        expect(entry.category).toBeTruthy();
      }
    });

    it("runs generate, validate, compile and export in canonical order", () => {
      expect(runA.stages).toEqual([...PIPELINE_STAGES]);
      expect(runA.generated.entryCount).toBe(valid.entries.length);
      expect(runA.generated.entryIds).toEqual(
        valid.entries.map((entry) => `lib-${entry.candidateId}`),
      );
      expect(runA.validation).toBeDefined();
      expect(runA.compilation).toBeDefined();
      expect(runA.exported).toBeDefined();
    });

    it("generates a real on-disk library (index + WAV + metadata)", async () => {
      const files = await listFiles(runA.generated.libraryDir);
      expect(files).toContain("index.json");
      for (const entry of valid.entries) {
        const id = `lib-${entry.candidateId}`;
        expect(files).toContain(`${entry.category}/${id}.wav`);
        expect(files).toContain(`${entry.category}/${id}.json`);
      }
    });

    it("validates the generated library without blocking", () => {
      expect(runA.validation!.entryCount).toBe(valid.entries.length);
      expect(runA.validation!.blocking).toBe(false);
    });

    it("compiles at least one baked/hybrid artifact plus a manifest", () => {
      expect(runA.compilation!.written.length).toBeGreaterThan(0);
      expect(runA.compilation!.manifest.assets.length).toBe(valid.entries.length);
      expect(runA.compilation!.target).toBe("web");
    });

    it("exports every generated asset WAV by category", () => {
      expect(runA.exported!.count).toBe(valid.entries.length);
      expect(runA.exported!.skipped).toEqual([]);
    });

    it("can run a restricted stage set (generate + validate only)", async () => {
      const workspace = await mkdtemp(join(tmpdir(), "tf-integrations-validate-"));
      try {
        const partial = await runPipelineFromFixture(valid, {
          workspaceDir: workspace,
          stages: ["generate", "validate"],
        });
        expect(partial.stages).toEqual(["generate", "validate"]);
        expect(partial.validation).toBeDefined();
        expect(partial.compilation).toBeUndefined();
        expect(partial.exported).toBeUndefined();
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    }, TIMEOUT);
  });

  // -------------------------------------------------------------------------
  // AC2 — golden assertions: output structure, manifest, determinism
  // -------------------------------------------------------------------------

  describe("AC2 — golden output structure and manifest contents", () => {
    it("produces the expected compile output file structure", async () => {
      const files = await listFiles(runA.compileDir);
      expect(files).toEqual([...golden.compileFiles, "manifest.json"].sort());
    });

    it("produces the expected export output file structure", async () => {
      const files = await listFiles(runA.exportDir);
      expect(files).toEqual([...golden.exportFiles].sort());
    });

    it("emits a RIFF/WAVE WAV for every baked and hybrid asset", async () => {
      for (const file of golden.manifestFiles) {
        const bytes = await readFile(join(runA.compileDir, file));
        expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
        expect(bytes.subarray(8, 12).toString("ascii")).toBe("WAVE");
      }
    });

    it("matches the golden per-asset decisions and counts", () => {
      const manifest = runA.compilation!.manifest;
      const decisions = Object.fromEntries(
        manifest.assets.map((asset) => [asset.assetId, asset.decision]),
      );
      expect(decisions).toEqual(golden.compileDecisions);
      expect(manifest.bakedAssets).toBe(1);
      expect(manifest.hybridAssets).toBe(1);
      expect(manifest.proceduralAssets).toBe(1);
    });

    it("writes a manifest whose hashes and byte counts match the emitted WAVs", async () => {
      const manifest = readCompiledManifest(runA.compileDir);
      expect(manifest.buildId).toMatch(/^tfc_[0-9a-f]{16}$/);
      expect(manifest.target).toBe("web");

      for (const asset of manifest.assets) {
        if (asset.decision === "procedural") {
          expect(asset.file).toBeNull();
          expect(asset.hash).toBeNull();
          expect(asset.bytes).toBeNull();
          continue;
        }
        const bytes = await readFile(join(runA.compileDir, asset.file!));
        expect(asset.bytes).toBe(bytes.length);
        expect(asset.hash).toBe(hashBytes(bytes));
      }
    });

    it("records the expected manifest file list", () => {
      const manifest = readCompiledManifest(runA.compileDir);
      const files = manifest.assets
        .map((asset) => asset.file)
        .filter((file): file is string => file !== null)
        .sort();
      expect(files).toEqual([...golden.manifestFiles].sort());
    });

    it("is deterministic across independent runs", async () => {
      // Same manifest bytes on disk.
      const manifestA = await readFile(join(runA.compileDir, "manifest.json"), "utf-8");
      const manifestB = await readFile(join(runB.compileDir, "manifest.json"), "utf-8");
      expect(manifestB).toBe(manifestA);
      expect(runB.compilation!.manifest).toEqual(runA.compilation!.manifest);

      // Byte-identical compiled WAVs.
      for (const file of golden.manifestFiles) {
        const bytesA = await readFile(join(runA.compileDir, file));
        const bytesB = await readFile(join(runB.compileDir, file));
        expect(Buffer.compare(bytesA, bytesB)).toBe(0);
      }

      // Byte-identical exported WAVs.
      for (const file of golden.exportFiles) {
        const bytesA = await readFile(join(runA.exportDir, file));
        const bytesB = await readFile(join(runB.exportDir, file));
        expect(Buffer.compare(bytesA, bytesB)).toBe(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC3 — negative fixture asserts structured validation failure
  // -------------------------------------------------------------------------

  describe("AC3 — negative fixture fails validation with structured errors", () => {
    it("blocks the build with per-check structured errors", async () => {
      const workspace = await mkdtemp(join(tmpdir(), "tf-integrations-invalid-"));
      try {
        const invalid = loadFixture(fixturePath("invalid"));
        const result = await runPipelineFromFixture(invalid, {
          workspaceDir: workspace,
          stages: ["generate", "validate"],
        });

        const report = result.validation!;
        expect(report.blocking).toBe(true);
        expect(report.status).toBe("error");
        expect(report.counts.error).toBeGreaterThanOrEqual(2);
        expect(report.perCheck.peak_clipping.error).toBeGreaterThanOrEqual(1);
        expect(report.perCheck.duration_bounds.error).toBeGreaterThanOrEqual(1);

        const asset = report.assets.find((a) => a.assetId === "lib-broken-blast");
        expect(asset).toBeDefined();

        const peak = asset!.checks.find((c) => c.check === "peak_clipping")!;
        expect(peak.status).toBe("error");
        expect(peak.value).toBeCloseTo(1.2, 5);
        expect(peak.limit).toBe("<=0.95");
        expect(peak.message).toContain("exceeds");

        const duration = asset!.checks.find((c) => c.check === "duration_bounds")!;
        expect(duration.status).toBe("error");
        expect(duration.value).toBeCloseTo(2.5, 5);
        expect(duration.limit).toBe("0.02s..1.5s");
        expect(duration.message).toContain("exceeds maximum");
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    }, TIMEOUT);

    it("serves as a negative control for the valid fixture", () => {
      // The same harness reports the valid library as non-blocking.
      expect(runA.validation!.blocking).toBe(false);
      expect(runA.validation!.status).not.toBe("error");
    });
  });

  // -------------------------------------------------------------------------
  // AC4 — offline and deterministic
  // -------------------------------------------------------------------------

  describe("AC4 — offline, deterministic execution", () => {
    it("is self-contained: fixtures reference no network resources", () => {
      const serialised = JSON.stringify(valid);
      expect(serialised).not.toMatch(/https?:\/\//);
    });

    it("repeats the validation and export stages identically", () => {
      expect(runB.validation).toEqual(runA.validation);
      expect(runB.exported!.count).toBe(runA.exported!.count);
      expect([...runB.exported!.files].sort()).toEqual(
        [...runA.exported!.files].sort(),
      );
      expect(runB.generated.entryIds).toEqual(runA.generated.entryIds);
    });
  });
});
