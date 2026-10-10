/**
 * ToneForge Visualizer — Minimal PNG Encoder
 *
 * Encodes raw RGBA8 pixel buffers as PNG (colour type 6) without adding a
 * runtime image dependency, using Node's built-in `zlib` for DEFLATE. The
 * output is a valid, standard PNG decodable by any image viewer or game
 * engine asset pipeline.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 13 — sprite sheet export)
 */

import { deflateSync } from "node:zlib";

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Precomputed CRC-32 table (PNG polynomial 0xEDB88320). */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Serialise one PNG chunk: length + type + data + CRC. */
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from([...type].map((c) => c.charCodeAt(0)));
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);

  const out = new Uint8Array(4 + body.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(4 + body.length, crc32(body));
  return out;
}

/**
 * Encode an RGBA8 pixel buffer as a PNG byte sequence.
 *
 * @param width  - Image width in pixels (must be >= 1).
 * @param height - Image height in pixels (must be >= 1).
 * @param rgba   - Row-major RGBA pixels, length `width * height * 4`.
 * @returns      PNG file bytes.
 * @throws {RangeError} when dimensions or buffer length are invalid.
 */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new RangeError(`Invalid image dimensions ${width}x${height}`);
  }
  if (rgba.length !== width * height * 4) {
    throw new RangeError(
      `rgba length ${rgba.length} does not match ${width}x${height} (expected ${width * height * 4})`,
    );
  }

  // IHDR
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines: each row prefixed by a filter byte (0 = None).
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const idat = new Uint8Array(deflateSync(raw));

  const chunks = [
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
