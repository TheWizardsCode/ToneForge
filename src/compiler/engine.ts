/**
 * Compiler Engine
 *
 * Implements ToneForge's procedural-vs-baked decision model and the
 * top-level compilation orchestration.
 *
 * For every Library entry the engine picks one of three strategies
 * based on a declarative {@link CompileRuleset}:
 *
 * - `procedural` — keep the recipe; emit no WAV.
 * - `hybrid`     — bake the asset but keep a procedural core in the
 *                  runtime manifest; emit a WAV.
 * - `baked`      — fully bake the asset; emit a WAV.
 *
 * Decisions are rule-driven, explainable (each carries a `reason`), and
 * deterministic: the same entries and ruleset always yield the same
 * plan.
 *
 * Reference: docs/prd/COMPILER_PRD.md Sections 7, 9, 10.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { listEntries } from "../library/index.js";
import type { LibraryEntry, LibraryFilter } from "../library/types.js";
import {
  createManifest,
  hashBytes,
  serializeManifest,
  type BuildManifest,
  type ManifestAsset,
} from "./manifest.js";
import { assetOutputPath, renderAsset, writeAsset } from "./output.js";

/** Per-asset compilation strategy. */
export type CompileDecision = "procedural" | "hybrid" | "baked";

/** Canonical decision order, least to most baked. */
export const COMPILE_DECISIONS: readonly CompileDecision[] = [
  "procedural",
  "hybrid",
  "baked",
] as const;

/** Manifest file written into the build output directory. */
export const MANIFEST_FILE = "manifest.json";

/**
 * Criteria for a bake/hybrid rule.
 *
 * All specified fields must match (logical AND). Within `category` and
 * `tags` any one listed value matches (logical OR). `category` and tag
 * matching is case-insensitive; duration bounds are exclusive
 * (`durationAbove` means strictly greater, `durationBelow` strictly
 * less).
 */
export interface AssetMatchRule {
  /** Match assets whose category is one of these. */
  category?: readonly string[];
  /** Match assets carrying at least one of these tags. */
  tags?: readonly string[];
  /** Match assets whose duration is strictly greater than this (seconds). */
  durationAbove?: number;
  /** Match assets whose duration is strictly less than this (seconds). */
  durationBelow?: number;
}

/** A declarative compilation ruleset for a platform target. */
export interface CompileRuleset {
  /** Platform target name (web, mobile, console, desktop, ...). */
  target: string;
  /** Advisory voice budget for the target. */
  maxVoices?: number;
  /** Rule promoting an asset to fully baked (highest precedence). */
  bake?: AssetMatchRule;
  /** Rule promoting an asset to hybrid. */
  hybrid?: AssetMatchRule;
}

/** A single asset's compilation decision with an explanation. */
export interface AssetPlan {
  /** Library entry id. */
  assetId: string;
  /** Entry category. */
  category: string;
  /** Recipe that generated the asset. */
  recipe: string;
  /** Duration in seconds. */
  duration: number;
  /** Chosen strategy. */
  decision: CompileDecision;
  /** Human-readable explanation of the decision. */
  reason: string;
}

/** Deterministic per-asset plan for a compilation run. */
export interface BuildPlan {
  /** Platform target name. */
  target: string;
  /** Advisory voice budget, when the ruleset declares one. */
  maxVoices?: number;
  /** One decision per entry, in input order. */
  decisions: AssetPlan[];
  /** Number of assets left procedural. */
  proceduralAssets: number;
  /** Number of hybrid assets. */
  hybridAssets: number;
  /** Number of fully baked assets. */
  bakedAssets: number;
}

/**
 * Built-in compilation rulesets.
 *
 * `web_defaults` bakes heavy, long assets and keeps everything else
 * procedural. `mobile_aggressive` bakes earlier and promotes mid-length
 * assets to hybrid, reflecting mobile CPU/memory pressure.
 */
export const COMPILE_RULESETS: Readonly<Record<string, CompileRuleset>> = {
  web_defaults: {
    target: "web",
    maxVoices: 32,
    bake: { category: ["Impact", "Creature"], durationAbove: 2.0 },
    hybrid: { durationAbove: 1.0 },
  },
  mobile_aggressive: {
    target: "mobile",
    maxVoices: 16,
    bake: { category: ["Impact", "Creature", "Vehicle"], durationAbove: 1.0 },
    hybrid: { durationAbove: 0.5 },
  },
};

/** Names of the built-in compilation rulesets. */
export type CompileRulesetName = keyof typeof COMPILE_RULESETS;

/** List the built-in compilation ruleset names. */
export function listCompileRulesets(): string[] {
  return Object.keys(COMPILE_RULESETS);
}

/**
 * Resolve a built-in ruleset by name.
 *
 * @throws If the name is not a built-in ruleset.
 */
export function getCompileRuleset(name: string): CompileRuleset {
  const ruleset = COMPILE_RULESETS[name];
  if (!ruleset) {
    throw new Error(
      `Unknown compile ruleset '${name}'. ` +
        `Built-in rulesets: ${listCompileRulesets().join(", ")}.`,
    );
  }
  return ruleset;
}

/** Evaluate one match rule against an entry. */
function matchRule(
  entry: LibraryEntry,
  rule: AssetMatchRule,
): { matched: boolean; reason: string } {
  const reasons: string[] = [];

  if (rule.category && rule.category.length > 0) {
    const category = entry.category.toLowerCase();
    if (!rule.category.some((c) => c.toLowerCase() === category)) {
      return { matched: false, reason: "" };
    }
    reasons.push(`category '${entry.category}'`);
  }

  if (rule.tags && rule.tags.length > 0) {
    const tags = new Set(entry.tags.map((t) => t.toLowerCase()));
    const hit = rule.tags.find((t) => tags.has(t.toLowerCase()));
    if (!hit) return { matched: false, reason: "" };
    reasons.push(`tag '${hit}'`);
  }

  if (rule.durationAbove !== undefined) {
    if (!(entry.duration > rule.durationAbove)) {
      return { matched: false, reason: "" };
    }
    reasons.push(`duration ${entry.duration}s > ${rule.durationAbove}s`);
  }

  if (rule.durationBelow !== undefined) {
    if (!(entry.duration < rule.durationBelow)) {
      return { matched: false, reason: "" };
    }
    reasons.push(`duration ${entry.duration}s < ${rule.durationBelow}s`);
  }

  return {
    matched: true,
    reason: reasons.length > 0 ? reasons.join(" and ") : "empty rule (matches all)",
  };
}

/** Assemble an {@link AssetPlan} from an entry and decision. */
function toPlan(
  entry: LibraryEntry,
  decision: CompileDecision,
  reason: string,
): AssetPlan {
  return {
    assetId: entry.id,
    category: entry.category,
    recipe: entry.recipe,
    duration: entry.duration,
    decision,
    reason,
  };
}

/**
 * Decide the compilation strategy for a single entry.
 *
 * Bake rules take precedence over hybrid rules; assets matching
 * neither are left procedural.
 */
export function decideAsset(
  entry: LibraryEntry,
  ruleset: CompileRuleset,
): AssetPlan {
  if (ruleset.bake) {
    const match = matchRule(entry, ruleset.bake);
    if (match.matched) {
      return toPlan(entry, "baked", `bake rule: ${match.reason}`);
    }
  }
  if (ruleset.hybrid) {
    const match = matchRule(entry, ruleset.hybrid);
    if (match.matched) {
      return toPlan(entry, "hybrid", `hybrid rule: ${match.reason}`);
    }
  }
  return toPlan(entry, "procedural", "no bake or hybrid rule matched");
}

/**
 * Build a deterministic per-asset plan for a set of entries.
 *
 * Decisions are returned in input order; the counts are derived from
 * the decisions.
 */
export function planBuild(
  entries: readonly LibraryEntry[],
  ruleset: CompileRuleset,
): BuildPlan {
  const decisions = entries.map((entry) => decideAsset(entry, ruleset));

  let proceduralAssets = 0;
  let hybridAssets = 0;
  let bakedAssets = 0;
  for (const decision of decisions) {
    if (decision.decision === "baked") bakedAssets++;
    else if (decision.decision === "hybrid") hybridAssets++;
    else proceduralAssets++;
  }

  const plan: BuildPlan = {
    target: ruleset.target,
    decisions,
    proceduralAssets,
    hybridAssets,
    bakedAssets,
  };
  if (ruleset.maxVoices !== undefined) {
    plan.maxVoices = ruleset.maxVoices;
  }
  return plan;
}

/** Options for {@link compileLibrary}. */
export interface CompileOptions {
  /** Declarative compilation ruleset. */
  ruleset: CompileRuleset;
  /** Build output directory. */
  outputDir: string;
  /**
   * When true, compute and return the plan and manifest without
   * rendering WAVs or writing any files.
   */
  dryRun?: boolean;
}

/** Options for {@link compileLibraryDir}. */
export interface CompileDirOptions extends CompileOptions {
  /** Optional entry filter (category, recipe, tags). */
  filter?: LibraryFilter;
}

/** Result of a compilation run. */
export interface CompileResult {
  /** Platform target name. */
  target: string;
  /** Whether this was a dry run (no files written). */
  dryRun: boolean;
  /** Absolute build output directory. */
  outputDir: string;
  /** Per-asset decisions. */
  plan: BuildPlan;
  /** Deterministic build manifest. */
  manifest: BuildManifest;
  /** Relative paths of WAVs written (empty for dry runs). */
  written: string[];
}

/** Build the manifest asset for a procedural (no-file) decision. */
function proceduralManifestAsset(decision: AssetPlan): ManifestAsset {
  return {
    assetId: decision.assetId,
    category: decision.category,
    recipe: decision.recipe,
    duration: decision.duration,
    decision: decision.decision,
    file: null,
    hash: null,
    bytes: null,
  };
}

/**
 * Compile a set of Library entries.
 *
 * Runs the ruleset over the entries and, unless `dryRun` is set,
 * renders each baked/hybrid asset to a WAV, writes it under
 * `outputDir`, and writes a deterministic `manifest.json`.
 *
 * Dry runs return the same plan and manifest shape but write nothing
 * and leave every `hash`/`bytes` field `null`.
 */
export async function compileLibrary(
  entries: readonly LibraryEntry[],
  options: CompileOptions,
): Promise<CompileResult> {
  const dryRun = options.dryRun ?? false;
  const outputDir = resolve(options.outputDir);
  const plan = planBuild(entries, options.ruleset);
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

  const manifestAssets: ManifestAsset[] = [];
  const written: string[] = [];

  for (const decision of plan.decisions) {
    const entry = entryById.get(decision.assetId);
    if (!entry) continue;

    if (decision.decision === "procedural") {
      manifestAssets.push(proceduralManifestAsset(decision));
      continue;
    }

    if (dryRun) {
      manifestAssets.push({
        ...proceduralManifestAsset(decision),
        file: assetOutputPath(entry),
      });
      continue;
    }

    const output = await renderAsset(entry);
    const file = await writeAsset(output, outputDir);
    written.push(file);
    manifestAssets.push({
      assetId: decision.assetId,
      category: decision.category,
      recipe: decision.recipe,
      duration: decision.duration,
      decision: decision.decision,
      file,
      hash: hashBytes(output.bytes),
      bytes: output.bytes.length,
    });
  }

  const manifest = createManifest({
    target: options.ruleset.target,
    assets: manifestAssets,
  });

  if (!dryRun) {
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      resolve(outputDir, MANIFEST_FILE),
      serializeManifest(manifest) + "\n",
      "utf8",
    );
  }

  return {
    target: options.ruleset.target,
    dryRun,
    outputDir,
    plan,
    manifest,
    written,
  };
}

/**
 * Compile a Library stored on disk.
 *
 * Loads entries from the library index (optionally filtered) and
 * delegates to {@link compileLibrary}.
 */
export async function compileLibraryDir(
  libraryDir: string,
  options: CompileDirOptions,
): Promise<CompileResult> {
  const entries = await listEntries(options.filter, libraryDir);
  return compileLibrary(entries, options);
}
