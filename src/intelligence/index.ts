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
  RecommendReport,
  Recommendation,
  SuggestExplorationReport,
} from "./types.js";

export { auditLibrary, buildAuditReport } from "./audit.js";
export type { AuditOptions } from "./audit.js";

export { loadLibraryEntries, intensityBucket } from "./library.js";

export {
  parseActionableCommand,
  validateActionableCommand,
  ACTIONABLE_COMMAND_SPECS,
} from "./commands.js";
export type { CommandSpec, ParsedCommand } from "./commands.js";
