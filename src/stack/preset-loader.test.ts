/**
 * Stack Preset Loader Tests
 *
 * Tests for loadPreset() — reading, parsing, validating, and verifying
 * recipe references in JSON preset files.
 *
 * Work item: TF-0MLZZJZP50VW0Q4P
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPreset } from "./preset-loader.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `toneforge-preset-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

/** Write a JSON preset to a temp file and return the path. */
async function writePreset(name: string, data: unknown): Promise<string> {
  const filePath = join(tempDir, name);
  await writeFile(filePath, JSON.stringify(data), "utf-8");
  return filePath;
}

describe("loadPreset — valid presets", () => {
  it("loads the explosion_heavy preset file", async () => {
    const result = await loadPreset("presets/explosion_heavy.json");
    expect(result.name).toBe("explosion_heavy");
    expect(result.layers).toHaveLength(3);
    expect(result.layers[0]!.recipe).toBe("impact-crack");
    expect(result.layers[1]!.recipe).toBe("rumble-body");
    expect(result.layers[2]!.recipe).toBe("debris-tail");
  });

  it("loads the door_slam preset file", async () => {
    const result = await loadPreset("presets/door_slam.json");
    expect(result.name).toBe("door_slam");
    expect(result.layers).toHaveLength(3);
    expect(result.layers[0]!.recipe).toBe("slam-transient");
    expect(result.layers[1]!.recipe).toBe("resonance-body");
    expect(result.layers[2]!.recipe).toBe("rattle-decay");
  });

  it("returns a valid StackDefinition with correct layer properties", async () => {
    const result = await loadPreset("presets/explosion_heavy.json");
    expect(result.layers[0]!.startTime).toBe(0);
    expect(result.layers[0]!.gain).toBe(0.9);
    expect(result.layers[1]!.startTime).toBe(0.005);
    expect(result.layers[1]!.gain).toBe(0.7);
    expect(result.layers[2]!.startTime).toBe(0.05);
    expect(result.layers[2]!.gain).toBe(0.5);
  });
});

describe("loadPreset — file errors", () => {
  it("throws on non-existent file", async () => {
    await expect(loadPreset("/nonexistent/path/preset.json")).rejects.toThrow(
      /failed to read preset/i,
    );
  });

  it("throws on invalid JSON", async () => {
    const filePath = await writePreset("bad.json", "not json at all");
    // writeFile wrote the string directly, but it's valid JSON as a string...
    // We need to write raw invalid JSON
    await writeFile(filePath, "{invalid json}", "utf-8");
    await expect(loadPreset(filePath)).rejects.toThrow(/failed to parse preset/i);
  });
});

describe("loadPreset — schema validation", () => {
  it("throws on empty layers array", async () => {
    const filePath = await writePreset("empty-layers.json", {
      version: "1.0",
      name: "empty",
      layers: [],
    });
    await expect(loadPreset(filePath)).rejects.toThrow(/at least one layer/i);
  });

  it("throws on missing version", async () => {
    const filePath = await writePreset("no-version.json", {
      name: "test",
      layers: [{ recipe: "impact-crack", startTime: 0 }],
    });
    await expect(loadPreset(filePath)).rejects.toThrow(/version/i);
  });

  it("throws on missing name", async () => {
    const filePath = await writePreset("no-name.json", {
      version: "1.0",
      layers: [{ recipe: "impact-crack", startTime: 0 }],
    });
    await expect(loadPreset(filePath)).rejects.toThrow(/name/i);
  });

  it("throws on missing recipe in layer", async () => {
    const filePath = await writePreset("no-recipe.json", {
      version: "1.0",
      name: "test",
      layers: [{ startTime: 0 }],
    });
    await expect(loadPreset(filePath)).rejects.toThrow(/recipe/i);
  });

  it("throws on negative startTime", async () => {
    const filePath = await writePreset("neg-start.json", {
      version: "1.0",
      name: "test",
      layers: [{ recipe: "impact-crack", startTime: -1 }],
    });
    await expect(loadPreset(filePath)).rejects.toThrow(/startTime/i);
  });
});

describe("loadPreset — recipe validation", () => {
  it("throws on unknown recipe name", async () => {
    const filePath = await writePreset("unknown-recipe.json", {
      version: "1.0",
      name: "test",
      layers: [{ recipe: "nonexistent-recipe-xyz", startTime: 0 }],
    });
    await expect(loadPreset(filePath)).rejects.toThrow(
      /unknown recipe.*nonexistent-recipe-xyz/i,
    );
  });

  it("validates that all layer recipes exist in registry", async () => {
    const filePath = await writePreset("mixed-recipes.json", {
      version: "1.0",
      name: "test",
      layers: [
        { recipe: "impact-crack", startTime: 0 },
        { recipe: "this-recipe-does-not-exist", startTime: 0.1 },
      ],
    });
    await expect(loadPreset(filePath)).rejects.toThrow(
      /unknown recipe.*this-recipe-does-not-exist/i,
    );
  });
});
