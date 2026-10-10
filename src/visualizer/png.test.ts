import { describe, it, expect } from "vitest";
import { inflateSync } from "node:zlib";
import { encodePng } from "./png.js";

/** Minimal PNG reader used to verify the encoder produces valid, decodable bytes. */
function decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8; // skip signature
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];

  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    offset += 4;
    const type = String.fromCharCode(
      bytes[offset]!,
      bytes[offset + 1]!,
      bytes[offset + 2]!,
      bytes[offset + 3]!,
    );
    offset += 4;
    const data = bytes.subarray(offset, offset + length);
    offset += length + 4; // skip CRC

    if (type === "IHDR") {
      const ihdr = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = ihdr.getUint32(0);
      height = ihdr.getUint32(4);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  const total = idat.reduce((n, part) => n + part.length, 0);
  const compressed = new Uint8Array(total);
  let pos = 0;
  for (const part of idat) {
    compressed.set(part, pos);
    pos += part.length;
  }

  const raw = new Uint8Array(inflateSync(compressed));
  const stride = width * 4;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    expect(filter).toBe(0);
    rgba.set(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride), y * stride);
  }
  return { width, height, rgba };
}

describe("encodePng", () => {
  it("writes the PNG signature", () => {
    const png = encodePng(1, 1, new Uint8Array([255, 0, 0, 255]));
    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("round-trips dimensions and RGBA pixels exactly", () => {
    const width = 4;
    const height = 3;
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < rgba.length; i++) {
      rgba[i] = (i * 17) % 256;
    }
    const decoded = decodePng(encodePng(width, height, rgba));
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(Array.from(decoded.rgba)).toEqual(Array.from(rgba));
  });

  it("produces different bytes for different pixel data", () => {
    const a = encodePng(2, 1, new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]));
    const b = encodePng(2, 1, new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]));
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it("is deterministic for identical input", () => {
    const rgba = new Uint8Array([10, 20, 30, 255]);
    expect(Array.from(encodePng(1, 1, rgba))).toEqual(Array.from(encodePng(1, 1, rgba)));
  });

  it("rejects invalid dimensions and buffer lengths", () => {
    expect(() => encodePng(0, 1, new Uint8Array(4))).toThrow(RangeError);
    expect(() => encodePng(2, 2, new Uint8Array(4))).toThrow(RangeError);
  });
});
