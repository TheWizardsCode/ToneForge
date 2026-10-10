/**
 * Runtime Buffer Cache Tests
 *
 * LRU bound, deterministic eviction, render reuse, key identity, and failure
 * handling for the bounded buffer cache (RUNTIME_PRD §19.5).
 *
 * Work item: TF-0MUYBRKAT0036X2A
 */

import { describe, it, expect } from "vitest";
import { createBufferCache } from "./buffer-cache.js";
import type { BufferCacheKey } from "./buffer-cache.js";
import type { RenderResult } from "../core/renderer.js";

function resultFor(seed: number): RenderResult {
  return {
    samples: new Float32Array([seed]),
    sampleRate: 44100,
    duration: 0.1,
    numberOfChannels: 1,
  };
}

function countingRenderer(calls: BufferCacheKey[]) {
  return async (key: BufferCacheKey): Promise<RenderResult> => {
    calls.push(key);
    return resultFor(key.seed);
  };
}

describe("createBufferCache", () => {
  it("renders on a miss and reuses the render on a hit", async () => {
    const calls: BufferCacheKey[] = [];
    const cache = createBufferCache({ renderer: countingRenderer(calls) });

    const first = await cache.getOrRender({ recipe: "footstep-stone", seed: 42 });
    const second = await cache.getOrRender({ recipe: "footstep-stone", seed: 42 });

    expect(calls).toHaveLength(1);
    expect(second).toBe(first);
    expect(cache.stats()).toMatchObject({ hits: 1, misses: 1, size: 1 });
    expect(cache.has({ recipe: "footstep-stone", seed: 42 })).toBe(true);
  });

  it("treats different seeds and recipes as distinct keys", async () => {
    const calls: BufferCacheKey[] = [];
    const cache = createBufferCache({ renderer: countingRenderer(calls) });

    await cache.getOrRender({ recipe: "footstep-stone", seed: 42 });
    await cache.getOrRender({ recipe: "footstep-stone", seed: 43 });
    await cache.getOrRender({ recipe: "footstep-gravel", seed: 42 });

    expect(calls).toHaveLength(3);
    expect(cache.size()).toBe(3);
  });

  it("partitions on overrides and is insensitive to override ordering", async () => {
    const calls: BufferCacheKey[] = [];
    const cache = createBufferCache({ renderer: countingRenderer(calls) });

    await cache.getOrRender({ recipe: "x", seed: 1, overrides: { a: 1, b: 2 } });
    await cache.getOrRender({ recipe: "x", seed: 1, overrides: { b: 2, a: 1 } });
    await cache.getOrRender({ recipe: "x", seed: 1, overrides: { a: 1, b: 3 } });

    expect(calls).toHaveLength(2);
    expect(cache.size()).toBe(2);
    expect(cache.stats().hits).toBe(1);
  });

  it("shares a single render across concurrent misses", async () => {
    const calls: BufferCacheKey[] = [];
    let resolveRender: ((r: RenderResult) => void) | undefined;
    const cache = createBufferCache({
      renderer: (key) => {
        calls.push(key);
        return new Promise<RenderResult>((resolve) => {
          resolveRender = resolve;
        });
      },
    });

    const a = cache.getOrRender({ recipe: "x", seed: 1 });
    const b = cache.getOrRender({ recipe: "x", seed: 1 });

    // The renderer is invoked on a microtask; let it start before resolving.
    await Promise.resolve();
    resolveRender!(resultFor(1));
    const [ra, rb] = await Promise.all([a, b]);

    expect(calls).toHaveLength(1);
    expect(ra).toBe(rb);
  });
});

describe("createBufferCache — LRU bound", () => {
  it("never exceeds maxEntries and evicts the least-recently used entry", async () => {
    const calls: BufferCacheKey[] = [];
    const cache = createBufferCache({ maxEntries: 2, renderer: countingRenderer(calls) });

    await cache.getOrRender({ recipe: "a", seed: 1 });
    await cache.getOrRender({ recipe: "b", seed: 1 });
    await cache.getOrRender({ recipe: "c", seed: 1 });

    expect(cache.size()).toBe(2);
    expect(cache.stats().evictions).toBe(1);
    expect(cache.has({ recipe: "a", seed: 1 })).toBe(false);
    expect(cache.has({ recipe: "b", seed: 1 })).toBe(true);
    expect(cache.has({ recipe: "c", seed: 1 })).toBe(true);
  });

  it("refreshes recency on a hit so the touched entry survives eviction", async () => {
    const calls: BufferCacheKey[] = [];
    const cache = createBufferCache({ maxEntries: 2, renderer: countingRenderer(calls) });

    await cache.getOrRender({ recipe: "a", seed: 1 });
    await cache.getOrRender({ recipe: "b", seed: 1 });
    // Touch "a" so "b" becomes the least-recently used.
    await cache.getOrRender({ recipe: "a", seed: 1 });
    await cache.getOrRender({ recipe: "c", seed: 1 });

    expect(cache.has({ recipe: "a", seed: 1 })).toBe(true);
    expect(cache.has({ recipe: "b", seed: 1 })).toBe(false);
    expect(cache.has({ recipe: "c", seed: 1 })).toBe(true);
  });

  it("does not cache a failed render and allows a retry", async () => {
    let attempt = 0;
    const cache = createBufferCache({
      renderer: async (key) => {
        attempt++;
        if (attempt === 1) throw new Error("render boom");
        return resultFor(key.seed);
      },
    });

    await expect(cache.getOrRender({ recipe: "x", seed: 1 })).rejects.toThrow("render boom");
    expect(cache.size()).toBe(0);

    const retry = await cache.getOrRender({ recipe: "x", seed: 1 });
    expect(retry.samples[0]).toBe(1);
    expect(cache.stats().misses).toBe(2);
  });

  it("clear empties the cache", async () => {
    const cache = createBufferCache({ renderer: countingRenderer([]) });
    await cache.getOrRender({ recipe: "x", seed: 1 });
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
