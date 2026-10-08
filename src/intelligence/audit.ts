/**
 * ToneForge Intelligence — library audit engine.
 *
 * `auditLibrary` inspects a curated library and reports three classes of
 * issue without ever mutating the library:
 *
 * 1. **Coverage gaps** — categories missing a canonical intensity bucket or
 *    lacking material variety.
 * 2. **Redundancy** — clusters of perceptually similar entries that could be
 *    pruned to a representative subset.
 * 3. **Quality issues** — clipping, silence, or out-of-bounds duration
 *    derived from existing analysis metrics.
 *
 * Every finding carries a confidence in [0, 1], a rationale, and an
 * actionable CLI command (validated against the real CLI surface by tests).
 *
 * Reference: docs/prd/INTELLIGENCE_PRD.md §5.2 (Library Optimization),
 * §5.5 (Quality Assurance Assistance), §7 (Explainability).
 */

import type { LibraryEntry } from "../library/types.js";
import {
  analyzeRecipeCommand,
  exploreSweepCommand,
  libraryListCommand,
  librarySimilarCommand,
} from "./commands.js";
import {
  clamp,
  clusterByEmbedding,
  hasEmbedding,
  intensityBucket,
  loadLibraryEntries,
  roundTo,
  slugify,
} from "./library.js";
import type { IntensityBucket } from "./library.js";
import type {
  AuditFinding,
  AuditFindingKind,
  AuditReport,
  AuditSummary,
} from "./types.js";
import { INTELLIGENCE_VERSION } from "./types.js";

/** Tuning for the audit engine. */
export interface AuditOptions {
  /** Minimum cluster size reported as redundant. Default: 3. */
  minClusterSize?: number;

  /** Maximum embedding distance for cluster membership. Default: 0.35. */
  similarityThreshold?: number;

  /** Durations above this (seconds) are flagged. Default: 5. */
  maxDuration?: number;
}

const DEFAULT_MIN_CLUSTER = 3;
const DEFAULT_SIMILARITY_THRESHOLD = 0.35;
const DEFAULT_MAX_DURATION = 5;

/** Canonical intensity buckets audited for coverage. */
const CANONICAL_BUCKETS: readonly IntensityBucket[] = ["soft", "medium", "hard"];

/** Category grouping key. */
function categoryKey(entry: LibraryEntry): string {
  return (entry.category || "uncategorized").toLowerCase();
}

/** Pick a deterministic representative recipe for a category. */
function representativeRecipe(members: LibraryEntry[]): string | undefined {
  const recipes = [...new Set(members.map((m) => m.recipe))].sort((a, b) => a.localeCompare(b));
  return recipes[0];
}

/** Coverage-gap findings for a single category. */
function coverageFindingsForCategory(category: string, members: LibraryEntry[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const sortedMembers = [...members].sort((a, b) => a.id.localeCompare(b.id));

  const buckets = new Set<IntensityBucket>();
  for (const member of sortedMembers) {
    buckets.add(intensityBucket(member.classification?.intensity));
  }

  const recipe = representativeRecipe(sortedMembers);
  const suggestedCommand =
    recipe !== undefined
      ? exploreSweepCommand(recipe, 0, 99, "rms")
      : libraryListCommand(category);

  for (const bucket of CANONICAL_BUCKETS) {
    if (buckets.has(bucket)) continue;
    // A category with a single entry is expected to be sparse; still report
    // the missing buckets but with lower confidence.
    const base = 0.55 + Math.min(0.3, sortedMembers.length * 0.05);
    findings.push({
      id: `audit-coverage-${slugify(category)}-${bucket}`,
      kind: "coverage-gap",
      summary: `No ${bucket} intensity sounds in category '${category}'`,
      assets: sortedMembers.map((m) => m.id),
      confidence: roundTo(clamp(base, 0, 1)),
      rationale:
        `Category '${category}' has ${sortedMembers.length} entr` +
        `${sortedMembers.length === 1 ? "y" : "ies"} but none in the ` +
        `'${bucket}' intensity bucket (present: ${[...buckets].sort().join(", ") || "none"}).`,
      suggestedCommand,
      supportingMetrics: {
        category,
        bucket,
        entryCount: sortedMembers.length,
        presentBuckets: [...buckets].sort().join(","),
      },
    });
  }

  const materials = new Set(
    sortedMembers
      .map((m) => m.classification?.material ?? null)
      .filter((m): m is string => typeof m === "string" && m.length > 0),
  );
  if (sortedMembers.length >= 2 && materials.size <= 1) {
    findings.push({
      id: `audit-coverage-${slugify(category)}-materials`,
      kind: "coverage-gap",
      summary: `Category '${category}' has only ${materials.size} material${materials.size === 1 ? "" : "s"}`,
      assets: sortedMembers.map((m) => m.id),
      confidence: 0.7,
      rationale:
        `Category '${category}' contains ${sortedMembers.length} entries but only ` +
        `${materials.size} distinct material label${materials.size === 1 ? "" : "s"} ` +
        `(${[...materials].sort().join(", ") || "none"}).`,
      suggestedCommand,
      supportingMetrics: {
        category,
        materialCount: materials.size,
        entryCount: sortedMembers.length,
      },
    });
  }

  return findings;
}

/** Redundancy findings across the whole library. */
function redundancyFindings(entries: LibraryEntry[], options: Required<Pick<AuditOptions, "minClusterSize" | "similarityThreshold">>): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const clusters = clusterByEmbedding(entries, options.similarityThreshold);

  for (const cluster of clusters) {
    if (cluster.length < options.minClusterSize) continue;
    const sorted = [...cluster].sort((a, b) => a.id.localeCompare(b.id));
    const exemplar = sorted[0]!;

    // Average pairwise distance to the exemplar, for confidence.
    const exemplarEmbedding = exemplar.classification!.embedding;
    let distanceSum = 0;
    let distanceCount = 0;
    for (const member of sorted) {
      if (member.id === exemplar.id) continue;
      const embedding = member.classification!.embedding;
      let sum = 0;
      const len = Math.min(exemplarEmbedding.length, embedding.length);
      for (let i = 0; i < len; i++) {
        const d = (exemplarEmbedding[i] ?? 0) - (embedding[i] ?? 0);
        sum += d * d;
      }
      distanceSum += Math.sqrt(sum);
      distanceCount++;
    }
    const averageDistance = distanceCount > 0 ? distanceSum / distanceCount : 0;
    const tightness = clamp(1 - averageDistance / options.similarityThreshold, 0, 1);
    const sizeBoost = Math.min(0.2, (sorted.length - options.minClusterSize) * 0.05);
    const confidence = clamp(0.5 + tightness * 0.3 + sizeBoost, 0, 1);

    findings.push({
      id: `audit-redundancy-${slugify(exemplar.recipe)}-${slugify(exemplar.id)}`,
      kind: "redundancy",
      summary: `${sorted.length} similar entries cluster around '${exemplar.id}'`,
      assets: sorted.map((m) => m.id),
      confidence: roundTo(confidence),
      rationale:
        `${sorted.length} entries have near-identical embeddings ` +
        `(average distance ${roundTo(averageDistance, 3)} <= threshold ` +
        `${options.similarityThreshold}); consider pruning to a representative subset.`,
      suggestedCommand: librarySimilarCommand(exemplar.id, 5),
      supportingMetrics: {
        clusterSize: sorted.length,
        averageDistance: roundTo(averageDistance, 4),
        threshold: options.similarityThreshold,
        exemplar: exemplar.id,
      },
    });
  }

  return findings;
}

/** Quality findings derived from analysis metrics and duration. */
function qualityFindings(entries: LibraryEntry[], maxDuration: number): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const entry of entries) {
    const metrics = entry.analysis.metrics ?? {};
    const quality = metrics["quality"] ?? {};
    const time = metrics["time"] ?? {};

    const clipping = quality["clipping"] === true;
    const silence = quality["silence"] === true;
    const duration = typeof time["duration"] === "number" ? (time["duration"] as number) : entry.duration;
    const peak = typeof time["peak"] === "number" ? (time["peak"] as number) : undefined;

    const suggestedCommand = analyzeRecipeCommand(entry.recipe, entry.seed);

    if (clipping) {
      findings.push({
        id: `audit-quality-${slugify(entry.id)}-clipping`,
        kind: "quality",
        summary: `Entry '${entry.id}' is clipped`,
        assets: [entry.id],
        confidence: 0.95,
        rationale: `Analysis flagged clipping for '${entry.id}'; peak amplitude${peak !== undefined ? ` ${roundTo(peak, 4)}` : ""} exceeds the safe range.`,
        suggestedCommand,
        supportingMetrics: { entryId: entry.id, clipping: true, ...(peak !== undefined ? { peak: roundTo(peak, 4) } : {}) },
      });
    }

    if (silence) {
      findings.push({
        id: `audit-quality-${slugify(entry.id)}-silence`,
        kind: "quality",
        summary: `Entry '${entry.id}' is silent`,
        assets: [entry.id],
        confidence: 0.95,
        rationale: `Analysis flagged silence for '${entry.id}'; the rendered audio carries no usable signal.`,
        suggestedCommand,
        supportingMetrics: { entryId: entry.id, silence: true },
      });
    }

    if (duration <= 0 || duration > maxDuration) {
      findings.push({
        id: `audit-quality-${slugify(entry.id)}-duration`,
        kind: "quality",
        summary: `Entry '${entry.id}' has an out-of-bounds duration (${roundTo(duration, 3)}s)`,
        assets: [entry.id],
        confidence: 0.8,
        rationale:
          `Duration ${roundTo(duration, 3)}s is outside the expected range ` +
          `(0 < duration <= ${maxDuration}s).`,
        suggestedCommand,
        supportingMetrics: { entryId: entry.id, duration: roundTo(duration, 4), maxDuration },
      });
    }
  }

  return findings;
}

/** Sort findings into a stable, human-friendly order. */
function sortFindings(findings: AuditFinding[]): AuditFinding[] {
  const kindOrder: Record<AuditFindingKind, number> = {
    "coverage-gap": 0,
    redundancy: 1,
    quality: 2,
  };
  return [...findings].sort((a, b) => {
    if (kindOrder[a.kind] !== kindOrder[b.kind]) return kindOrder[a.kind] - kindOrder[b.kind];
    return a.id.localeCompare(b.id);
  });
}

/**
 * Build an audit report from in-memory entries (pure; no I/O).
 */
export function buildAuditReport(
  entries: LibraryEntry[],
  library: string,
  options?: AuditOptions,
): AuditReport {
  const minClusterSize = options?.minClusterSize ?? DEFAULT_MIN_CLUSTER;
  const similarityThreshold = options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const maxDuration = options?.maxDuration ?? DEFAULT_MAX_DURATION;

  const sortedEntries = [...entries].sort((a, b) => a.id.localeCompare(b.id));

  const byCategory = new Map<string, LibraryEntry[]>();
  for (const entry of sortedEntries) {
    const key = categoryKey(entry);
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(entry);
    else byCategory.set(key, [entry]);
  }

  const coverage = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([category, members]) => coverageFindingsForCategory(category, members));

  const redundancy = redundancyFindings(sortedEntries, { minClusterSize, similarityThreshold });
  const quality = qualityFindings(sortedEntries, maxDuration);

  const findings = sortFindings([...coverage, ...redundancy, ...quality]);

  const summary: AuditSummary = {
    entries: sortedEntries.length,
    categories: byCategory.size,
    coverageGaps: coverage.length,
    redundancies: redundancy.length,
    qualityIssues: quality.length,
  };

  return {
    command: "intelligence audit",
    version: INTELLIGENCE_VERSION,
    library,
    totalEntries: sortedEntries.length,
    categories: [...byCategory.keys()].sort(),
    findings,
    summary,
  };
}

/**
 * Audit the library at `libraryDir`.
 *
 * This is a read-only operation: it never writes to the library directory.
 *
 * @param libraryDir - Directory containing `index.json`.
 * @param options - Optional engine tuning.
 */
export async function auditLibrary(
  libraryDir: string,
  options?: AuditOptions,
): Promise<AuditReport> {
  const entries = await loadLibraryEntries(libraryDir);
  return buildAuditReport(entries, libraryDir, options);
}

/** Re-export for consumers that only need the length check. */
export { hasEmbedding };
