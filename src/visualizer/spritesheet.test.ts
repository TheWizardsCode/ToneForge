import { describe, it, expect } from "vitest";
import { composeSpriteSheet, buildSpriteSheetMetadata } from "./spritesheet.js";
import type { EffectFrame } from "./effects.js";

/** Build a 2x1 frame filled with one colour for positional assertions. */
function solidFrame(r: number, g: number, b: number): EffectFrame {
  return {
    width: 2,
    height: 1,
    rgba: Uint8Array.from([r, g, b, 255, r, g, b, 255]),
  };
}

function pixelAt(sheet: { rgba: Uint8Array; width: number }, x: number, y: number): number[] {
  const idx = (y * sheet.width + x) * 4;
  return Array.from(sheet.rgba.subarray(idx, idx + 4));
}

describe("composeSpriteSheet", () => {
  it("packs frames into a single horizontal strip by default", () => {
    const sheet = composeSpriteSheet([solidFrame(255, 0, 0), solidFrame(0, 255, 0)]);
    expect(sheet.width).toBe(4);
    expect(sheet.height).toBe(1);
    expect(sheet.columns).toBe(2);
    expect(sheet.rows).toBe(1);
    expect(pixelAt(sheet, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(sheet, 2, 0)).toEqual([0, 255, 0, 255]);
  });

  it("wraps frames onto multiple rows when columns is limited", () => {
    const frames = [solidFrame(1, 0, 0), solidFrame(2, 0, 0), solidFrame(3, 0, 0)];
    const sheet = composeSpriteSheet(frames, 2);
    expect(sheet.width).toBe(4);
    expect(sheet.height).toBe(2);
    expect(sheet.rows).toBe(2);
    expect(pixelAt(sheet, 0, 0)).toEqual([1, 0, 0, 255]);
    expect(pixelAt(sheet, 2, 0)).toEqual([2, 0, 0, 255]);
    // Third frame wraps to the second row, first column.
    expect(pixelAt(sheet, 0, 1)).toEqual([3, 0, 0, 255]);
  });

  it("rejects empty input, mismatched dimensions, and invalid columns", () => {
    expect(() => composeSpriteSheet([])).toThrow(RangeError);
    expect(() =>
      composeSpriteSheet([
        solidFrame(1, 2, 3),
        { width: 3, height: 1, rgba: new Uint8Array(12) },
      ]),
    ).toThrow(RangeError);
    expect(() => composeSpriteSheet([solidFrame(1, 2, 3)], 0)).toThrow(RangeError);
  });
});

describe("buildSpriteSheetMetadata", () => {
  it("describes a deterministic left-to-right, top-to-bottom grid", () => {
    const frames = [solidFrame(1, 0, 0), solidFrame(2, 0, 0), solidFrame(3, 0, 0)];
    const sheet = composeSpriteSheet(frames, 2);
    const meta = buildSpriteSheetMetadata(sheet);
    expect(meta).toMatchObject({
      frameWidth: 2,
      frameHeight: 1,
      frameCount: 3,
      columns: 2,
      rows: 2,
    });
    expect(meta.frames).toEqual([
      { index: 0, x: 0, y: 0 },
      { index: 1, x: 2, y: 0 },
      { index: 2, x: 0, y: 1 },
    ]);
  });
});
