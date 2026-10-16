/**
 * Instrument daemon client: the CLI side of the noteon / noteoff protocol.
 *
 * A CLI invocation connects to the daemon socket, sends a single
 * newline-delimited JSON message and reads one reply. When no daemon is
 * running, {@link ensureDaemon} spawns a detached one (re-running the CLI
 * entry with the internal `instrument __daemon` subcommand) and waits for it
 * to become reachable.
 *
 * Node-only (`node:net`, `node:child_process`); deliberately not exported from
 * `src/instruments/index.ts` so the web bundle stays free of Node built-ins.
 *
 * Work item: TF-0MVBECXFJ006SSW4.
 */

import { connect } from "node:net";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

import type { DaemonReply, DaemonRequest } from "./daemon.js";
import { resolveInstrumentSocketPath } from "./daemon.js";

/** Default round-trip timeout for a single message. */
export const DEFAULT_TIMEOUT_MS = 2000;

/** Default time to wait for a freshly spawned daemon to start listening. */
export const DEFAULT_SPAWN_WAIT_MS = 8000;

/** Options for {@link sendToDaemon}. */
export interface SendToDaemonOptions {
  /** Socket path (default {@link resolveInstrumentSocketPath}). */
  socketPath?: string;
  /** Round-trip timeout in milliseconds (default 2000). */
  timeoutMs?: number;
}

/**
 * Send one request to the daemon and resolve with its reply.
 *
 * @throws If the daemon is unreachable or does not reply in time.
 */
export function sendToDaemon(
  request: DaemonRequest,
  options: SendToDaemonOptions = {},
): Promise<DaemonReply> {
  const socketPath = options.socketPath ?? resolveInstrumentSocketPath();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<DaemonReply>((resolvePromise, reject) => {
    const socket = connect(socketPath);
    let buffer = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(`Timed out after ${timeoutMs} ms waiting for the instrument daemon.`));
    }, timeoutMs);

    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.end();
      action();
    };

    socket.setEncoding("utf8");
    socket.on("connect", () => {
      socket.write(`${JSON.stringify(request)}\n`);
    });
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const index = buffer.indexOf("\n");
      if (index < 0) return;
      const line = buffer.slice(0, index);
      try {
        const reply = JSON.parse(line) as DaemonReply;
        finish(() => resolvePromise(reply));
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error(String(error))));
      }
    });
    socket.on("error", (error) => {
      finish(() => reject(error));
    });
    socket.on("close", () => {
      finish(() => reject(new Error("The instrument daemon closed the connection.")));
    });
  });
}

/** Whether a daemon is currently reachable at *socketPath*. */
export async function pingDaemon(
  socketPath?: string,
  timeoutMs = 500,
): Promise<boolean> {
  try {
    const reply = await sendToDaemon({ cmd: "ping" }, { socketPath, timeoutMs });
    return reply.ok === true;
  } catch {
    return false;
  }
}

/** Spawns a detached daemon process. Injectable for tests. */
export type DaemonSpawner = (
  entryPath: string,
  socketPath: string,
  env: NodeJS.ProcessEnv,
) => void;

/** Options for {@link ensureDaemon}. */
export interface EnsureDaemonOptions {
  /** Socket path to use (default {@link resolveInstrumentSocketPath}). */
  socketPath?: string;
  /** CLI entry path to re-run as the daemon (default `process.argv[1]`). */
  entryPath?: string;
  /** Environment for the spawned daemon (default `process.env`). */
  env?: NodeJS.ProcessEnv;
  /** How long to wait for the spawned daemon (default 8000 ms). */
  waitMs?: number;
  /** Poll interval while waiting (default 50 ms). */
  pollIntervalMs?: number;
  /** Injectable ping (default {@link pingDaemon}). */
  ping?: (socketPath: string) => Promise<boolean>;
  /** Injectable spawner (default a detached `node <entry> instrument __daemon`). */
  spawnDaemon?: DaemonSpawner;
  /** Injectable sleep (default `setTimeout`). */
  sleep?: (ms: number) => Promise<void>;
}

/** The outcome of {@link ensureDaemon}. */
export interface EnsureDaemonResult {
  /** The socket path the daemon is listening on. */
  readonly socketPath: string;
  /** Whether this call spawned the daemon (false when it was already running). */
  readonly spawned: boolean;
}

/** Resolve the CLI entry script to re-run as the daemon. */
function defaultEntryPath(): string {
  const entry = process.argv[1];
  if (!entry) {
    throw new Error(
      "Cannot determine the ToneForge CLI entry path to spawn the instrument daemon.",
    );
  }
  return resolve(entry);
}

/** Default detached spawner: `node <entry> instrument __daemon`. */
const defaultSpawnDaemon: DaemonSpawner = (entryPath, socketPath, env) => {
  const child = spawn(process.execPath, [entryPath, "instrument", "__daemon"], {
    detached: true,
    stdio: "ignore",
    env: { ...env, TONEFORGE_INSTRUMENT_SOCKET: socketPath },
  });
  child.unref();
};

/**
 * Ensure a daemon is running, spawning one if necessary.
 *
 * @throws If the daemon cannot be reached within `waitMs`.
 */
export async function ensureDaemon(
  options: EnsureDaemonOptions = {},
): Promise<EnsureDaemonResult> {
  const socketPath = options.socketPath ?? resolveInstrumentSocketPath();
  const env = options.env ?? process.env;
  const ping = options.ping ?? ((path: string) => pingDaemon(path));
  const spawnDaemon = options.spawnDaemon ?? defaultSpawnDaemon;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const waitMs = options.waitMs ?? DEFAULT_SPAWN_WAIT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? 50;

  if (await ping(socketPath)) {
    return { socketPath, spawned: false };
  }

  spawnDaemon(options.entryPath ?? defaultEntryPath(), socketPath, env);

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);
    if (await ping(socketPath)) {
      return { socketPath, spawned: true };
    }
  }
  throw new Error(
    `The instrument daemon did not start within ${waitMs} ms (socket: ${socketPath}).`,
  );
}
