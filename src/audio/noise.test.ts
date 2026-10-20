/**
 * Unit tests for the shared seeded noise buffer generator.
 *
 * These tests pin the four contracts other modules rely on:
 * - determinism (same seed, same bytes) and RNG draw order (one draw per frame);
 * - audibility and headroom (non-silent, within [-1, 1]);
 * - the documented spectral ordering (white brighter than pink, pink brighter
 *   than brown);
 * - colour validation with an actionable error, plus a browser-safe module
 *   graph (no Node-only imports).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OfflineAudioContext } from "node-web-audio-api";
import { SpectralCentroidExtractor } from "../analyze/extractors/spectral-centroid.js";
import { createRng, type Rng } from "../core/rng.js";
import {
  NOISE_COLORS,
  assertNoiseColor,
  generateNoiseBuffer,
  isNoiseColor,
  type NoiseColor,
} from "./noise.js";

const SAMPLE_RATE = 44100;
const DURATION_SECONDS = 0.25;
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const centroidExtractor = new SpectralCentroidExtractor();

/** Render one noise buffer into a plain sample array. */
function renderNoise(
  color: NoiseColor,
  seed: number,
  durationSeconds = DURATION_SECONDS,
  rng: Rng = createRng(seed),
): Float32Array {
  const ctx = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(SAMPLE_RATE * durationSeconds)),
    SAMPLE_RATE,
  );
  const buffer = generateNoiseBuffer(ctx, durationSeconds, color, rng);
  return new Float32Array(buffer.getChannelData(0));
}

/** Compute the spectral centroid (in Hz) of a rendered buffer. */
function spectralCentroid(samples: Float32Array): number {
  return centroidExtractor.extract(samples, SAMPLE_RATE)["spectralCentroid"] as number;
}

/** Extract every import/export specifier from TypeScript module source. */
function importSpecifiers(source: string): string[] {
  const pattern = /(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+)["']/g;
  return [...source.matchAll(pattern)].map((match) => match[1]!);
}

/**
 * Walk the relative module graph starting at `entry`, collecting the visited
 * files and every non-relative specifier (both `node:*` built-ins and bare
 * package names).
 */
function collectModuleGraph(entry: string): { files: string[]; bareSpecifiers: string[] } {
  const visited = new Set<string>();
  const bareSpecifiers = new Set<string>();
  const pending = [entry];

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) {
      continue;
    }
    visited.add(file);

    for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
      if (!specifier.startsWith(".")) {
        bareSpecifiers.add(specifier);
        continue;
      }
      // Source imports use the compiled `.js` extension; the files on disk are `.ts`.
      pending.push(resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));
    }
  }

  return { files: [...visited], bareSpecifiers: [...bareSpecifiers] };
}

describe("generateNoiseBuffer", () => {
  it("allocates a mono buffer covering the requested duration at the context sample rate", () => {
    const ctx = new OfflineAudioContext(1, SAMPLE_RATE, SAMPLE_RATE);
    const buffer = generateNoiseBuffer(ctx, DURATION_SECONDS, "white", createRng(1));

    expect(buffer.numberOfChannels).toBe(1);
    expect(buffer.sampleRate).toBe(SAMPLE_RATE);
    expect(buffer.length).toBe(Math.ceil(SAMPLE_RATE * DURATION_SECONDS));
  });

  it("clamps a zero-length request to a single frame", () => {
    const ctx = new OfflineAudioContext(1, SAMPLE_RATE, SAMPLE_RATE);
    const buffer = generateNoiseBuffer(ctx, 0, "white", createRng(1));

    expect(buffer.length).toBe(1);
  });

  it.each(NOISE_COLORS)("is byte-identical for the same seed (%s)", (color) => {
    const first = renderNoise(color, 42);
    const second = renderNoise(color, 42);

    expect(first.length).toBe(second.length);
    for (let i = 0; i < first.length; i += 1) {
      // Exact equality, not a tolerance: determinism is the hard contract.
      expect(first[i]).toBe(second[i]);
    }
  });

  it.each(NOISE_COLORS)("produces different samples for different seeds (%s)", (color) => {
    const first = renderNoise(color, 42);
    const second = renderNoise(color, 43);

    const differing = first.reduce(
      (count, sample, index) => (sample === second[index] ? count : count + 1),
      0,
    );
    expect(differing).toBeGreaterThan(first.length / 2);
  });

  it.each(NOISE_COLORS)("consumes exactly one RNG draw per frame (%s)", (color) => {
    const seeded = createRng(7);
    let draws = 0;
    const countingRng: Rng = () => {
      draws += 1;
      return seeded();
    };

    const samples = renderNoise(color, 7, DURATION_SECONDS, countingRng);

    // The draw order is part of the determinism contract: ToneGraph recipes
    // share the RNG with later nodes, so an extra or missing draw would shift
    // every subsequent sample.
    expect(draws).toBe(samples.length);
  });

  it.each(NOISE_COLORS)("is non-silent and stays within [-1, 1] (%s)", (color) => {
    const samples = renderNoise(color, 42);
    const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);

    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(1);
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("orders the colours by spectral brightness: white > pink > brown", () => {
    const white = spectralCentroid(renderNoise("white", 42));
    const pink = spectralCentroid(renderNoise("pink", 42));
    const brown = spectralCentroid(renderNoise("brown", 42));

    // Flat spectrum (white) sits near Nyquist/2; pink falls as 1/f and brown
    // as 1/f², so their centroids descend in the documented order.
    expect(white).toBeGreaterThan(pink);
    expect(pink).toBeGreaterThan(brown);
    // Meaningful separation, not just a coincidental ordering.
    expect(white).toBeGreaterThan(pink * 1.2);
    expect(pink).toBeGreaterThan(brown * 1.2);
  });
});

describe("noise colour validation", () => {
  it.each(NOISE_COLORS)("accepts the supported colour %s", (color) => {
    expect(isNoiseColor(color)).toBe(true);
    expect(() => assertNoiseColor(color)).not.toThrow();
  });

  it.each(["green", "", "PINK", "white ", "brownish", 42, null, undefined])(
    "rejects the unsupported colour %s with an actionable error",
    (value) => {
      expect(isNoiseColor(value)).toBe(false);
      expect(() => assertNoiseColor(value)).toThrowError(/Unsupported noise colour/);

      try {
        assertNoiseColor(value);
        expect.unreachable("assertNoiseColor should have thrown");
      } catch (error) {
        const message = (error as Error).message;
        // The error must name every accepted value so authors can correct it.
        for (const color of NOISE_COLORS) {
          expect(message).toContain(color);
        }
      }
    },
  );

  it("rejects an unsupported colour before generating any samples", () => {
    const ctx = new OfflineAudioContext(1, SAMPLE_RATE, SAMPLE_RATE);
    const seeded = createRng(1);
    let draws = 0;
    const countingRng: Rng = () => {
      draws += 1;
      return seeded();
    };

    expect(() =>
      generateNoiseBuffer(ctx, 0.1, "green" as NoiseColor, countingRng),
    ).toThrowError(/Unsupported noise colour "green".*white, pink, brown/);
    expect(draws).toBe(0);
  });
});

describe("browser-safe module graph", () => {
  it("imports no Node-only modules transitively", () => {
    const { files, bareSpecifiers } = collectModuleGraph(resolve(MODULE_DIR, "noise.ts"));

    // The walk really traversed the seeded RNG dependency, not just this file.
    expect(files.map((file) => basename(file))).toEqual(
      expect.arrayContaining(["noise.ts", "rng.ts"]),
    );
    // `node:*` built-ins and the Node-only Web Audio package would break a
    // browser bundle, so the generator must not pull either in.
    const nodeOnly = bareSpecifiers.filter(
      (specifier) => specifier.startsWith("node:") || specifier === "node-web-audio-api",
    );
    expect(nodeOnly).toEqual([]);
  });
});
