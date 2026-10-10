/**
 * Library Index Store
 *
 * Manages the single JSON index file at `.toneforge-library/index.json`.
 * Provides load, save, and query operations for library entries.
 *
 * The index is loaded into memory on first access and written back
 * on every mutation to ensure durability.
 *
 * Reference: docs/prd/LIBRARY_PRD.md Section 7
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type {
  LibraryEntry,
  LibraryIndex,
  LibraryFilter,
  LibraryRegisteredAsset,
  RegisteredAssetFilter,
} from "./types.js";
import { LIBRARY_VERSION, DEFAULT_LIBRARY_DIR, INDEX_FILE } from "./types.js";

/**
 * In-memory cache of the library index.
 *
 * Keyed by resolved base directory path to support multiple
 * library instances (primarily for testing).
 */
const indexCache = new Map<string, LibraryIndex>();

/**
 * Get the resolved path to the index file.
 */
function indexPath(baseDir: string = DEFAULT_LIBRARY_DIR): string {
  return resolve(baseDir, INDEX_FILE);
}

/**
 * Create an empty library index.
 */
function emptyIndex(): LibraryIndex {
  return {
    version: LIBRARY_VERSION,
    entries: [],
  };
}

/**
 * Load the library index from disk.
 *
 * Returns the cached index if already loaded. Creates a new empty
 * index if the file does not exist.
 *
 * @param baseDir - Base directory for library storage.
 * @returns The loaded or newly created library index.
 */
export async function loadIndex(
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<LibraryIndex> {
  const resolvedDir = resolve(baseDir);

  // Return cached index if available
  const cached = indexCache.get(resolvedDir);
  if (cached) return cached;

  const filePath = indexPath(baseDir);

  if (!existsSync(filePath)) {
    const index = emptyIndex();
    indexCache.set(resolvedDir, index);
    return index;
  }

  const content = await readFile(filePath, "utf-8");
  const index = JSON.parse(content) as LibraryIndex;
  indexCache.set(resolvedDir, index);
  return index;
}

/**
 * Save the library index to disk.
 *
 * Creates the directory structure if it does not exist.
 *
 * @param index - The index to persist.
 * @param baseDir - Base directory for library storage.
 * @returns Path to the saved index file.
 */
export async function saveIndex(
  index: LibraryIndex,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<string> {
  const filePath = indexPath(baseDir);
  await mkdir(dirname(filePath), { recursive: true });

  const content = JSON.stringify(index, null, 2);
  await writeFile(filePath, content);

  // Update cache
  const resolvedDir = resolve(baseDir);
  indexCache.set(resolvedDir, index);

  return filePath;
}

/**
 * Add an entry to the index and persist.
 *
 * If an entry with the same ID already exists, this is a no-op
 * (idempotent) and returns the existing entry.
 *
 * @param entry - The library entry to add.
 * @param baseDir - Base directory for library storage.
 * @returns The added entry (or existing entry if duplicate).
 */
export async function addToIndex(
  entry: LibraryEntry,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<LibraryEntry> {
  const index = await loadIndex(baseDir);

  // Idempotent: check for existing entry with same ID
  const existing = index.entries.find((e) => e.id === entry.id);
  if (existing) return existing;

  index.entries.push(entry);
  await saveIndex(index, baseDir);

  return entry;
}

/**
 * Get an entry from the index by ID.
 *
 * @param id - The entry ID to look up.
 * @param baseDir - Base directory for library storage.
 * @returns The matching entry, or null if not found.
 */
export async function getFromIndex(
  id: string,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<LibraryEntry | null> {
  const index = await loadIndex(baseDir);
  return index.entries.find((e) => e.id === id) ?? null;
}

/**
 * Remove an entry from the index by ID and persist.
 *
 * @param id - The entry ID to remove.
 * @param baseDir - Base directory for library storage.
 * @returns True if the entry was found and removed, false otherwise.
 */
export async function removeFromIndex(
  id: string,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<boolean> {
  const index = await loadIndex(baseDir);
  const before = index.entries.length;
  index.entries = index.entries.filter((e) => e.id !== id);

  if (index.entries.length === before) return false;

  await saveIndex(index, baseDir);
  return true;
}

/**
 * List entries from the index, optionally filtered.
 *
 * @param filter - Optional filter criteria.
 * @param baseDir - Base directory for library storage.
 * @returns Array of matching entries.
 */
export async function listFromIndex(
  filter?: LibraryFilter,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<LibraryEntry[]> {
  const index = await loadIndex(baseDir);

  if (!filter) return [...index.entries];

  return index.entries.filter((entry) => {
    if (filter.category && entry.category !== filter.category) return false;
    if (filter.recipe && entry.recipe !== filter.recipe) return false;
    if (filter.tags && filter.tags.length > 0) {
      const hasAllTags = filter.tags.every((tag) => entry.tags.includes(tag));
      if (!hasAllTags) return false;
    }
    return true;
  });
}

/**
 * Clear the in-memory index cache.
 *
 * Primarily used in tests to ensure a clean state between test runs.
 *
 * @param baseDir - Optional specific base directory to clear.
 *                  If omitted, clears the entire cache.
 */
export function clearIndexCache(baseDir?: string): void {
  if (baseDir) {
    indexCache.delete(resolve(baseDir));
  } else {
    indexCache.clear();
  }
}

// ---------------------------------------------------------------------------
// Marketplace-registered assets
// ---------------------------------------------------------------------------

/**
 * Build the deterministic id for a registered asset.
 *
 * Format: `${package}@${version}:${kind}:${path}`.
 */
export function registeredAssetId(
  asset: Pick<LibraryRegisteredAsset, "package" | "version" | "kind" | "path">,
): string {
  return `${asset.package}@${asset.version}:${asset.kind}:${asset.path}`;
}

/**
 * Read the index synchronously, seeding the shared cache when absent.
 *
 * Used by the synchronous marketplace-registration helpers, because the
 * install pipeline calls the registrar synchronously. The async and sync
 * paths share {@link indexCache}, so they always observe the same state.
 */
function loadIndexSync(baseDir: string): LibraryIndex {
  const resolvedDir = resolve(baseDir);
  const cached = indexCache.get(resolvedDir);
  if (cached) return cached;

  const filePath = indexPath(baseDir);
  let index: LibraryIndex;
  if (existsSync(filePath)) {
    index = JSON.parse(readFileSync(filePath, "utf-8")) as LibraryIndex;
  } else {
    index = emptyIndex();
  }
  indexCache.set(resolvedDir, index);
  return index;
}

/**
 * Persist the index synchronously and refresh the cache.
 */
function saveIndexSync(index: LibraryIndex, baseDir: string): string {
  const filePath = indexPath(baseDir);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(index, null, 2));
  indexCache.set(resolve(baseDir), index);
  return filePath;
}

/**
 * Record a marketplace-installed asset in the library index.
 *
 * Idempotent: re-registering the same id replaces the existing record (a
 * re-install of the same package/version yields identical state). The asset's
 * bytes stay in the installed package directory; only provenance and the
 * content hash are stored here.
 *
 * Synchronous so the (synchronous) Marketplace install pipeline can call it
 * from its registrar hook.
 *
 * @param asset - The asset to record (without `id`; it is derived).
 * @param baseDir - Base directory for library storage.
 * @returns The recorded asset (with its derived id).
 */
export function addRegisteredAssetSync(
  asset: Omit<LibraryRegisteredAsset, "id"> & { id?: string },
  baseDir: string = DEFAULT_LIBRARY_DIR,
): LibraryRegisteredAsset {
  const index = loadIndexSync(baseDir);
  const registered: LibraryRegisteredAsset = {
    id: asset.id ?? registeredAssetId(asset),
    kind: asset.kind,
    path: asset.path,
    contentHash: asset.contentHash,
    package: asset.package,
    version: asset.version,
    registry: asset.registry,
  };

  const assets = index.registeredAssets ?? [];
  const existingIndex = assets.findIndex((entry) => entry.id === registered.id);
  if (existingIndex >= 0) {
    assets[existingIndex] = registered;
  } else {
    assets.push(registered);
  }
  index.registeredAssets = assets;

  saveIndexSync(index, baseDir);
  return registered;
}

/**
 * List marketplace-registered assets from the library index, optionally
 * filtered by kind and/or package.
 */
export function listRegisteredAssets(
  filter?: RegisteredAssetFilter,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): LibraryRegisteredAsset[] {
  const index = loadIndexSync(baseDir);
  const assets = index.registeredAssets ?? [];
  if (!filter) return [...assets];

  return assets.filter((asset) => {
    if (filter.kind && asset.kind !== filter.kind) return false;
    if (filter.package && asset.package !== filter.package) return false;
    return true;
  });
}

/**
 * Remove a marketplace-registered asset by id.
 *
 * @returns True if a record was removed, false otherwise.
 */
export function removeRegisteredAsset(
  id: string,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): boolean {
  const index = loadIndexSync(baseDir);
  const assets = index.registeredAssets ?? [];
  const next = assets.filter((asset) => asset.id !== id);
  if (next.length === assets.length) return false;
  index.registeredAssets = next;
  saveIndexSync(index, baseDir);
  return true;
}
