import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { exportVisual } from "./export.js";

describe("exportVisual", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "toneforge-visual-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("exports a sprite sheet PNG plus grid metadata", async () => {
    const result = await exportVisual({
      recipe: "weapon-laser-zap",
      seed: 42,
      format: "spritesheet",
      outputDir: tempDir,
      frames: 4,
      width: 16,
      height: 16,
    });

    expect(result.command).toBe("visualize export");
    expect(result.recipe).toBe("weapon-laser-zap");
    expect(result.effect).toBe("directional_streak");
    expect(result.frameCount).toBe(4);
    expect(result.spriteSheet).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(existsSync(result.spriteSheet!)).toBe(true);
    expect(existsSync(result.metadata!)).toBe(true);

    // Valid PNG signature.
    const png = readFileSync(result.spriteSheet!);
    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const meta = JSON.parse(readFileSync(result.metadata!, "utf8"));
    expect(meta.frameCount).toBe(4);
    expect(meta.frameWidth).toBe(16);
    expect(meta.columns).toBe(4);
    expect(meta.rows).toBe(1);
    expect(meta.frames).toHaveLength(4);
  });

  it("is deterministic: the same seed + palette yields byte-identical assets", async () => {
    const a = await exportVisual({
      recipe: "weapon-laser-zap",
      seed: 42,
      format: "spritesheet",
      outputDir: join(tempDir, "a"),
      frames: 3,
      width: 12,
      height: 12,
    });
    const b = await exportVisual({
      recipe: "weapon-laser-zap",
      seed: 42,
      format: "spritesheet",
      outputDir: join(tempDir, "b"),
      frames: 3,
      width: 12,
      height: 12,
    });
    expect(readFileSync(a.spriteSheet!).equals(readFileSync(b.spriteSheet!))).toBe(true);
  });

  it("changes visual output when the palette changes", async () => {
    const a = await exportVisual({
      recipe: "weapon-laser-zap",
      seed: 42,
      format: "spritesheet",
      outputDir: join(tempDir, "a"),
      palette: "calm_ui",
      frames: 3,
      width: 12,
      height: 12,
    });
    const b = await exportVisual({
      recipe: "weapon-laser-zap",
      seed: 42,
      format: "spritesheet",
      outputDir: join(tempDir, "b"),
      palette: "high_energy_combat",
      frames: 3,
      width: 12,
      height: 12,
    });
    expect(readFileSync(a.spriteSheet!).equals(readFileSync(b.spriteSheet!))).toBe(false);
  });

  it("exports individual frames when format is 'frames'", async () => {
    const result = await exportVisual({
      recipe: "ui-scifi-confirm",
      seed: 7,
      format: "frames",
      outputDir: tempDir,
      frames: 3,
      width: 8,
      height: 8,
    });
    expect(result.effect).toBe("radial_pulse");
    const pngFiles = result.files.filter((f) => f.endsWith(".png"));
    expect(pngFiles).toHaveLength(3);
    for (const file of pngFiles) {
      expect(existsSync(file)).toBe(true);
      const png = readFileSync(file);
      expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }
  });

  it("rejects unknown recipes", async () => {
    await expect(
      exportVisual({ recipe: "nope-not-real", seed: 1, format: "spritesheet", outputDir: tempDir }),
    ).rejects.toThrow(/Recipe not found/);
  });

  it("rejects unsupported formats", async () => {
    await expect(
      exportVisual({ recipe: "weapon-laser-zap", seed: 1, format: "gif", outputDir: tempDir }),
    ).rejects.toThrow(/Unsupported format/);
  });

  it("rejects an unknown palette", async () => {
    await expect(
      exportVisual({
        recipe: "weapon-laser-zap",
        seed: 1,
        format: "spritesheet",
        outputDir: tempDir,
        palette: "not_a_palette",
      }),
    ).rejects.toThrow(/Unknown palette/);
  });
});
