/**
 * Marketplace registry abstraction and the local, directory-backed adapter.
 *
 * The Marketplace core depends only on the injectable {@link MarketplaceRegistry}
 * interface (search + fetch); the transport/backend is an implementation
 * detail. Publishing adds the {@link MutableMarketplaceRegistry} extension
 * (`register` + `has`) so the publish pipeline can persist a package without
 * widening the read-only seam. The demo ships a single *local* adapter that
 * reads a registry index from disk, resolves package bundles beneath a root
 * directory and appends publishes back to the index — no network access —
 * matching `docs/prd/MARKETPLACE_PRD.md` Section 12 (private registries and
 * offline mirrors) and keeping tests deterministic. A remote adapter
 * delegating to the Demo 15 Network module can implement the same interface
 * later without touching callers.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 10, 12, 14.
 * Work items: TF-0MUZX3XWW008FO77 (read seam), TF-0MUZX3YVJ001VHLN (publish).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import { parseManifest } from "./manifest.js";
import { createSearchResult, searchEntries } from "./search.js";
import {
  MARKETPLACE_ASSET_KINDS,
  type MarketplaceAssetKind,
  type MarketplaceIssue,
  type MarketplaceManifest,
  type MarketplacePackageBundle,
  type MarketplaceRegistryEntry,
  type MarketplaceRegistryIndex,
  type MarketplaceSearchListing,
  type MarketplaceSearchResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A pluggable, read-only Marketplace package registry.
 *
 * Implementations may be local (directory-backed), in-memory or remote, as
 * long as `search` is deterministic and `fetch` resolves a published
 * `name@version` (or returns `null` when it is unknown).
 */
export interface MarketplaceRegistry {
  /** Deterministic, metadata-rich search; an absent category returns all. */
  search(category?: string): MarketplaceSearchListing[];
  /** The same search, wrapped in the JSON-ready `searchResult` shape. */
  searchResult(category?: string): MarketplaceSearchResult;
  /** Resolve a published package by exact name and version, or `null`. */
  fetch(name: string, version: string): MarketplacePackageBundle | null;
}

/**
 * A Marketplace registry that accepts publishes.
 *
 * The publish pipeline depends only on this extension: `register` appends a
 * published entry and `has` is the immutability probe used to reject a
 * duplicate version. Read-only registries (the install/search seams) stay on
 * {@link MarketplaceRegistry}.
 */
export interface MutableMarketplaceRegistry extends MarketplaceRegistry {
  /** Register a published package entry in the registry index. */
  register(entry: MarketplaceRegistryEntry): void;
  /** Check if a `name@version` is already published. */
  has(name: string, version: string): boolean;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Classification of a registry failure. */
export type MarketplaceRegistryErrorCode =
  | "index-unreadable"
  | "index-invalid"
  | "manifest-unreadable"
  | "manifest-invalid";

/** A structured, actionable registry failure. */
export class MarketplaceRegistryError extends Error {
  constructor(
    /** Machine-readable classification. */
    readonly code: MarketplaceRegistryErrorCode,
    message: string,
    /** Field-addressed issues (for example invalid manifest fields). */
    readonly issues: MarketplaceIssue[] = [],
  ) {
    super(message);
    this.name = "MarketplaceRegistryError";
  }
}

// ---------------------------------------------------------------------------
// Index loading
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Throw a structured `index-invalid` error naming the offending field. */
function invalidIndex(field: string, message: string): never {
  throw new MarketplaceRegistryError("index-invalid", message, [
    { field, message },
  ]);
}

/** Coerce a decoded asset-count object, defaulting absent kinds to zero. */
function coerceAssetCounts(
  value: unknown,
  field: string,
): Record<MarketplaceAssetKind, number> {
  if (!isRecord(value)) {
    invalidIndex(field, `${field} must be an object of asset counts`);
  }
  const counts = {} as Record<MarketplaceAssetKind, number>;
  for (const kind of MARKETPLACE_ASSET_KINDS) {
    const raw = (value as Record<string, unknown>)[kind];
    if (raw === undefined) {
      counts[kind] = 0;
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      counts[kind] = raw;
    } else {
      invalidIndex(`${field}.${kind}`, `${field}.${kind} must be a number`);
    }
  }
  return counts;
}

/** Coerce one decoded registry package entry. */
function coerceRegistryEntry(
  value: unknown,
  index: number,
): MarketplaceRegistryEntry {
  const field = `packages[${index}]`;
  if (!isRecord(value)) invalidIndex(field, `${field} must be an object`);
  for (const key of ["name", "version", "type", "category", "author", "license", "path"] as const) {
    if (!isNonEmptyString((value as Record<string, unknown>)[key])) {
      invalidIndex(`${field}.${key}`, `${field}.${key} must be a non-empty string`);
    }
  }
  const rating = (value as Record<string, unknown>).rating;
  if (typeof rating !== "number" || !Number.isFinite(rating)) {
    invalidIndex(`${field}.rating`, `${field}.rating must be a number`);
  }
  const source = value as Record<string, unknown>;
  return {
    name: source.name as string,
    version: source.version as string,
    type: source.type as string,
    category: source.category as string,
    author: source.author as string,
    license: source.license as string,
    rating: rating as number,
    path: source.path as string,
    assets: coerceAssetCounts(source.assets, `${field}.assets`),
  };
}

/** Coerce one decoded installed-package record. */
function coerceInstalledPackage(
  value: unknown,
  index: number,
): { name: string; version: string } {
  const field = `installed[${index}]`;
  if (!isRecord(value)) invalidIndex(field, `${field} must be an object`);
  const source = value as Record<string, unknown>;
  if (!isNonEmptyString(source.name)) {
    invalidIndex(`${field}.name`, `${field}.name must be a non-empty string`);
  }
  if (!isNonEmptyString(source.version)) {
    invalidIndex(`${field}.version`, `${field}.version must be a non-empty string`);
  }
  return { name: source.name as string, version: source.version as string };
}

/** Coerce a decoded registry index into its typed shape or throw. */
export function coerceRegistryIndex(value: unknown): MarketplaceRegistryIndex {
  if (!isRecord(value)) {
    invalidIndex("registry", "registry index must be a JSON object");
  }
  const source = value as Record<string, unknown>;
  if (!isNonEmptyString(source.version)) {
    invalidIndex("version", "version must be a non-empty string");
  }
  if (!Array.isArray(source.packages)) {
    invalidIndex("packages", "packages must be an array");
  }
  if (!Array.isArray(source.installed)) {
    invalidIndex("installed", "installed must be an array");
  }
  return {
    version: source.version as string,
    packages: (source.packages as unknown[]).map(coerceRegistryEntry),
    installed: (source.installed as unknown[]).map(coerceInstalledPackage),
  };
}

/**
 * Load and validate a registry index from disk.
 *
 * @throws MarketplaceRegistryError `index-unreadable` when the file cannot be
 *   read and `index-invalid` when it is not valid JSON or is malformed.
 */
export function loadRegistryIndex(indexFile: string): MarketplaceRegistryIndex {
  if (!existsSync(indexFile)) {
    throw new MarketplaceRegistryError(
      "index-unreadable",
      `registry index not found: ${indexFile}`,
    );
  }
  let raw: string;
  try {
    raw = readFileSync(indexFile, "utf-8");
  } catch (error) {
    throw new MarketplaceRegistryError(
      "index-unreadable",
      `unable to read registry index ${indexFile}: ${(error as Error).message}`,
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch (error) {
    throw new MarketplaceRegistryError(
      "index-invalid",
      `registry index ${indexFile} is not valid JSON: ${(error as Error).message}`,
    );
  }
  return coerceRegistryIndex(decoded);
}

// ---------------------------------------------------------------------------
// Local adapter
// ---------------------------------------------------------------------------

/** Construction options for {@link LocalDirectoryRegistry}. */
export interface LocalRegistryOptions {
  /** Path to the registry index JSON describing published packages. */
  indexFile: string;
  /** Base directory that relative package `path`s resolve against. */
  root: string;
}

/**
 * A local, directory-backed {@link MarketplaceRegistry}.
 *
 * Reads the registry index once at construction and resolves package bundles
 * beneath {@link LocalRegistryOptions.root}. No network access is performed.
 * Publishing writes the updated index back to disk.
 */
export class LocalDirectoryRegistry implements MutableMarketplaceRegistry {
  private readonly index: MarketplaceRegistryIndex;
  private readonly root: string;
  private readonly indexFile: string;

  constructor(options: LocalRegistryOptions) {
    this.index = loadRegistryIndex(options.indexFile);
    this.root = options.root;
    this.indexFile = options.indexFile;
  }

  /** The loaded registry index (read-only view of the published packages). */
  get registryIndex(): MarketplaceRegistryIndex {
    return this.index;
  }

  search(category?: string): MarketplaceSearchListing[] {
    return searchEntries(this.index.packages, category);
  }

  searchResult(category?: string): MarketplaceSearchResult {
    return createSearchResult(category, this.search(category));
  }

  fetch(name: string, version: string): MarketplacePackageBundle | null {
    const entry = this.index.packages.find(
      (candidate) => candidate.name === name && candidate.version === version,
    );
    if (!entry) return null;

    const directory = this.resolvePackageDir(entry.path);
    const manifest = this.readManifest(directory);
    return { name: entry.name, version: entry.version, directory, manifest };
  }

  register(entry: MarketplaceRegistryEntry): void {
    this.index.packages.push(entry);
    writeFileSync(
      this.indexFile,
      `${JSON.stringify(this.index, null, 2)}\n`,
      "utf-8",
    );
  }

  has(name: string, version: string): boolean {
    return this.index.packages.some(
      (p) => p.name === name && p.version === version,
    );
  }

  /** Resolve a package `path` (relative to the root, or absolute). */
  private resolvePackageDir(pathOrRelative: string): string {
    return isAbsolute(pathOrRelative)
      ? pathOrRelative
      : join(this.root, pathOrRelative);
  }

  /** Read, parse and validate a package's `manifest.json`. */
  private readManifest(directory: string): MarketplaceManifest {
    const manifestFile = join(directory, "manifest.json");
    if (!existsSync(manifestFile)) {
      throw new MarketplaceRegistryError(
        "manifest-unreadable",
        `package manifest not found: ${manifestFile}`,
      );
    }
    let raw: string;
    try {
      raw = readFileSync(manifestFile, "utf-8");
    } catch (error) {
      throw new MarketplaceRegistryError(
        "manifest-unreadable",
        `unable to read package manifest ${manifestFile}: ${(error as Error).message}`,
      );
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch (error) {
      throw new MarketplaceRegistryError(
        "manifest-invalid",
        `package manifest ${manifestFile} is not valid JSON: ${(error as Error).message}`,
        [{ field: "manifest", message: "manifest is not valid JSON" }],
      );
    }
    const parsed = parseManifest(decoded);
    if (!parsed.ok) {
      throw new MarketplaceRegistryError(
        "manifest-invalid",
        `package manifest ${manifestFile} failed schema validation`,
        parsed.issues,
      );
    }
    return parsed.manifest;
  }
}

/** Create a local, directory-backed Marketplace registry. */
export function createLocalRegistry(
  options: LocalRegistryOptions,
): LocalDirectoryRegistry {
  return new LocalDirectoryRegistry(options);
}
