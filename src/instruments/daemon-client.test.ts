/**
 * Tests for the instrument daemon client (`src/instruments/daemon-client.ts`).
 *
 * Covers the real socket round-trip (a daemon on a temp socket answering
 * noteon/noteoff/status), socket-path resolution, and the spawn-if-absent
 * behaviour of {@link ensureDaemon} using injected ping/spawn functions (no
 * real process is started here; the cross-process path is covered by
 * `daemon.integration.test.ts`).
 *
 * Work item: TF-0MVBECXFJ006SSW4.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

import {
  ensureDaemon,
  pingDaemon,
  sendToDaemon,
  DEFAULT_SPAWN_WAIT_MS,
} from "./daemon-client.js";
import {
  createInstrumentDaemon,
  createNullEngineFactory,
  resolveInstrumentSocketPath,
} from "./daemon.js";
import {
  registerInstrumentPreset,
  instrumentRegistry,
  loadBundledInstrumentPresets,
} from "./presets.js";
import type { InstrumentDefinition } from "./schema.js";

const TEST_PRESET = "client.pluck";

const TEST_DEFINITION: InstrumentDefinition = {
  id: TEST_PRESET,
  name: "Client Pluck",
  category: "Pluck",
  oscillator: { type: "sine" },
  envelope: { attack: 0.002, decay: 0.09, sustain: 0.12, release: 0.12 },
};

let socketPath: string;
let daemon: ReturnType<typeof createInstrumentDaemon> | null = null;

beforeEach(async () => {
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();
  registerInstrumentPreset({ definition: TEST_DEFINITION, category: "Pluck" });
  socketPath = join(tmpdir(), `toneforge-client-test-${process.pid}-${Math.random().toString(36).slice(2)}.sock`);
});

afterEach(async () => {
  if (daemon) {
    await daemon.stop("test");
    daemon = null;
  }
  try {
    rmSync(socketPath, { force: true });
  } catch {
    /* ignore */
  }
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();
});

async function startDaemon(): Promise<void> {
  daemon = createInstrumentDaemon({
    socketPath,
    createEngine: createNullEngineFactory(),
    loadPresets: async () => [],
    defaultPreset: TEST_PRESET,
    idleTimeoutMs: 0,
  });
  await daemon.start();
}

describe("resolveInstrumentSocketPath", () => {
  it("honours the TONEFORGE_INSTRUMENT_SOCKET override", () => {
    expect(resolveInstrumentSocketPath({ TONEFORGE_INSTRUMENT_SOCKET: "/tmp/custom.sock" }))
      .toBe("/tmp/custom.sock");
  });

  it("defaults to a per-user path under the temp directory", () => {
    const path = resolveInstrumentSocketPath({});
    expect(path).toContain("toneforge-instrument-");
    expect(path).toContain(tmpdir());
  });
});

describe("daemon client over a real socket", () => {
  it("returns a reply from noteon and status", async () => {
    await startDaemon();

    const on = await sendToDaemon({ cmd: "noteon", note: 60, velocity: 100 }, { socketPath });
    expect(on).toMatchObject({ ok: true, cmd: "noteon", note: 60, preset: TEST_PRESET });

    const status = await sendToDaemon({ cmd: "status" }, { socketPath });
    expect(status.ok).toBe(true);
    expect(status.notes).toHaveLength(1);
    expect(status.notes![0]).toMatchObject({ note: 60, velocity: 100, preset: TEST_PRESET });
  });

  it("round-trips a chord with only the matching note released", async () => {
    await startDaemon();
    await sendToDaemon({ cmd: "noteon", note: 60 }, { socketPath });
    await sendToDaemon({ cmd: "noteon", note: 64 }, { socketPath });
    await sendToDaemon({ cmd: "noteon", note: 67 }, { socketPath });

    const off = await sendToDaemon({ cmd: "noteoff", note: 64 }, { socketPath });
    expect(off.ok).toBe(true);

    const status = await sendToDaemon({ cmd: "status" }, { socketPath });
    expect((status.notes ?? []).map((n) => n.note).sort()).toEqual([60, 67]);
  });

  it("reports an unmatched noteoff", async () => {
    await startDaemon();
    const reply = await sendToDaemon({ cmd: "noteoff", note: 60 }, { socketPath });
    expect(reply).toMatchObject({ ok: false, code: "note_not_held" });
  });

  it("pingDaemon is true while running and false once stopped", async () => {
    await startDaemon();
    expect(await pingDaemon(socketPath)).toBe(true);
    await daemon!.stop("test");
    daemon = null;
    expect(await pingDaemon(socketPath, 200)).toBe(false);
  });

  it("sendToDaemon rejects when no daemon is listening", async () => {
    await expect(
      sendToDaemon({ cmd: "ping" }, { socketPath, timeoutMs: 200 }),
    ).rejects.toBeTruthy();
  });
});

describe("ensureDaemon", () => {
  it("does not spawn when a daemon already answers ping", async () => {
    let spawnCalls = 0;
    const result = await ensureDaemon({
      socketPath,
      ping: async () => true,
      spawnDaemon: () => { spawnCalls += 1; },
    });
    expect(result).toEqual({ socketPath, spawned: false });
    expect(spawnCalls).toBe(0);
  });

  it("spawns once and polls until the daemon answers", async () => {
    let spawnCalls = 0;
    let attempts = 0;
    const result = await ensureDaemon({
      socketPath,
      entryPath: "/fake/cli.js",
      env: { TONEFORGE_INSTRUMENT_SOCKET: socketPath, OTHER: "x" },
      ping: async () => {
        attempts += 1;
        return attempts >= 3; // reachable from the third poll
      },
      spawnDaemon: (entryPath, path, env) => {
        spawnCalls += 1;
        expect(entryPath).toBe("/fake/cli.js");
        expect(path).toBe(socketPath);
        expect(env.TONEFORGE_INSTRUMENT_SOCKET).toBe(socketPath);
        expect(env.OTHER).toBe("x");
      },
      sleep: async () => {},
      pollIntervalMs: 1,
    });
    expect(result).toEqual({ socketPath, spawned: true });
    expect(spawnCalls).toBe(1);
  });

  it("throws when the daemon never becomes reachable", async () => {
    await expect(
      ensureDaemon({
        socketPath,
        entryPath: "/fake/cli.js",
        ping: async () => false,
        spawnDaemon: () => {},
        sleep: async () => {},
        pollIntervalMs: 1,
        waitMs: 5,
      }),
    ).rejects.toThrow(/did not start within 5 ms/);
  });

  it("defaults the spawn wait to 8 seconds", () => {
    expect(DEFAULT_SPAWN_WAIT_MS).toBe(8000);
  });
});
