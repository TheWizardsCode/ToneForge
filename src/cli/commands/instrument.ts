/**
 * `toneforge instrument` command group: demo live MIDI note playback on the
 * playable instrument presets.
 *
 * ```text
 * toneforge instrument noteon <note> [--preset <name>] [--velocity <n>] [--length <s>]
 * toneforge instrument noteoff <note>
 * toneforge instrument status
 * toneforge instrument stop
 * toneforge instrument presets
 * ```
 *
 * A note started with `noteon` **keeps sounding until `noteoff` is sent with
 * the same note number** — even after the `noteon` process exits. Sustained
 * playback is provided by a persistent in-process daemon owned by the platform
 * (see `src/instruments/daemon.ts`); each CLI invocation is a thin client.
 *
 * Work item: TF-0MVBECXFJ006SSW4 (parent epic TF-0MV9PIBNV008C00R).
 */

import { outputError, outputInfo, outputSuccess, outputMarkdown } from "../../output.js";
import {
  createInstrumentDaemon,
  createNullEngineFactory,
  resolveInstrumentSocketPath,
  DEFAULT_PRESET,
  DEFAULT_VELOCITY,
} from "../../instruments/daemon.js";
import {
  ensureDaemon,
  sendToDaemon,
} from "../../instruments/daemon-client.js";
import {
  loadBundledInstrumentPresets,
  listInstrumentSummaries,
} from "../../instruments/presets.js";
import { MIDI_NOTE_MAX, MIDI_NOTE_MIN, MIDI_VELOCITY_MAX } from "../../instruments/instrument.js";

/** Yargs command metadata (kept in the module for discoverability/help). */
export const command = "instrument";
export const desc = "Demo live MIDI note playback on instrument presets (noteon / noteoff)";

type Flags = Record<string, string | boolean>;

function stringFlag(flags: Flags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function errorOut(jsonMode: boolean, message: string): number {
  if (jsonMode) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  } else {
    outputError(`Error: ${message}`);
  }
  return 1;
}

function printReplyError(jsonMode: boolean, error: string, available?: string[]): number {
  const suffix = available && available.length > 0
    ? ` Available presets: ${available.join(", ")}.`
    : "";
  return errorOut(jsonMode, `${error}${suffix}`);
}

/** Parse the `<note>` positional (0–127 integer). */
function parseNote(flags: Flags, jsonMode: boolean): { note: number } | { error: number } {
  const raw = stringFlag(flags, "note");
  if (raw === undefined) {
    return { error: errorOut(jsonMode, `instrument noteon requires a MIDI note number (0–${MIDI_NOTE_MAX}).`) };
  }
  const note = Number(raw);
  if (
    !Number.isInteger(note)
    || note < MIDI_NOTE_MIN
    || note > MIDI_NOTE_MAX
  ) {
    return {
      error: errorOut(
        jsonMode,
        `invalid MIDI note '${raw}': expected an integer between ${MIDI_NOTE_MIN} and ${MIDI_NOTE_MAX}.`,
      ),
    };
  }
  return { note };
}

/** Parse `--velocity` (1–127 integer, default {@link DEFAULT_VELOCITY}). */
function parseVelocity(flags: Flags, jsonMode: boolean): { velocity: number } | { error: number } {
  const raw = stringFlag(flags, "velocity");
  if (raw === undefined) return { velocity: DEFAULT_VELOCITY };
  const velocity = Number(raw);
  if (!Number.isInteger(velocity) || velocity < 1 || velocity > MIDI_VELOCITY_MAX) {
    return {
      error: errorOut(
        jsonMode,
        `invalid --velocity '${raw}': expected an integer between 1 and ${MIDI_VELOCITY_MAX}.`,
      ),
    };
  }
  return { velocity };
}

/** Parse `--length` (finite seconds > 0, optional). */
function parseLength(
  flags: Flags,
  jsonMode: boolean,
): Promise<{ length: number } | { none: true } | { error: number }> {
  const raw = stringFlag(flags, "length");
  if (raw === undefined) return Promise.resolve({ none: true });
  const length = Number(raw);
  if (!Number.isFinite(length) || length <= 0) {
    return Promise.resolve({
      error: errorOut(jsonMode, `invalid --length '${raw}': expected a positive number of seconds.`),
    });
  }
  return Promise.resolve({ length });
}

async function noteOn(flags: Flags): Promise<number> {
  const jsonMode = flags.json === true;
  const parsedNote = parseNote(flags, jsonMode);
  if ("error" in parsedNote) return parsedNote.error;
  const parsedVelocity = parseVelocity(flags, jsonMode);
  if ("error" in parsedVelocity) return parsedVelocity.error;
  const parsedLength = await parseLength(flags, jsonMode);
  if ("error" in parsedLength) return parsedLength.error;
  const note = parsedNote.note;
  const velocity = parsedVelocity.velocity;
  const length = "none" in parsedLength ? undefined : parsedLength.length;
  const preset = stringFlag(flags, "preset") ?? DEFAULT_PRESET;

  const socketPath = resolveInstrumentSocketPath();
  try {
    await ensureDaemon({ socketPath });
    const reply = await sendToDaemon(
      { cmd: "noteon", note, velocity, preset, ...(length !== undefined ? { length } : {}) },
      { socketPath },
    );
    if (!reply.ok) {
      return printReplyError(jsonMode, reply.error ?? "Instrument daemon rejected the note.", reply.availablePresets);
    }
    if (jsonMode) {
      process.stdout.write(
        `${JSON.stringify({ ok: true, command: "instrument-noteon", note, velocity, preset, length: length ?? null })}\n`,
      );
    } else {
      outputSuccess(`Holding note ${note} (${preset}) at velocity ${velocity}.`);
      if (length !== undefined) {
        outputInfo(`Note Off will be sent automatically after ${length}s.`);
      } else {
        outputInfo(`Send \`toneforge instrument noteoff ${note}\` to release it.`);
      }
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorOut(jsonMode, `cannot reach the instrument daemon: ${message}`);
  }
}

async function noteOff(flags: Flags): Promise<number> {
  const jsonMode = flags.json === true;
  const parsedNote = parseNote(flags, jsonMode);
  if ("error" in parsedNote) return parsedNote.error;
  const note = parsedNote.note;

  const socketPath = resolveInstrumentSocketPath();
  try {
    const reply = await sendToDaemon({ cmd: "noteoff", note }, { socketPath });
    if (!reply.ok) {
      if (reply.code === "note_not_held") {
        return errorOut(jsonMode, `note ${note} is not currently held.`);
      }
      return printReplyError(jsonMode, reply.error ?? "Instrument daemon rejected the Note Off.");
    }
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ ok: true, command: "instrument-noteoff", note })}\n`);
    } else {
      outputSuccess(`Released note ${note}.`);
    }
    return 0;
  } catch {
    return errorOut(
      jsonMode,
      "no instrument daemon is running. Start one with `toneforge instrument noteon <note>` first.",
    );
  }
}

async function status(flags: Flags): Promise<number> {
  const jsonMode = flags.json === true;
  const socketPath = resolveInstrumentSocketPath();
  try {
    const reply = await sendToDaemon({ cmd: "status" }, { socketPath });
    if (!reply.ok) return printReplyError(jsonMode, reply.error ?? "status failed.");
    const notes = reply.notes ?? [];
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ ok: true, command: "instrument-status", instrument: reply.instrument, notes })}\n`);
    } else if (notes.length === 0) {
      outputInfo("No notes are currently held.");
    } else {
      outputInfo(`Instrument: ${reply.instrument}`);
      for (const held of notes) {
        const auto = held.length === null ? "held" : `auto-release in ${held.length}s`;
        outputInfo(
          `  note ${held.note}  velocity ${held.velocity}  preset ${held.preset}  held ${held.heldFor.toFixed(2)}s  (${auto})`,
        );
      }
    }
    return 0;
  } catch {
    return errorOut(jsonMode, "no instrument daemon is running.");
  }
}

async function stop(flags: Flags): Promise<number> {
  const jsonMode = flags.json === true;
  const socketPath = resolveInstrumentSocketPath();
  try {
    const reply = await sendToDaemon({ cmd: "stop" }, { socketPath });
    if (!reply.ok) return printReplyError(jsonMode, reply.error ?? "stop failed.");
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ ok: true, command: "instrument-stop" })}\n`);
    } else {
      outputSuccess("Stopped the instrument daemon.");
    }
    return 0;
  } catch {
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ ok: true, command: "instrument-stop", stopped: false })}\n`);
    } else {
      outputInfo("No instrument daemon is running.");
    }
    return 0;
  }
}

async function presets(flags: Flags): Promise<number> {
  const jsonMode = flags.json === true;
  try {
    await loadBundledInstrumentPresets();
    const summaries = listInstrumentSummaries();
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ ok: true, command: "instrument-presets", presets: summaries })}\n`);
    } else {
      outputInfo(`Instrument presets (${summaries.length}):`);
      for (const summary of summaries) {
        outputInfo(`  ${summary.id.padEnd(14)} ${summary.name}  (${summary.category})`);
      }
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorOut(jsonMode, `could not load instrument presets: ${message}`);
  }
}

/**
 * Internal daemon entry: run as a long-lived service until stopped.
 *
 * Spawned detached by {@link ensureDaemon} as
 * `node <cli-entry> instrument __daemon`. Reads `TONEFORGE_INSTRUMENT_SOCKET`
 * for the socket and `TONEFORGE_INSTRUMENT_IDLE_MS` for the idle timeout
 * (0 disables). `TONEFORGE_INSTRUMENT_ENGINE=null` selects a silent engine —
 * used by headless tests and CI to exercise the protocol without an audio
 * device.
 */
async function daemonMain(flags: Flags): Promise<number> {
  const jsonMode = flags.json === true;
  const socketPath = resolveInstrumentSocketPath();
  const idleEnv = process.env.TONEFORGE_INSTRUMENT_IDLE_MS;
  const idleParsed = idleEnv === undefined ? undefined : Number.parseInt(idleEnv, 10);
  const idleTimeoutMs = Number.isFinite(idleParsed) ? idleParsed : undefined;
  const createEngine = process.env.TONEFORGE_INSTRUMENT_ENGINE === "null"
    ? createNullEngineFactory()
    : undefined;

  const daemon = createInstrumentDaemon({ socketPath, createEngine, idleTimeoutMs });
  const shutdown = (): void => {
    void daemon.stop("signal");
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  try {
    await daemon.start();
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ ok: true, daemon: "instrument", socket: socketPath })}\n`);
    } else {
      outputInfo(`Instrument daemon listening on ${socketPath}.`);
    }
    const reason = await daemon.whenStopped();
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ ok: true, stopped: true, reason })}\n`);
    } else {
      outputInfo(`Instrument daemon stopped (${reason}).`);
    }
    return 0;
  } finally {
    process.removeListener("SIGINT", shutdown);
    process.removeListener("SIGTERM", shutdown);
  }
}

function printHelp(subcommand: string | undefined): Promise<void> {
  if (subcommand === "noteon") {
    return outputMarkdown(`# ToneForge instrument noteon

**Start (and hold) a MIDI note until Note Off**

## Usage

\`\`\`
toneforge instrument noteon <note> [--preset <name>] [--velocity <n>] [--length <seconds>]
\`\`\`

## Arguments

- \`<note>\` — MIDI note number (0–127) *(required)*

## Options

- \`--preset <name>\` — Instrument preset id (default: ${DEFAULT_PRESET})
- \`--velocity <n>\` — MIDI velocity, 1–127 (default: ${DEFAULT_VELOCITY})
- \`--length <seconds>\` — Automatically send Note Off after this many seconds
- \`--json\` — Output JSON

## Behaviour

The note keeps sounding until \`toneforge instrument noteoff <note>\` is sent
with the same note number — even after this command exits (a persistent
instrument daemon provides the audio). Use \`--length\` for a one-shot note
whose Note Off is sent automatically.

## Examples

\`\`\`
toneforge instrument noteon 60
toneforge instrument noteon 60 --preset pad --velocity 90
toneforge instrument noteon 67 --preset bell --length 0.6
\`\`\``);
  }
  if (subcommand === "noteoff") {
    return outputMarkdown(`# ToneForge instrument noteoff

**Release a held MIDI note**

## Usage

\`\`\`
toneforge instrument noteoff <note>
\`\`\`

## Arguments

- \`<note>\` — MIDI note number (0–127) *(required)*

## Behaviour

Releases exactly the note with this number; other held notes are unaffected.
Sending Note Off for a note that is not held is an error (exit code 1).

## Example

\`\`\`
toneforge instrument noteon 60
toneforge instrument noteoff 60
\`\`\``);
  }
  return outputMarkdown(`# ToneForge instrument

**Demo live MIDI note playback on instrument presets**

A note started with \`noteon\` keeps sounding until \`noteoff\` is sent with the
same note number — notes are polyphonic, so chords and held drones are
supported across separate invocations.

## Subcommands

| Subcommand | Description |
|------------|-------------|
| **noteon** | Start (and hold) a MIDI note until Note Off |
| **noteoff** | Release a held MIDI note |
| **status** | List currently held notes |
| **presets** | List available instrument presets |
| **stop** | Stop the instrument daemon and release all notes |

Run \`toneforge instrument <subcommand> --help\` for subcommand-specific help.

## Examples

\`\`\`
toneforge instrument noteon 60
toneforge instrument noteon 60 --preset pad --length 1.0
toneforge instrument noteoff 60
toneforge instrument status
toneforge instrument stop
\`\`\``);
}

/** Entry point called by the CLI dispatcher. */
export async function runInstrumentCommand(
  subcommand: string | undefined,
  flags: Flags,
): Promise<number> {
  if (flags.help === true) {
    await printHelp(subcommand);
    return 0;
  }
  switch (subcommand) {
    case "noteon":
      return noteOn(flags);
    case "noteoff":
      return noteOff(flags);
    case "status":
      return status(flags);
    case "presets":
      return presets(flags);
    case "stop":
      return stop(flags);
    case "__daemon":
      return daemonMain(flags);
    case undefined: {
      await printHelp(undefined);
      return 0;
    }
    default:
      return errorOut(
        flags.json === true,
        `unknown instrument subcommand '${subcommand}'. Run 'toneforge instrument --help' for usage.`,
      );
  }
}
