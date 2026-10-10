/**
 * Engine sync integration tests.
 *
 * Exercises `syncLibrary` end-to-end against a real on-disk library:
 * validation gate, compiler reuse, target-specific file layout, engine
 * manifest contents, and deterministic/idempotent output.
 *
 * Work item: TF-0MUZYS2VP007O99D. Reference: docs/prd/INTEGRATIONS_PRD.md
 * Sections 4.1, 6, 7 (deterministic builds), 9 (library sync), 10.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashBytes } from "../../compiler/index.js";
import {
  ENGINE_MANIFEST_FILE,
  SyncValidationError,
  UnsupportedTargetError,
  syncLibrary,
} from "../index.js";
import { addLibraryEntry, createTempDir } from "../../../test/cli-test-utils.js";

/** Recursively list files under `dir` as sorted POSIX-relative paths. */
async function listFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(current: string, prefix: string): Promise<void> {
    for (const dirent of await readdir(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${dirent.name}` : dirent.name;
      if (dirent.isDirectory()) await walk(join(current, dirent.name), rel);
      else found.push(rel);
    }
  }
  if (!existsSync(dir)) return [];
  await walk(dir, "");
  return found.sort();
}

describe("syncLibrary", () => {
  let tempDir: string;
  let libraryDir: string;
  let outDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("toneforge-sync-");
    libraryDir = join(tempDir, "library");
    outDir = join(tempDir, "out");

    await addLibraryEntry(libraryDir, {
      id: "impact-crack",
      recipe: "impact-crack",
      duration: 0.25,
      peak: 0.8,
      category: "Impact",
      tags: ["impact", "heavy"],
    });
    await addLibraryEntry(libraryDir, {
      id: "ui-confirm",
      recipe: "ui-notification-chime",
      duration: 0.3,
      peak: 0.6,
      category: "UI",
      tags: ["ui", "confirm"],
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes Unity assets under Assets/Audio/<category>/ plus a manifest", async () => {
    const result = await syncLibrary({
      target: "unity",
      libraryDir,
      outputDir: outDir,
    });

    expect(await listFiles(outDir)).toEqual([
      "Assets/Audio/Impact/lib-impact-crack.wav",
      "Assets/Audio/UI/lib-ui-confirm.wav",
      ENGINE_MANIFEST_FILE,
    ]);

    expect(result.manifest.target).toBe("unity");
    expect(result.manifest.assets.map((a) => a.assetId)).toEqual([
      "lib-impact-crack",
      "lib-ui-confirm",
    ]);
    expect(result.written).toHaveLength(2);
  });

  it("maps categories to audio groups and tags to mixer buses in the manifest", async () => {
    const result = await syncLibrary({ target: "unity", libraryDir, outputDir: outDir });
    const manifest = result.manifest;

    expect(manifest.audioGroups).toEqual({ Impact: "SFX", UI: "UI" });
    expect(manifest.mixerBuses).toEqual({
      confirm: "SFX",
      heavy: "SFX",
      impact: "SFX",
      ui: "UI",
    });

    const impact = manifest.assets.find((a) => a.assetId === "lib-impact-crack")!;
    expect(impact.audioGroup).toBe("SFX");
    expect(impact.tags).toEqual(["impact", "heavy"]);
    expect(impact.file).toBe("Assets/Audio/Impact/lib-impact-crack.wav");

    const ui = manifest.assets.find((a) => a.assetId === "lib-ui-confirm")!;
    expect(ui.audioGroup).toBe("UI");
    expect(ui.mixerBus).toBe("UI");
  });

  it("records byte counts and hashes that match the emitted WAVs", async () => {
    const result = await syncLibrary({ target: "unity", libraryDir, outputDir: outDir });

    for (const asset of result.manifest.assets) {
      const bytes = await readFile(join(outDir, asset.file));
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(asset.bytes).toBe(bytes.length);
      expect(asset.hash).toBe(hashBytes(bytes));
    }
  });

  it("uses a flat audio/ layout for the web target", async () => {
    const result = await syncLibrary({ target: "web", libraryDir, outputDir: outDir });

    expect(await listFiles(outDir)).toEqual([
      "audio/lib-impact-crack.wav",
      "audio/lib-ui-confirm.wav",
      ENGINE_MANIFEST_FILE,
    ]);
    expect(result.manifest.target).toBe("web");
    expect(result.manifest.audioGroups).toEqual({ Impact: "sfx", UI: "ui" });
  });

  it("is deterministic across independent runs", async () => {
    const outA = join(tempDir, "out-a");
    const outB = join(tempDir, "out-b");
    const a = await syncLibrary({ target: "unity", libraryDir, outputDir: outA });
    const b = await syncLibrary({ target: "unity", libraryDir, outputDir: outB });

    expect(a.manifest).toEqual(b.manifest);
    expect(a.manifest.buildId).toMatch(/^tfs_[0-9a-f]{16}$/);

    const filesA = await listFiles(outA);
    expect(filesA).toEqual(await listFiles(outB));
    for (const file of filesA) {
      const bytesA = await readFile(join(outA, file));
      const bytesB = await readFile(join(outB, file));
      expect(Buffer.compare(bytesA, bytesB)).toBe(0);
    }
  });

  it("is idempotent when re-run into the same directory", async () => {
    await syncLibrary({ target: "unity", libraryDir, outputDir: outDir });
    const first = await Promise.all(
      (await listFiles(outDir)).map(async (file) => readFile(join(outDir, file))),
    );
    await syncLibrary({ target: "unity", libraryDir, outputDir: outDir });
    const second = await Promise.all(
      (await listFiles(outDir)).map(async (file) => readFile(join(outDir, file))),
    );

    expect(second.length).toBe(first.length);
    for (let i = 0; i < first.length; i++) {
      expect(Buffer.compare(first[i]!, second[i]!)).toBe(0);
    }
  });

  it("rejects an unsupported target before touching the output directory", async () => {
    await expect(
      syncLibrary({ target: "godot", libraryDir, outputDir: outDir }),
    ).rejects.toBeInstanceOf(UnsupportedTargetError);
    expect(existsSync(outDir)).toBe(false);
  });

  it("blocks on error-level validation findings and writes nothing", async () => {
    const badDir = join(tempDir, "bad-library");
    await addLibraryEntry(badDir, {
      id: "broken-blast",
      recipe: "impact-crack",
      duration: 0.5,
      peak: 1.2,
      category: "Impact",
      tags: ["impact"],
    });

    const badOut = join(tempDir, "bad-out");
    await expect(
      syncLibrary({ target: "unity", libraryDir: badDir, outputDir: badOut }),
    ).rejects.toBeInstanceOf(SyncValidationError);
    expect(existsSync(badOut)).toBe(false);
  });
});
