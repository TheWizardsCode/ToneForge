/**
 * Unit tests for the yargs dispatch guard in `yargsMain`.
 *
 * Regression (TF-0MVEYTTJ10067O90): when a *matched* command handler rejected
 * (e.g. the instrument daemon died mid-stream during `instrument play <file>`),
 * `yargsMain`'s catch block re-dispatched the raw argv through `parseArgs`.
 * `parseArgs` only records the command and one subcommand — positionals such as
 * the MIDI file path are dropped — so the re-dispatch called `play` with no
 * `file` and printed the misleading
 * `instrument play requires a MIDI file path (<file.mid>).`
 *
 * A matched handler's own error/exit code must be surfaced instead. The
 * `parseArgs` fallback remains for genuinely unmatched commands.
 *
 * The instrument command module is replaced with a test double so a handler
 * rejection can be produced deterministically without a daemon or audio device.
 *
 * Work item: TF-0MVEYTTJ10067O90.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const handlerFailure = new Error("The instrument daemon closed the connection.");

vi.mock("./cli/commands/instrument.js", () => ({
  command: "instrument",
  desc: "Instrument command (test double)",
  runInstrumentCommand: vi.fn(async (subcommand: string | undefined) => {
    if (subcommand === "play") throw handlerFailure;
    return 0;
  }),
}));

import { yargsMain } from "./cli.yargs.js";
import { runInstrumentCommand } from "./cli/commands/instrument.js";

async function captureOutput(fn: () => Promise<number>): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutLines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrLines.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;

  try {
    const code = await fn();
    return { code, stdout: stdoutLines.join(""), stderr: stderrLines.join("") };
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

beforeEach(() => {
  vi.mocked(runInstrumentCommand).mockClear();
});

describe("yargsMain matched-handler failure guard", () => {
  it("surfaces the handler's real error and never fabricates a missing-argument error", async () => {
    const result = await captureOutput(() =>
      yargsMain(["node", "cli.ts", "instrument", "play", "song.mid"]),
    );

    // The positional reached the handler intact (it was not dropped by a
    // parseArgs re-dispatch), and the handler's real failure is reported.
    expect(vi.mocked(runInstrumentCommand)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runInstrumentCommand)).toHaveBeenCalledWith(
      "play",
      expect.objectContaining({ file: "song.mid" }),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("closed the connection");
    expect(result.stderr).not.toContain("requires a MIDI file path");
    expect(result.stderr).not.toMatch(/\s+at /);
  });

  it("still re-dispatches genuinely unmatched subcommands through parseArgs", async () => {
    const result = await captureOutput(() =>
      yargsMain(["node", "cli.ts", "instrument", "bogus-subcommand"]),
    );

    expect(result.code).toBe(0);
    expect(vi.mocked(runInstrumentCommand)).toHaveBeenCalledWith(
      "bogus-subcommand",
      expect.any(Object),
    );
  });
});
