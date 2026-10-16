/**
 * Cross-process integration test for the instrument daemon.
 *
 * Proves the real spawn path: the CLI binary is launched detached as an
 * `instrument __daemon` process (with `TONEFORGE_INSTRUMENT_ENGINE=null` so no
 * audio device is needed), a *separate* client process persistence is
 * exercised by sending noteon / status / noteoff / stop messages and asserting
 * the daemon process holds and releases notes.
 *
 * Work item: TF-0MVBECXFJ006SSW4.
 */

import { describe, it, expect, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ensureDaemon,
  pingDaemon,
  sendToDaemon,
} from "./daemon-client.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI_ENTRY = resolve(PROJECT_ROOT, "bin/dev-cli.js");

let socketPath: string;

afterEach(async () => {
  // Best-effort cleanup: stop the daemon and remove the socket.
  try {
    await sendToDaemon({ cmd: "stop" }, { socketPath, timeoutMs: 500 });
  } catch {
    /* daemon already gone */
  }
  try {
    rmSync(socketPath, { force: true });
  } catch {
    /* ignore */
  }
});

describe("spawned instrument daemon (cross-process)", () => {
  it(
    "holds notes across client processes and releases them on noteoff",
    async () => {
      socketPath = join(
        tmpdir(),
        `toneforge-spawn-test-${process.pid}-${Math.random().toString(36).slice(2)}.sock`,
      );

      const { spawned, socketPath: path } = await ensureDaemon({
        socketPath,
        entryPath: CLI_ENTRY,
        waitMs: 15_000,
        env: {
          ...process.env,
          TONEFORGE_INSTRUMENT_ENGINE: "null",
          TONEFORGE_INSTRUMENT_IDLE_MS: "0",
        },
      });
      expect(spawned).toBe(true);
      expect(await pingDaemon(path)).toBe(true);

      // Client 1: start two notes.
      const on60 = await sendToDaemon({ cmd: "noteon", note: 60 }, { socketPath: path });
      expect(on60.ok).toBe(true);
      const on64 = await sendToDaemon({ cmd: "noteon", note: 64 }, { socketPath: path });
      expect(on64.ok).toBe(true);

      // The notes persist in the daemon process between clients.
      const status = await sendToDaemon({ cmd: "status" }, { socketPath: path });
      expect(status.notes?.map((n) => n.note).sort()).toEqual([60, 64]);

      // Client 2: release only note 60.
      const off60 = await sendToDaemon({ cmd: "noteoff", note: 60 }, { socketPath: path });
      expect(off60.ok).toBe(true);
      const after = await sendToDaemon({ cmd: "status" }, { socketPath: path });
      expect(after.notes?.map((n) => n.note)).toEqual([64]);

      // Named preset and velocity work through the wire protocol.
      const pad = await sendToDaemon(
        { cmd: "noteon", note: 67, velocity: 90, preset: "pad", length: 0.2 },
        { socketPath: path },
      );
      expect(pad).toMatchObject({ ok: true, preset: "pad", length: 0.2 });

      const stop = await sendToDaemon({ cmd: "stop" }, { socketPath: path });
      expect(stop.ok).toBe(true);

      // The daemon process exits with the socket.
      await new Promise((r) => setTimeout(r, 200));
      expect(await pingDaemon(path, 300)).toBe(false);
    },
    30_000,
  );
});
