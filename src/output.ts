/**
 * Output utility for ToneForge CLI.
 *
 * Provides markdown-to-ANSI rendering, TTY detection, NO_COLOR support,
 * and styled helper functions for errors, warnings, info, and success messages.
 */

import chalk from "chalk";
import { Marked, type MarkedExtension } from "marked";
import { markedTerminal } from "marked-terminal";

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
// Chalk with forced colour support
// ---------------------------------------------------------------------------

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

/** Options that override every chalk-based style in marked-terminal. */
const terminalRendererOptions = {
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

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

/**
 * Render a CommonMark markdown string to styled ANSI output when the
 * terminal is a TTY, or return the raw markdown when piped / `NO_COLOR` is
 * set.
 *
 * Returns an empty string when given an empty (or whitespace-only) input.
 */
export function renderMarkdown(md: string): string {
  if (md.trim() === "") return "";

  if (!isStdoutTty()) {
    return md;
  }

  const instance = new Marked();
  // The @types/marked-terminal types are slightly out of date with the
  // marked extension API, but the runtime contract is correct.
  instance.use(
    markedTerminal(terminalRendererOptions) as unknown as MarkedExtension,
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
