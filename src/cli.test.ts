import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { main } from "./cli.js";

// Mock the playAudio function to avoid actual audio playback during tests
vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

/** Helper to build a fake argv array as if invoked via `node cli.ts <...args>`. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

/** Capture console output during a function call. */
async function captureOutput(fn: () => Promise<number>): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const origLog = console.log;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    stdoutLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderrLines.push(args.map(String).join(" "));
  };

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
  }
}

describe("CLI", () => {
  describe("help", () => {
    it("prints help with --help flag", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("--help")));
      expect(code).toBe(0);
      expect(stdout).toContain("ToneForge");
      expect(stdout).toContain("generate");
    });

    it("prints help with -h flag", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("-h")));
      expect(code).toBe(0);
      expect(stdout).toContain("ToneForge");
    });

    it("prints help and returns 1 when no command given", async () => {
      const { code, stdout } = await captureOutput(() => main(argv()));
      expect(code).toBe(1);
      expect(stdout).toContain("Usage");
    });

    it("prints generate-specific help", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("--recipe");
      expect(stdout).toContain("--seed");
      expect(stdout).toContain("ui-scifi-confirm");
    });
  });

  describe("error handling", () => {
    it("returns 1 for unknown command", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("unknown-cmd")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("Unknown command");
    });

    it("returns 1 when --recipe is missing", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("--recipe is required");
    });

    it("returns 1 for invalid recipe name", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "nonexistent")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("Unknown recipe");
      expect(stderr).toContain("nonexistent");
    });

    it("returns 1 for non-integer seed", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "abc")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("--seed must be an integer");
    });
  });

  describe("generate command", () => {
    it("renders and plays with explicit seed (exit 0)", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("Generating");
      expect(stdout).toContain("ui-scifi-confirm");
      expect(stdout).toContain("seed 42");
      expect(stdout).toContain("Rendered");
      expect(stdout).toContain("Done.");
    });

    it("uses random seed when --seed is omitted", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("Using random seed:");
      expect(stdout).toContain("Done.");
    });

    it("completes in under 5 seconds", async () => {
      const start = performance.now();
      const { code } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "1")),
      );
      const elapsed = performance.now() - start;
      expect(code).toBe(0);
      expect(elapsed).toBeLessThan(5000);
    });
  });
});
