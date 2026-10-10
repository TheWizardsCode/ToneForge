/**
 * ToneForge Memory — public API.
 *
 * Memory is the append-only, project-local recall layer. It records what
 * happened and what mattered, and exposes deterministic queries. It never
 * makes decisions and never mutates library assets.
 */

export {
  MEMORY_VERSION,
  MEMORY_DIR_PARTS,
  MEMORY_FILE_NAME,
  MEMORY_CATEGORIES,
  MEMORY_EVENTS,
  validateMemoryRecord,
  parseMemoryRecord,
  serialiseMemoryRecord,
  sortDetails,
} from "./types.js";
export type {
  MemoryCategory,
  MemoryDetailValue,
  MemoryEvent,
  MemoryQueryOptions,
  MemoryQueryReport,
  MemoryRecord,
  MemoryTimeRange,
  QualityTrendPoint,
  RecurringIssueSummary,
  RejectedIntentSummary,
  SeedUsageSummary,
} from "./types.js";

export {
  JsonlMemoryStore,
  NodeMemoryFileSystem,
  InMemoryMemoryFileSystem,
  createMemoryStore,
  resolveMemoryDir,
} from "./store.js";
export type {
  MemoryFileSystem,
  MemoryStore,
  MemoryStoreOptions,
} from "./store.js";

export {
  createMemoryRecord,
  createMemoryRecorder,
  generationEvent,
  promotionEvent,
  rejectionEvent,
  overrideEvent,
  qualityEvent,
  systemClock,
} from "./record.js";
export type {
  MemoryClock,
  MemoryEventInput,
  MemoryRecorder,
  MemoryRecorderOptions,
} from "./record.js";

export {
  buildMemoryReport,
  queryMemory,
  exportMemory,
  clearMemory,
} from "./query.js";
