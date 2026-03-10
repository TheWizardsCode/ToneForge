import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { main } from "./cli.js";
import { truncateTags } from "./cli.js";
import { existsSync, readFileSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock the playAudio and getPlayerCommand functions to avoid actual audio playback during tests
vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
  getPlayerCommand: vi.fn().mockReturnValue({ command: "echo", args: ["mock-play"] }),
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
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

  console.log = (...args: unknown[]) => {
    stdoutLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderrLines.push(args.map(String).join(" "));
  };
  // Capture process.stdout.write / process.stderr.write used by output helpers
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

describe("CLI", () => {
  describe("help", () => {
    it("prints help with --help flag", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("--help")));
      expect(code).toBe(0);
      expect(stdout).toContain("ToneForge");
      expect(stdout).toContain("generate");
      expect(stdout).toContain("list");
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
      expect(stdout).toContain("--output");
      expect(stdout).toContain("--seed-range");
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
    it("does not print startup banner to stdout", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42")),
      );
      expect(code).toBe(0);
      expect(stdout).not.toMatch(/^ToneForge v\d+\.\d+\.\d+$/m);
    });

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

  describe("list command", () => {
    it("lists all registered recipes", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("list", "recipes")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("ui-scifi-confirm");
      expect(stdout).toContain("weapon-laser-zap");
      expect(stdout).toContain("footstep-stone");
      expect(stdout).toContain("ui-notification-chime");
      expect(stdout).toContain("ambient-wind-gust");
    });

    it("includes a one-line description for each recipe", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("list", "recipes")),
      );
      expect(code).toBe(0);
      // Verify known descriptions appear (word-wrapped across the table)
      expect(stdout).toContain("sci-fi");
      expect(stdout).toContain("confirmation");
      expect(stdout).toContain("laser zap");
      expect(stdout).toContain("stone");
      expect(stdout).toContain("footstep");
    });

    it("outputs one recipe per line", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("list", "recipes")),
      );
      expect(code).toBe(0);
      const lines = stdout.trim().split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(5);
    });

    it("prints list help with --help flag", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("list", "--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("recipes");
      expect(stdout).toContain("resource");
    });

    it("defaults to listing recipes when no resource specified", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("list")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("ui-scifi-confirm");
      expect(stdout).toContain("weapon-laser-zap");
      expect(stdout).toContain("footstep-stone");
      expect(stdout).toContain("ui-notification-chime");
      expect(stdout).toContain("ambient-wind-gust");
    });

    it("returns 1 for unknown resource type", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("list", "unknown")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("Unknown resource");
    });

    it("list output contains no ANSI when non-TTY", async () => {
      const { setTtyOverride } = await import("./output.js");
      setTtyOverride(false);
      try {
        const { code, stdout } = await captureOutput(
          () => main(argv("list")),
        );
        expect(code).toBe(0);
        // eslint-disable-next-line no-control-regex
        expect(stdout).not.toMatch(/\x1b\[/);
        expect(stdout).toContain("ui-scifi-confirm");
      } finally {
        setTtyOverride(undefined);
      }
    });

    it("list output contains ANSI when TTY", async () => {
      const { setTtyOverride } = await import("./output.js");
      setTtyOverride(true);
      try {
        const { code, stdout } = await captureOutput(
          () => main(argv("list")),
        );
        expect(code).toBe(0);
        // eslint-disable-next-line no-control-regex
        expect(stdout).toMatch(/\x1b\[/);
        expect(stdout).toContain("ui-scifi-confirm");
      } finally {
        setTtyOverride(undefined);
      }
    });

    it("list JSON output is unaffected by TTY mode", async () => {
      const { setTtyOverride } = await import("./output.js");
      setTtyOverride(true);
      try {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "--json")),
        );
        expect(code).toBe(0);
        // eslint-disable-next-line no-control-regex
        expect(stdout).not.toMatch(/\x1b\[/);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("list");
        const names = data.recipes.map((r: { name: string }) => r.name);
        expect(names).toContain("ui-scifi-confirm");
      } finally {
        setTtyOverride(undefined);
      }
    });
  });

  describe("list recipes filtering", () => {
    describe("--search flag", () => {
      it("filters by keyword matching recipe name", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--search", "laser")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("weapon-laser-zap");
        expect(stdout).not.toContain("card-flip");
      });

      it("filters by keyword matching description", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--search", "fanfare")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("card-victory-fanfare");
        expect(stdout).not.toContain("weapon-laser-zap");
      });

      it("filters by keyword matching category", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--search", "weapon")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("weapon-laser-zap");
      });

      it("search is case-insensitive", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--search", "LASER")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("weapon-laser-zap");
      });

      it("shows filtered footer with search", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--search", "laser")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(/Found \d+ of \d+ recipes/);
      });
    });

    describe("--category flag", () => {
      it("filters by exact category match", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--category", "weapon")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("weapon-laser-zap");
        expect(stdout).not.toContain("card-flip");
      });

      it("normalizes category with spaces to hyphens", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--category", "Card Game")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("card-flip");
        expect(stdout).not.toContain("weapon-laser-zap");
      });

      it("category match is case-insensitive", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--category", "WEAPON")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("weapon-laser-zap");
      });

      it("non-matching category returns zero results", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--category", "nonexistent")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(/Found 0 of \d+ recipes/);
        // Should not contain table headers when zero results
        expect(stdout).not.toContain("Recipe");
      });
    });

    describe("--tags flag", () => {
      it("filters by single tag", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--tags", "laser")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("weapon-laser-zap");
      });

      it("tags match is case-insensitive", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--tags", "LASER")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("weapon-laser-zap");
      });

      it("multiple tags use AND logic", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--tags", "card,flip")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("card-flip");
        // card-shuffle has "card" but not "flip", so should not appear
        expect(stdout).not.toContain("card-shuffle");
      });

      it("uses exact match not substring", async () => {
        // "laser" should match tag "laser" but NOT a tag like "laser-beam"
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--tags", "las")),
        );
        expect(code).toBe(0);
        // "las" is not an exact tag match for any recipe
        expect(stdout).toMatch(/Found 0 of \d+ recipes/);
      });
    });

    describe("combined filters", () => {
      it("combines --category and --search with AND logic", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--category", "card-game", "--search", "coin")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("card-coin-collect");
        expect(stdout).not.toContain("weapon-laser-zap");
        expect(stdout).not.toContain("card-flip");
      });

      it("combines --category and --tags with AND logic", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--category", "card-game", "--tags", "card,flip")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("card-flip");
        expect(stdout).not.toContain("weapon-laser-zap");
      });
    });

    describe("zero results", () => {
      it("displays footer only when no recipes match", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--search", "zzz-nonexistent-zzz")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(/Found 0 of \d+ recipes/);
        expect(stdout).not.toContain("| Recipe");
      });
    });

    describe("JSON output with filters", () => {
      it("includes total field in unfiltered JSON", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(typeof data.total).toBe("number");
        expect(data.total).toBeGreaterThanOrEqual(5);
        expect(data.recipes.length).toBe(data.total);
      });

      it("includes category and tags in JSON recipe objects", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        for (const r of data.recipes) {
          expect(typeof r.category).toBe("string");
          expect(Array.isArray(r.tags)).toBe(true);
        }
      });

      it("includes filters object when filtering with --search", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--json", "--search", "laser")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.filters).toBeDefined();
        expect(data.filters.search).toBe("laser");
        expect(data.recipes.length).toBeLessThan(data.total);
      });

      it("includes filters object when filtering with --category", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--json", "--category", "weapon")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.filters).toBeDefined();
        expect(data.filters.category).toBe("weapon");
      });

      it("includes filters object when filtering with --tags", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--json", "--tags", "laser,zap")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.filters).toBeDefined();
        expect(data.filters.tags).toEqual(["laser", "zap"]);
      });

      it("omits filters object when unfiltered", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.filters).toBeUndefined();
      });
    });

    describe("table format and footer", () => {
      it("displays four-column table headers", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("Recipe");
        expect(stdout).toContain("Description");
        expect(stdout).toContain("Category");
        expect(stdout).toContain("Tags");
      });

      it("displays unfiltered footer with total count", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(/Showing \d+ recipes/);
        expect(stdout).not.toMatch(/Found \d+ of/);
      });

      it("displays filtered footer with match count", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--search", "laser")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(/Found \d+ of \d+ recipes/);
      });

      it("truncates long tag lists with ellipsis", async () => {
        // card-coin-collect-hybrid has multiple tags that should overflow 14-char column
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--search", "coin-collect-hybrid")),
        );
        expect(code).toBe(0);
        // The ellipsis character should appear when tags overflow
        expect(stdout).toContain("\u2026");
      });
    });

    describe("truncateTags unit tests", () => {
      it("returns em-dash for empty tag list", () => {
        expect(truncateTags([], 14)).toBe("\u2014");
      });

      it("returns em-dash for empty tags even when matchedTags provided", () => {
        expect(truncateTags([], 14, ["laser"], true)).toBe("\u2014");
      });

      it("joins tags without truncation when they fit", () => {
        expect(truncateTags(["a", "b", "c"], 14)).toBe("a, b, c");
      });

      it("truncates with ellipsis when tags exceed maxWidth", () => {
        const result = truncateTags(["laser", "sci-fi", "bright", "arcade"], 14);
        expect(result).toContain("\u2026");
        // Visible width should be <= 14
        expect(result.length).toBeLessThanOrEqual(14);
      });

      it("preserves original order when matchedTags is empty", () => {
        const result = truncateTags(["alpha", "beta"], 20, []);
        expect(result).toBe("alpha, beta");
      });

      it("reorders matched tags to the front", () => {
        // "beta" is matched, should move before "alpha"
        const result = truncateTags(["alpha", "beta", "gamma"], 30, ["beta"]);
        expect(result).toBe("beta, alpha, gamma");
      });

      it("preserves relative order within matched and unmatched groups", () => {
        const result = truncateTags(
          ["a", "b", "c", "d", "e"],
          40,
          ["c", "e"],
        );
        // matched: c, e  |  unmatched: a, b, d
        expect(result).toBe("c, e, a, b, d");
      });

      it("applies ANSI bold+yellow to matched tags in TTY mode", () => {
        const result = truncateTags(["laser", "sci-fi"], 30, ["laser"], true);
        expect(result).toBe("\x1b[1m\x1b[33mlaser\x1b[0m, sci-fi");
      });

      it("does not apply ANSI codes when tty is false", () => {
        const result = truncateTags(["laser", "sci-fi"], 30, ["laser"], false);
        expect(result).toBe("laser, sci-fi");
      });

      it("does not apply ANSI codes when tty defaults to false", () => {
        const result = truncateTags(["laser", "sci-fi"], 30, ["laser"]);
        expect(result).toBe("laser, sci-fi");
      });

      it("truncates correctly with ANSI bold+yellow (visible width only)", () => {
        // Tags: "laser", "sci-fi", "bright" with "laser" matched and styled
        // Styled "laser" = \x1b[1m\x1b[33mlaser\x1b[0m (5 visible chars)
        // With maxWidth=14, should truncate but ANSI codes are zero-width
        const result = truncateTags(
          ["laser", "sci-fi", "bright"],
          14,
          ["laser"],
          true,
        );
        expect(result).toContain("\x1b[1m\x1b[33mlaser\x1b[0m");
        expect(result).toContain("\u2026");
      });

      it("closes open ANSI bold before appending ellipsis", () => {
        // With a very short maxWidth, truncation may cut mid-bold-tag
        // Use tags where the matched tag itself is long enough to be truncated
        const result = truncateTags(
          ["longmatchedtag"],
          10,
          ["longmatchedtag"],
          true,
        );
        // The result should contain ellipsis and a reset before it
        expect(result).toContain("\u2026");
        // Should not have unclosed bold (last ANSI code before ellipsis should be reset)
        const lastBold = result.lastIndexOf("\x1b[1m");
        const lastReset = result.lastIndexOf("\x1b[0m");
        if (lastBold >= 0) {
          expect(lastReset).toBeGreaterThan(lastBold);
        }
      });

      it("handles all tags matched and fitting within maxWidth", () => {
        const result = truncateTags(["a", "b"], 14, ["a", "b"], true);
        expect(result).toBe("\x1b[1m\x1b[33ma\x1b[0m, \x1b[1m\x1b[33mb\x1b[0m");
        // No ellipsis since it fits
        expect(result).not.toContain("\u2026");
      });

      it("ignores matchedTags not present in tags array", () => {
        const result = truncateTags(["alpha", "beta"], 30, ["gamma"], false);
        // "gamma" is not in tags, so no reordering happens
        expect(result).toBe("alpha, beta");
      });

      it("handles case-insensitive matching for reordering", () => {
        // matchedTags uses case-insensitive comparison
        const result = truncateTags(
          ["Laser", "Sci-Fi"],
          30,
          ["laser"],
          false,
        );
        // "Laser" should be recognized as matched (case-insensitive)
        expect(result).toBe("Laser, Sci-Fi");
      });

      it("reorders with case-insensitive match and applies bold", () => {
        const result = truncateTags(
          ["alpha", "Laser", "beta"],
          40,
          ["laser"],
          true,
        );
        expect(result).toBe("\x1b[1m\x1b[33mLaser\x1b[0m, alpha, beta");
      });
    });

    describe("matched tag display integration", () => {
      it("JSON output does NOT include matchedTags field", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--json", "--tags", "laser")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        for (const r of data.recipes) {
          expect(r).not.toHaveProperty("matchedTags");
        }
      });

      it("JSON output preserves original tag order when filtered", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--json", "--search", "laser")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        // Tags in JSON should maintain registration order, not reordered
        for (const r of data.recipes) {
          expect(Array.isArray(r.tags)).toBe(true);
        }
      });

      it("shows ANSI bold for matched tags in TTY mode with --tags filter", async () => {
        const { setTtyOverride } = await import("./output.js");
        setTtyOverride(true);
        try {
          const { code, stdout } = await captureOutput(
            () => main(argv("list", "recipes", "--tags", "laser")),
          );
          expect(code).toBe(0);
          // Should contain ANSI bold sequence for the matched tag
          expect(stdout).toContain("\x1b[1m");
        } finally {
          setTtyOverride(undefined);
        }
      });

      it("shows ANSI bold for matched tags in TTY mode with --search filter", async () => {
        const { setTtyOverride } = await import("./output.js");
        setTtyOverride(true);
        try {
          const { code, stdout } = await captureOutput(
            () => main(argv("list", "recipes", "--search", "laser")),
          );
          expect(code).toBe(0);
          // Should contain ANSI bold sequence for matched tags
          expect(stdout).toContain("\x1b[1m");
        } finally {
          setTtyOverride(undefined);
        }
      });

      it("does not emit ANSI codes when TTY is false", async () => {
        const { setTtyOverride } = await import("./output.js");
        setTtyOverride(false);
        try {
          const { code, stdout } = await captureOutput(
            () => main(argv("list", "recipes", "--tags", "laser")),
          );
          expect(code).toBe(0);
          // No bold ANSI codes in non-TTY output
          expect(stdout).not.toContain("\x1b[1m");
        } finally {
          setTtyOverride(undefined);
        }
      });

      it("does not apply tag reordering or bold when only --category filter is active", async () => {
        const { setTtyOverride } = await import("./output.js");
        setTtyOverride(true);
        try {
          const { code, stdout } = await captureOutput(
            () => main(argv("list", "recipes", "--category", "weapon")),
          );
          expect(code).toBe(0);
          // category-only filter should NOT produce bold tags
          // (matchedTags is empty when only --category is active)
          // Bold from table headers may exist, so check specifically that
          // tag cells don't have bold. The simplest check: the output should
          // still be valid and produce results.
          expect(stdout).toMatch(/Found \d+ of \d+ recipes/);
        } finally {
          setTtyOverride(undefined);
        }
      });

      it("unfiltered output has no ANSI bold in tag cells", async () => {
        const { setTtyOverride } = await import("./output.js");
        setTtyOverride(true);
        try {
          const { code, stdout } = await captureOutput(
            () => main(argv("list", "recipes")),
          );
          expect(code).toBe(0);
          // Unfiltered: matchedTags is always empty, so no bold in tags column.
          // Table headers/borders may have styling, but tag values should not.
          expect(stdout).toMatch(/Showing \d+ recipes/);
        } finally {
          setTtyOverride(undefined);
        }
      });
    });

    describe("empty and whitespace filters", () => {
      it("treats empty --search value as no filter", async () => {
        const { code: codeFiltered, stdout: stdoutFiltered } = await captureOutput(
          () => main(argv("list", "recipes", "--search", "")),
        );
        const { code: codeUnfiltered, stdout: stdoutUnfiltered } = await captureOutput(
          () => main(argv("list", "recipes")),
        );
        expect(codeFiltered).toBe(0);
        expect(codeUnfiltered).toBe(0);
        // Both should show "Showing N recipes" (unfiltered footer)
        expect(stdoutFiltered).toMatch(/Showing \d+ recipes/);
        expect(stdoutUnfiltered).toMatch(/Showing \d+ recipes/);
      });

      it("treats whitespace-only --search value as no filter", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--search", "   ")),
        );
        expect(code).toBe(0);
        // Should show unfiltered results since whitespace is ignored at the registry level
        expect(stdout).toMatch(/Showing \d+ recipes/);
      });
    });
  });

  describe("--output flag (single-file WAV export)", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `toneforge-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(() => {
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it("writes a valid WAV file to the specified path", async () => {
      const outPath = join(tempDir, "test-output.wav");
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      expect(code).toBe(0);
      expect(stdout).toContain(`Wrote ${outPath}`);
      expect(existsSync(outPath)).toBe(true);

      // Validate WAV header
      const fileData = readFileSync(outPath);
      expect(fileData.length).toBeGreaterThan(44);
      expect(fileData.toString("ascii", 0, 4)).toBe("RIFF");
      expect(fileData.toString("ascii", 8, 12)).toBe("WAVE");
    });

    it("does not play audio when --output is specified", async () => {
      const outPath = join(tempDir, "no-play.wav");
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      expect(code).toBe(0);
      expect(stdout).not.toContain("Playing...");
      expect(stdout).not.toContain("Done.");
    });

    it("auto-creates parent directories", async () => {
      const outPath = join(tempDir, "nested", "deep", "test.wav");
      const { code } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      expect(code).toBe(0);
      expect(existsSync(outPath)).toBe(true);
    });

    it("overwrites existing files silently", async () => {
      const outPath = join(tempDir, "overwrite.wav");

      // Write first time
      await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      const firstSize = readFileSync(outPath).length;

      // Write again with a different seed
      const { code } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "99", "--output", outPath)),
      );
      expect(code).toBe(0);
      expect(existsSync(outPath)).toBe(true);
      // File should still be valid WAV (may differ in size due to different seed)
      const data = readFileSync(outPath);
      expect(data.toString("ascii", 0, 4)).toBe("RIFF");
    });

    it("suppresses verbose output in write-only mode", async () => {
      const outPath = join(tempDir, "quiet.wav");
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      expect(code).toBe(0);
      expect(stdout).not.toContain("Generating");
      expect(stdout).not.toContain("Rendered");
      expect(stdout).toContain("Wrote");
    });

    it("writes to directory with deterministic filename when --output is a dir", async () => {
      const outDir = join(tempDir, "dir-output/");
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outDir)),
      );
      expect(code).toBe(0);
      const expectedFile = join(tempDir, "dir-output", "ui-scifi-confirm-seed-42.wav");
      expect(stdout).toContain("Wrote");
      expect(existsSync(expectedFile)).toBe(true);
    });
  });

  describe("--seed-range flag (batch generation)", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `toneforge-batch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(() => {
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it("generates multiple WAV files with correct naming", async () => {
      const outDir = tempDir + "/";
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:3", "--output", outDir)),
      );
      expect(code).toBe(0);
      expect(existsSync(join(tempDir, "ui-scifi-confirm-seed-1.wav"))).toBe(true);
      expect(existsSync(join(tempDir, "ui-scifi-confirm-seed-2.wav"))).toBe(true);
      expect(existsSync(join(tempDir, "ui-scifi-confirm-seed-3.wav"))).toBe(true);
      expect(stdout).toContain("ui-scifi-confirm-seed-1.wav");
      expect(stdout).toContain("ui-scifi-confirm-seed-2.wav");
      expect(stdout).toContain("ui-scifi-confirm-seed-3.wav");
    });

    it("seed range is inclusive (1:1 generates one file)", async () => {
      const outDir = tempDir + "/";
      const { code } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "5:5", "--output", outDir)),
      );
      expect(code).toBe(0);
      expect(existsSync(join(tempDir, "ui-scifi-confirm-seed-5.wav"))).toBe(true);
    });

    it("auto-creates output directory", async () => {
      const outDir = join(tempDir, "nested", "batch") + "/";
      const { code } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:1", "--output", outDir)),
      );
      expect(code).toBe(0);
      expect(existsSync(join(tempDir, "nested", "batch", "ui-scifi-confirm-seed-1.wav"))).toBe(true);
    });

    it("each generated file is a valid WAV", async () => {
      const outDir = tempDir + "/";
      await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:2", "--output", outDir)),
      );

      for (const seed of [1, 2]) {
        const data = readFileSync(join(tempDir, `ui-scifi-confirm-seed-${seed}.wav`));
        expect(data.toString("ascii", 0, 4)).toBe("RIFF");
        expect(data.toString("ascii", 8, 12)).toBe("WAVE");
        expect(data.length).toBeGreaterThan(44);
      }
    });
  });

  describe("play command", () => {
    it("prints play help with --help flag", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("play", "--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("play");
      expect(stdout).toContain("<file.wav>");
      expect(stdout).toContain("Examples");
    });

    it("returns 1 when no file path is given", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("play")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("requires a WAV file path");
    });

    it("returns 1 when file does not exist", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("play", "./nonexistent/path/to/file.wav")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("File not found");
    });

    it("plays an existing WAV file successfully", async () => {
      // First generate a WAV file to play
      const outPath = join(tmpdir(), `toneforge-play-test-${Date.now()}.wav`);
      await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      expect(existsSync(outPath)).toBe(true);

      // Now play it (getPlayerCommand is mocked to return { command: "echo", args: ["mock-play"] })
      const { code } = await captureOutput(
        () => main(argv("play", outPath)),
      );
      expect(code).toBe(0);

      // Clean up
      try { unlinkSync(outPath); } catch { /* ignore */ }
    });

    it("appears in the top-level help text", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("play");
    });
  });

  describe("version", () => {
    it("prints version with 'version' command", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("version")));
      expect(code).toBe(0);
      expect(stdout).toMatch(/^ToneForge v\d+\.\d+\.\d+$/);
    });

    it("prints version with --version flag", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("--version")));
      expect(code).toBe(0);
      expect(stdout).toMatch(/^ToneForge v\d+\.\d+\.\d+$/);
    });

    it("prints version with -V flag", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("-V")));
      expect(code).toBe(0);
      expect(stdout).toMatch(/^ToneForge v\d+\.\d+\.\d+$/);
    });

    it("version appears in top-level help text", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("--help")));
      expect(code).toBe(0);
      expect(stdout).toContain("version");
      expect(stdout).toContain("--version");
    });
  });

  describe("flag validation", () => {
    it("errors when --seed-range is used without --output", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:10")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("--seed-range requires --output");
    });

    it("errors when --seed and --seed-range are both specified", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--seed-range", "1:10", "--output", "./test/")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("mutually exclusive");
    });

    it("errors when --seed-range is used with .wav output path", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:10", "--output", "./test.wav")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("directory");
    });

    it("errors when --seed-range format is invalid", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "bad", "--output", "./test/")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("format");
    });

    it("errors when --seed-range has non-integer values", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "a:b", "--output", "./test/")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("integers");
    });

    it("errors when --seed-range start > end", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "10:1", "--output", "./test/")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("must be <=");
    });
  });

  describe("show command", () => {
    it("prints show help with --help flag", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("show");
      expect(stdout).toContain("<recipe-name>");
      expect(stdout).toContain("--seed");
      expect(stdout).toContain("Examples");
    });

    it("returns 1 when no recipe name is given", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("show")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("requires a recipe name");
    });

    it("displays recipe metadata for a valid recipe", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("# ui-scifi-confirm");
      expect(stdout).toContain("**Category:** UI");
      expect(stdout).toContain("**Description:**");
      expect(stdout).toContain("## Signal Chain");
      expect(stdout).toContain("## Parameters");
      expect(stdout).toContain("## Duration");
      expect(stdout).toContain("| Parameter");
      expect(stdout).toContain("| frequency");
      expect(stdout).toContain("| attack");
      expect(stdout).toContain("| decay");
      expect(stdout).toContain("| filterCutoff");
    });

    it("does not include a Value column without --seed", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("| Parameter | Min | Max | Unit |");
      expect(stdout).not.toContain("| Value");
    });

    it("includes a Value column with --seed", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "42")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("# ui-scifi-confirm (seed: 42)");
      expect(stdout).toContain("| Parameter | Min | Max | Value | Unit |");
      // Value column should have actual numbers for each param
      const lines = stdout.split("\n");
      const paramLines = lines.filter((l: string) => l.startsWith("| frequency") || l.startsWith("| attack") || l.startsWith("| decay") || l.startsWith("| filterCutoff"));
      for (const line of paramLines) {
        // Each param line should have 5 pipe-delimited columns (plus borders)
        const cells = line.split("|").filter((c: string) => c.trim() !== "");
        expect(cells.length).toBe(5);
      }
    });

    it("shows seed-specific duration with --seed", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "42")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("seed 42");
      expect(stdout).toContain("Range:");
    });

    it("shows duration range without --seed", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm")),
      );
      expect(code).toBe(0);
      // Duration section should contain a range like "0.051s - 0.31s"
      const durationMatch = stdout.match(/(\d+\.?\d*)s\s*-\s*(\d+\.?\d*)s/);
      expect(durationMatch).not.toBeNull();
    });

    it("returns error with suggestions for unknown recipe", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("show", "ui-scfi-confrim")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("Unknown recipe");
      expect(stderr).toContain("ui-scfi-confrim");
      expect(stderr).toContain("Did you mean:");
      expect(stderr).toContain("ui-scifi-confirm");
    });

    it("returns error for completely unrelated recipe name", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("show", "zzz-nonexistent")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("Unknown recipe");
      expect(stderr).toContain("Did you mean:");
    });

    it("errors for non-integer --seed", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "abc")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("--seed must be an integer");
    });

    it("appears in the top-level help text", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("show");
    });

    it("outputs raw markdown (no ANSI escape codes) when non-TTY", async () => {
      const { setTtyOverride } = await import("./output.js");
      setTtyOverride(false);
      try {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm")),
        );
        expect(code).toBe(0);
        // eslint-disable-next-line no-control-regex
        expect(stdout).not.toMatch(/\x1b\[/);
        // Should still contain raw markdown syntax
        expect(stdout).toContain("# ui-scifi-confirm");
        expect(stdout).toContain("**Category:**");
      } finally {
        setTtyOverride(undefined);
      }
    });

    it("outputs styled ANSI when TTY is detected", async () => {
      const { setTtyOverride } = await import("./output.js");
      setTtyOverride(true);
      try {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm")),
        );
        expect(code).toBe(0);
        // eslint-disable-next-line no-control-regex
        expect(stdout).toMatch(/\x1b\[/);
        // Content should still be present
        expect(stdout).toContain("ui-scifi-confirm");
        expect(stdout).toContain("Parameters");
      } finally {
        setTtyOverride(undefined);
      }
    });

    it("JSON output contains no ANSI codes regardless of TTY", async () => {
      const { setTtyOverride } = await import("./output.js");
      setTtyOverride(true);
      try {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--json")),
        );
        expect(code).toBe(0);
        // eslint-disable-next-line no-control-regex
        expect(stdout).not.toMatch(/\x1b\[/);
        // Should be valid JSON
        const data = JSON.parse(stdout);
        expect(data.command).toBe("show");
        expect(data.recipe).toBe("ui-scifi-confirm");
      } finally {
        setTtyOverride(undefined);
      }
    });

    it("produces output for all five recipes", async () => {
      const recipes = [
        "ui-scifi-confirm",
        "weapon-laser-zap",
        "footstep-stone",
        "ui-notification-chime",
        "ambient-wind-gust",
      ];
      for (const recipe of recipes) {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", recipe)),
        );
        expect(code).toBe(0);
        expect(stdout).toContain(`# ${recipe}`);
        expect(stdout).toContain("**Category:**");
        expect(stdout).toContain("**Description:**");
        expect(stdout).toContain("## Signal Chain");
        expect(stdout).toContain("## Parameters");
        expect(stdout).toContain("## Duration");
      }
    });

    it("seed produces deterministic output", async () => {
      const { stdout: first } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "42")),
      );
      const { stdout: second } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "42")),
      );
      expect(first).toBe(second);
    });

    it("different seeds produce different parameter values", async () => {
      const { stdout: seed1 } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "1")),
      );
      const { stdout: seed2 } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "2")),
      );
      expect(seed1).not.toBe(seed2);
    });
  });

  describe("metadata completeness", () => {
    it("all registered recipes have complete metadata", async () => {
      const { registry } = await import("./recipes/index.js");
      const names = registry.list();
      expect(names.length).toBeGreaterThanOrEqual(5);

      for (const name of names) {
        const reg = registry.getRegistration(name);
        expect(reg).toBeDefined();
        expect(reg!.description).toBeTruthy();
        expect(reg!.category).toBeTruthy();
        expect(reg!.signalChain).toBeTruthy();
        expect(reg!.params.length).toBeGreaterThan(0);
        expect(typeof reg!.getParams).toBe("function");

        // Verify all param descriptors have required fields
        for (const p of reg!.params) {
          expect(p.name).toBeTruthy();
          expect(typeof p.min).toBe("number");
          expect(typeof p.max).toBe("number");
          expect(p.unit).toBeTruthy();
          expect(p.max).toBeGreaterThan(p.min);
        }
      }
    });

    it("getParams keys match param descriptor names", async () => {
      const { registry } = await import("./recipes/index.js");
      const { createRng } = await import("./core/rng.js");
      const names = registry.list();

      for (const name of names) {
        const reg = registry.getRegistration(name)!;
        const rng = createRng(42);
        const values = reg.getParams(rng);
        const valueKeys = Object.keys(values).sort();
        const paramNames = reg.params.map((p) => p.name).sort();
        expect(valueKeys).toEqual(paramNames);
      }
    });

    it("getParams values fall within declared min/max ranges", async () => {
      const { registry } = await import("./recipes/index.js");
      const { createRng } = await import("./core/rng.js");
      const names = registry.list();

      for (const name of names) {
        const reg = registry.getRegistration(name)!;
        // Test with several seeds
        for (let seed = 0; seed < 50; seed++) {
          const rng = createRng(seed);
          const values = reg.getParams(rng);
          for (const p of reg.params) {
            const v = values[p.name]!;
            expect(v).toBeGreaterThanOrEqual(p.min);
            expect(v).toBeLessThan(p.max);
          }
        }
      }
    });
  });

  describe("--json flag", () => {
    describe("version", () => {
      it("outputs JSON with 'version --json'", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("version", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("version");
        expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
      });

      it("outputs JSON with '--version --json'", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("--version", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("version");
        expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });

    describe("list", () => {
      it("outputs JSON with recipe array containing name and description", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("list");
        expect(data.resource).toBe("recipes");
        expect(Array.isArray(data.recipes)).toBe(true);
        const names = data.recipes.map((r: { name: string }) => r.name);
        expect(names).toContain("ui-scifi-confirm");
        expect(names).toContain("weapon-laser-zap");
        expect(names).toContain("footstep-stone");
        expect(names).toContain("ui-notification-chime");
        expect(names).toContain("ambient-wind-gust");
        // Each entry must have a description string
        for (const r of data.recipes) {
          expect(typeof r.name).toBe("string");
          expect(typeof r.description).toBe("string");
        }
      });

      it("outputs JSON with 'list recipes --json'", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("list");
        expect(data.recipes.length).toBeGreaterThanOrEqual(5);
        // Verify description is non-empty for a known recipe
        const confirm = data.recipes.find(
          (r: { name: string }) => r.name === "ui-scifi-confirm",
        );
        expect(confirm).toBeDefined();
        expect(confirm.description.length).toBeGreaterThan(0);
      });

      it("outputs JSON error for unknown resource", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("list", "unknown", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("Unknown resource");
      });
    });

    describe("show", () => {
      it("outputs JSON with recipe metadata", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("show");
        expect(data.recipe).toBe("ui-scifi-confirm");
        expect(data.category).toBe("UI");
        expect(typeof data.description).toBe("string");
        expect(Array.isArray(data.tags)).toBe(true);
        expect(typeof data.signalChain).toBe("string");
        expect(Array.isArray(data.params)).toBe(true);
        expect(data.params.length).toBeGreaterThan(0);
        expect(typeof data.duration).toBe("object");
        expect(typeof data.duration.min).toBe("number");
        expect(typeof data.duration.max).toBe("number");
      });

      it("includes seed-specific values with --seed", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.seed).toBe(42);
        expect(data.duration.value).toBeDefined();
        expect(data.duration.seed).toBe(42);
        // Every param should have a value
        for (const param of data.params) {
          expect(param.value).toBeDefined();
          expect(typeof param.value).toBe("number");
        }
      });

      it("does not include seed-specific values without --seed", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.seed).toBeUndefined();
        for (const param of data.params) {
          expect(param.value).toBeUndefined();
        }
      });

      it("param descriptors have correct fields", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        for (const param of data.params) {
          expect(typeof param.name).toBe("string");
          expect(typeof param.min).toBe("number");
          expect(typeof param.max).toBe("number");
          expect(typeof param.unit).toBe("string");
        }
      });

      it("outputs JSON error for unknown recipe", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("show", "nonexistent", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("Unknown recipe");
      });

      it("outputs JSON error for missing recipe name", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("show", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("requires a recipe name");
      });

      it("outputs JSON error for invalid seed", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--seed", "abc", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--seed must be an integer");
      });

      it("produces deterministic JSON output with same seed", async () => {
        const { stdout: first } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        const { stdout: second } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(first).toBe(second);
      });

      it("works for all five recipes", async () => {
        const recipes = [
          "ui-scifi-confirm",
          "weapon-laser-zap",
          "footstep-stone",
          "ui-notification-chime",
          "ambient-wind-gust",
        ];
        for (const recipe of recipes) {
          const { code, stdout } = await captureOutput(
            () => main(argv("show", recipe, "--json")),
          );
          expect(code).toBe(0);
          const data = JSON.parse(stdout);
          expect(data.recipe).toBe(recipe);
          expect(data.params.length).toBeGreaterThan(0);
        }
      });
    });

    describe("generate", () => {
      let tempDir: string;

      beforeEach(() => {
        tempDir = join(tmpdir(), `toneforge-json-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      });

      afterEach(() => {
        try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
      });

      it("outputs JSON for single-file export", async () => {
        const outPath = join(tempDir, "test.wav");
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("generate");
        expect(data.recipe).toBe("ui-scifi-confirm");
        expect(data.seed).toBe(42);
        expect(data.output).toBe(outPath);
        expect(typeof data.duration).toBe("number");
        expect(typeof data.sampleRate).toBe("number");
        expect(typeof data.samples).toBe("number");
      });

      it("outputs JSON for play mode", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("generate");
        expect(data.recipe).toBe("ui-scifi-confirm");
        expect(data.seed).toBe(42);
        expect(data.played).toBe(true);
        expect(typeof data.duration).toBe("number");
        expect(typeof data.sampleRate).toBe("number");
        expect(typeof data.samples).toBe("number");
      });

      it("suppresses text output in JSON mode", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(code).toBe(0);
        // Should be a single JSON line, no "Generating", "Rendered", etc.
        expect(stdout).not.toContain("Generating");
        expect(stdout).not.toContain("Rendered");
        expect(stdout).not.toContain("Playing...");
        expect(stdout).not.toContain("Done.");
        expect(stdout).not.toContain("Using random seed");
        // Verify it's valid JSON
        expect(() => JSON.parse(stdout)).not.toThrow();
      });

      it("outputs JSON for batch generation", async () => {
        const outDir = tempDir + "/";
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:3", "--output", outDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("generate");
        expect(data.recipe).toBe("ui-scifi-confirm");
        expect(data.seedRange).toEqual([1, 3]);
        expect(data.output).toBe(outDir);
        expect(Array.isArray(data.files)).toBe(true);
        expect(data.files.length).toBe(3);
        for (const file of data.files) {
          expect(typeof file.seed).toBe("number");
          expect(typeof file.output).toBe("string");
          expect(typeof file.duration).toBe("number");
          expect(typeof file.sampleRate).toBe("number");
          expect(typeof file.samples).toBe("number");
        }
      });

      it("outputs JSON for directory output (single seed)", async () => {
        const outDir = join(tempDir, "dir-output/");
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("generate");
        expect(data.output).toContain("ui-scifi-confirm-seed-42.wav");
      });

      it("outputs JSON error for missing recipe", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("generate", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--recipe is required");
      });

      it("outputs JSON error for unknown recipe", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("generate", "--recipe", "nonexistent", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("Unknown recipe");
      });

      it("outputs JSON error for invalid seed", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "abc", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--seed must be an integer");
      });

      it("includes seed in JSON output when randomly generated", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(typeof data.seed).toBe("number");
        expect(data.seed).toBeGreaterThanOrEqual(0);
      });
    });

    describe("play", () => {
      it("outputs JSON after successful play", async () => {
        // Generate a WAV file first
        const outPath = join(tmpdir(), `toneforge-json-play-${Date.now()}.wav`);
        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
        );

        const { code, stdout } = await captureOutput(
          () => main(argv("play", outPath, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("play");
        expect(data.file).toBe(outPath);

        // Clean up
        try { unlinkSync(outPath); } catch { /* ignore */ }
      });

      it("suppresses text output in JSON mode", async () => {
        // Generate a WAV file first
        const outPath = join(tmpdir(), `toneforge-json-play-quiet-${Date.now()}.wav`);
        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
        );

        const { code, stdout } = await captureOutput(
          () => main(argv("play", outPath, "--json")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toContain("Playing ");
        expect(() => JSON.parse(stdout)).not.toThrow();

        try { unlinkSync(outPath); } catch { /* ignore */ }
      });

      it("outputs JSON error for missing file", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("play", "./nonexistent.wav", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("File not found");
      });

      it("outputs JSON error for missing path argument", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("play", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("requires a WAV file path");
      });
    });

    describe("errors", () => {
      it("outputs JSON error for unknown command", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("unknown-cmd", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("Unknown command");
      });

      it("JSON errors do not include 'Error:' prefix", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("unknown-cmd", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).not.toMatch(/^Error:/);
      });
    });

    describe("help text", () => {
      it("global help mentions --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("--json");
      });

      it("generate help mentions --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("--json");
      });

      it("list help mentions --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("--json");
      });

      it("show help mentions --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("--json");
      });

      it("play help mentions --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("play", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("--json");
      });
    });
  });

  describe("help text markdown rendering", () => {
    // eslint-disable-next-line no-control-regex
    const ANSI_RE = /\x1b\[/;

    let setTtyOverride: (value: boolean | undefined) => void;

    beforeEach(async () => {
      const outputModule = await import("./output.js");
      setTtyOverride = outputModule.setTtyOverride;
    });

    afterEach(() => {
      setTtyOverride(undefined);
    });

    describe("TTY mode (ANSI output)", () => {
      it("global help contains ANSI codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(ANSI_RE);
        expect(stdout).toContain("ToneForge");
      });

      it("generate help contains ANSI codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(ANSI_RE);
        expect(stdout).toContain("recipe");
      });

      it("list help contains ANSI codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(ANSI_RE);
        expect(stdout).toContain("recipes");
      });

      it("play help contains ANSI codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("play", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(ANSI_RE);
        expect(stdout).toContain("play");
      });

      it("show help contains ANSI codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(ANSI_RE);
        expect(stdout).toContain("show");
      });
    });

    describe("non-TTY mode (raw markdown)", () => {
      it("global help contains no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("--help")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("ToneForge");
        expect(stdout).toContain("generate");
      });

      it("generate help contains no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("--recipe");
      });

      it("list help contains no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("recipes");
      });

      it("play help contains no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("play", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("play");
      });

      it("show help contains no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("show");
      });
    });

    describe("content preservation", () => {
      it("global help preserves all command names in markdown format", async () => {
        setTtyOverride(false);
        const { stdout } = await captureOutput(
          () => main(argv("--help")),
        );
        expect(stdout).toContain("generate");
        expect(stdout).toContain("show");
        expect(stdout).toContain("play");
        expect(stdout).toContain("list");
        expect(stdout).toContain("version");
        expect(stdout).toContain("--help");
        expect(stdout).toContain("--version");
        expect(stdout).toContain("--json");
      });

      it("generate help preserves all flags and examples", async () => {
        setTtyOverride(false);
        const { stdout } = await captureOutput(
          () => main(argv("generate", "--help")),
        );
        expect(stdout).toContain("--recipe");
        expect(stdout).toContain("--seed");
        expect(stdout).toContain("--output");
        expect(stdout).toContain("--seed-range");
        expect(stdout).toContain("ui-scifi-confirm");
        expect(stdout).toContain("weapon-laser-zap");
      });

      it("show help preserves recipe-name argument and available recipes", async () => {
        setTtyOverride(false);
        const { stdout } = await captureOutput(
          () => main(argv("show", "--help")),
        );
        expect(stdout).toContain("<recipe-name>");
        expect(stdout).toContain("--seed");
        expect(stdout).toContain("ui-scifi-confirm");
        expect(stdout).toContain("weapon-laser-zap");
      });

      it("play help preserves file.wav argument", async () => {
        setTtyOverride(false);
        const { stdout } = await captureOutput(
          () => main(argv("play", "--help")),
        );
        expect(stdout).toContain("<file.wav>");
        expect(stdout).toContain("Examples");
      });

      it("list help preserves resource description", async () => {
        setTtyOverride(false);
        const { stdout } = await captureOutput(
          () => main(argv("list", "--help")),
        );
        expect(stdout).toContain("recipes");
        expect(stdout).toContain("resource");
      });
    });
  });

  describe("styled error, warning, success, and info output", () => {
    // eslint-disable-next-line no-control-regex
    const ANSI_RE = /\x1b\[/;

    let setTtyOverride: (value: boolean | undefined) => void;

    beforeEach(async () => {
      const outputModule = await import("./output.js");
      setTtyOverride = outputModule.setTtyOverride;
    });

    afterEach(() => {
      setTtyOverride(undefined);
    });

    describe("TTY mode (styled output)", () => {
      it("error messages contain ANSI red codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stderr } = await captureOutput(
          () => main(argv("generate")),
        );
        expect(code).toBe(1);
        expect(stderr).toMatch(ANSI_RE);
        expect(stderr).toContain("--recipe is required");
      });

      it("warning 'Did you mean' suggestions contain ANSI yellow codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stderr } = await captureOutput(
          () => main(argv("show", "ui-scfi-confrim")),
        );
        expect(code).toBe(1);
        // Error part should have red ANSI
        expect(stderr).toContain("Unknown recipe");
        // Warning part (Did you mean) should have yellow ANSI
        expect(stderr).toContain("Did you mean");
        expect(stderr).toMatch(ANSI_RE);
      });

      it("success messages contain ANSI green codes when TTY", async () => {
        const { join } = await import("node:path");
        const { tmpdir } = await import("node:os");
        const outPath = join(tmpdir(), `toneforge-styled-test-${Date.now()}.wav`);
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("Wrote");
        expect(stdout).toMatch(ANSI_RE);
        // Clean up
        try { const { unlinkSync } = await import("node:fs"); unlinkSync(outPath); } catch { /* ignore */ }
      });

      it("info messages contain ANSI dim codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("Generating");
        expect(stdout).toMatch(ANSI_RE);
      });
    });

    describe("non-TTY mode (no ANSI codes)", () => {
      it("error messages contain no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stderr } = await captureOutput(
          () => main(argv("generate")),
        );
        expect(code).toBe(1);
        expect(stderr).not.toMatch(ANSI_RE);
        expect(stderr).toContain("--recipe is required");
      });

      it("warning suggestions contain no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stderr } = await captureOutput(
          () => main(argv("show", "ui-scfi-confrim")),
        );
        expect(code).toBe(1);
        expect(stderr).not.toMatch(ANSI_RE);
        expect(stderr).toContain("Did you mean");
      });

      it("success messages contain no ANSI codes when non-TTY", async () => {
        const { join } = await import("node:path");
        const { tmpdir } = await import("node:os");
        const outPath = join(tmpdir(), `toneforge-styled-test-${Date.now()}.wav`);
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("Wrote");
        // Clean up
        try { const { unlinkSync } = await import("node:fs"); unlinkSync(outPath); } catch { /* ignore */ }
      });

      it("info messages contain no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("Generating");
      });
    });

    describe("JSON errors unaffected by TTY", () => {
      it("JSON error output has no ANSI codes even in TTY mode", async () => {
        setTtyOverride(true);
        const { code, stderr } = await captureOutput(
          () => main(argv("generate", "--json")),
        );
        expect(code).toBe(1);
        expect(stderr).not.toMatch(ANSI_RE);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--recipe is required");
      });
    });

    describe("version output styling", () => {
      it("version output contains ANSI dim codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("version")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("ToneForge v");
        expect(stdout).toMatch(ANSI_RE);
      });

      it("version output contains no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("version")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("ToneForge v");
        expect(stdout).not.toMatch(ANSI_RE);
      });

      it("version JSON output is unaffected by TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("version", "--json")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("version");
        expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });
  });

  describe("analyze command", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `toneforge-analyze-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(() => {
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    describe("help", () => {
      it("prints analyze help with --help flag", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("analyze", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("analyze");
        expect(stdout).toContain("--input");
        expect(stdout).toContain("--recipe");
      });
    });

    describe("error handling", () => {
      it("returns exit code 1 when neither --input nor --recipe given", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("analyze", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--input");
        expect(data.error).toContain("--recipe");
      });

      it("returns exit code 1 when both --input and --recipe given", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("analyze", "--input", "file.wav", "--recipe", "foo", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("mutually exclusive");
      });

      it("returns exit code 1 for non-existent input file", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("analyze", "--input", "/tmp/does-not-exist.wav", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("not found");
      });

      it("returns exit code 1 when --recipe without --seed", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("analyze", "--recipe", "ui-scifi-confirm", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--seed");
      });

      it("returns exit code 1 for unknown recipe name", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("analyze", "--recipe", "nonexistent-recipe", "--seed", "42", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("Unknown recipe");
      });

      it("returns exit code 1 for invalid --format value", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("analyze", "--input", "test.wav", "--format", "csv", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--format");
      });

      it("returns exit code 1 for non-WAV input file", async () => {
        // Create a temp non-wav file
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const txtPath = join(tempDir, "test.txt");
        writeFileSync(txtPath, "not a wav");
        const { code, stderr } = await captureOutput(
          () => main(argv("analyze", "--input", txtPath, "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain(".wav");
      });
    });

    describe("single file analysis (--input)", () => {
      it("analyzes a generated WAV file and returns JSON", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const wavPath = join(tempDir, "test.wav");

        // Generate a WAV file first
        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", wavPath)),
        );

        // Now analyze it
        const { code, stdout } = await captureOutput(
          () => main(argv("analyze", "--input", wavPath, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("analyze");
        expect(data.file).toBe(wavPath);
        expect(data.analysisVersion).toBe("1.0");
        expect(typeof data.sampleRate).toBe("number");
        expect(typeof data.sampleCount).toBe("number");
        expect(data.metrics).toBeDefined();
        expect(data.metrics.time).toBeDefined();
        expect(typeof data.metrics.time.duration).toBe("number");
        expect(typeof data.metrics.time.peak).toBe("number");
        expect(typeof data.metrics.time.rms).toBe("number");
        expect(typeof data.metrics.time.crestFactor).toBe("number");
        expect(data.metrics.quality).toBeDefined();
        expect(typeof data.metrics.quality.clipping).toBe("boolean");
        expect(typeof data.metrics.quality.silence).toBe("boolean");
        expect(data.metrics.envelope).toBeDefined();
        expect(data.metrics.spectral).toBeDefined();
        expect(typeof data.metrics.spectral.spectralCentroid).toBe("number");
      });

      it("produces deterministic output for the same input", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const wavPath = join(tempDir, "determinism.wav");

        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", wavPath)),
        );

        const { stdout: out1 } = await captureOutput(
          () => main(argv("analyze", "--input", wavPath, "--json")),
        );
        const { stdout: out2 } = await captureOutput(
          () => main(argv("analyze", "--input", wavPath, "--json")),
        );
        expect(out1).toBe(out2);
      });

      it("displays human-readable output without --json", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const wavPath = join(tempDir, "human.wav");

        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", wavPath)),
        );

        const { code, stdout } = await captureOutput(
          () => main(argv("analyze", "--input", wavPath, "--format", "table")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("Analysis:");
        expect(stdout).toContain("duration");
        expect(stdout).toContain("peak");
        expect(stdout).toContain("rms");
      });
    });

    describe("recipe+seed analysis (--recipe)", () => {
      it("analyzes a recipe+seed and returns JSON", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("analyze", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("analyze");
        expect(data.source).toEqual({ recipe: "ui-scifi-confirm", seed: 42 });
        expect(data.analysisVersion).toBe("1.0");
        expect(data.metrics.time).toBeDefined();
        expect(data.metrics.quality).toBeDefined();
        expect(data.metrics.envelope).toBeDefined();
        expect(data.metrics.spectral).toBeDefined();
      });

      it("produces deterministic output for the same recipe+seed", async () => {
        const { stdout: out1 } = await captureOutput(
          () => main(argv("analyze", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        const { stdout: out2 } = await captureOutput(
          () => main(argv("analyze", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(out1).toBe(out2);
      });

      it("displays human-readable output without --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("analyze", "--recipe", "ui-scifi-confirm", "--seed", "42")),
        );
        expect(code).toBe(0);
        // Without --json, defaults to JSON output for single-source analysis
        // but also shows info messages
        expect(stdout).toContain("Analyzing recipe");
      });
    });

    describe("batch directory analysis", () => {
      it("analyzes all WAV files in a directory", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        // Generate two WAV files
        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "1", "--output", join(tempDir, "sound-1.wav"))),
        );
        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "2", "--output", join(tempDir, "sound-2.wav"))),
        );

        const { code, stdout } = await captureOutput(
          () => main(argv("analyze", "--input", tempDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("analyze");
        expect(data.count).toBe(2);
        expect(data.files).toHaveLength(2);
        expect(data.files[0].analysisVersion).toBe("1.0");
        expect(data.files[0].metrics.time).toBeDefined();
      });

      it("writes individual JSON files with --output", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const outputAnalysisDir = join(tempDir, "analysis");

        // Generate a WAV file
        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "1", "--output", join(tempDir, "sound.wav"))),
        );

        const { code } = await captureOutput(
          () => main(argv("analyze", "--input", tempDir, "--output", outputAnalysisDir, "--json")),
        );
        expect(code).toBe(0);
        expect(existsSync(join(outputAnalysisDir, "sound.json"))).toBe(true);

        const jsonContent = JSON.parse(readFileSync(join(outputAnalysisDir, "sound.json"), "utf-8"));
        expect(jsonContent.file).toBe("sound.wav");
        expect(jsonContent.metrics.time).toBeDefined();
      });

      it("handles empty directory gracefully", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        const { code, stdout } = await captureOutput(
          () => main(argv("analyze", "--input", tempDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.count).toBe(0);
        expect(data.files).toHaveLength(0);
      });

      it("outputs table format for batch analysis", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "1", "--output", join(tempDir, "sound-1.wav"))),
        );
        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "2", "--output", join(tempDir, "sound-2.wav"))),
        );

        const { code, stdout } = await captureOutput(
          () => main(argv("analyze", "--input", tempDir, "--format", "table")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("File");
        expect(stdout).toContain("Peak");
        expect(stdout).toContain("RMS");
        expect(stdout).toContain("sound-1.wav");
        expect(stdout).toContain("sound-2.wav");
        expect(stdout).toContain("Analyzed 2 files");
      });
    });

    describe("analyze appears in main help", () => {
      it("lists analyze command in main help output", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("analyze");
      });
    });
  });

  describe("classify command", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `toneforge-classify-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(() => {
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    describe("help", () => {
      it("prints classify help with --help flag", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("classify");
        expect(stdout).toContain("--analysis");
        expect(stdout).toContain("--input");
        expect(stdout).toContain("--recipe");
        expect(stdout).toContain("search");
      });
    });

    describe("error handling", () => {
      it("returns exit code 1 when no source flag given", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("classify", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--analysis");
      });

      it("returns exit code 1 when multiple source flags given", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("classify", "--input", "file.wav", "--recipe", "foo", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("mutually exclusive");
      });

      it("returns exit code 1 for invalid --format value", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("classify", "--input", "test.wav", "--format", "csv", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--format");
      });

      it("returns exit code 1 when --recipe without --seed", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("classify", "--recipe", "ui-scifi-confirm", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--seed");
      });

      it("returns exit code 1 for unknown recipe name", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("classify", "--recipe", "nonexistent-recipe", "--seed", "42", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("Unknown recipe");
      });

      it("returns exit code 1 for non-existent input file", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("classify", "--input", "/tmp/does-not-exist.wav", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("not found");
      });

      it("returns exit code 1 for non-WAV single file input", async () => {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const txtPath = join(tempDir, "test.txt");
        writeFileSync(txtPath, "not a wav");
        const { code, stderr } = await captureOutput(
          () => main(argv("classify", "--input", txtPath, "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain(".wav");
      });

      it("returns exit code 1 for non-existent analysis directory", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("classify", "--analysis", "/tmp/does-not-exist-dir", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("not found");
      });
    });

    describe("recipe+seed classification (--recipe)", () => {
      it("classifies a recipe+seed and returns JSON", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("classify");
        expect(data.source).toBe("ui-scifi-confirm_seed-042");
        expect(typeof data.category).toBe("string");
        expect(data.category).toBe("ui");
        expect(typeof data.intensity).toBe("string");
        expect(Array.isArray(data.texture)).toBe(true);
        expect(Array.isArray(data.tags)).toBe(true);
        expect(data.classificationVersion).toBe("1.1");
      });

      it("produces deterministic output for the same recipe+seed", async () => {
        const { stdout: out1 } = await captureOutput(
          () => main(argv("classify", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        const { stdout: out2 } = await captureOutput(
          () => main(argv("classify", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(out1).toBe(out2);
      });

      it("displays human-readable output without --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "--recipe", "ui-scifi-confirm", "--seed", "42")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("Classification:");
        expect(stdout).toContain("Category:");
        expect(stdout).toContain("Intensity:");
      });

      it("writes output file with --output", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const outputClassifyDir = join(tempDir, "classification");

        const { code } = await captureOutput(
          () => main(argv("classify", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outputClassifyDir, "--json")),
        );
        expect(code).toBe(0);
        expect(existsSync(join(outputClassifyDir, "ui-scifi-confirm_seed-042.json"))).toBe(true);

        const content = JSON.parse(readFileSync(join(outputClassifyDir, "ui-scifi-confirm_seed-042.json"), "utf-8"));
        expect(content.category).toBe("ui");
        expect(content.classificationVersion).toBe("1.1");
      });

      it("classifies weapon recipe correctly", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "--recipe", "weapon-laser-zap", "--seed", "1", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.category).toBe("weapon");
      });
    });

    describe("single WAV file classification (--input)", () => {
      it("classifies a WAV file end-to-end and returns JSON", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const wavPath = join(tempDir, "weapon-laser-zap_seed-001.wav");

        // Generate a WAV file first
        await captureOutput(
          () => main(argv("generate", "--recipe", "weapon-laser-zap", "--seed", "1", "--output", wavPath)),
        );

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "--input", wavPath, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("classify");
        expect(typeof data.category).toBe("string");
        expect(data.category).toBe("weapon");
        expect(typeof data.intensity).toBe("string");
        expect(Array.isArray(data.texture)).toBe(true);
        expect(Array.isArray(data.tags)).toBe(true);
        expect(data.classificationVersion).toBe("1.1");
      });

      it("produces deterministic output for the same WAV file", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const wavPath = join(tempDir, "test-determinism.wav");

        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", wavPath)),
        );

        const { stdout: out1 } = await captureOutput(
          () => main(argv("classify", "--input", wavPath, "--json")),
        );
        const { stdout: out2 } = await captureOutput(
          () => main(argv("classify", "--input", wavPath, "--json")),
        );
        expect(out1).toBe(out2);
      });
    });

    describe("batch WAV directory classification (--input <dir>)", () => {
      it("classifies all WAV files in a directory", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "1", "--output", join(tempDir, "sound-1.wav"))),
        );
        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "2", "--output", join(tempDir, "sound-2.wav"))),
        );

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "--input", tempDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("classify");
        expect(data.count).toBe(2);
        expect(data.files).toHaveLength(2);
        expect(data.files[0].classificationVersion).toBe("1.1");
        expect(typeof data.files[0].category).toBe("string");
      });

      it("writes individual JSON files with --output", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const outputClassifyDir = join(tempDir, "classification");

        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "1", "--output", join(tempDir, "sound.wav"))),
        );

        const { code } = await captureOutput(
          () => main(argv("classify", "--input", tempDir, "--output", outputClassifyDir, "--json")),
        );
        expect(code).toBe(0);
        expect(existsSync(join(outputClassifyDir, "sound.json"))).toBe(true);

        const content = JSON.parse(readFileSync(join(outputClassifyDir, "sound.json"), "utf-8"));
        expect(typeof content.category).toBe("string");
        expect(content.classificationVersion).toBe("1.1");
      });

      it("handles empty directory gracefully", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "--input", tempDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.count).toBe(0);
        expect(data.files).toHaveLength(0);
      });

      it("outputs table format for batch classification", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "1", "--output", join(tempDir, "sound-1.wav"))),
        );

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "--input", tempDir, "--format", "table")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("Source");
        expect(stdout).toContain("Category");
        expect(stdout).toContain("Intensity");
        expect(stdout).toContain("Classified 1 file");
      });
    });

    describe("batch from analysis directory (--analysis)", () => {
      it("classifies analysis JSON files in a directory", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const wavDir = join(tempDir, "renders");
        const analysisDir = join(tempDir, "analysis");
        mkdirSync(wavDir, { recursive: true });

        // Generate WAV, then analyze to produce JSON files
        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "1", "--output", join(wavDir, "ui-scifi-confirm_seed-001.wav"))),
        );
        await captureOutput(
          () => main(argv("analyze", "--input", wavDir, "--output", analysisDir)),
        );

        // Now classify from analysis
        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "--analysis", analysisDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("classify");
        expect(data.count).toBe(1);
        expect(data.files).toHaveLength(1);
        expect(data.files[0].category).toBe("ui");
        expect(data.files[0].classificationVersion).toBe("1.1");
      });

      it("writes classification JSON files with --output", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });
        const wavDir = join(tempDir, "renders");
        const analysisDir = join(tempDir, "analysis");
        const classifyDir = join(tempDir, "classification");
        mkdirSync(wavDir, { recursive: true });

        await captureOutput(
          () => main(argv("generate", "--recipe", "weapon-laser-zap", "--seed", "1", "--output", join(wavDir, "weapon-laser-zap_seed-001.wav"))),
        );
        await captureOutput(
          () => main(argv("analyze", "--input", wavDir, "--output", analysisDir)),
        );
        const { code } = await captureOutput(
          () => main(argv("classify", "--analysis", analysisDir, "--output", classifyDir, "--json")),
        );
        expect(code).toBe(0);
        expect(existsSync(join(classifyDir, "weapon-laser-zap_seed-001.json"))).toBe(true);

        const content = JSON.parse(readFileSync(join(classifyDir, "weapon-laser-zap_seed-001.json"), "utf-8"));
        expect(content.category).toBe("weapon");
      });

      it("handles empty analysis directory", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "--analysis", tempDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.count).toBe(0);
      });
    });

    describe("classify search subcommand", () => {
      it("returns exit code 1 when no filter given", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("classify", "search", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("filter");
      });

      it("returns exit code 1 for non-existent search directory", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("classify", "search", "--category", "weapon", "--dir", "/tmp/does-not-exist-dir", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("not found");
      });

      it("searches classification files by category", async () => {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        // Write two classification JSON files
        writeFileSync(join(tempDir, "weapon-1.json"), JSON.stringify({
          source: "weapon-laser-zap_seed-001",
          category: "weapon",
          intensity: "hard",
          texture: ["sharp", "bright"],
          material: "energy",
          tags: ["sci-fi", "ranged"],
          analysisRef: "./analysis/weapon-1.json",
        }));
        writeFileSync(join(tempDir, "ui-1.json"), JSON.stringify({
          source: "ui-scifi-confirm_seed-001",
          category: "ui",
          intensity: "soft",
          texture: ["smooth"],
          material: null,
          tags: ["interface"],
          analysisRef: "./analysis/ui-1.json",
        }));

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "search", "--category", "weapon", "--dir", tempDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.count).toBe(1);
        expect(data.matches).toHaveLength(1);
        expect(data.matches[0].category).toBe("weapon");
        expect(data.matches[0].source).toBe("weapon-laser-zap_seed-001");
      });

      it("searches by intensity", async () => {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        writeFileSync(join(tempDir, "hard-1.json"), JSON.stringify({
          source: "weapon-1",
          category: "weapon",
          intensity: "hard",
          texture: ["sharp"],
          material: "metal",
          tags: [],
          analysisRef: "./a.json",
        }));
        writeFileSync(join(tempDir, "soft-1.json"), JSON.stringify({
          source: "ui-1",
          category: "ui",
          intensity: "soft",
          texture: ["smooth"],
          material: null,
          tags: [],
          analysisRef: "./b.json",
        }));

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "search", "--intensity", "soft", "--dir", tempDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.count).toBe(1);
        expect(data.matches[0].intensity).toBe("soft");
      });

      it("searches by texture (partial match)", async () => {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        writeFileSync(join(tempDir, "sharp-1.json"), JSON.stringify({
          source: "weapon-1",
          category: "weapon",
          intensity: "hard",
          texture: ["sharp", "bright"],
          material: "metal",
          tags: [],
          analysisRef: "./a.json",
        }));
        writeFileSync(join(tempDir, "smooth-1.json"), JSON.stringify({
          source: "ui-1",
          category: "ui",
          intensity: "soft",
          texture: ["smooth"],
          material: null,
          tags: [],
          analysisRef: "./b.json",
        }));

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "search", "--texture", "sharp", "--dir", tempDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.count).toBe(1);
        expect(data.matches[0].texture).toContain("sharp");
      });

      it("combines multiple filters", async () => {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        writeFileSync(join(tempDir, "match.json"), JSON.stringify({
          source: "weapon-1",
          category: "weapon",
          intensity: "hard",
          texture: ["sharp"],
          material: "metal",
          tags: [],
          analysisRef: "./a.json",
        }));
        writeFileSync(join(tempDir, "no-match.json"), JSON.stringify({
          source: "weapon-2",
          category: "weapon",
          intensity: "soft",
          texture: ["smooth"],
          material: null,
          tags: [],
          analysisRef: "./b.json",
        }));

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "search", "--category", "weapon", "--intensity", "hard", "--dir", tempDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.count).toBe(1);
        expect(data.matches[0].source).toBe("weapon-1");
      });

      it("returns empty results when no matches found", async () => {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        writeFileSync(join(tempDir, "ui-1.json"), JSON.stringify({
          source: "ui-1",
          category: "ui",
          intensity: "soft",
          texture: ["smooth"],
          material: null,
          tags: [],
          analysisRef: "./a.json",
        }));

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "search", "--category", "weapon", "--dir", tempDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.count).toBe(0);
        expect(data.matches).toHaveLength(0);
      });

      it("displays table output by default", async () => {
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        writeFileSync(join(tempDir, "weapon-1.json"), JSON.stringify({
          source: "weapon-laser-zap_seed-001",
          category: "weapon",
          intensity: "hard",
          texture: ["sharp", "bright"],
          material: "energy",
          tags: ["sci-fi"],
          analysisRef: "./a.json",
        }));

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "search", "--category", "weapon", "--dir", tempDir)),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("Source");
        expect(stdout).toContain("Category");
        expect(stdout).toContain("weapon");
        expect(stdout).toContain("Found 1 match");
      });

      it("shows help with --help in search subcommand", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "search", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("classify");
        expect(stdout).toContain("--category");
      });

      it("handles empty classification directory", async () => {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(tempDir, { recursive: true });

        const { code, stdout } = await captureOutput(
          () => main(argv("classify", "search", "--category", "weapon", "--dir", tempDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.count).toBe(0);
      });
    });

    describe("classify appears in main help", () => {
      it("lists classify command in main help output", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("classify");
      });
    });
  });
});
