/**
 * Unit tests for the instrument daemon (`src/instruments/daemon.ts`).
 *
 * The daemon is the persistent service that keeps a Note On sounding until the
 * matching Note Off — the core of the sustained cross-process playback the CLI
 * build on. All tests drive {@link InstrumentDaemon.handle} directly with an
 * injectable *recording* engine and a fake clock, so no socket and no audio
 * device are needed.
 *
 * Work item: TF-0MVBECXFJ006SSW4.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { InstrumentEngineFactory } from "./daemon.js";
import { createInstrumentDaemon, DEFAULT_PRESET } from "./daemon.js";
import {
  registerInstrumentPreset,
  instrumentRegistry,
  loadBundledInstrumentPresets,
} from "./presets.js";
import type { InstrumentDefinition } from "./schema.js";

const TEST_PRESET = "test.pluck";

const TEST_DEFINITION: InstrumentDefinition = {
  id: TEST_PRESET,
  name: "Test Pluck",
  category: "Pluck",
  oscillator: { type: "triangle" },
  envelope: { attack: 0.002, decay: 0.09, sustain: 0.12, release: 0.12 },
};

interface RecordedEvent {
  readonly type: "noteOn" | "noteOff" | "close";
  readonly note: number;
  readonly velocity?: number;
  readonly at: number;
}

/** Injectable engine factory that records every call, with an injectable now(). */
function recordingEngineFactory(
  events: RecordedEvent[],
  now: () => number,
): InstrumentEngineFactory {
  return () => ({
    noteOn: (note, velocity) => {
      events.push({ type: "noteOn", note, velocity, at: now() });
    },
    noteOff: (note) => {
      events.push({ type: "noteOff", note, at: now() });
    },
    close: () => {
      events.push({ type: "close", note: 0, at: now() });
    },
  });
}

/** A deterministic fake clock that satisfies {@link DaemonClock}. */
function createFakeClock(startMs = 0) {
  let now = startMs;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    setTimeout: (fn: () => void, ms: number): number => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (handle: unknown): void => {
      timers.delete(handle as number);
    },
    advance: (ms: number): void => {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
    elapsed: () => now,
  };
}

type FakeClock = ReturnType<typeof createFakeClock>;

async function restoreRegistry(): Promise<void> {
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();
}

describe("instrument daemon", () => {
  let events: RecordedEvent[];
  let clock: FakeClock;
  let daemon: ReturnType<typeof createInstrumentDaemon>;

  beforeEach(async () => {
    await restoreRegistry();
    registerInstrumentPreset({ definition: TEST_DEFINITION, category: "Pluck" });
    events = [];
    clock = createFakeClock(1000);
  });

  afterEach(async () => {
    await daemon?.stop("test-cleanup");
    daemon = undefined as unknown as ReturnType<typeof createInstrumentDaemon>;
    await restoreRegistry();
  });

  function makeDaemon(idleTimeoutMs = 0) {
    daemon = createInstrumentDaemon({
      socketPath: `/tmp/toneforge-test-${Math.random().toString(36).slice(2)}.sock`,
      createEngine: recordingEngineFactory(events, clock.now),
      loadPresets: async () => [],
      defaultPreset: TEST_PRESET,
      clock,
      idleTimeoutMs,
    });
    return daemon;
  }

  it("holds a note on noteon until the matching noteoff", async () => {
    const d = makeDaemon();

    const on = await d.handle({ cmd: "noteon", note: 60, velocity: 100 });
    expect(on.ok).toBe(true);
    expect(events).toEqual([
      { type: "noteOn", note: 60, velocity: 100, at: 1000 },
    ]);

    // The note is still held immediately after noteon.
    const status = await d.handle({ cmd: "status" });
    expect(status.ok).toBe(true);
    expect(status.notes).toHaveLength(1);
    expect(status.notes![0]).toMatchObject({ note: 60, velocity: 100, preset: TEST_PRESET });

    const off = await d.handle({ cmd: "noteoff", note: 60 });
    expect(off.ok).toBe(true);
    expect(events).toEqual([
      { type: "noteOn", note: 60, velocity: 100, at: 1000 },
      { type: "noteOff", note: 60, at: 1000 },
    ]);

    const after = await d.handle({ cmd: "status" });
    expect(after.notes).toHaveLength(0);
  });

  it("releases only the note with the matching number (chord)", async () => {
    const d = makeDaemon();
    await d.handle({ cmd: "noteon", note: 60 });
    await d.handle({ cmd: "noteon", note: 64 });
    await d.handle({ cmd: "noteon", note: 67 });

    const off = await d.handle({ cmd: "noteoff", note: 64 });
    expect(off.ok).toBe(true);

    const status = await d.handle({ cmd: "status" });
    const notes = (status.notes ?? []).map((n) => n.note).sort();
    expect(notes).toEqual([60, 67]);

    const offEvents = events.filter((e) => e.type === "noteOff");
    expect(offEvents).toEqual([{ type: "noteOff", note: 64, at: 1000 }]);
  });

  it("rejects a noteoff for a note that is not held", async () => {
    const d = makeDaemon();
    const reply = await d.handle({ cmd: "noteoff", note: 60 });
    expect(reply.ok).toBe(false);
    expect(reply.code).toBe("note_not_held");
    expect(reply.error).toContain("60");
  });

  it("auto-sends noteoff after --length and at the scheduled time", async () => {
    const d = makeDaemon();

    const on = await d.handle({ cmd: "noteon", note: 67, velocity: 90, length: 0.5 });
    expect(on.ok).toBe(true);
    expect(events).toHaveLength(1);

    clock.advance(499);
    expect(await d.handle({ cmd: "status" })).toMatchObject({ notes: [{ note: 67 }] });

    clock.advance(1);
    // The auto Note Off timer fires at +500 ms.
    await new Promise((r) => setTimeout(r, 0));
    expect(events.filter((e) => e.type === "noteOff")).toEqual([
      { type: "noteOff", note: 67, at: 1500 },
    ]);
    const status = await d.handle({ cmd: "status" });
    expect(status.notes).toHaveLength(0);

    // A second Note Off is now unmatched.
    const off = await d.handle({ cmd: "noteoff", note: 67 });
    expect(off.ok).toBe(false);
    expect(off.code).toBe("note_not_held");
  });

  it("cancels a scheduled auto noteoff when noteoff arrives first", async () => {
    const d = makeDaemon();
    await d.handle({ cmd: "noteon", note: 60, length: 2 });
    await d.handle({ cmd: "noteoff", note: 60 });

    clock.advance(3000);
    await new Promise((r) => setTimeout(r, 0));
    const offEvents = events.filter((e) => e.type === "noteOff");
    expect(offEvents).toHaveLength(1); // only the manual one
    expect(await d.handle({ cmd: "status" })).toMatchObject({ notes: [] });
  });

  it("rejects invalid notes, velocities and lengths with clear codes", async () => {
    const d = makeDaemon();

    const badNote = await d.handle({ cmd: "noteon", note: 128 });
    expect(badNote).toMatchObject({ ok: false, code: "invalid_note" });

    const badVelocity = await d.handle({ cmd: "noteon", note: 60, velocity: 0 });
    expect(badVelocity).toMatchObject({ ok: false, code: "invalid_velocity" });

    const highVelocity = await d.handle({ cmd: "noteon", note: 60, velocity: 200 });
    expect(highVelocity).toMatchObject({ ok: false, code: "invalid_velocity" });

    const badLength = await d.handle({ cmd: "noteon", note: 60, length: -1 });
    expect(badLength).toMatchObject({ ok: false, code: "invalid_length" });

    expect(events).toHaveLength(0);
  });

  it("rejects an unknown preset and lists the available presets", async () => {
    const d = makeDaemon();
    const reply = await d.handle({ cmd: "noteon", note: 60, preset: "nope" });
    expect(reply.ok).toBe(false);
    expect(reply.code).toBe("unknown_preset");
    expect(reply.error).toContain("nope");
    expect(reply.availablePresets).toContain(TEST_PRESET);
    expect(events).toHaveLength(0);
  });

  it("retriggers a note that is already sounding (replaces the voice)", async () => {
    const d = makeDaemon();
    await d.handle({ cmd: "noteon", note: 60, velocity: 60 });
    const retrigger = await d.handle({ cmd: "noteon", note: 60, velocity: 110 });
    expect(retrigger.ok).toBe(true);

    expect(events).toEqual([
      { type: "noteOn", note: 60, velocity: 60, at: 1000 },
      { type: "noteOff", note: 60, at: 1000 },
      { type: "noteOn", note: 60, velocity: 110, at: 1000 },
    ]);
  });

  it("uses the configured default preset and default velocity", async () => {
    const d = makeDaemon();
    const reply = await d.handle({ cmd: "noteon", note: 60 });
    expect(reply).toMatchObject({ ok: true, preset: TEST_PRESET, velocity: 100 });
  });

  it("stop releases every held note and closes every engine", async () => {
    const d = makeDaemon();
    await d.handle({ cmd: "noteon", note: 60 });
    await d.handle({ cmd: "noteon", note: 64 });

    await d.stop("test");
    const notes = events.filter((e) => e.type === "noteOff").map((e) => e.note).sort();
    expect(notes).toEqual([60, 64]);
    expect(events.filter((e) => e.type === "close")).toHaveLength(1);
    expect(await d.handle({ cmd: "status" })).toMatchObject({ notes: [] });
  });

  it("shuts itself down after the idle timeout once no notes are held", async () => {
    clock = createFakeClock(0);
    const d = makeDaemon(100);
    await d.handle({ cmd: "noteon", note: 60 });
    await d.handle({ cmd: "noteoff", note: 60 });

    clock.advance(99);
    let stopped: string | null = null;
    void d.whenStopped().then((reason) => { stopped = reason; });
    await new Promise((r) => setTimeout(r, 0));
    expect(stopped).toBeNull();

    clock.advance(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(stopped).toBe("idle");
  });

  it("ping replies ok", async () => {
    const d = makeDaemon();
    await expect(d.handle({ cmd: "ping" })).resolves.toMatchObject({ ok: true });
  });
});

describe("instrument daemon constants", () => {
  it("defaults the preset to pluck", () => {
    expect(DEFAULT_PRESET).toBe("pluck");
  });
});
