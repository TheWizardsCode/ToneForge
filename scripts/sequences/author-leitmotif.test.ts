/**
 * Byte-identity test for the authoring script
 * (`scripts/sequences/author-leitmotif.ts`).
 *
 * The script is the single source of truth for `assets/music/leitmotif-*`:
 * regenerating at any time must reproduce the committed files byte for byte.
 * This is the determinism guarantee the acceptance criteria demand — a fixed,
 * fully-specified composition (no RNG) plus pinned serialisation options.
 *
 * This file also pins the percussion **arrangement** (notes, velocities and
 * ticks) to its pre-drum-kit value: re-voicing the action cue through the kit
 * must change only the track's instrument name, never the composed drum part.
 *
 * Work item: TF-0MVDQP78X007OZNA (origin), TF-0MVFQ52EE005CA37 (kit re-voice).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import Midi from "midi-file";

import {
  composeMenuBytes,
  composeActionBytes,
  MUSIC_DIR,
} from "../../scripts/sequences/author-leitmotif.js";

/** SHA-256 of the committed menu file at the pre-drum-kit baseline. */
const MENU_SHA256 = "e95786feed78ef393d345bfdac031f54b80bce1d77d780a94c4bd47d97d3032a";

/**
 * SHA-256 of the pre-drum-kit percussion arrangement, computed over the
 * sorted `[note, velocity, tick]` triples of every Note On in the percussion
 * track. Re-voicing must not alter this digest.
 */
const PERCUSSION_ARRANGEMENT_SHA256 =
  "314f89d15dc593ca364cd450e4320c56a85cfa84d451611533694ab11cc43d13";

/** The kit track name the action cue must carry. */
const KIT_TRACK_NAME = "percussion (ToneForge: drum-kit, GM ch9)";

function committed(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(MUSIC_DIR, name)));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Parse a composed MIDI file's track names. */
function trackNames(bytes: Uint8Array): string[] {
  const midi = Midi.parseMidi([...bytes]);
  return midi.tracks.map(
    (track) => track.find((event) => event.type === "trackName")?.text ?? "",
  );
}

/**
 * Extract the percussion arrangement as sorted `[note, velocity, tick]`
 * triples from the composed action bytes.
 */
function percussionArrangement(bytes: Uint8Array): Array<[number, number, number]> {
  const midi = Midi.parseMidi([...bytes]);
  const track = midi.tracks.find((candidate) =>
    candidate.some(
      (event) => event.type === "trackName" && event.text.includes("percussion"),
    ),
  );
  if (!track) {
    throw new Error("action cue has no percussion track");
  }

  let tick = 0;
  const triples: Array<[number, number, number]> = [];
  for (const event of track) {
    tick += event.deltaTime;
    if (event.type === "noteOn" && event.velocity > 0) {
      triples.push([event.noteNumber, event.velocity, tick]);
    }
  }
  triples.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
  return triples;
}

describe("author-leitmotif regeneration", () => {
  it("regenerates leitmotif-menu.mid to byte-identical output", () => {
    expect(composeMenuBytes()).toEqual(committed("leitmotif-menu.mid"));
  });

  it("regenerates leitmotif-action.mid to byte-identical output", () => {
    expect(composeActionBytes()).toEqual(committed("leitmotif-action.mid"));
  });

  it("is deterministic: two fresh compositions are byte-identical", () => {
    expect(composeMenuBytes()).toEqual(composeMenuBytes());
    expect(composeActionBytes()).toEqual(composeActionBytes());
  });

  it("composes two distinct sequences (different tempo constants)", () => {
    // The menu file must not merely be a re-serialisation of the action file.
    const menu = composeMenuBytes();
    const action = composeActionBytes();
    expect(menu).not.toEqual(action);
    expect(menu.length).toBeGreaterThan(0);
    expect(action.length).toBeGreaterThan(menu.length);
  });

  it("names the percussion track for the ToneForge drum kit", () => {
    const names = trackNames(composeActionBytes());
    expect(names).toContain(KIT_TRACK_NAME);
    expect(names.some((name) => name.includes("percussion (ToneForge: percussion"))).toBe(false);
  });

  it("preserves the pre-drum-kit percussion arrangement (notes/velocities/ticks)", () => {
    const arrangement = percussionArrangement(composeActionBytes());
    const digest = createHash("sha256").update(JSON.stringify(arrangement)).digest("hex");

    expect(
      arrangement.length,
      "the action cue's percussion hit count must not change when re-voiced",
    ).toBe(111);
    expect(arrangement[0]).toEqual([36, 110, 0]);
    expect(arrangement[arrangement.length - 1]).toEqual([42, 76, 15240]);
    expect(
      digest,
      "re-voicing through the drum kit must not re-compose the percussion part",
    ).toBe(PERCUSSION_ARRANGEMENT_SHA256);
  });

  it("leaves leitmotif-menu.mid byte-unchanged (the menu cue stays drum-free)", () => {
    expect(sha256(committed("leitmotif-menu.mid"))).toBe(MENU_SHA256);
    const names = trackNames(composeMenuBytes());
    expect(names.some((name) => name.includes("percussion"))).toBe(false);
  });
});
