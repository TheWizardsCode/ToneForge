/**
 * Compiler Build Manifests
 *
 * Produces deterministic, JSON-serialisable build manifests for a
 * compilation run. Every manifest records the per-asset decisions and
 * the SHA-256 hash of each emitted WAV, plus a combined manifest hash
 * and a hash-derived `buildId`.
 *
 * Determinism is the contract: the same inputs (decisions + output
 * bytes) always produce byte-identical manifests. No timestamps, host
 * information, or insertion-order-dependent serialisation is included.
 *
 * Reference: docs/prd/COMPILER_PRD.md Sections 6, 12.
 */

import { createHash } from "node:crypto";
import type { CompileDecision } from "./engine.js";

/** A single asset entry in a build manifest. */
export interface ManifestAsset {
  /** Library entry id. */
  assetId: string;
  /** Entry category. */
  category: string;
  /** Recipe that generated the asset. */
  recipe: string;
  /** Rendered duration in seconds. */
  duration: number;
  /** Compilation decision taken for this asset. */
  decision: CompileDecision;
  /**
   * Output path relative to the build output directory, or `null`
   * for procedural assets (and dry runs) that emit no file.
   */
  file: string | null;
  /** SHA-256 hex digest of the emitted WAV bytes, or `null` when none. */
  hash: string | null;
  /** Size of the emitted WAV in bytes, or `null` when none. */
  bytes: number | null;
}

/** A deterministic build manifest produced by a compilation run. */
export interface BuildManifest {
  /** Hash-derived build identifier (`tfc_<16 hex chars>`). */
  buildId: string;
  /** Platform target name. */
  target: string;
  /** SHA-256 of the canonical manifest content (assets + target). */
  hash: string;
  /** Number of assets left procedural. */
  proceduralAssets: number;
  /** Number of hybrid assets. */
  hybridAssets: number;
  /** Number of fully baked assets. */
  bakedAssets: number;
  /** Per-asset entries, sorted by `assetId`. */
  assets: ManifestAsset[];
}

/** Options for {@link createManifest}. */
export interface CreateManifestOptions {
  /** Platform target name. */
  target: string;
  /** Per-asset entries (order does not matter; output is sorted). */
  assets: ManifestAsset[];
}

/** Compute the SHA-256 hex digest of a byte sequence. */
export function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Recursively normalise a JSON value so object keys are sorted.
 *
 * Arrays keep their order (the caller is responsible for sorting
 * manifest assets before hashing). This makes `JSON.stringify` output
 * stable regardless of how objects were constructed.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      out[key] = canonicalize(source[key]);
    }
    return out;
  }
  return value;
}

/**
 * Serialise a value to canonical JSON (recursively sorted object keys).
 *
 * Used for hashing and for writing manifest files so that the same
 * logical content always yields the same bytes.
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/** Sort manifest assets by `assetId` without mutating the input. */
function sortAssets(assets: readonly ManifestAsset[]): ManifestAsset[] {
  return [...assets].sort((a, b) =>
    a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0,
  );
}

/** Count decisions across a set of manifest assets. */
function countDecisions(assets: readonly ManifestAsset[]): {
  proceduralAssets: number;
  hybridAssets: number;
  bakedAssets: number;
} {
  let proceduralAssets = 0;
  let hybridAssets = 0;
  let bakedAssets = 0;
  for (const asset of assets) {
    if (asset.decision === "baked") bakedAssets++;
    else if (asset.decision === "hybrid") hybridAssets++;
    else proceduralAssets++;
  }
  return { proceduralAssets, hybridAssets, bakedAssets };
}

/**
 * Build a deterministic manifest from per-asset entries.
 *
 * Assets are sorted by `assetId`, counts are derived from the sorted
 * set, and the combined `hash` is computed over the canonical
 * `{ target, assets }` content. `buildId` is the first 16 hex characters
 * of that hash.
 */
export function createManifest(options: CreateManifestOptions): BuildManifest {
  const assets = sortAssets(options.assets);
  const counts = countDecisions(assets);
  const hash = hashBytes(
    new TextEncoder().encode(canonicalStringify({ target: options.target, assets })),
  );

  return {
    buildId: `tfc_${hash.slice(0, 16)}`,
    target: options.target,
    hash,
    ...counts,
    assets,
  };
}

/**
 * Serialise a manifest to canonical JSON.
 *
 * Defensive against callers constructing a manifest with unsorted
 * assets: the assets are re-sorted before serialisation so the output
 * always matches {@link createManifest}.
 */
export function serializeManifest(manifest: BuildManifest): string {
  const sorted: BuildManifest = {
    ...manifest,
    assets: sortAssets(manifest.assets),
  };
  return canonicalStringify(sorted);
}

/**
 * Parse a manifest from canonical JSON produced by
 * {@link serializeManifest}.
 */
export function parseManifest(json: string): BuildManifest {
  return JSON.parse(json) as BuildManifest;
}
