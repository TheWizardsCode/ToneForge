/**
 * Byte-identity test for the authoring script
 * (`scripts/sequences/author-leitmotif.ts`).
 *
 * The script is the single source of truth for `assets/music/leitmotif-*`:
 * regenerating at any time must reproduce the committed files byte for byte.
 * This is the determinism guarantee the acceptance criteria demand — a fixed,
 * fully-specified composition (no RNG) plus pinned serialisation options.
 *
 * Work item: TF-0MVDQP78X007OZNA.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  composeMenuBytes,
  composeActionBytes,
  MUSIC_DIR,
} from "../../scripts/sequences/author-leitmotif.js";

function committed(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(MUSIC_DIR, name)));
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
});
