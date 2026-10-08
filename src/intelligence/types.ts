/**
 * ToneForge Intelligence — shared contract types.
 *
 * Intelligence is the assistive reasoning layer: it reads analysis,
 * classification and library data and produces explainable suggestions.
 * It never mutates library assets.
 *
 * Every suggestion produced by an Intelligence engine shares one
 * explainability contract:
 *
 * - `confidence` — a number in the closed interval [0, 1];
 * - `rationale` — a human-readable explanation;
 * - `suggestedCommand` — an actionable, runnable `toneforge` command.
 *
 * This keeps `audit`, `recommend` and `suggest-exploration` consistent and
 * lets the conformance harness assert a single shape across engines.
 *
 * Reference: docs/prd/INTELLIGENCE_PRD.md §7 (Explainability & Trust),
 * §10 (Determinism & Safety).
 */

import type { MemoryContextSummary } from "./memory-context.js";

/** Current Intelligence output schema version. */
export const INTELLIGENCE_VERSION = "1.0";

/**
 * The explainability contract shared by every Intelligence suggestion.
 *
 * @remarks
 * `confidence` MUST be in [0, 1]. Consumers may treat it as a relative
 * measure of how strongly the evidence supports the suggestion; it is a
 * deterministic heuristic, not a calibrated probability.
 */
export interface ExplainedFinding {
  /** Confidence in the suggestion, in the closed interval [0, 1]. */
  confidence: number;

  /** Human-readable explanation of why the suggestion was made. */
  rationale: string;

  /** An actionable, runnable `toneforge` command related to the finding. */
  suggestedCommand: string;
}

/** Classification of an audit finding. */
export type AuditFindingKind = "coverage-gap" | "redundancy" | "quality";

/**
 * A single audit finding.
 *
 * `assets` names the library entry ids (or category labels) affected by the
 * finding so a human can act on it without re-deriving the analysis.
 */
export interface AuditFinding extends ExplainedFinding {
  /** Stable, deterministic finding identifier. */
  id: string;

  /** The kind of issue detected. */
  kind: AuditFindingKind;

  /** One-line human-readable summary. */
  summary: string;

  /** Library entry ids or labels affected by this finding. */
  assets: string[];

  /**
   * Metrics that support the finding. Values are primitives so the report
   * serialises deterministically.
   */
  supportingMetrics: Record<string, number | string | boolean>;
}

/** Aggregate counts for an audit report. */
export interface AuditSummary {
  /** Total number of entries inspected. */
  entries: number;

  /** Number of distinct categories inspected. */
  categories: number;

  /** Number of coverage-gap findings. */
  coverageGaps: number;

  /** Number of redundancy findings. */
  redundancies: number;

  /** Number of quality findings. */
  qualityIssues: number;
}

/**
 * Structured result of `toneforge intelligence audit`.
 *
 * The report is deterministic: the same library input yields byte-identical
 * JSON (no wall-clock timestamps or random ordering).
 */
export interface AuditReport {
  /** Command discriminator. */
  command: "intelligence audit";

  /** Intelligence schema version. */
  version: string;

  /** Intelligence is always read-only; included as an explicit contract. */
  readOnly: true;

  /** Intelligence always operates in dry-run mode; included as an explicit contract. */
  dryRun: true;

  /** Library directory that was audited. */
  library: string;

  /** Total number of entries inspected. */
  totalEntries: number;

  /** Distinct library categories, sorted. */
  categories: string[];

  /** All findings, deterministically ordered. */
  findings: AuditFinding[];

  /** Aggregate finding counts. */
  summary: AuditSummary;

  /** Additive historical context when `--use-memory` is supplied. */
  memoryContext?: MemoryContextSummary;
}

/**
 * A single ranked sound recommendation.
 */
export interface Recommendation extends ExplainedFinding {
  /** 1-based rank within the result set. */
  rank: number;

  /** Library entry id. */
  entryId: string;

  /** Recipe that produced the entry. */
  recipe: string;

  /** Seed used to generate the entry. */
  seed: number;

  /** Library category. */
  category: string;

  /** Raw relevance score before confidence normalisation (higher is better). */
  score: number;

  /** Historical notes derived from Memory when `--use-memory` is supplied. */
  memoryNotes?: string[];
}

/** Structured result of `toneforge intelligence recommend`. */
export interface RecommendReport {
  /** Command discriminator. */
  command: "intelligence recommend";

  /** Intelligence schema version. */
  version: string;

  /** Intelligence is always read-only; included as an explicit contract. */
  readOnly: true;

  /** Intelligence always operates in dry-run mode; included as an explicit contract. */
  dryRun: true;

  /** The requested use case. */
  useCase: string;

  /** Maximum number of recommendations requested. */
  maxResults: number;

  /** Ranked recommendations, highest confidence first. */
  recommendations: Recommendation[];

  /** Additive historical context when `--use-memory` is supplied. */
  memoryContext?: MemoryContextSummary;
}

/**
 * A single exploration suggestion for a recipe.
 */
export interface ExplorationSuggestion extends ExplainedFinding {
  /** Recipe the suggestion applies to. */
  recipe: string;

  /** Proposed inclusive seed range to explore. */
  seedRange: { start: number; end: number };
}

/** Structured result of `toneforge intelligence suggest-exploration`. */
export interface SuggestExplorationReport {
  /** Command discriminator. */
  command: "intelligence suggest-exploration";

  /** Intelligence schema version. */
  version: string;

  /** Intelligence is always read-only; included as an explicit contract. */
  readOnly: true;

  /** Intelligence always operates in dry-run mode; included as an explicit contract. */
  dryRun: true;

  /** Recipe the suggestions apply to. */
  recipe: string;

  /** Deterministically ordered suggestions. */
  suggestions: ExplorationSuggestion[];

  /** Additive historical context when `--use-memory` is supplied. */
  memoryContext?: MemoryContextSummary;
}

/**
 * Options common to every Intelligence CLI invocation.
 */
export interface IntelligenceOptions {
  /** Emit machine-readable JSON. */
  json?: boolean;
}

/**
 * Union of every Intelligence report.
 *
 * All members share `command`, `version`, `readOnly`, and `dryRun`.
 */
export type IntelligenceReport = AuditReport | RecommendReport | SuggestExplorationReport;

/**
 * Union of every explainable Intelligence suggestion.
 *
 * All members share the {@link ExplainedFinding} contract (`confidence`,
 * `rationale`, `suggestedCommand`).
 */
export type IntelligenceSuggestion = AuditFinding | Recommendation | ExplorationSuggestion;
