/**
 * Runtime Buffer Cache
 *
 * A bounded, deterministic LRU cache of rendered audio buffers keyed by
 * `(recipe, seed, overrides)`. RUNTIME_PRD §19.5 requires repeated runtime
 * events to reuse render work without unbounded memory growth; this cache is
 * the mechanism for that.
 *
 * Rendering goes through the existing `renderPreset` (the offline renderer) —
 * the cache never synthesises audio itself.
 *
 * Reference: docs/prd/RUNTIME_PRD.md §19.5 (Buffer cache)
 */

import type { RenderResult } from "../core/renderer.js";
import { renderPreset } from "../core/renderer.js";

// ── Types ─────────────────────────────────────────────────────────

/** Cache key: a unique render request. */
export interface BufferCacheKey {
  /** Registered recipe name. */
  recipe: string;
  /** Deterministic integer seed. */
  seed: number;
  /** Optional parameter overrides (part of the cache identity). */
  overrides?: Record<string, number>;
}

/** Cache statistics, used for inspection and tests. */
export interface BufferCacheStats {
  /** Number of cache hits. */
  hits: number;
  /** Number of cache misses (renders started). */
  misses: number;
  /** Number of entries evicted by the LRU bound. */
  evictions: number;
  /** Current number of cached entries. */
  size: number;
  /** Configured maximum number of entries. */
  maxEntries: number;
}

/** Bounded LRU buffer cache API. */
export interface BufferCache {
  /**
   * Return the render for `key`, rendering and caching it on a miss.
   *
   * Concurrent calls for the same key share a single render. Failed renders
   * are not cached, so a later call can retry.
   */
  getOrRender(key: BufferCacheKey): Promise<RenderResult>;

  /** Whether `key` is currently cached. */
  has(key: BufferCacheKey): boolean;

  /** Remove all cached entries (statistics are retained). */
  clear(): void;

  /** Current number of cached entries. */
  size(): number;

  /** A snapshot of cache statistics. */
  stats(): BufferCacheStats;
}

/** Options for {@link createBufferCache}. */
export interface BufferCacheOptions {
  /** Maximum number of entries (default: 64). Must be >= 1. */
  maxEntries?: number;

  /**
   * Renderer used on a miss. Defaults to the offline renderer
   * (`renderPreset`). Injectable for tests.
   */
  renderer?: (key: BufferCacheKey) => Promise<RenderResult>;
}

// ── Implementation ────────────────────────────────────────────────

/**
 * Build a stable string key from a {@link BufferCacheKey}.
 *
 * Overrides are sorted so `{a: 1, b: 2}` and `{b: 2, a: 1}` map to the same
 * entry.
 */
function serializeKey(key: BufferCacheKey): string {
  const overrides = key.overrides;
  let entries: Array<[string, number]> | null = null;
  if (overrides && Object.keys(overrides).length > 0) {
    entries = Object.entries(overrides).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
  }
  return JSON.stringify([key.recipe, key.seed, entries]);
}

/**
 * Create a bounded LRU buffer cache.
 *
 * @param options - Cache configuration.
 * @returns A {@link BufferCache}.
 */
export function createBufferCache(options?: BufferCacheOptions): BufferCache {
  const maxEntries = Math.max(1, Math.floor(options?.maxEntries ?? 64));
  const renderer =
    options?.renderer ??
    ((key: BufferCacheKey) =>
      renderPreset({
        recipe: key.recipe,
        seed: key.seed,
        ...(key.overrides !== undefined ? { overrides: key.overrides } : {}),
      }));

  // Map preserves insertion order; the first entry is the least-recently used.
  const entries = new Map<string, Promise<RenderResult>>();

  let hits = 0;
  let misses = 0;
  let evictions = 0;

  function touch(cacheKey: string, promise: Promise<RenderResult>): void {
    // Re-insert to mark as most-recently used.
    entries.delete(cacheKey);
    entries.set(cacheKey, promise);
  }

  function evictOverflow(): void {
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
      evictions++;
    }
  }

  return {
    async getOrRender(key: BufferCacheKey): Promise<RenderResult> {
      const cacheKey = serializeKey(key);

      const existing = entries.get(cacheKey);
      if (existing !== undefined) {
        hits++;
        touch(cacheKey, existing);
        return existing;
      }

      misses++;
      const promise = Promise.resolve()
        .then(() => renderer(key))
        .catch((error: unknown) => {
          // Never cache a failed render — allow a later retry.
          if (entries.get(cacheKey) === promise) {
            entries.delete(cacheKey);
          }
          throw error;
        });

      entries.set(cacheKey, promise);
      evictOverflow();

      return promise;
    },

    has(key: BufferCacheKey): boolean {
      return entries.has(serializeKey(key));
    },

    clear(): void {
      entries.clear();
    },

    size(): number {
      return entries.size;
    },

    stats(): BufferCacheStats {
      return {
        hits,
        misses,
        evictions,
        size: entries.size,
        maxEntries,
      };
    },
  };
}
