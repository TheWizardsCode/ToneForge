/**
 * Output utility for ToneForge CLI.
 *
 * Provides markdown-to-ANSI rendering, TTY detection, NO_COLOR support,
 * and styled helper functions for errors, warnings, info, and success messages.
 *
 * Heavy dependencies (chalk, marked, marked-terminal) are lazy-loaded on
 * first use of `renderMarkdown()` to avoid ~590ms of module-load overhead
 * at CLI startup. The simpler output helpers (outputError, outputInfo, etc.)
 * use only raw ANSI escape sequences and incur zero import cost.
 */

import type { MarkedExtension } from "marked";

// ---------------------------------------------------------------------------
// Color configuration -- 16-color ANSI palette
// ---------------------------------------------------------------------------

/** Named ANSI escape sequences used throughout the module. */
export const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
} as const;

// ---------------------------------------------------------------------------
// TTY detection & overrides
// ---------------------------------------------------------------------------

let ttyOverride: boolean | undefined;

/**
 * Override TTY detection for testing purposes.
 * Pass `undefined` to restore default behaviour (check `process.stdout.isTTY`
 * / `process.stderr.isTTY`).
 */
export function setTtyOverride(value: boolean | undefined): void {
  ttyOverride = value;
}

/** Returns `true` when stdout should emit styled output. */
function isStdoutTty(): boolean {
  if (process.env["NO_COLOR"] !== undefined) return false;
  if (ttyOverride !== undefined) return ttyOverride;
  return process.stdout.isTTY === true;
}

/** Returns `true` when stderr should emit styled output. */
function isStderrTty(): boolean {
  if (process.env["NO_COLOR"] !== undefined) return false;
  if (ttyOverride !== undefined) return ttyOverride;
  return process.stderr.isTTY === true;
}

// ---------------------------------------------------------------------------
// Chalk with forced colour support (lazy-loaded)
// ---------------------------------------------------------------------------

/**
 * Lazily-initialised chalk instance and marked-terminal renderer options.
 * Only loaded on first call to `renderMarkdown()` to avoid the ~590ms
 * startup cost of marked-terminal → cli-highlight.
 */
let _terminalRendererOptions: Record<string, unknown> | undefined;

async function getTerminalRendererOptions(): Promise<Record<string, unknown>> {
  if (_terminalRendererOptions) return _terminalRendererOptions;

  const chalkModule = await import("chalk");
  const chalk = chalkModule.default;

  /**
   * Create a chalk instance that always produces 16-colour ANSI output,
   * regardless of the ambient terminal detection.  This is needed because
   * marked-terminal delegates all styling to chalk, and chalk's default
   * instance caches its colour level at import time (which is 0 in CI /
   * piped environments).  By providing our own instance with `level: 1`
   * we guarantee colours when our own TTY check says "yes".
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forcedChalk = new (chalk as any).Instance({ level: 1 }) as typeof chalk;

  _terminalRendererOptions = {
    code: forcedChalk.yellow,
    blockquote: forcedChalk.gray.italic,
    html: forcedChalk.gray,
    heading: forcedChalk.green.bold,
    firstHeading: forcedChalk.magenta.underline.bold,
    hr: forcedChalk.reset,
    listitem: forcedChalk.reset,
    table: forcedChalk.reset,
    paragraph: forcedChalk.reset,
    strong: forcedChalk.bold,
    em: forcedChalk.italic,
    codespan: forcedChalk.yellow,
    del: forcedChalk.dim.gray.strikethrough,
    link: forcedChalk.blue,
    href: forcedChalk.blue.underline,
  };

  return _terminalRendererOptions;
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

/**
 * Render a CommonMark markdown string to styled ANSI output when the
 * terminal is a TTY, or return the raw markdown when piped / `NO_COLOR` is
 * set.
 *
 * Returns an empty string when given an empty (or whitespace-only) input.
 *
 * Heavy dependencies (marked, marked-terminal, chalk) are imported lazily
 * on first call to avoid penalising CLI startup for commands that don't
 * render markdown.
 */
export async function renderMarkdown(md: string): Promise<string> {
  if (md.trim() === "") return "";

  if (!isStdoutTty()) {
    return md;
  }

  const [{ Marked }, { markedTerminal }, opts] = await Promise.all([
    import("marked"),
    import("marked-terminal"),
    getTerminalRendererOptions(),
  ]);

  const instance = new Marked();
  // The @types/marked-terminal types are slightly out of date with the
  // marked extension API, but the runtime contract is correct.
  instance.use(
    markedTerminal(opts) as unknown as MarkedExtension,
  );

  const result = instance.parse(md) as string;

  // marked-terminal may add a trailing newline; trim it to match raw behaviour
  return result.replace(/\n$/, "");
}

// ---------------------------------------------------------------------------
// Styled output helpers
// ---------------------------------------------------------------------------

/** Wrap `text` with ANSI codes if the target stream is a TTY. */
function style(
  text: string,
  ansi: string,
  stream: "stdout" | "stderr",
): string {
  const isTty = stream === "stderr" ? isStderrTty() : isStdoutTty();
  if (!isTty) return text;
  return `${ansi}${text}${COLORS.reset}`;
}

/** Print an error message to stderr (red when TTY). */
export function outputError(msg: string): void {
  process.stderr.write(style(msg, COLORS.red, "stderr") + "\n");
}

/** Print a warning message to stderr (yellow when TTY). */
export function outputWarning(msg: string): void {
  process.stderr.write(style(msg, COLORS.yellow, "stderr") + "\n");
}

/** Print a success message to stdout (green when TTY). */
export function outputSuccess(msg: string): void {
  process.stdout.write(style(msg, COLORS.green, "stdout") + "\n");
}

/** Print an informational message to stdout (dim when TTY). */
export function outputInfo(msg: string): void {
  process.stdout.write(style(msg, COLORS.dim, "stdout") + "\n");
}

/**
 * Render a markdown string and write the result to stdout.
 *
 * This is the preferred way to emit rendered markdown content (help text,
 * show output, list output, etc.) — it keeps `console.log` out of the
 * main CLI module entirely.
 */
export async function outputMarkdown(md: string): Promise<void> {
  const rendered = await renderMarkdown(md);
  if (rendered.length > 0) {
    process.stdout.write(rendered + "\n");
  }
}

// ---------------------------------------------------------------------------
// Table formatting with word-wrap
// ---------------------------------------------------------------------------

/** Pad `s` with trailing spaces to width `w`. */
function pad(s: string, w: number): string {
  return s + " ".repeat(Math.max(0, w - s.length));
}

/**
 * Word-wrap `text` to fit within `width` characters.
 * Breaks on word boundaries where possible; forces a break mid-word only
 * when a single word exceeds the available width.
 */
export function wordWrap(text: string, width: number): string[] {
  if (width <= 0) return [text];
  if (text.length <= width) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      // Force-break words longer than width
      if (word.length > width) {
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.slice(i, i + width));
        }
        current = "";
        // If the last chunk was exactly `width` it was pushed; if shorter
        // it becomes the start of the next line.
        const last = lines[lines.length - 1];
        if (last && last.length < width) {
          current = lines.pop()!;
        }
      } else {
        current = word;
      }
    } else if (current.length + 1 + word.length <= width) {
      current += " " + word;
    } else {
      lines.push(current);
      // Handle overlong word at line start
      if (word.length > width) {
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.slice(i, i + width));
        }
        current = "";
        const last = lines[lines.length - 1];
        if (last && last.length < width) {
          current = lines.pop()!;
        }
      } else {
        current = word;
      }
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

/** Box-drawing characters for TTY tables. */
const BOX = {
  tl: "\u250c", t: "\u2500", tc: "\u252c", tr: "\u2510",
  ml: "\u251c", m: "\u2500", x: "\u253c",  mr: "\u2524",
  bl: "\u2514", b: "\u2500", bc: "\u2534", br: "\u2518",
  v: "\u2502",
} as const;

export interface TableColumn {
  header: string;
  width: number;
}

/**
 * Format tabular data as a fixed-width string with word-wrapped cells.
 *
 * In TTY mode the table uses Unicode box-drawing characters with dim
 * ANSI styling on the borders and bold red headers.  In non-TTY mode
 * it uses plain pipe-delimited lines.
 *
 * @param columns  Column definitions (header + width).
 * @param rows     Array of rows; each row is a string array matching columns.
 * @param tty      Whether to emit styled box-drawing output.
 */
export function formatTable(
  columns: TableColumn[],
  rows: string[][],
  tty: boolean,
): string {
  const lines: string[] = [];

  if (tty) {
    const dim = COLORS.dim;
    const red = "\x1b[31m";
    const rst = COLORS.reset;

    const hRule = (l: string, cross: string, r: string, fill: string) =>
      `${dim}${l}${columns.map((c) => fill.repeat(c.width + 2)).join(`${cross}`)}${r}${rst}`;

    // Top border
    lines.push(hRule(BOX.tl, BOX.tc, BOX.tr, BOX.t));

    // Header row
    const hdr = columns
      .map((c) => ` ${red}${pad(c.header, c.width)}${rst} `)
      .join(`${dim}${BOX.v}${rst}`);
    lines.push(`${dim}${BOX.v}${rst}${hdr}${dim}${BOX.v}${rst}`);

    // Header separator
    lines.push(hRule(BOX.ml, BOX.x, BOX.mr, BOX.m));

    // Data rows
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const wrapped = row.map((cell, i) => wordWrap(cell, columns[i].width));
      const maxLines = Math.max(...wrapped.map((w) => w.length));

      for (let ln = 0; ln < maxLines; ln++) {
        const cells = columns
          .map((c, i) => ` ${pad(wrapped[i][ln] ?? "", c.width)} `)
          .join(`${dim}${BOX.v}${rst}`);
        lines.push(`${dim}${BOX.v}${rst}${cells}${dim}${BOX.v}${rst}`);
      }

      // Row separator (between rows, not after the last)
      if (ri < rows.length - 1) {
        lines.push(hRule(BOX.ml, BOX.x, BOX.mr, BOX.m));
      }
    }

    // Bottom border
    lines.push(hRule(BOX.bl, BOX.bc, BOX.br, BOX.b));
  } else {
    // Plain pipe-delimited table

    // Header
    lines.push(
      "| " + columns.map((c) => pad(c.header, c.width)).join(" | ") + " |",
    );
    // Separator
    lines.push(
      "| " + columns.map((c) => "-".repeat(c.width)).join(" | ") + " |",
    );
    // Data rows
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const wrapped = row.map((cell, i) => wordWrap(cell, columns[i].width));
      const maxLines = Math.max(...wrapped.map((w) => w.length));

      for (let ln = 0; ln < maxLines; ln++) {
        lines.push(
          "| " +
            columns
              .map((c, i) => pad(wrapped[i][ln] ?? "", c.width))
              .join(" | ") +
            " |",
        );
      }

      // Row separator (between rows, not after the last)
      if (ri < rows.length - 1) {
        lines.push(
          "| " + columns.map((c) => "-".repeat(c.width)).join(" | ") + " |",
        );
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format and write a table to stdout, choosing box-drawn (TTY) or
 * pipe-delimited (non-TTY) output automatically.
 */
export function outputTable(
  columns: TableColumn[],
  rows: string[][],
): void {
  const result = formatTable(columns, rows, isStdoutTty());
  if (result.length > 0) {
    process.stdout.write(result + "\n");
  }
}
