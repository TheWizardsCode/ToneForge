/**
 * Sweep Runner
 *
 * Core exploration engine that iterates over a seed range, renders
 * deterministic audio for each seed, runs analysis metrics, and
 * collects candidates for ranking and clustering.
 *
 * Supports configurable concurrency with a default of
 * max(1, floor(logicalCPUs / 2)).
 *
 * Reference: docs/prd/EXPLORE_PRD.md Section 5.1
 */

import { availableParallelism } from "node:os";
import { renderRecipe } from "../core/renderer.js";
import { createRng } from "../core/rng.js";
import { registry } from "../recipes/index.js";
import {
  createAnalysisEngine,
  registerBuiltinExtractors,
} from "../analyze/index.js";
import type { AnalysisResult } from "../analyze/types.js";
import type {
  ExploreCandidate,
  SweepConfig,
  MutateConfig,
  ProgressCallback,
} from "./types.js";

/**
 * Compute the default concurrency level.
 *
 * Uses max(1, floor(logicalCPUs / 2)) as recommended
 * to avoid saturating the machine.
 */
export function defaultConcurrency(): number {
  return Math.max(1, Math.floor(availableParallelism() / 2));
}

/**
 * Render a single seed and produce a candidate with analysis metrics.
 *
 * This is the atomic unit of work in both sweep and mutate pipelines.
 */
export async function renderAndAnalyze(
  recipe: string,
  seed: number,
): Promise<ExploreCandidate> {
  const reg = registry.getRegistration(recipe);
  if (!reg) {
    throw new Error(`Recipe not found: ${recipe}`);
  }

  const renderResult = await renderRecipe(recipe, seed);

  const engine = createAnalysisEngine();
  registerBuiltinExtractors(engine);
  const analysis = engine.analyze(renderResult.samples, renderResult.sampleRate);

  // Extract rendered parameters for regeneration metadata
  const paramRng = createRng(seed);
  const params = reg.getParams(paramRng);

  const id = `${recipe}_seed-${String(seed).padStart(5, "0")}`;

  return {
    id,
    recipe,
    seed,
    duration: renderResult.duration,
    sampleRate: renderResult.sampleRate,
    sampleCount: renderResult.samples.length,
    analysis,
    score: 0,
    metricScores: {},
    cluster: -1,
    promoted: false,
    libraryId: null,
    params,
  };
}

/**
 * Run a batch of seeds with bounded concurrency.
 *
 * Processes seeds in chunks of `concurrency` size to avoid
 * overwhelming the system. Calls the optional progress callback
 * after each seed completes.
 */
export async function runBatch(
  recipe: string,
  seeds: number[],
  concurrency: number,
  onProgress?: ProgressCallback,
): Promise<ExploreCandidate[]> {
  const candidates: ExploreCandidate[] = [];
  let completed = 0;

  // Process in chunks of `concurrency`
  for (let i = 0; i < seeds.length; i += concurrency) {
    const chunk = seeds.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map((seed) => renderAndAnalyze(recipe, seed)),
    );
    candidates.push(...results);
    completed += results.length;
    onProgress?.(completed, seeds.length);
  }

  return candidates;
}

/**
 * Execute a full sweep over a seed range.
 *
 * 1. Validates the recipe exists
 * 2. Generates seed list from range
 * 3. Renders + analyzes each seed with bounded concurrency
 * 4. Returns raw candidates (ranking/clustering applied separately)
 */
export async function sweep(
  config: SweepConfig,
  onProgress?: ProgressCallback,
): Promise<ExploreCandidate[]> {
  const reg = registry.getRegistration(config.recipe);
  if (!reg) {
    throw new Error(`Recipe not found: ${config.recipe}`);
  }

  // Generate seed list
  const seeds: number[] = [];
  for (let s = config.seedStart; s <= config.seedEnd; s++) {
    seeds.push(s);
  }

  if (seeds.length === 0) {
    return [];
  }

  return runBatch(config.recipe, seeds, config.concurrency, onProgress);
}

/**
 * Generate mutated seeds deterministically from a base seed.
 *
 * Uses the base seed to initialize an RNG, then generates `count`
 * new seeds by jittering around the base seed value.
 */
export function generateMutatedSeeds(
  baseSeed: number,
  count: number,
  jitter: number,
): number[] {
  const rng = createRng(baseSeed);
  const seeds: number[] = [];
  const range = Math.max(1, Math.floor(jitter * 10000));

  for (let i = 0; i < count; i++) {
    // Generate a deterministic offset from the base seed
    const offset = Math.floor(rng() * range * 2) - range;
    const mutatedSeed = Math.abs(baseSeed + offset + i);
    seeds.push(mutatedSeed);
  }

  return seeds;
}

/**
 * Execute a mutate run: generate variations around a base seed.
 *
 * 1. Generates deterministic mutated seeds
 * 2. Renders + analyzes each variation
 * 3. Returns raw candidates
 */
export async function mutate(
  config: MutateConfig,
  onProgress?: ProgressCallback,
): Promise<ExploreCandidate[]> {
  const reg = registry.getRegistration(config.recipe);
  if (!reg) {
    throw new Error(`Recipe not found: ${config.recipe}`);
  }

  const seeds = generateMutatedSeeds(config.seed, config.count, config.jitter);

  return runBatch(config.recipe, seeds, config.concurrency, onProgress);
}
