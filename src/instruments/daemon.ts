/**
 * Instrument daemon: a small, persistent audio service that holds MIDI notes
 * for the `toneforge instrument noteon` / `noteoff` CLI commands.
 *
 * Audio cannot survive the CLI process exiting, so a note that must keep
 * sounding until an explicit Note Off cannot live in the `noteon` invocation
 * itself. The daemon owns a real-time instrument engine and keeps it alive
 * between commands; each `noteon` / `noteoff` invocation is a thin client that
 * sends one message over a local socket.
 *
 * The daemon is Node-only (`node:net`, `node:fs`) and is deliberately **not**
 * exported from `src/instruments/index.ts`, so importing the instruments
 * barrel never pulls Node built-ins into the web bundle.
 *
 * The engine factory and clock are injectable, so the whole daemon is
 * unit-testable without a real audio device or real timers.
 *
 * Work item: TF-0MVBECXFJ006SSW4 (parent epic TF-0MVBECXFJ006SSW4).
 */

import { createServer } from "node:net";
import type { Server, Socket } from "node:net";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { InstrumentDefinition } from "./schema.js";
import { createRealtimeInstrument } from "./engine.js";
import { AudioContext } from "../audio/web-audio.js";
import {
  getInstrument,
  listInstruments,
  loadBundledInstrumentPresets,
} from "./presets.js";
import { MIDI_NOTE_MAX, MIDI_NOTE_MIN, MIDI_VELOCITY_MAX } from "./instrument.js";

/** Default note velocity when the caller does not supply one. */
export const DEFAULT_VELOCITY = 100;

/** Default instrument preset used when `--preset` is omitted. */
export const DEFAULT_PRESET = "pluck";

/** Default idle timeout before a note-less daemon shuts itself down. */
export const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

// ── Protocol ──────────────────────────────────────────────────────

/** Error codes returned by the daemon. */
export type DaemonErrorCode =
  | "bad_request"
  | "invalid_note"
  | "invalid_velocity"
  | "invalid_length"
  | "unknown_preset"
  | "note_not_held";

/** A request from a CLI client to the daemon. */
export type DaemonRequest =
  | { id?: string; cmd: "ping" }
  | { id?: string; cmd: "status" }
  | { id?: string; cmd: "stop" }
  | {
      id?: string;
      cmd: "noteon";
      note: number;
      velocity?: number;
      preset?: string;
      /** Auto Note Off after this many seconds (optional). */
      length?: number;
    }
  | { id?: string; cmd: "noteoff"; note: number };

/** A single held note as reported by `status`. */
export interface DaemonNoteInfo {
  /** MIDI note number (0–127). */
  readonly note: number;
  /** Note-on velocity (1–127). */
  readonly velocity: number;
  /** Preset id the note is sounding on. */
  readonly preset: string;
  /** Seconds the note has been held. */
  readonly heldFor: number;
  /** Scheduled auto-release in seconds, or `null` when held indefinitely. */
  readonly length: number | null;
}

/** A reply from the daemon to a CLI client. */
export interface DaemonReply {
  readonly id?: string;
  readonly ok: boolean;
  readonly cmd: DaemonRequest["cmd"];
  readonly error?: string;
  readonly code?: DaemonErrorCode;
  readonly note?: number;
  readonly velocity?: number;
  readonly preset?: string;
  readonly length?: number | null;
  readonly notes?: DaemonNoteInfo[];
  readonly instrument?: string;
  readonly availablePresets?: string[];
}

// ── Injectable engine + clock ─────────────────────────────────────

/**
 * The subset of an {@link Instrument} the daemon needs, plus an optional
 * `close` to release the audio context.
 */
export interface InstrumentEngine {
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  close?(): void;
}

/** Builds an engine for a resolved preset definition. */
export type InstrumentEngineFactory = (
  definition: InstrumentDefinition,
) => InstrumentEngine | Promise<InstrumentEngine>;

/** An injectable time source so `--length` scheduling is deterministic in tests. */
export interface DaemonClock {
  /** Current time in milliseconds. */
  now(): number;
  /** Schedule *handler* after *timeoutMs*; returns an opaque handle. */
  setTimeout(handler: () => void, timeoutMs: number): unknown;
  /** Cancel a handle previously returned by {@link setTimeout}. */
  clearTimeout(handle: unknown): void;
}

/** The default, wall-clock time source. */
export const realDaemonClock: DaemonClock = {
  now: () => Date.now(),
  setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * The default engine factory: a real-time instrument backed by a real
 * `AudioContext` (browser native, or `node-web-audio-api` in Node).
 */
export function defaultInstrumentEngineFactory(
  definition: InstrumentDefinition,
): InstrumentEngine {
  const context = new AudioContext();
  const instrument = createRealtimeInstrument(definition, { context });
  return {
    noteOn: (note, velocity) => instrument.noteOn(note, velocity),
    noteOff: (note) => instrument.noteOff(note),
    close: () => {
      void context.close();
    },
  };
}

/**
 * An engine factory that accepts every event and produces no audio.
 *
 * Used by tests (and headless/CI environments without an audio device) via
 * `TONEFORGE_INSTRUMENT_ENGINE=null`, so the full cross-process protocol can
 * be exercised without touching `node-web-audio-api`.
 */
export function createNullEngineFactory(): InstrumentEngineFactory {
  return () => ({ noteOn: () => {}, noteOff: () => {}, close: () => {} });
}

// ── Daemon ────────────────────────────────────────────────────────

/** Options for {@link createInstrumentDaemon}. */
export interface InstrumentDaemonOptions {
  /** Socket path to listen on (default {@link resolveInstrumentSocketPath}). */
  socketPath?: string;
  /** Engine factory (default {@link defaultInstrumentEngineFactory}). */
  createEngine?: InstrumentEngineFactory;
  /** Preset loader, called once (default {@link loadBundledInstrumentPresets}). */
  loadPresets?: () => Promise<string[]>;
  /** Default preset id (default {@link DEFAULT_PRESET}). */
  defaultPreset?: string;
  /** Injectable clock (default {@link realDaemonClock}). */
  clock?: DaemonClock;
  /** Idle shutdown after the last note is released; 0 disables (default 30 min). */
  idleTimeoutMs?: number;
  /** Logger for non-fatal warnings (default `console`). */
  logger?: Pick<Console, "warn" | "error">;
}

/** A running (or runnable) instrument daemon. */
export interface InstrumentDaemon {
  /** Start listening; resolves with the socket path. Idempotent. */
  start(): Promise<string>;
  /** Handle a single protocol message (no socket required). */
  handle(request: DaemonRequest): Promise<DaemonReply>;
  /** Currently held notes. */
  heldNotes(): DaemonNoteInfo[];
  /** Stop the daemon, releasing notes and closing engines. Idempotent. */
  stop(reason?: string): Promise<void>;
  /** Resolve when the daemon stops, with the shutdown reason. */
  whenStopped(): Promise<string>;
  /** The socket path, or null before {@link start}. */
  address(): string | null;
}

interface HeldNote {
  readonly velocity: number;
  readonly preset: string;
  readonly startedAt: number;
  readonly lengthMs: number | null;
  timer: unknown;
}

/**
 * Create an instrument daemon.
 *
 * The returned object does not listen until {@link InstrumentDaemon.start} is
 * called; {@link InstrumentDaemon.handle} is always available so message
 * semantics can be tested without a socket.
 */
export function createInstrumentDaemon(
  options: InstrumentDaemonOptions = {},
): InstrumentDaemon {
  const clock = options.clock ?? realDaemonClock;
  const createEngine = options.createEngine ?? defaultInstrumentEngineFactory;
  const loadPresets = options.loadPresets ?? loadBundledInstrumentPresets;
  const defaultPreset = options.defaultPreset ?? DEFAULT_PRESET;
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const logger = options.logger ?? console;

  const engines = new Map<string, InstrumentEngine>();
  const held = new Map<number, HeldNote>();

  let presetsLoaded = false;
  let running = false;
  let server: Server | null = null;
  let socketPath: string | null = options.socketPath ?? null;
  let idleTimer: unknown = null;
  let stopReason: string | null = null;
  let resolveStop: ((reason: string) => void) | null = null;
  let stopPromise: Promise<string> | null = null;

  async function ensurePresets(): Promise<void> {
    if (presetsLoaded) return;
    presetsLoaded = true;
    try {
      await loadPresets();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Instrument daemon could not load presets: ${message}`);
    }
  }

  async function getEngine(presetId: string): Promise<InstrumentEngine | null> {
    const existing = engines.get(presetId);
    if (existing) return existing;
    const preset = getInstrument(presetId);
    if (!preset) return null;
    const engine = await createEngine(preset.definition);
    engines.set(presetId, engine);
    return engine;
  }

  function clearIdle(): void {
    if (idleTimer !== null) {
      clock.clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function armIdle(): void {
    clearIdle();
    if (idleTimeoutMs > 0 && held.size === 0) {
      idleTimer = clock.setTimeout(() => {
        void stop("idle");
      }, idleTimeoutMs);
    }
  }

  function heldNotes(): DaemonNoteInfo[] {
    const now = clock.now();
    return [...held.entries()].map(([note, entry]) => ({
      note,
      velocity: entry.velocity,
      preset: entry.preset,
      heldFor: Math.max(0, (now - entry.startedAt) / 1000),
      length: entry.lengthMs === null ? null : entry.lengthMs / 1000,
    }));
  }

  async function releaseNote(note: number): Promise<boolean> {
    const entry = held.get(note);
    if (!entry) return false;
    if (entry.timer !== null) clock.clearTimeout(entry.timer);
    engines.get(entry.preset)?.noteOff(note);
    held.delete(note);
    if (held.size === 0) armIdle();
    return true;
  }

  async function handleNoteOn(
    request: Extract<DaemonRequest, { cmd: "noteon" }>,
  ): Promise<DaemonReply> {
    await ensurePresets();
    const { note, id } = request;
    const velocity = request.velocity ?? DEFAULT_VELOCITY;
    const presetId = request.preset ?? defaultPreset;
    const length = request.length;

    if (!Number.isInteger(note) || note < MIDI_NOTE_MIN || note > MIDI_NOTE_MAX) {
      return {
        id,
        ok: false,
        cmd: "noteon",
        code: "invalid_note",
        error: `note ${note} out of range ${MIDI_NOTE_MIN}–${MIDI_NOTE_MAX}.`,
      };
    }
    if (!Number.isInteger(velocity) || velocity < 1 || velocity > MIDI_VELOCITY_MAX) {
      return {
        id,
        ok: false,
        cmd: "noteon",
        code: "invalid_velocity",
        error: `velocity ${velocity} out of range 1–${MIDI_VELOCITY_MAX}.`,
      };
    }
    if (length !== undefined && (!Number.isFinite(length) || length <= 0)) {
      return {
        id,
        ok: false,
        cmd: "noteon",
        code: "invalid_length",
        error: `length ${length} must be a positive number of seconds.`,
      };
    }

    const engine = await getEngine(presetId);
    if (!engine) {
      return {
        id,
        ok: false,
        cmd: "noteon",
        code: "unknown_preset",
        error: `Unknown instrument preset '${presetId}'.`,
        availablePresets: listInstruments(),
      };
    }

    const existing = held.get(note);
    if (existing) {
      // Same-note retrigger replaces the held voice.
      if (existing.timer !== null) clock.clearTimeout(existing.timer);
      engine.noteOff(note);
    } else {
      clearIdle();
    }

    engine.noteOn(note, velocity);
    const entry: HeldNote = {
      velocity,
      preset: presetId,
      startedAt: clock.now(),
      lengthMs: length === undefined ? null : length * 1000,
      timer: null,
    };
    if (length !== undefined) {
      entry.timer = clock.setTimeout(() => {
        void releaseNote(note);
      }, length * 1000);
    }
    held.set(note, entry);

    return {
      id,
      ok: true,
      cmd: "noteon",
      note,
      velocity,
      preset: presetId,
      length: length ?? null,
    };
  }

  async function handleNoteOff(
    request: Extract<DaemonRequest, { cmd: "noteoff" }>,
  ): Promise<DaemonReply> {
    const { note, id } = request;
    if (!Number.isInteger(note) || note < MIDI_NOTE_MIN || note > MIDI_NOTE_MAX) {
      return {
        id,
        ok: false,
        cmd: "noteoff",
        code: "invalid_note",
        error: `note ${note} out of range ${MIDI_NOTE_MIN}–${MIDI_NOTE_MAX}.`,
      };
    }
    const released = await releaseNote(note);
    if (!released) {
      return {
        id,
        ok: false,
        cmd: "noteoff",
        code: "note_not_held",
        error: `Note ${note} is not currently held.`,
      };
    }
    return { id, ok: true, cmd: "noteoff", note };
  }

  async function handle(request: DaemonRequest): Promise<DaemonReply> {
    if (
      typeof request !== "object"
      || request === null
      || typeof (request as { cmd?: unknown }).cmd !== "string"
    ) {
      return { ok: false, cmd: "ping", code: "bad_request", error: "Invalid request." };
    }
    switch (request.cmd) {
      case "ping":
        return { id: request.id, ok: true, cmd: "ping" };
      case "status":
        await ensurePresets();
        return {
          id: request.id,
          ok: true,
          cmd: "status",
          instrument: defaultPreset,
          notes: heldNotes(),
        };
      case "noteon":
        return handleNoteOn(request);
      case "noteoff":
        return handleNoteOff(request);
      case "stop":
        return { id: request.id, ok: true, cmd: "stop" };
      default:
        return {
          ok: false,
          cmd: "ping",
          code: "bad_request",
          error: `Unknown command '${(request as { cmd: string }).cmd}'.`,
        };
    }
  }

  function writeLine(socket: Socket, value: unknown): void {
    socket.write(`${JSON.stringify(value)}\n`);
  }

  async function respond(socket: Socket, line: string): Promise<void> {
    let request: DaemonRequest;
    try {
      request = JSON.parse(line) as DaemonRequest;
    } catch {
      writeLine(socket, {
        ok: false,
        cmd: "ping",
        code: "bad_request",
        error: "Invalid JSON.",
      });
      return;
    }
    let reply: DaemonReply;
    try {
      reply = await handle(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply = { ok: false, cmd: request.cmd, code: "bad_request", error: message };
    }
    writeLine(socket, reply);
    if (request.cmd === "stop") {
      socket.end();
      void stop("requested");
    }
  }

  function attachSocket(socket: Socket): void {
    socket.setEncoding("utf8");
    let buffer = "";
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      let index: number;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line.length === 0) continue;
        void respond(socket, line);
      }
    });
    socket.on("error", () => {
      /* A broken client must never take the daemon down. */
    });
  }

  async function start(): Promise<string> {
    if (running && socketPath) return socketPath;
    await ensurePresets();
    const path = socketPath ?? resolveInstrumentSocketPath();
    socketPath = path;
    if (process.platform !== "win32" && existsSync(path)) {
      try {
        unlinkSync(path);
      } catch {
        /* A stale socket we cannot remove fails at listen() with a clear error. */
      }
    }
    const created = createServer((socket) => attachSocket(socket));
    await new Promise<void>((resolvePromise, reject) => {
      const onError = (error: Error): void => {
        reject(error);
      };
      created.once("error", onError);
      created.listen(path, () => {
        created.removeListener("error", onError);
        resolvePromise();
      });
    });
    server = created;
    running = true;
    armIdle();
    return path;
  }

  async function stop(reason = "stopped"): Promise<void> {
    if (stopReason !== null) {
      resolveStop?.(stopReason);
      resolveStop = null;
      return;
    }
    running = false;
    clearIdle();
    for (const [note, entry] of held) {
      if (entry.timer !== null) clock.clearTimeout(entry.timer);
      engines.get(entry.preset)?.noteOff(note);
    }
    held.clear();
    for (const engine of engines.values()) {
      try {
        engine.close?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Instrument daemon engine close failed: ${message}`);
      }
    }
    engines.clear();
    if (server) {
      await new Promise<void>((resolvePromise) => server?.close(() => resolvePromise()));
      server = null;
    }
    if (socketPath && process.platform !== "win32" && existsSync(socketPath)) {
      try {
        unlinkSync(socketPath);
      } catch {
        /* best-effort socket cleanup */
      }
    }
    stopReason = reason;
    resolveStop?.(reason);
    resolveStop = null;
  }

  return {
    start,
    handle,
    heldNotes,
    stop,
    whenStopped(): Promise<string> {
      if (stopReason !== null) return Promise.resolve(stopReason);
      if (!stopPromise) {
        stopPromise = new Promise<string>((resolvePromise) => {
          resolveStop = resolvePromise;
        });
      }
      return stopPromise;
    },
    address(): string | null {
      return running ? socketPath : null;
    },
  };
}

/**
 * Resolve the default daemon socket path.
 *
 * `TONEFORGE_INSTRUMENT_SOCKET` overrides; otherwise a per-user path under the
 * OS temp directory is used (a named pipe on Windows).
 */
export function resolveInstrumentSocketPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = env.TONEFORGE_INSTRUMENT_SOCKET?.trim();
  if (override) return override;
  const uid =
    typeof process.getuid === "function" ? String(process.getuid()) : "user";
  const name = `toneforge-instrument-${uid}.sock`;
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\${name}`;
  }
  return joinTmp(name);
}

function joinTmp(name: string): string {
  return join(tmpdir(), name);
}

