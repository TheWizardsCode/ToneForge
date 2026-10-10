/**
 * Shared helpers for CLI command tests.
 *
 * Provides output capture for the in-process yargs entrypoint and temp
 * library fixtures built through the real Library API (so tests exercise
 * the same index/WAV layout the CLI reads in production).
 */

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addEntry, clearIndexCache } from "../src/library/index.js";
import { encodeWav } from "../src/audio/wav-encoder.js";
import type { LibraryEntry } from "../src/library/types.js";
import type { ExploreCandidate } from "../src/explore/types.js";

/** Captured CLI output and exit code. */
export interface CapturedOutput {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run `fn` while capturing everything written to stdout/stderr (both the
 * `process.*.write` and `console.*` paths), then restore the originals.
 */
export async function captureOutput(fn: () => Promise<number>): Promise<CapturedOutput> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const origLog = console.log;
  const origError = console.error;
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

  console.log = (...args: unknown[]) => {
    stdoutLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderrLines.push(args.map(String).join(" "));
  };
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutLines.push(String(chunk).replace(/\n$/, ""));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrLines.push(String(chunk).replace(/\n$/, ""));
    return true;
  }) as typeof process.stderr.write;

  try {
    const code = await fn();
    return { code, stdout: stdoutLines.join("\n"), stderr: stderrLines.join("\n") };
  } finally {
    console.log = origLog;
    console.error = origError;
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

/** Create an isolated temp directory and clear the library index cache. */
export async function createTempDir(prefix = "toneforge-cli-"): Promise<string> {
  clearIndexCache();
  return mkdtemp(join(tmpdir(), prefix));
}

/** Compact description of a library entry fixture. */
export interface CandidateSpec {
  /** Candidate id (the stored entry id is `lib-<id>`). */
  id: string;
  recipe?: string;
  seed?: number;
  /** Duration in seconds. */
  duration: number;
  /** Analysis peak amplitude. */
  peak?: number;
  /** Fraction of leading samples that are silent (0-1). */
  silentFraction?: number;
  /** Classification category (drives the entry's category when set). */
  category?: string;
  /** Classification tags (drives the entry's tags when set). */
  tags?: string[];
}

/**
 * Add a real library entry (index + WAV + metadata) to `dir`.
 *
 * The stored WAV carries `silentFraction` of leading silent samples so the
 * validator's silence-ratio check is deterministic.
 */
export async function addLibraryEntry(
  dir: string,
  spec: CandidateSpec,
): Promise<LibraryEntry> {
  const duration = spec.duration;
  const sampleCount = Math.max(2, Math.round(duration * 44100));

  const candidate: ExploreCandidate = {
    id: spec.id,
    recipe: spec.recipe ?? "ui-notification-chime",
    seed: spec.seed ?? 1,
    duration,
    sampleRate: 44100,
    sampleCount,
    analysis: {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount,
      metrics: { time: { duration, peak: spec.peak ?? 0.6, rms: 0.3, crestFactor: 1.5 } },
    },
    score: 0.5,
    metricScores: {},
    cluster: -1,
    promoted: false,
    libraryId: null,
    params: {},
  };

  if (spec.category) {
    candidate.classification = {
      source: spec.id,
      category: spec.category,
      intensity: "medium",
      texture: [],
      material: null,
      tags: spec.tags ?? [],
      embedding: [],
      analysisRef: "",
    };
  }

  const silent = Math.round(sampleCount * (spec.silentFraction ?? 0));
  const samples = new Float32Array(sampleCount);
  for (let i = silent; i < sampleCount; i++) samples[i] = 0.6;
  const wav = encodeWav(samples, { sampleRate: 44100 });

  return addEntry(candidate, wav, dir);
}
