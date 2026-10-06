/**
 * Shared Playwright e2e diagnostics.
 *
 * The failure helpers in this module attach the evidence needed to name the
 * *true* root cause of a timeout:
 *
 * - browser console messages, so a missing recipe surfaces the
 *   `Unknown recipe "<name>"` warning emitted by `web/src/audio.ts`; and
 * - shell errors from the PTY buffer, so a wait that ends in
 *   `toneforge: command not found` reports that error instead of a generic
 *   "Timed out waiting for terminal text".
 *
 * The pure helpers (no Playwright dependency) are unit-tested in
 * `web/test/diagnostics.test.ts`; the `waitFor*` helpers inject the Playwright
 * `Page` so the module stays import-safe outside a Playwright run.
 *
 * Work item: TF-0MUVK0K230013UC3.
 */
import type { Page } from "@playwright/test";

export interface ConsoleRecord {
  /** Playwright console message type, e.g. `log`, `warning`, `error`. */
  type: string;
  /** Rendered message text. */
  text: string;
}

export interface ConsoleCapture {
  /** Messages collected so far, in arrival order. */
  records: ConsoleRecord[];
  /** Forget everything collected so far (used to scope diagnostics to a step). */
  clear(): void;
}

/**
 * Shell error signatures that mean an expected command never ran.
 *
 * Kept deliberately specific to avoid matching ordinary output: a bare
 * "not found" only counts when it follows the shell's `command:` prefix
 * (bash) or appears as `sh: 1: <cmd>: not found` (dash).
 */
const SHELL_ERROR_PATTERNS: RegExp[] = [
  /\bcommand not found\b/i,
  /(?:^|:\s+)[^\s:]+:\s+not found\b/i,
  /\bno such file or directory\b/i,
  /\bpermission denied\b/i,
  /\bcannot execute\b/i,
];

/** `Unknown recipe "<name>"` warning emitted by the browser audio layer. */
const UNKNOWN_RECIPE_PATTERN = /unknown recipe/i;

/** Matches ANSI SGR escape sequences (e.g. `\x1b[36m`) emitted by xterm. */
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/g;

/** Strip ANSI colour codes and surrounding whitespace from a terminal line. */
export function stripAnsi(line: string): string {
  return line.replace(ANSI_ESCAPE_PATTERN, "").trim();
}

/** True when a single terminal line is a shell error worth reporting. */
export function isShellErrorLine(line: string): boolean {
  const clean = stripAnsi(line);
  if (!clean) return false;
  return SHELL_ERROR_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Extract the distinct shell error lines from a terminal buffer.
 *
 * The PTY echoes the command, its output and the next prompt into the same
 * buffer; this narrows the buffer down to the lines that explain a failure.
 */
export function extractShellErrors(terminalText: string): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const rawLine of terminalText.split(/\r?\n/)) {
    const line = stripAnsi(rawLine);
    if (!line || !isShellErrorLine(line) || seen.has(line)) continue;
    seen.add(line);
    errors.push(line);
  }
  return errors;
}

/** The `Unknown recipe` warnings present in a console capture. */
export function findUnknownRecipeWarnings(records: ConsoleRecord[]): string[] {
  return records
    .filter((record) => UNKNOWN_RECIPE_PATTERN.test(record.text))
    .map((record) => record.text);
}

/**
 * The console messages worth attaching to a failure: warnings, errors and any
 * warning naming an unresolved recipe (which is otherwise easy to miss).
 */
export function selectDiagnosticConsole(records: ConsoleRecord[]): ConsoleRecord[] {
  return records.filter(
    (record) =>
      record.type === "warning" ||
      record.type === "error" ||
      record.type === "pageerror" ||
      UNKNOWN_RECIPE_PATTERN.test(record.text),
  );
}

export interface TimeoutDiagnostics {
  /** Human description of what the wait expected. */
  expected: string;
  /** Timeout in milliseconds. */
  timeoutMs: number;
  /** Last observed terminal output (empty when not terminal-based). */
  lastOutput: string;
  /** Browser console capture, when available. */
  consoleRecords?: ConsoleRecord[];
  /** Pre-computed shell errors (recomputed from `lastOutput` when omitted). */
  shellErrors?: string[];
  /** One-line explanation of the most likely root cause. */
  hint?: string;
}

/**
 * Build a timeout message that names the root cause instead of printing a
 * generic "timed out" line. Shell errors and the `Unknown recipe` warning are
 * highlighted separately because they point straight at the broken step.
 */
export function formatTimeoutDiagnostics(options: TimeoutDiagnostics): string {
  const lines: string[] = [
    `Timed out after ${options.timeoutMs}ms waiting for: ${options.expected}`,
  ];
  if (options.hint) {
    lines.push(options.hint);
  }

  const shellErrors =
    options.shellErrors?.length
      ? options.shellErrors
      : extractShellErrors(options.lastOutput);
  if (shellErrors.length > 0) {
    lines.push("");
    lines.push(
      "Shell error(s) detected in the terminal — this is the likely root cause:",
    );
    for (const error of shellErrors) {
      lines.push(`  $ ${error}`);
    }
  }

  const consoleRecords = options.consoleRecords ?? [];
  const unknownRecipes = findUnknownRecipeWarnings(consoleRecords);
  if (unknownRecipes.length > 0) {
    lines.push("");
    lines.push(
      "Browser console reported an unresolved recipe — the registry did not resolve it:",
    );
    for (const warning of unknownRecipes) {
      lines.push(`  ! ${warning}`);
    }
  }

  const relevantConsole = selectDiagnosticConsole(consoleRecords);
  if (relevantConsole.length > 0) {
    lines.push("");
    lines.push("Browser console (warnings/errors):");
    for (const record of relevantConsole) {
      lines.push(`  [${record.type}] ${record.text}`);
    }
  }

  if (options.lastOutput) {
    lines.push("");
    lines.push(`Last terminal output (${options.lastOutput.length} chars):`);
    lines.push(options.lastOutput.slice(0, 2000));
  }

  return lines.join("\n");
}

/**
 * Start capturing browser console messages and uncaught page errors.
 *
 * Call once per page before navigation so warnings emitted during
 * initialisation are recorded.
 */
export function captureConsole(page: Page): ConsoleCapture {
  const records: ConsoleRecord[] = [];
  page.on("console", (message) => {
    records.push({ type: message.type(), text: message.text() });
  });
  page.on("pageerror", (error) => {
    records.push({ type: "pageerror", text: error.message });
  });
  return {
    records,
    clear() {
      records.length = 0;
    },
  };
}

/**
 * Read the visible text from the xterm.js terminal.
 *
 * xterm exposes two views of the same buffer: the accessibility tree (used by
 * screen readers, and the only text source when the canvas renderer is active)
 * and the DOM-rendered `.xterm-rows`. Either view can lag or hold only a slice
 * of the scrollback — notably the accessibility tree can drop earlier rows
 * when the shell prompt wraps a long working directory — so both are read and
 * merged. Merging keeps `includes(expected)` truthful regardless of renderer.
 */
export async function getTerminalText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const readRows = (selector: string): string =>
      Array.from(document.querySelectorAll(selector))
        .map((row) => row.textContent ?? "")
        .join("\n");

    const accessibility = readRows(
      ".xterm-accessibility .xterm-accessibility-tree div",
    );
    const renderedRows = readRows(".xterm-rows > div");

    if (accessibility && renderedRows) {
      return accessibility.includes(renderedRows)
        ? accessibility
        : `${accessibility}\n${renderedRows}`;
    }
    return accessibility || renderedRows;
  });
}

/**
 * Wait until the terminal contains `expected`.
 *
 * Fails fast when the buffer already contains a shell error (e.g.
 * `command not found`): that error — not the missing text — is the root cause,
 * so it is reported explicitly.
 */
export async function waitForTerminalText(
  page: Page,
  expected: string,
  timeoutMs: number,
  capture?: ConsoleCapture,
): Promise<string> {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    last = await getTerminalText(page);
    if (last.includes(expected)) {
      return last;
    }

    const shellErrors = extractShellErrors(last);
    if (shellErrors.length > 0) {
      throw new Error(
        formatTimeoutDiagnostics({
          expected: `terminal text: ${expected}`,
          timeoutMs,
          lastOutput: last,
          consoleRecords: capture?.records,
          shellErrors,
          hint: "The PTY reported a shell error before the expected text appeared.",
        }),
      );
    }
    await page.waitForTimeout(250);
  }

  throw new Error(
    formatTimeoutDiagnostics({
      expected: `terminal text: ${expected}`,
      timeoutMs,
      lastOutput: last,
      consoleRecords: capture?.records,
    }),
  );
}

/**
 * Read the length of the last buffer rendered by the patched
 * `OfflineAudioContext.startRendering` (installed by the smoke spec).
 */
async function readRenderedBufferLength(page: Page): Promise<number> {
  return page.evaluate(() => {
    const value = (globalThis as { __tfLastRenderedLength?: unknown })
      .__tfLastRenderedLength;
    return typeof value === "number" ? value : 0;
  });
}

/**
 * Wait until a browser-side render produces a non-zero buffer length.
 *
 * Fails fast — naming the `Unknown recipe` warning — when the registry did not
 * resolve the recipe, because in that case `startRendering()` is never called
 * and a generic timeout would hide the real cause.
 */
export async function waitForRenderedBufferLength(
  page: Page,
  timeoutMs: number,
  capture?: ConsoleCapture,
): Promise<number> {
  const expected = "a non-zero OfflineAudioContext rendered buffer length";
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const length = await readRenderedBufferLength(page);
    if (length > 0) {
      return length;
    }

    const unknownRecipes = findUnknownRecipeWarnings(capture?.records ?? []);
    if (unknownRecipes.length > 0) {
      throw new Error(
        formatTimeoutDiagnostics({
          expected,
          timeoutMs,
          lastOutput: "",
          consoleRecords: capture?.records,
          hint:
            "The browser recipe registry did not resolve the recipe, so " +
            "startRendering() was never called.",
        }),
      );
    }
    await page.waitForTimeout(200);
  }

  throw new Error(
    formatTimeoutDiagnostics({
      expected,
      timeoutMs,
      lastOutput: "",
      consoleRecords: capture?.records,
      hint:
        "No render was observed. Check the browser console for Node-only " +
        "imports or an unresolved recipe.",
    }),
  );
}
