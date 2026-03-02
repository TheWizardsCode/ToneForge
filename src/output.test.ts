import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  renderMarkdown,
  outputError,
  outputWarning,
  outputSuccess,
  outputInfo,
  outputMarkdown,
  outputTable,
  formatTable,
  wordWrap,
  setTtyOverride,
  COLORS,
  stripAnsi,
  ansiWidth,
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
  // stripAnsi
  // -----------------------------------------------------------------------
  describe("stripAnsi", () => {
    it("returns plain strings unchanged", () => {
      expect(stripAnsi("hello world")).toBe("hello world");
    });

    it("strips bold escape sequences", () => {
      expect(stripAnsi("\x1b[1mbold\x1b[0m")).toBe("bold");
    });

    it("strips multiple different codes", () => {
      expect(stripAnsi("\x1b[31mred\x1b[0m and \x1b[1mbold\x1b[0m")).toBe(
        "red and bold",
      );
    });

    it("strips nested/stacked codes", () => {
      expect(stripAnsi("\x1b[1m\x1b[31mboldred\x1b[0m")).toBe("boldred");
    });

    it("returns empty string for empty input", () => {
      expect(stripAnsi("")).toBe("");
    });

    it("returns empty string for a string containing only ANSI codes", () => {
      expect(stripAnsi("\x1b[1m\x1b[0m")).toBe("");
    });

    it("does not modify strings with literal brackets that are not ANSI sequences", () => {
      expect(stripAnsi("[INFO] message")).toBe("[INFO] message");
    });

    it("handles codes with multi-digit parameters", () => {
      expect(stripAnsi("\x1b[38;5;196mcolored\x1b[0m")).toBe("colored");
    });
  });

  // -----------------------------------------------------------------------
  // ansiWidth
  // -----------------------------------------------------------------------
  describe("ansiWidth", () => {
    it("returns length of plain string", () => {
      expect(ansiWidth("hello")).toBe(5);
    });

    it("returns visible width ignoring bold codes", () => {
      expect(ansiWidth("\x1b[1mbold\x1b[0m")).toBe(4);
    });

    it("returns visible width with mixed ANSI and plain text", () => {
      expect(ansiWidth("\x1b[1mhi\x1b[0m there")).toBe(8);
    });

    it("returns 0 for empty string", () => {
      expect(ansiWidth("")).toBe(0);
    });

    it("returns 0 for string containing only ANSI codes", () => {
      expect(ansiWidth("\x1b[1m\x1b[0m")).toBe(0);
    });
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
    it("overrides TTY detection to true", async () => {
      setTtyOverride(true);
      const result = await renderMarkdown("**bold**");
      expect(result).toMatch(ANSI_RE);
    });

    it("overrides TTY detection to false", async () => {
      setTtyOverride(false);
      const result = await renderMarkdown("**bold**");
      expect(result).not.toMatch(ANSI_RE);
      expect(result).toBe("**bold**");
    });

    it("restores default behaviour when set to undefined", async () => {
      setTtyOverride(true);
      expect(await renderMarkdown("**bold**")).toMatch(ANSI_RE);

      setTtyOverride(undefined);
      // In CI / vitest the process is not a TTY, so should produce raw output
      const result = await renderMarkdown("**bold**");
      expect(result).toBe("**bold**");
    });
  });

  // -----------------------------------------------------------------------
  // renderMarkdown
  // -----------------------------------------------------------------------
  describe("renderMarkdown", () => {
    it("returns empty string for empty input", async () => {
      expect(await renderMarkdown("")).toBe("");
    });

    it("returns empty string for whitespace-only input", async () => {
      expect(await renderMarkdown("   \n  \t  ")).toBe("");
    });

    it("returns raw markdown when TTY is false", async () => {
      setTtyOverride(false);
      const md = "# Hello\n\nThis is **bold** and *italic*.";
      expect(await renderMarkdown(md)).toBe(md);
    });

    it("renders ANSI output when TTY is true", async () => {
      setTtyOverride(true);
      const result = await renderMarkdown("# Heading");
      expect(result).toMatch(ANSI_RE);
      expect(result).toContain("Heading");
    });

    it("renders bold text with ANSI when TTY is true", async () => {
      setTtyOverride(true);
      const result = await renderMarkdown("**bold**");
      expect(result).toMatch(ANSI_RE);
      expect(result).toContain("bold");
    });

    it("renders code blocks when TTY is true", async () => {
      setTtyOverride(true);
      const md = "```js\nconst x = 1;\n```";
      const result = await renderMarkdown(md);
      expect(result).toContain("x");
    });

    it("renders tables when TTY is true", async () => {
      setTtyOverride(true);
      const md = "| A | B |\n|---|---|\n| 1 | 2 |";
      const result = await renderMarkdown(md);
      expect(result).toContain("1");
      expect(result).toContain("2");
    });

    it("suppresses ANSI when NO_COLOR is set even if TTY is true", async () => {
      setTtyOverride(true);
      process.env["NO_COLOR"] = "1";
      const result = await renderMarkdown("# Heading");
      expect(result).not.toMatch(ANSI_RE);
      expect(result).toBe("# Heading");
    });

    it("suppresses ANSI when NO_COLOR is empty string", async () => {
      setTtyOverride(true);
      process.env["NO_COLOR"] = "";
      const result = await renderMarkdown("**bold**");
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
    it("writes to stdout", async () => {
      setTtyOverride(false);
      await outputMarkdown("hello world");
      expect(stdoutChunks.join("")).toContain("hello world");
      expect(stderrChunks).toHaveLength(0);
    });

    it("renders markdown with ANSI when TTY", async () => {
      setTtyOverride(true);
      await outputMarkdown("# Heading");
      const output = stdoutChunks.join("");
      expect(output).toMatch(ANSI_RE);
    });

    it("returns raw markdown when not TTY", async () => {
      setTtyOverride(false);
      await outputMarkdown("# Heading");
      const output = stdoutChunks.join("");
      expect(output).toContain("# Heading");
      expect(output).not.toMatch(ANSI_RE);
    });

    it("does not write anything for empty input", async () => {
      setTtyOverride(false);
      await outputMarkdown("");
      expect(stdoutChunks).toHaveLength(0);
    });

    it("does not write anything for whitespace-only input", async () => {
      setTtyOverride(false);
      await outputMarkdown("   \n  ");
      expect(stdoutChunks).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // wordWrap
  // -----------------------------------------------------------------------
  describe("wordWrap", () => {
    it("returns single-element array when text fits within width", () => {
      expect(wordWrap("hello world", 20)).toEqual(["hello world"]);
    });

    it("wraps on word boundaries", () => {
      expect(wordWrap("one two three four", 10)).toEqual([
        "one two",
        "three four",
      ]);
    });

    it("handles single long word exceeding width", () => {
      expect(wordWrap("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
    });

    it("handles empty string", () => {
      expect(wordWrap("", 10)).toEqual([""]);
    });

    it("wraps real description text at 48 chars", () => {
      const desc =
        "Short sci-fi confirmation tone using sine synthesis with a filtered sweep.";
      const lines = wordWrap(desc, 48);
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(48);
      }
      expect(lines.join(" ")).toBe(desc);
    });

    it("treats ANSI bold codes as zero-width and does not wrap prematurely", () => {
      // "hello" is 5 visible chars; with bold codes it's longer in raw length
      const bold = `${COLORS.bold}hello${COLORS.reset}`;
      expect(bold.length).toBeGreaterThan(10); // raw length includes ANSI codes
      const lines = wordWrap(bold, 10);
      expect(lines).toEqual([bold]); // fits within 10 visible chars
    });

    it("wraps ANSI-styled text at correct visible position", () => {
      const boldWord = `${COLORS.bold}one${COLORS.reset}`;
      const text = `${boldWord} two three four`;
      const lines = wordWrap(text, 10);
      // "one two" is 7 visible chars, fits in 10
      // "three four" is 10 visible chars, fits in 10
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("one");
      expect(lines[0]).toContain("two");
      expect(lines[1]).toBe("three four");
    });

    it("plain string produces identical output as before (regression guard)", () => {
      const text = "alpha beta gamma delta epsilon";
      const result = wordWrap(text, 15);
      expect(result).toEqual(["alpha beta", "gamma delta", "epsilon"]);
    });
  });

  // -----------------------------------------------------------------------
  // formatTable
  // -----------------------------------------------------------------------
  describe("formatTable", () => {
    const cols = [
      { header: "Name", width: 10 },
      { header: "Desc", width: 20 },
    ];

    it("produces pipe-delimited output in non-TTY mode", () => {
      const result = formatTable(cols, [["foo", "a short desc"]], false);
      const lines = result.split("\n");
      expect(lines[0]).toContain("| Name");
      expect(lines[0]).toContain("| Desc");
      expect(lines[1]).toMatch(/^\| -{10} \| -{20} \|$/);
      expect(lines[2]).toContain("foo");
      expect(lines[2]).toContain("a short desc");
    });

    it("wraps long cell content across multiple lines", () => {
      const longDesc = "this is a description that exceeds twenty characters easily";
      const result = formatTable(cols, [["foo", longDesc]], false);
      const lines = result.split("\n");
      // Header + separator + at least 2 wrapped lines
      expect(lines.length).toBeGreaterThanOrEqual(4);
      // Name column should be empty on continuation lines
      expect(lines[3]).toMatch(/^\|\s{12}\|/);
    });

    it("maintains consistent line width in non-TTY mode", () => {
      const result = formatTable(
        cols,
        [["foo", "some text that wraps around the column width boundary"]],
        false,
      );
      const lines = result.split("\n");
      const expectedWidth = lines[0].length;
      for (const line of lines) {
        expect(line.length).toBe(expectedWidth);
      }
    });

    it("produces box-drawing characters in TTY mode", () => {
      const result = formatTable(cols, [["bar", "baz"]], true);
      expect(result).toContain("\u250c"); // top-left corner
      expect(result).toContain("\u2518"); // bottom-right corner
      expect(result).toContain("\u2502"); // vertical bar
      expect(result).toContain("\u252c"); // top cross
      expect(result).toContain("\u2534"); // bottom cross
    });

    it("includes ANSI codes in TTY mode", () => {
      const result = formatTable(cols, [["x", "y"]], true);
      expect(result).toMatch(ANSI_RE);
    });

    it("excludes ANSI codes in non-TTY mode", () => {
      const result = formatTable(cols, [["x", "y"]], false);
      expect(result).not.toMatch(ANSI_RE);
    });

    it("adds row separators between data rows in non-TTY mode", () => {
      const result = formatTable(
        cols,
        [["a", "desc a"], ["b", "desc b"], ["c", "desc c"]],
        false,
      );
      const lines = result.split("\n");
      // Header, header-sep, row-a, sep, row-b, sep, row-c  = 7 lines
      expect(lines).toHaveLength(7);
      // Separators are at index 3 and 5
      expect(lines[3]).toMatch(/^\| -{10} \| -{20} \|$/);
      expect(lines[5]).toMatch(/^\| -{10} \| -{20} \|$/);
    });

    it("does not add separator after the last data row in non-TTY mode", () => {
      const result = formatTable(cols, [["a", "one"], ["b", "two"]], false);
      const lines = result.split("\n");
      // Last line should be data, not a separator
      expect(lines[lines.length - 1]).not.toMatch(/^[\s|]*-+/);
      expect(lines[lines.length - 1]).toContain("two");
    });

    it("pads ANSI-styled cell content correctly (ANSI codes do not consume width)", () => {
      const boldCell = `${COLORS.bold}hi${COLORS.reset}`;
      const smallCols = [{ header: "A", width: 10 }];
      const result = formatTable(smallCols, [[boldCell]], false);
      const dataLine = result.split("\n")[2]; // header, separator, data
      // "hi" is 2 visible chars in a 10-wide column → 8 spaces of padding
      // The raw string has ANSI codes + "hi" + 8 spaces
      expect(dataLine).toContain(boldCell);
      // Verify consistent line width (ANSI-aware padding keeps alignment)
      const headerLine = result.split("\n")[0];
      // In non-TTY mode no ANSI codes in header, so widths should match
      // accounting for the ANSI codes in the data line
      const lines = result.split("\n");
      // All lines should have same visible width (strip ANSI first)
      const visibleWidths = lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, "").length);
      expect(new Set(visibleWidths).size).toBe(1);
    });

    it("adds row separators between data rows in TTY mode", () => {
      const result = formatTable(
        cols,
        [["a", "desc a"], ["b", "desc b"]],
        true,
      );
      // Mid-rule character (├) should appear twice:
      // once for header separator, once for row separator
      const midLeftCount = (result.match(/\u251c/g) || []).length;
      expect(midLeftCount).toBe(2);
    });

    it("does not add row separator after the last row in TTY mode", () => {
      const result = formatTable(cols, [["only", "row"]], true);
      // Only one mid-rule (header separator), no row separator
      const midLeftCount = (result.match(/\u251c/g) || []).length;
      expect(midLeftCount).toBe(1);
    });

    it("places row separators correctly with multi-line wrapped rows", () => {
      const longDesc = "this wraps to multiple lines in the column";
      const result = formatTable(
        cols,
        [["a", longDesc], ["b", "short"]],
        false,
      );
      const lines = result.split("\n");
      // Find the separator between the two data rows
      const sepIndices = lines.reduce<number[]>((acc, line, i) => {
        // Skip header separator at index 1
        if (i > 1 && /^\| -{10} \| -{20} \|$/.test(line)) acc.push(i);
        return acc;
      }, []);
      expect(sepIndices).toHaveLength(1);
      // The line before the separator should be the last continuation of row "a"
      // The line after the separator should contain "b"
      expect(lines[sepIndices[0] + 1]).toContain("b");
    });
  });

  // -----------------------------------------------------------------------
  // outputTable
  // -----------------------------------------------------------------------
  describe("outputTable", () => {
    it("writes to stdout", () => {
      setTtyOverride(false);
      outputTable(
        [{ header: "A", width: 5 }, { header: "B", width: 5 }],
        [["1", "2"]],
      );
      const output = stdoutChunks.join("");
      expect(output).toContain("1");
      expect(output).toContain("2");
      expect(stderrChunks).toHaveLength(0);
    });

    it("produces ANSI output when TTY", () => {
      setTtyOverride(true);
      outputTable(
        [{ header: "A", width: 5 }],
        [["x"]],
      );
      const output = stdoutChunks.join("");
      expect(output).toMatch(ANSI_RE);
    });

    it("produces no ANSI when not TTY", () => {
      setTtyOverride(false);
      outputTable(
        [{ header: "A", width: 5 }],
        [["x"]],
      );
      const output = stdoutChunks.join("");
      expect(output).not.toMatch(ANSI_RE);
    });
  });
});
