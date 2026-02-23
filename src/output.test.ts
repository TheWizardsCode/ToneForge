import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  renderMarkdown,
  outputError,
  outputWarning,
  outputSuccess,
  outputInfo,
  outputMarkdown,
  setTtyOverride,
  COLORS,
} from "./output.js";

// ANSI escape sequence pattern
const ANSI_RE = /\x1b\[/;

describe("output", () => {
  // Capture writes to stdout/stderr
  let stdoutChunks: string[];
  let stderrChunks: string[];
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutChunks = [];
    stderrChunks = [];
    stdoutWriteSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        stdoutChunks.push(String(chunk));
        return true;
      });
    stderrWriteSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        stderrChunks.push(String(chunk));
        return true;
      });
  });

  afterEach(() => {
    setTtyOverride(undefined);
    delete process.env["NO_COLOR"];
    stdoutWriteSpy.mockRestore();
    stderrWriteSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // COLORS constant
  // -----------------------------------------------------------------------
  describe("COLORS", () => {
    it("exports a configuration object with named ANSI constants", () => {
      expect(COLORS.reset).toBe("\x1b[0m");
      expect(COLORS.red).toBe("\x1b[31m");
      expect(COLORS.green).toBe("\x1b[32m");
      expect(COLORS.yellow).toBe("\x1b[33m");
      expect(COLORS.dim).toBe("\x1b[2m");
      expect(COLORS.bold).toBe("\x1b[1m");
      expect(COLORS.cyan).toBe("\x1b[36m");
    });
  });

  // -----------------------------------------------------------------------
  // setTtyOverride
  // -----------------------------------------------------------------------
  describe("setTtyOverride", () => {
    it("overrides TTY detection to true", () => {
      setTtyOverride(true);
      const result = renderMarkdown("**bold**");
      expect(result).toMatch(ANSI_RE);
    });

    it("overrides TTY detection to false", () => {
      setTtyOverride(false);
      const result = renderMarkdown("**bold**");
      expect(result).not.toMatch(ANSI_RE);
      expect(result).toBe("**bold**");
    });

    it("restores default behaviour when set to undefined", () => {
      setTtyOverride(true);
      expect(renderMarkdown("**bold**")).toMatch(ANSI_RE);

      setTtyOverride(undefined);
      // In CI / vitest the process is not a TTY, so should produce raw output
      const result = renderMarkdown("**bold**");
      expect(result).toBe("**bold**");
    });
  });

  // -----------------------------------------------------------------------
  // renderMarkdown
  // -----------------------------------------------------------------------
  describe("renderMarkdown", () => {
    it("returns empty string for empty input", () => {
      expect(renderMarkdown("")).toBe("");
    });

    it("returns empty string for whitespace-only input", () => {
      expect(renderMarkdown("   \n  \t  ")).toBe("");
    });

    it("returns raw markdown when TTY is false", () => {
      setTtyOverride(false);
      const md = "# Hello\n\nThis is **bold** and *italic*.";
      expect(renderMarkdown(md)).toBe(md);
    });

    it("renders ANSI output when TTY is true", () => {
      setTtyOverride(true);
      const result = renderMarkdown("# Heading");
      expect(result).toMatch(ANSI_RE);
      expect(result).toContain("Heading");
    });

    it("renders bold text with ANSI when TTY is true", () => {
      setTtyOverride(true);
      const result = renderMarkdown("**bold**");
      expect(result).toMatch(ANSI_RE);
      expect(result).toContain("bold");
    });

    it("renders code blocks when TTY is true", () => {
      setTtyOverride(true);
      const md = "```js\nconst x = 1;\n```";
      const result = renderMarkdown(md);
      expect(result).toContain("x");
    });

    it("renders tables when TTY is true", () => {
      setTtyOverride(true);
      const md = "| A | B |\n|---|---|\n| 1 | 2 |";
      const result = renderMarkdown(md);
      expect(result).toContain("1");
      expect(result).toContain("2");
    });

    it("suppresses ANSI when NO_COLOR is set even if TTY is true", () => {
      setTtyOverride(true);
      process.env["NO_COLOR"] = "1";
      const result = renderMarkdown("# Heading");
      expect(result).not.toMatch(ANSI_RE);
      expect(result).toBe("# Heading");
    });

    it("suppresses ANSI when NO_COLOR is empty string", () => {
      setTtyOverride(true);
      process.env["NO_COLOR"] = "";
      const result = renderMarkdown("**bold**");
      expect(result).not.toMatch(ANSI_RE);
    });
  });

  // -----------------------------------------------------------------------
  // outputError
  // -----------------------------------------------------------------------
  describe("outputError", () => {
    it("writes to stderr", () => {
      setTtyOverride(false);
      outputError("something broke");
      expect(stderrChunks.join("")).toContain("something broke");
      expect(stdoutChunks).toHaveLength(0);
    });

    it("applies red color when TTY", () => {
      setTtyOverride(true);
      outputError("fail");
      const output = stderrChunks.join("");
      expect(output).toContain(COLORS.red);
      expect(output).toContain(COLORS.reset);
      expect(output).toContain("fail");
    });

    it("produces no ANSI when not TTY", () => {
      setTtyOverride(false);
      outputError("fail");
      const output = stderrChunks.join("");
      expect(output).not.toMatch(ANSI_RE);
    });

    it("produces no ANSI when NO_COLOR is set", () => {
      setTtyOverride(true);
      process.env["NO_COLOR"] = "1";
      outputError("fail");
      const output = stderrChunks.join("");
      expect(output).not.toMatch(ANSI_RE);
    });
  });

  // -----------------------------------------------------------------------
  // outputWarning
  // -----------------------------------------------------------------------
  describe("outputWarning", () => {
    it("writes to stderr", () => {
      setTtyOverride(false);
      outputWarning("watch out");
      expect(stderrChunks.join("")).toContain("watch out");
      expect(stdoutChunks).toHaveLength(0);
    });

    it("applies yellow color when TTY", () => {
      setTtyOverride(true);
      outputWarning("caution");
      const output = stderrChunks.join("");
      expect(output).toContain(COLORS.yellow);
      expect(output).toContain(COLORS.reset);
    });

    it("produces no ANSI when not TTY", () => {
      setTtyOverride(false);
      outputWarning("caution");
      expect(stderrChunks.join("")).not.toMatch(ANSI_RE);
    });
  });

  // -----------------------------------------------------------------------
  // outputSuccess
  // -----------------------------------------------------------------------
  describe("outputSuccess", () => {
    it("writes to stdout", () => {
      setTtyOverride(false);
      outputSuccess("done");
      expect(stdoutChunks.join("")).toContain("done");
      expect(stderrChunks).toHaveLength(0);
    });

    it("applies green color when TTY", () => {
      setTtyOverride(true);
      outputSuccess("done");
      const output = stdoutChunks.join("");
      expect(output).toContain(COLORS.green);
      expect(output).toContain(COLORS.reset);
    });

    it("produces no ANSI when not TTY", () => {
      setTtyOverride(false);
      outputSuccess("done");
      expect(stdoutChunks.join("")).not.toMatch(ANSI_RE);
    });
  });

  // -----------------------------------------------------------------------
  // outputInfo
  // -----------------------------------------------------------------------
  describe("outputInfo", () => {
    it("writes to stdout", () => {
      setTtyOverride(false);
      outputInfo("fyi");
      expect(stdoutChunks.join("")).toContain("fyi");
      expect(stderrChunks).toHaveLength(0);
    });

    it("applies dim style when TTY", () => {
      setTtyOverride(true);
      outputInfo("note");
      const output = stdoutChunks.join("");
      expect(output).toContain(COLORS.dim);
      expect(output).toContain(COLORS.reset);
    });

    it("produces no ANSI when not TTY", () => {
      setTtyOverride(false);
      outputInfo("note");
      expect(stdoutChunks.join("")).not.toMatch(ANSI_RE);
    });
  });

  describe("outputMarkdown", () => {
    it("writes to stdout", () => {
      setTtyOverride(false);
      outputMarkdown("hello world");
      expect(stdoutChunks.join("")).toContain("hello world");
      expect(stderrChunks).toHaveLength(0);
    });

    it("renders markdown with ANSI when TTY", () => {
      setTtyOverride(true);
      outputMarkdown("# Heading");
      const output = stdoutChunks.join("");
      expect(output).toMatch(ANSI_RE);
    });

    it("returns raw markdown when not TTY", () => {
      setTtyOverride(false);
      outputMarkdown("# Heading");
      const output = stdoutChunks.join("");
      expect(output).toContain("# Heading");
      expect(output).not.toMatch(ANSI_RE);
    });

    it("does not write anything for empty input", () => {
      setTtyOverride(false);
      outputMarkdown("");
      expect(stdoutChunks).toHaveLength(0);
    });

    it("does not write anything for whitespace-only input", () => {
      setTtyOverride(false);
      outputMarkdown("   \n  ");
      expect(stdoutChunks).toHaveLength(0);
    });
  });
});
