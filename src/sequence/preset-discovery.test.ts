/**
 * Unit tests for preset-file discovery.
 *
 * Verifies observable behaviour of `listPresetFiles()`: `.json` files only,
 * `__`-prefixed test artefacts excluded, results sorted, empty directory
 * yields an empty array.
 *
 * Work item: TF-0MUYJSV32004EFAZ
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listPresetFiles } from "./preset-discovery.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "toneforge-preset-discovery-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("listPresetFiles", () => {
  it("returns real preset JSON files", async () => {
    await writeFile(join(dir, "laser.json"), "{}");
    await writeFile(join(dir, "explosion.json"), "{}");

    expect(listPresetFiles(dir)).toEqual(["explosion.json", "laser.json"]);
  });

  it("excludes __-prefixed test artefacts", async () => {
    await writeFile(join(dir, "real.json"), "{}");
    await writeFile(join(dir, "__malformed_test__.json"), "{ not valid json");
    await writeFile(join(dir, "__leaked__.json"), "{}");

    expect(listPresetFiles(dir)).toEqual(["real.json"]);
  });

  it("excludes non-JSON files", async () => {
    await writeFile(join(dir, "real.json"), "{}");
    await writeFile(join(dir, "README.md"), "# presets");
    await writeFile(join(dir, "notes.txt"), "scratch");

    expect(listPresetFiles(dir)).toEqual(["real.json"]);
  });

  it("ignores directories whose name ends in .json", async () => {
    await writeFile(join(dir, "real.json"), "{}");
    await mkdir(join(dir, "not-a-file.json"));

    expect(listPresetFiles(dir)).toEqual(["real.json"]);
  });

  it("returns an empty array for an empty directory", () => {
    expect(listPresetFiles(dir)).toEqual([]);
  });

  it("returns files sorted lexicographically", async () => {
    await writeFile(join(dir, "zeta.json"), "{}");
    await writeFile(join(dir, "alpha.json"), "{}");
    await writeFile(join(dir, "mid.json"), "{}");

    expect(listPresetFiles(dir)).toEqual(["alpha.json", "mid.json", "zeta.json"]);
  });
});
