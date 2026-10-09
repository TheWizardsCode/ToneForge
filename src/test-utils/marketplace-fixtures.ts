/**
 * Marketplace conformance fixture loaders.
 *
 * Typed, read-only accessors for the offline Marketplace fixture registry
 * under `src/test-utils/fixtures/marketplace/`. These helpers are the shared
 * test foundation for the Marketplace slice (work item
 * TF-0MUZX3XAI003S1GN): the conformance harness and every later Marketplace
 * feature (manifest, registry, versioning, install, publish) loads its inputs
 * through here rather than reaching into the filesystem directly.
 *
 * Everything is local, deterministic and hand-edited: no loader ever writes to
 * the fixture tree, so a regression in engine code cannot silently rewrite its
 * own expected input.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 4, 5, 10, 13.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The four asset kinds a demo Marketplace package may contain. */
export type MarketplaceAssetKind =
  | "recipes"
  | "stacks"
  | "sequences"
  | "palettes";

/** Canonical asset-kind order — used for deterministic iteration. */
export const MARKETPLACE_ASSET_KINDS: readonly MarketplaceAssetKind[] = [
  "recipes",
  "stacks",
  "sequences",
  "palettes",
] as const;

/** Declarative, versioned package manifest declared by a fixture package. */
export interface MarketplacePackageManifest {
  /** Package name (unique within a registry). */
  name: string;
  /** Semantic version (`MAJOR.MINOR.PATCH`). */
  version: string;
  /** Primary asset type. */
  type: string;
  /** Optional search category (registry metadata; defaults to `unclassified`). */
  category?: string;
  /** Optional human-readable description. */
  description?: string;
  /** Author/attribution name. */
  author: string;
  /** Explicit license identifier (for example `commercial`, `mit`). */
  license: string;
  /** Dependency requirement strings (for example `core>=1.0`). */
  dependencies: string[];
  /** Contained asset paths, relative to the package directory. */
  assets: Record<MarketplaceAssetKind, string[]>;
}

/** A single listing entry in the fixture registry index. */
export interface MarketplaceRegistryEntry {
  name: string;
  version: string;
  type: string;
  /** Search category (for example `combat`, `ui`, `ambience`). */
  category: string;
  author: string;
  license: string;
  /** Rating in the closed interval [0, 5]. */
  rating: number;
  /** Package directory, relative to the fixture root. */
  path: string;
  /** Contained asset counts by kind (for search metadata). */
  assets: Record<MarketplaceAssetKind, number>;
}

/** A package already present in the local registry/install state. */
export interface MarketplaceInstalledPackage {
  name: string;
  version: string;
}

/** Root index describing the fixture registry state. */
export interface MarketplaceRegistryIndex {
  version: string;
  packages: MarketplaceRegistryEntry[];
  installed: MarketplaceInstalledPackage[];
}

/** Resolve the module directory so fixture paths work under ESM and Vitest. */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the Marketplace fixture registry root. */
export function marketplaceFixtureDir(): string {
  return resolve(MODULE_DIR, "fixtures", "marketplace");
}

/** Absolute path to a path inside the Marketplace fixture registry root. */
export function marketplaceFixturePath(...segments: string[]): string {
  return join(marketplaceFixtureDir(), ...segments);
}

/** Absolute path to the fixture registry index file. */
export function registryIndexPath(): string {
  return marketplaceFixturePath("registry", "index.json");
}

/** Absolute path to a fixture package directory (by package name). */
export function packageFixtureDir(name: string): string {
  return marketplaceFixturePath("packages", name);
}

/** Absolute path to a fixture package's `manifest.json`. */
export function packageManifestPath(name: string): string {
  return join(packageFixtureDir(name), "manifest.json");
}

/** Parse a JSON file with a helpful error message. */
function readJson<T>(path: string): T {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (error) {
    throw new Error(
      `Unable to read Marketplace fixture at ${path}: ${(error as Error).message}`,
    );
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `Marketplace fixture at ${path} is not valid JSON: ${(error as Error).message}`,
    );
  }
}

/** Load and parse the fixture registry index. */
export function loadMarketplaceRegistry(
  indexFile: string = registryIndexPath(),
): MarketplaceRegistryIndex {
  return readJson<MarketplaceRegistryIndex>(indexFile);
}

/** Load and parse a fixture package manifest given its package directory. */
export function loadPackageManifest(packageDir: string): MarketplacePackageManifest {
  return readJson<MarketplacePackageManifest>(join(packageDir, "manifest.json"));
}

/** Load and parse a fixture package manifest by package name. */
export function loadFixturePackageManifest(
  name: string,
): MarketplacePackageManifest {
  return loadPackageManifest(packageFixtureDir(name));
}
