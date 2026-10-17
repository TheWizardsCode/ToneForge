/**
 * `toneforge instrument` command group: demo live MIDI note playback on the
 * playable instrument presets.
 *
 * ```text
 * toneforge instrument noteon <note> [--preset <name>] [--velocity <n>] [--length <s>]
 * toneforge instrument noteoff <note>
 * toneforge instrument play <file.mid> [--preset <name>] [--output <file.wav>] [--fallback]
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

import { outputError, outputInfo, outputSuccess, outputMarkdown, outputWarning } from "../../output.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { encodeWav } from "../../audio/wav-encoder.js";
import { playAudio } from "../../audio/player.js";
import { renderNoteOffline, DEFAULT_NOTE_HOLD_SECONDS, resolveInstrumentDefinition } from "../../instruments/offline-demo.js";
import {
  createInstrumentDaemon,
  createNullEngineFactory,
  resolveInstrumentSocketPath,
  DEFAULT_PRESET,
  DEFAULT_VELOCITY,
} from "../../instruments/daemon.js";
import { renderInstrument, ENGINE_SAMPLE_RATE, type InstrumentEvent } from "../../instruments/engine.js";
import { parseMidiToInstrumentEvents } from "../../midi/translate.js";
import {
  ensureDaemon,
  sendToDaemon,
} from "../../instruments/daemon-client.js";
import {
  loadBundledInstrumentPresets,
  listInstrumentSummaries,
  listInstruments,
} from "../../instruments/presets.js";
import {
  buildNoAudioDeviceHint,
  buildNoAudioDeviceMessage,
  type AudioEnvironment,
} from "../../instruments/audio-probe.js";
import { MIDI_NOTE_MAX, MIDI_NOTE_MIN, MIDI_VELOCITY_MAX } from "../../instruments/instrument.js";

/** Yargs command metadata (kept in the module for discoverability/help). */
export const command = "instrument";
export const desc = "Demo live MIDI note playback on instrument presets (noteon / noteoff / play)";

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

/**
 * The actionable error shown when a sustained note is requested but no live
 * audio device is available (WSL, container, headless).
 */
function noAudioDeviceError(
  jsonMode: boolean,
  environment: AudioEnvironment | undefined,
  note: number,
): number {
  const resolved = environment ?? "unknown";
  const message = buildNoAudioDeviceMessage(resolved, note);
  if (jsonMode) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        command: "instrument-noteon",
        code: "no_audio_device",
        environment: resolved,
        audioDeviceAvailable: false,
        error: message,
      })}\n`,
    );
    return 1;
  }
  outputError(`Error: ${message}`);
  return 1;
}

/**
 * The actionable no-device error for `instrument play`.
 *
 * Mirrors the `noteon` message (naming the environment and suggesting
 * `--output` / `--fallback`) but references the file being played so the user
 * can recover with the exact command.
 */
function playNoAudioDeviceError(
  jsonMode: boolean,
  environment: AudioEnvironment | undefined,
  file: string,
): number {
  const resolved = environment ?? "unknown";
  const prefix = resolved === "wsl"
    ? "WSL detected — no live audio device is available."
    : "No live audio device is available on this system.";
  const message = [
    prefix,
    "Choose an offline alternative:",
    `  - render the file to a WAV you can play elsewhere: toneforge instrument play ${file} --output note.wav`,
    `  - play via an offline pre-render (playback starts after a short render delay): toneforge instrument play ${file} --fallback`,
  ].join("\n");
  if (jsonMode) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        command: "instrument-play",
        code: "no_audio_device",
        environment: resolved,
        audioDeviceAvailable: false,
        error: message,
      })}\n`,
    );
    return 1;
  }
  outputError(`Error: ${message}`);
  return 1;
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

interface OfflineNoteOnArgs {
  jsonMode: boolean;
  note: number;
  velocity: number;
  preset: string;
  length: number | undefined;
  output: string | undefined;
  fallback: boolean;
}

/**
 * Offline path for `noteon --output <file.wav>` and `noteon --fallback`.
 *
 * Renders the note through `renderInstrument` (no audio device required) and
 * either writes a WAV or plays it through the platform's system player — the
 * same path `tf generate` uses — so it is audible on machines (WSL, headless)
 * where the real-time daemon cannot open an output device.
 */
async function noteOnOffline(args: OfflineNoteOnArgs): Promise<number> {
  const { jsonMode, note, velocity, preset, length, output, fallback } = args;
  if (output !== undefined && fallback) {
    return errorOut(jsonMode, "--output and --fallback cannot be combined. Choose one.");
  }
  try {
    await loadBundledInstrumentPresets();
    const rendered = await renderNoteOffline({
      note,
      velocity,
      presetId: preset,
      holdSeconds: length,
    });

    if (output !== undefined) {
      const target = resolve(output);
      await mkdir(dirname(target), { recursive: true });
      const wav = encodeWav(rendered.samples, { sampleRate: rendered.sampleRate });
      await writeFile(target, wav);
      if (jsonMode) {
        process.stdout.write(
          `${JSON.stringify({
            ok: true,
            command: "instrument-noteon",
            note,
            velocity,
            preset,
            length: length ?? null,
            file: target,
            sampleRate: rendered.sampleRate,
            duration: Number(rendered.duration.toFixed(3)),
          })}\n`,
        );
      } else {
        outputSuccess(`Wrote ${target} (${rendered.duration.toFixed(3)}s, ${rendered.sampleRate} Hz).`);
        outputInfo(`Play it later with \`toneforge play ${output}\`.`);
      }
      return 0;
    }

    // fallback: pre-render then play via the system player (introduces a
    // short render start delay — documented in the help text).
    await playAudio(rendered.samples, { sampleRate: rendered.sampleRate });
    if (jsonMode) {
      process.stdout.write(
        `${JSON.stringify({
          ok: true,
          command: "instrument-noteon",
          note,
          velocity,
          preset,
          length: length ?? null,
          fallback: true,
          sampleRate: rendered.sampleRate,
          duration: Number(rendered.duration.toFixed(3)),
        })}\n`,
      );
    } else {
      outputSuccess(`Played note ${note} (${preset}) via offline pre-render (${rendered.duration.toFixed(3)}s).`);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorOut(jsonMode, message);
  }
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

  const output = stringFlag(flags, "output");
  if (output !== undefined || flags.fallback === true) {
    return noteOnOffline({
      jsonMode,
      note,
      velocity,
      preset,
      length,
      output,
      fallback: flags.fallback === true,
    });
  }

  const socketPath = resolveInstrumentSocketPath();
  try {
    await ensureDaemon({ socketPath });
    const reply = await sendToDaemon(
      { cmd: "noteon", note, velocity, preset, ...(length !== undefined ? { length } : {}) },
      { socketPath },
    );
    if (!reply.ok) {
      if (reply.code === "no_audio_device") {
        return noAudioDeviceError(jsonMode, reply.environment, note);
      }
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
    const environment = reply.environment ?? "unknown";
    const audioDeviceAvailable = reply.audioDeviceAvailable !== false;
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ ok: true, command: "instrument-status", instrument: reply.instrument, environment, audioDeviceAvailable, notes })}\n`);
    } else {
      if (!audioDeviceAvailable) {
        outputWarning(buildNoAudioDeviceHint(environment));
        outputInfo("Use `--output <file.wav>` to render a WAV, or `--fallback` to play via an offline pre-render (playback starts after a short render delay).");
      }
      if (notes.length === 0) {
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

// ── play <file.mid> ──────────────────────────────────────────────

interface PlayArgs {
  jsonMode: boolean;
  file: string;
  preset: string;
  events: InstrumentEvent[];
  output: string | undefined;
  fallback: boolean;
}

/**
 * Shared `play` implementation for the offline modes (`--output` / `--fallback`).
 *
 * Renders the merged MIDI event stream through `renderInstrument` at the pinned
 * 44100 Hz (no audio device needed) and either writes a deterministic WAV or
 * plays it through the system player — the same device-free pattern as
 * `noteon --output` / `--fallback`, applied to a whole `.mid` file.
 */
async function playOffline(args: PlayArgs): Promise<number> {
  const { jsonMode, file, preset, events, output, fallback } = args;
  if (output !== undefined && fallback) {
    return errorOut(jsonMode, "--output and --fallback cannot be combined. Choose one.");
  }
  try {
    await loadBundledInstrumentPresets();
    const definition = resolveInstrumentDefinition(preset);
    if (!definition) {
      return printReplyError(jsonMode, `Unknown instrument preset '${preset}'.`, listInstruments());
    }
    const rendered = await renderInstrument(definition, events, {
      sampleRate: ENGINE_SAMPLE_RATE,
    });

    if (output !== undefined) {
      const target = resolve(output);
      await mkdir(dirname(target), { recursive: true });
      const wav = encodeWav(rendered.samples, { sampleRate: rendered.sampleRate });
      await writeFile(target, wav);
      if (jsonMode) {
        process.stdout.write(
          `${JSON.stringify({
            ok: true,
            command: "instrument-play",
            file: target,
            preset,
            noteEvents: events.length,
            sampleRate: rendered.sampleRate,
            duration: Number(rendered.duration.toFixed(3)),
          })}\n`,
        );
      } else {
        outputSuccess(`Wrote ${target} (${rendered.duration.toFixed(3)}s, ${rendered.sampleRate} Hz).`);
        outputInfo(`Play the rendered file with \`toneforge play ${output}\`.`);
      }
      return 0;
    }

    // fallback: pre-render then play via the system player.
    await playAudio(rendered.samples, { sampleRate: rendered.sampleRate });
    if (jsonMode) {
      process.stdout.write(
        `${JSON.stringify({
          ok: true,
          command: "instrument-play",
          file,
          preset,
          noteEvents: events.length,
          fallback: true,
          sampleRate: rendered.sampleRate,
          duration: Number(rendered.duration.toFixed(3)),
        })}\n`,
      );
    } else {
      outputSuccess(`Played ${file} (${preset}) via offline pre-render (${rendered.duration.toFixed(3)}s).`);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorOut(jsonMode, message);
  }
}

/**
 * Real-time `play` path: stream the file's note events through the instrument
 * daemon (which owns a real-time audio engine via `createRealtimeInstrument`).
 *
 * Each Note On is sent at its tempo-map onset (delay-scheduled from the first
 * event) with an **auto-release length** derived from the file's own Note Off
 * events, so the melody's rhythm is preserved and notes are released by the
 * daemon at exactly the moment the composer intended. On machines without a
 * live audio device the daemon rejects the first note with the same actionable
 * message as `noteon` (naming the environment and suggesting
 * `--output` / `--fallback`).
 */
async function playRealtime(args: PlayArgs): Promise<number> {
  const { jsonMode, file, preset, events } = args;
  const socketPath = resolveInstrumentSocketPath();
  try {
    await ensureDaemon({ socketPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorOut(jsonMode, `cannot reach the instrument daemon: ${message}`);
  }

  // Map each note to its upcoming Note Off times (from the merged stream).
  const noteOffs = new Map<number, number[]>();
  for (const event of events) {
    if (event.type === "midiNoteOff") {
      const list = noteOffs.get(event.note) ?? [];
      list.push(event.time);
      noteOffs.set(event.note, list);
    }
  }
  for (const times of noteOffs.values()) times.sort((a, b) => a - b);

  const onsets = events.filter((event) => event.type === "midiNoteOn");
  const startTime = onsets.length > 0 ? onsets[0]!.time : 0;
  const startedAt = Date.now();

  for (const event of onsets) {
    // Preserve the file's rhythm: wait until this onset relative to the first.
    const delayMs = Math.max(0, (event.time - startTime) * 1000 - (Date.now() - startedAt));
    if (delayMs > 0) {
      await new Promise((resolveWait) => setTimeout(resolveWait, delayMs));
    }
    // Auto-release after the matching Note Off; fall back to the default hold
    // when the file never releases this note.
    const offTime = noteOffs.get(event.note)?.shift();
    const length = offTime !== undefined
      ? Math.max(0, offTime - event.time)
      : DEFAULT_NOTE_HOLD_SECONDS;
    const reply = await sendToDaemon(
      { cmd: "noteon", note: event.note, velocity: event.velocity, preset, length },
      { socketPath },
    );
    if (!reply.ok) {
      if (reply.code === "no_audio_device") {
        return playNoAudioDeviceError(jsonMode, reply.environment, file);
      }
      return printReplyError(jsonMode, reply.error ?? "Instrument daemon rejected the note.", reply.availablePresets);
    }
  }
  if (jsonMode) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        command: "instrument-play",
        file,
        preset,
        eventCount: onsets.length,
        realtime: true,
      })}\n`,
    );
  } else {
    outputSuccess(`Streaming ${file} (${preset}) to the real-time instrument daemon.`);
  }
  return 0;
}

/**
 * `instrument play <file.mid>`: parse the SMF with the shipped MIDI import and
 * play it through the instruments engine — offline (`--output` / `--fallback`)
 * or streamed live through the real-time daemon (default).
 */
async function play(flags: Flags): Promise<number> {
  const jsonMode = flags.json === true;
  const file = stringFlag(flags, "file");
  if (file === undefined) {
    return errorOut(jsonMode, "instrument play requires a MIDI file path (<file.mid>).");
  }
  const preset = stringFlag(flags, "preset") ?? DEFAULT_PRESET;
  const output = stringFlag(flags, "output");

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(file));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorOut(jsonMode, `cannot read MIDI file '${file}': ${message}`);
  }

  let events: InstrumentEvent[];
  try {
    events = parseMidiToInstrumentEvents(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorOut(jsonMode, `invalid MIDI file '${file}': ${message}`);
  }
  if (events.length === 0) {
    return errorOut(jsonMode, `no note events found in '${file}'.`);
  }

  const args: PlayArgs = { jsonMode, file, preset, events, output, fallback: flags.fallback === true };
  if (output !== undefined || args.fallback) {
    return playOffline(args);
  }
  return playRealtime(args);
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

**Record or play a MIDI note with no live audio device required**

## Usage

\`\`\`
toneforge instrument noteon <note> [--preset <name>] [--velocity <n>] [--length <seconds>]
toneforge instrument noteon <note> [--preset <name>] [--velocity <n>] [--length <seconds>] --output <file.wav>
toneforge instrument noteon <note> [--preset <name>] [--velocity <n>] [--length <seconds>] --fallback
\`\`\`

## Arguments

- \`<note>\` — MIDI note number (0–127) *(required)*

## Options

- \`--preset <name>\` — Instrument preset id (default: ${DEFAULT_PRESET})
- \`--velocity <n>\` — MIDI velocity, 1–127 (default: ${DEFAULT_VELOCITY})
- \`--length <seconds>\` — Note On → Note Off hold (default: ${DEFAULT_NOTE_HOLD_SECONDS}s for the offline modes)
- \`--output <file.wav>\` — **offline**: render the note to a WAV file (no audio device needed)
- \`--fallback\` — **offline**: pre-render the note and play it via the system player
- \`--json\` — Output JSON

## Behaviour

Default (no \`--output\`/\`--fallback\`): starts a real-time note that keeps
sounding until \`toneforge instrument noteoff <note>\` (needs a live audio
device). With \`--length\`, a Note Off is sent automatically.

**No live audio device detected** (WSL, containers, headless machines): the
command exits with a clear message naming the environment and suggesting
\`--output\` or \`--fallback\` — no raw audio-driver traceback is printed.

**Offline modes** work on machines with no live audio device (WSL, headless,
containers): the note is rendered deterministically through the engine and
written to a file, or played back through the system player
(\`--fallback\`) — playback then starts after a short pre-render delay.
Without \`--length\` the note holds for ${DEFAULT_NOTE_HOLD_SECONDS}s before
Note Off. \`--output\` and \`--fallback\` cannot be combined.

## Examples

\`\`\`
toneforge instrument noteon 60
toneforge instrument noteon 60 --preset pad --velocity 90
toneforge instrument noteon 67 --preset bell --length 0.6 --output chime.wav
toneforge instrument noteon 60 --length 0.6 --fallback
toneforge instrument noteoff 60
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
  if (subcommand === "play") {
    return outputMarkdown(`# ToneForge instrument play

**Play a Standard MIDI File (\`.mid\`) through the instruments engine**

## Usage

\`\`\`
toneforge instrument play <file.mid> [--preset <name>] [--output <file.wav>] [--fallback] [--json]
\`\`\`

## Arguments

- \`<file.mid>\` — Path to a Standard MIDI File (SMF) *(required)*

## Options

- \`--preset <name>\` — Instrument preset id (default: ${DEFAULT_PRESET}), same registry as \`noteon\`
- \`--output <file.wav>\` — **offline**: render the whole file deterministically to a WAV (no audio device needed; works headless/WSL/containers)
- \`--fallback\` — **offline**: pre-render the file and play it via the system player (playback starts after a short render delay)
- \`--json\` — Output JSON

## Behaviour

The file is parsed with the shipped MIDI import (\`src/midi/smf.ts\` +
\`src/midi/translate.ts\`, TF-0MVBDU0RM007QTNR) and its note events are merged
into one deterministic stream: delta times are resolved through the tempo map
(PPQ ticks → seconds, tempo changes honoured) and multi-track files are merged
sorted by absolute time (release-before-retrigger tie-break). An invalid or
unreadable file produces a clear error and a non-zero exit — no stack trace.

- **\`--output\`**: renders the merged stream through \`renderInstrument\` at a
  pinned 44100 Hz and writes a valid WAV — same file + same preset ⇒
  byte-identical output (platform determinism guarantee).
- **\`--fallback\`**: renders offline and plays the WAV via the system player
  (the \`tf play\` path — works on WSL/headless machines).
- **Default (no \`--output\`/\`--fallback\`)**: streams the note events through
  the real-time instrument daemon (needs a live audio device). On machines
  without one, the error is the same actionable message as \`noteon\`, naming
  the environment and suggesting \`--output\` / \`--fallback\`.

\`--output\` and \`--fallback\` cannot be combined.

## Examples

\`\`\`
toneforge instrument play song.mid
toneforge instrument play song.mid --output song.wav
toneforge instrument play song.mid --preset pad --output pad.wav
toneforge instrument play song.mid --fallback
toneforge instrument play song.mid --json
\`\`\``);
  }
  return outputMarkdown(`# ToneForge instrument

**Demo live MIDI note playback on instrument presets**

A note started with \`noteon\` keeps sounding until \`noteoff\` is sent with the
same note number — notes are polyphonic, so chords and held drones are
supported across separate invocations. On machines without a live audio device
(WSL, containers, headless), \`noteon\` (no \`--output\`/\`--fallback\`) fails
with an actionable message naming the environment and suggesting the offline
alternatives. \`play\` plays a Standard MIDI File (\`.mid\`) through the same
engine — offline to a WAV (\`--output\`), via the system player (\`--fallback\`)
or live through the daemon (default).

## Subcommands

| Subcommand | Description |
|------------|-------------|
| **noteon** | Start (and hold) a MIDI note until Note Off |
| **noteoff** | Release a held MIDI note |
| **play** | Play a Standard MIDI File (\`.mid\`) through the instruments engine (offline WAV render or live playback) |
| **status** | List currently held notes |
| **presets** | List available instrument presets |
| **stop** | Stop the instrument daemon and release all notes |

Run \`toneforge instrument <subcommand> --help\` for subcommand-specific help.

## Examples

\`\`\`
toneforge instrument noteon 60
toneforge instrument noteon 60 --preset pad --length 1.0
toneforge instrument noteoff 60
toneforge instrument play melody.mid --output melody.wav
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
    case "play":
      return play(flags);
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
