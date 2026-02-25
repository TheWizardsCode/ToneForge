/**
 * Library Module Public API
 *
 * Re-exports the storage, index, and type definitions for
 * external consumers.
 */

export {
  addEntry,
  getEntry,
  listEntries,
  removeEntry,
  countEntries,
  buildEntry,
  entryId,
  readEntryMetadata,
  entryWavExists,
} from "./storage.js";
export type { AddEntryOptions, BuildEntryOptions } from "./storage.js";

export {
  loadIndex,
  saveIndex,
  addToIndex,
  getFromIndex,
  removeFromIndex,
  listFromIndex,
  clearIndexCache,
} from "./index-store.js";

export { searchEntries } from "./search.js";
export type { SearchQuery } from "./search.js";

export { findSimilar } from "./similarity.js";
export type { SimilarityResult, SimilarityOptions } from "./similarity.js";

export { regenerateEntry } from "./regenerate.js";
export type { RegenerateResult } from "./regenerate.js";

export { exportEntries } from "./export.js";
export type { ExportOptions, ExportResult } from "./export.js";

export { LIBRARY_VERSION, DEFAULT_LIBRARY_DIR, INDEX_FILE } from "./types.js";
export type {
  LibraryEntry,
  LibraryIndex,
  LibraryPreset,
  LibraryProvenance,
  LibraryFiles,
  LibraryFilter,
} from "./types.js";
