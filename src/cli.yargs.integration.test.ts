import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { yargsMain } from "./cli.yargs.js";

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

  it("supports show --json via yargs entrypoint", async () => {
    const { code, stdout } = await captureOutput(() => yargsMain(argv("show", "ui-scifi-confirm", "--json")));
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("show");
    expect(data.recipe).toBe("ui-scifi-confirm");
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
});
