/**
 * ToneForge Intelligence — public API.
 *
 * Intelligence is the assistive reasoning layer. It reads library, analysis
 * and classification data and produces explainable, actionable suggestions;
 * it never mutates library data.
 */

export { INTELLIGENCE_VERSION } from "./types.js";
export type {
  AuditFinding,
  AuditFindingKind,
  AuditReport,
  AuditSummary,
  ExplainedFinding,
  ExplorationSuggestion,
  IntelligenceOptions,
  IntelligenceReport,
  IntelligenceSuggestion,
  RecommendReport,
  Recommendation,
  SuggestExplorationReport,
} from "./types.js";

export { auditLibrary, buildAuditReport } from "./audit.js";
export type { AuditOptions } from "./audit.js";

export { recommendSounds, buildRecommendations, parseUseCase } from "./recommend.js";
export type { RecommendOptions, UseCaseIntent } from "./recommend.js";

export { suggestExploration, buildExplorationSuggestions } from "./suggest-exploration.js";
export type { SuggestExplorationOptions } from "./suggest-exploration.js";

export { loadLibraryEntries, intensityBucket } from "./library.js";

export {
  parseActionableCommand,
  validateActionableCommand,
  ACTIONABLE_COMMAND_SPECS,
} from "./commands.js";
export type { CommandSpec, ParsedCommand } from "./commands.js";

export {
  snapshotLibrary,
  assertLibraryUnchanged,
  withReadOnlyGuard,
  ReadOnlyViolationError,
} from "./read-only.js";
export type { LibrarySnapshot } from "./read-only.js";

export { logIntelligenceEvent } from "./logging.js";
export type { IntelligenceLogEvent } from "./logging.js";

export {
  deriveMemoryContext,
  memoryNotesForEntry,
  isOverRepresented,
  OVER_REPRESENTED_THRESHOLD,
} from "./memory-context.js";
export type { MemoryContextSummary } from "./memory-context.js";
