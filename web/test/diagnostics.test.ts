/**
 * Unit tests for the shared e2e diagnostics helpers.
 *
 * These exercise the pure formatting/parsing logic that turns a raw terminal
 * buffer and browser console capture into a root-cause failure message. The
 * Playwright wiring (`waitForTerminalText` / `waitForRenderedBufferLength`) is
 * covered end-to-end by the specs in `web/e2e/`.
 *
 * Work item: TF-0MUVK0K230013UC3.
 */
import { describe, expect, it } from "vitest";
import {
  extractShellErrors,
  findUnknownRecipeWarnings,
  formatTimeoutDiagnostics,
  isShellErrorLine,
  selectDiagnosticConsole,
  stripAnsi,
  type ConsoleRecord,
} from "../e2e/helpers/diagnostics.js";

describe("stripAnsi", () => {
  it("removes xterm SGR colour codes and trims surrounding whitespace", () => {
    expect(stripAnsi("  \x1b[31mtoneforge: command not found\x1b[0m  ")).toBe(
      "toneforge: command not found",
    );
  });
});

describe("isShellErrorLine", () => {
  it.each([
    "toneforge: command not found",
    "bash: toneforge: command not found",
    "sh: 1: toneforge: not found",
    "toneforge: No such file or directory",
    "bash: ./run.sh: Permission denied",
  ])("recognises the shell error %j", (line) => {
    expect(isShellErrorLine(line)).toBe(true);
  });

  it("does not flag ordinary command output", () => {
    expect(isShellErrorLine("Rendered ui-scifi-confirm (seed 42)")).toBe(false);
    expect(isShellErrorLine("Playing...")).toBe(false);
    expect(isShellErrorLine("")).toBe(false);
  });
});

describe("extractShellErrors", () => {
  it("returns the distinct shell error lines from a PTY buffer", () => {
    const buffer = [
      "ToneForge Terminal",
      "$ toneforge generate --recipe ui-scifi-confirm --seed 42",
      "toneforge: command not found",
      "bash: line 1: something: not found",
      "toneforge: command not found",
      "user@host:~/repo$",
    ].join("\r\n");

    expect(extractShellErrors(buffer)).toEqual([
      "toneforge: command not found",
      "bash: line 1: something: not found",
    ]);
  });

  it("returns an empty list for a clean buffer", () => {
    expect(extractShellErrors("ToneForge Terminal\r\nuser@host:~/repo$")).toEqual(
      [],
    );
  });
});

describe("findUnknownRecipeWarnings", () => {
  it("finds the registry warning emitted for an unresolved recipe", () => {
    const records: ConsoleRecord[] = [
      { type: "log", text: "[ToneForge] WebSocket connected" },
      {
        type: "warning",
        text: 'Unknown recipe "ui-scifi-confirm" - skipping audio playback.',
      },
    ];

    expect(findUnknownRecipeWarnings(records)).toEqual([
      'Unknown recipe "ui-scifi-confirm" - skipping audio playback.',
    ]);
  });

  it("returns an empty list when no warning is present", () => {
    expect(
      findUnknownRecipeWarnings([{ type: "log", text: "all good" }]),
    ).toEqual([]);
  });
});

describe("selectDiagnosticConsole", () => {
  it("keeps warnings, errors and unresolved-recipe messages but drops logs", () => {
    const records: ConsoleRecord[] = [
      { type: "log", text: "noise" },
      { type: "warning", text: "a warning" },
      { type: "error", text: "an error" },
      { type: "pageerror", text: "uncaught" },
      { type: "log", text: 'Unknown recipe "x" - skipping audio playback.' },
    ];

    expect(selectDiagnosticConsole(records)).toEqual([
      { type: "warning", text: "a warning" },
      { type: "error", text: "an error" },
      { type: "pageerror", text: "uncaught" },
      { type: "log", text: 'Unknown recipe "x" - skipping audio playback.' },
    ]);
  });
});

describe("formatTimeoutDiagnostics", () => {
  it("surfaces a shell command-not-found error instead of a generic timeout", () => {
    const message = formatTimeoutDiagnostics({
      expected: "terminal text: Rendered",
      timeoutMs: 1000,
      lastOutput: "$ toneforge generate\r\ntoneforge: command not found\r\n",
    });

    expect(message).toContain("Timed out after 1000ms");
    expect(message).toContain("terminal text: Rendered");
    expect(message).toContain("toneforge: command not found");
    expect(message).toContain("likely root cause");
  });

  it("surfaces the browser Unknown recipe warning as the root cause", () => {
    const message = formatTimeoutDiagnostics({
      expected: "a non-zero OfflineAudioContext rendered buffer length",
      timeoutMs: 500,
      lastOutput: "",
      consoleRecords: [
        {
          type: "warning",
          text: 'Unknown recipe "ui-scifi-confirm" - skipping audio playback.',
        },
      ],
    });

    expect(message).toContain("unresolved recipe");
    expect(message).toContain('Unknown recipe "ui-scifi-confirm"');
    expect(message).toContain("[warning]");
  });

  it("uses pre-computed shell errors when provided", () => {
    const message = formatTimeoutDiagnostics({
      expected: "terminal text: Tests",
      timeoutMs: 2000,
      lastOutput: "some output",
      shellErrors: ["bash: vitest: command not found"],
    });

    expect(message).toContain("bash: vitest: command not found");
    expect(message).toContain("some output");
  });
});
