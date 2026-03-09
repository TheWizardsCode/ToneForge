import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { yargsMain } from "./cli.yargs.js";

vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
  getPlayerCommand: vi.fn().mockReturnValue({ command: "echo", args: ["mock-play"] }),
}));

async function captureOutput(fn: () => Promise<number>): Promise<{ code: number; stdout: string; stderr: string }> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const origLog = console.log;
  const origError = console.error;
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

  console.log = (...args: unknown[]) => {
    stdoutLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderrLines.push(args.map(String).join(" "));
  };
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutLines.push(String(chunk).replace(/\n$/, ""));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrLines.push(String(chunk).replace(/\n$/, ""));
    return true;
  }) as typeof process.stderr.write;

  try {
    const code = await fn();
    return {
      code,
      stdout: stdoutLines.join("\n"),
      stderr: stderrLines.join("\n"),
    };
  } finally {
    console.log = origLog;
    console.error = origError;
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

function argv(...args: string[]): string[] {
  return ["node", "cli.yargs.ts", ...args];
}

describe("yargs CLI entrypoint integration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `toneforge-yargs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup issues
    }
  });

  it("supports list --json via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(() => yargsMain(argv("list", "--json")));
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("list");
    expect(data.resource).toBe("recipes");
    expect(Array.isArray(data.recipes)).toBe(true);
  });

  it("supports list text output via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(() => yargsMain(argv("list", "recipes")));
    expect(code).toBe(0);
    expect(stdout).toContain("Recipe");
    expect(stdout).toContain("ui-scifi-confirm");
  });

  it("supports show --json via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(() => yargsMain(argv("show", "ui-scifi-confirm", "--json")));
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("show");
    expect(data.recipe).toBe("ui-scifi-confirm");
  });

  it("supports show text output via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(() => yargsMain(argv("show", "ui-scifi-confirm")));
    expect(code).toBe(0);
    expect(stdout).toContain("# ui-scifi-confirm");
    expect(stdout).toContain("## Parameters");
  });

  it("supports generate --json via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(
      () => yargsMain(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("generate");
    expect(data.recipe).toBe("ui-scifi-confirm");
    expect(data.seed).toBe(42);
  });

  it("supports version command via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(() => yargsMain(argv("version")));
    expect(code).toBe(0);
    expect(stdout).toMatch(/^ToneForge v\d+\.\d+\.\d+$/);
  });

  it("supports play command via yargs entrypoint", async () => {
    const outPath = join(tempDir, "play-source.wav");
    const generated = await captureOutput(
      () => yargsMain(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
    );
    expect(generated.code).toBe(0);

    const { code } = await captureOutput(() => yargsMain(argv("play", outPath)));
    expect(code).toBe(0);
  });

  it("writes a valid WAV file via yargs generate --output", async () => {
    const outPath = join(tempDir, "yargs-output.wav");
    const { code, stdout } = await captureOutput(
      () => yargsMain(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
    );

    expect(code).toBe(0);
    expect(stdout).toContain("Wrote");
    expect(existsSync(outPath)).toBe(true);

    const data = readFileSync(outPath);
    expect(data.toString("ascii", 0, 4)).toBe("RIFF");
    expect(data.toString("ascii", 8, 12)).toBe("WAVE");
    expect(data.length).toBe(44 + data.readUInt32LE(40));
  });

  it("preserves JSON error output shape", async () => {
    const { code, stderr } = await captureOutput(
      () => yargsMain(argv("generate", "--recipe", "nonexistent", "--json")),
    );
    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(typeof data.error).toBe("string");
    expect(data.error).toContain("Unknown recipe");
  });

  it("supports stack inspect --json via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(
      () => yargsMain(argv("stack", "inspect", "--preset", "presets/explosion_heavy.json", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("stack inspect");
    expect(data.preset).toBe("presets/explosion_heavy.json");
    expect(Array.isArray(data.layers)).toBe(true);
  });

  it("supports sequence simulate --json via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(
      () => yargsMain(argv("sequence", "simulate", "--preset", "presets/sequences/weapon_burst.json", "--seed", "42", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.name).toBe("weapon_burst");
    expect(data.seed).toBe(42);
    expect(Array.isArray(data.events)).toBe(true);
  });

  it("supports stack render --json via yargs entrypoint", async () => {
    const outPath = join(tempDir, "stack-output.wav");
    const { code, stdout } = await captureOutput(
      () => yargsMain(argv("stack", "render", "--preset", "presets/explosion_heavy.json", "--seed", "42", "--output", outPath, "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("stack render");
    expect(data.name).toBe("explosion_heavy");
    expect(data.seed).toBe(42);
    expect(data.output).toBe(outPath);
    expect(existsSync(outPath)).toBe(true);
  });

  it("supports sequence inspect --json via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(
      () => yargsMain(argv("sequence", "inspect", "--preset", "presets/sequences/weapon_burst.json", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("sequence inspect");
    expect(data.name).toBe("weapon_burst");
    expect(Array.isArray(data.events)).toBe(true);
  });

  it("supports analyze --json via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(
      () => yargsMain(argv("analyze", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("analyze");
    expect(data.source).toEqual({ recipe: "ui-scifi-confirm", seed: 42 });
    expect(typeof data.sampleRate).toBe("number");
    expect(typeof data.metrics).toBe("object");
  });

  it("supports classify --json via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(
      () => yargsMain(argv("classify", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("classify");
    expect(typeof data.category).toBe("string");
    expect(typeof data.intensity).toBe("string");
    expect(Array.isArray(data.texture)).toBe(true);
    expect(Array.isArray(data.tags)).toBe(true);
  });

  it("supports classify search --json via yargs entrypoint", async () => {
    const { code, stderr } = await captureOutput(
      () => yargsMain(argv("classify", "search", "--category", "ui", "--dir", "./tmp-nonexistent", "--json")),
    );
    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(typeof data.error).toBe("string");
    expect(data.error).toContain("Directory not found");
  });

  it("supports explore sweep --json via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(
      () => yargsMain(argv("explore", "sweep", "--recipe", "ui-scifi-confirm", "--seed-range", "1:2", "--keep-top", "1", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("explore sweep");
    expect(data.config.recipe).toBe("ui-scifi-confirm");
    expect(Array.isArray(data.candidates)).toBe(true);
    expect(typeof data.runId).toBe("string");
  });

  it("supports library list --json via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(
      () => yargsMain(argv("library", "list", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("library list");
    expect(Array.isArray(data.entries)).toBe(true);
  });

  it("preserves TUI non-interactive error behavior via yargs entrypoint", async () => {
    const { code, stderr } = await captureOutput(
      () => yargsMain(argv("tui")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("requires an interactive terminal");
  });
});
