import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../../test/run-yargs-child.js";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

describe("visualize export CLI integration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "toneforge-visual-cli-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("exports a sprite sheet via the yargs entrypoint with JSON output", async () => {
    const { code, stdout, stderr } = await runCli([
      "visualize", "export",
      "--recipe", "weapon-laser-zap",
      "--seed", "42",
      "--format", "spritesheet",
      "--frames", "4",
      "--width", "16",
      "--height", "16",
      "--output", tempDir,
      "--json",
    ]);

    expect(stderr).toBe("");
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("visualize export");
    expect(data.recipe).toBe("weapon-laser-zap");
    expect(data.seed).toBe(42);
    expect(data.effect).toBe("directional_streak");
    expect(data.frameCount).toBe(4);
    expect(existsSync(data.spriteSheet)).toBe(true);
    expect(Array.from(readFileSync(data.spriteSheet).subarray(0, 8))).toEqual(PNG_SIGNATURE);
  });

  it("produces byte-identical assets for the same seed and palette", async () => {
    const baseArgs = [
      "visualize", "export",
      "--recipe", "weapon-laser-zap",
      "--seed", "99",
      "--format", "spritesheet",
      "--frames", "3",
      "--width", "12",
      "--height", "12",
      "--json",
    ];
    const first = await runCli([...baseArgs, "--output", join(tempDir, "a")]);
    const second = await runCli([...baseArgs, "--output", join(tempDir, "b")]);
    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    const a = JSON.parse(first.stdout);
    const b = JSON.parse(second.stdout);
    expect(readFileSync(a.spriteSheet).equals(readFileSync(b.spriteSheet))).toBe(true);
  });

  it("reports a non-zero exit code for an unsupported format", async () => {
    const { code, stderr } = await runCli([
      "visualize", "export",
      "--recipe", "weapon-laser-zap",
      "--seed", "1",
      "--format", "gif",
      "--output", tempDir,
    ]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/format/);
  });

  it("lists visualizer usage via --help", async () => {
    const { code, stdout } = await runCli(["visualize", "export", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("visualize");
    expect(stdout).toContain("--palette");
  });
});
