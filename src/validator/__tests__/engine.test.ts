import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHECK_NAMES, validateLibrary, validateLibraryDir } from "../engine.js";
import { addEntry, clearIndexCache } from "../../library/index.js";
import { encodeWav } from "../../audio/wav-encoder.js";
import type { ExploreCandidate } from "../../explore/types.js";
import { makeEntry } from "./helpers.js";

describe("validateLibrary", () => {
  const goodEntry = makeEntry({ id: "lib-good", peak: 0.8, duration: 0.5, silenceRatio: 0.1 });
  const clippingEntry = makeEntry({ id: "lib-clip", peak: 0.99, duration: 0.5, silenceRatio: 0.1 });
  const longEntry = makeEntry({ id: "lib-long", peak: 0.8, duration: 3, silenceRatio: 0.1 });

  it("counts pass/warning/error results per check and per asset", () => {
    const report = validateLibrary([goodEntry, clippingEntry, longEntry], {
      ruleset: "mobile",
      strictness: "error",
    });

    expect(report.entryCount).toBe(3);
    expect(report.assets).toHaveLength(3);
    expect(report.assets.map((a) => a.assetId)).toEqual(["lib-good", "lib-clip", "lib-long"]);
    expect(report.assets.map((a) => a.status)).toEqual(["pass", "error", "error"]);
    expect(report.assets[0]!.checks).toHaveLength(3);

    // 7 passing checks, 2 violating checks.
    expect(report.counts).toMatchObject({ pass: 7, error: 2, warning: 0, info: 0 });
    expect(report.perCheck.peak_clipping).toMatchObject({ pass: 2, error: 1 });
    expect(report.perCheck.duration_bounds).toMatchObject({ pass: 2, error: 1 });
    expect(report.perCheck.silence_ratio).toMatchObject({ pass: 3, error: 0 });
  });

  it("marks the run blocking only when errors are present", () => {
    const blocking = validateLibrary([clippingEntry], { ruleset: "mobile", strictness: "error" });
    expect(blocking.status).toBe("error");
    expect(blocking.blocking).toBe(true);

    const warning = validateLibrary([clippingEntry], { ruleset: "mobile", strictness: "warning" });
    expect(warning.status).toBe("warning");
    expect(warning.blocking).toBe(false);
    expect(warning.counts.warning).toBe(1);

    const info = validateLibrary([clippingEntry], { ruleset: "mobile", strictness: "info" });
    expect(info.status).toBe("info");
    expect(info.blocking).toBe(false);
    expect(info.counts.info).toBe(1);
  });

  it("defaults to warning strictness", () => {
    const report = validateLibrary([clippingEntry], { ruleset: "mobile" });
    expect(report.strictness).toBe("warning");
    expect(report.assets[0]!.checks.find((c) => c.check === "peak_clipping")!.status).toBe("warning");
  });

  it("runs the silence check from supplied samples", () => {
    const entry = makeEntry({ id: "lib-quiet", peak: 0.8, duration: 0.5 });
    const samples = new Float32Array([0, 0, 0.6, 0.6]);

    const report = validateLibrary([entry], {
      ruleset: "web",
      strictness: "error",
      samples: new Map([[entry.id, samples]]),
    });

    const silence = report.perCheck.silence_ratio;
    expect(silence.error).toBe(1);
    expect(report.assets[0]!.checks.find((c) => c.check === "silence_ratio")!.value).toBeCloseTo(0.5, 6);
  });

  it("accepts samples as a plain record", () => {
    const entry = makeEntry({ id: "lib-quiet", peak: 0.8, duration: 0.5 });
    const report = validateLibrary([entry], {
      ruleset: "web",
      strictness: "error",
      samples: { [entry.id]: new Float32Array([0, 0, 0.6, 0.6]) },
    });
    expect(report.perCheck.silence_ratio.error).toBe(1);
  });

  it("skips the silence check when no samples or metric are available", () => {
    const entry = makeEntry({ id: "lib-no-audio", peak: 0.8, duration: 0.5 });
    const report = validateLibrary([entry], { ruleset: "mobile", strictness: "error" });

    expect(report.counts.skipped).toBe(1);
    expect(report.perCheck.silence_ratio.skipped).toBe(1);
    expect(report.assets[0]!.status).toBe("pass");
  });

  it("produces a deterministic, JSON-serialisable report", () => {
    const entries = [goodEntry, clippingEntry, longEntry];
    const first = validateLibrary(entries, { ruleset: "console", strictness: "error" });
    const second = validateLibrary(entries, { ruleset: "console", strictness: "error" });

    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(second).toEqual(first);
  });

  it("exposes a stable canonical check order", () => {
    expect(CHECK_NAMES).toEqual(["peak_clipping", "duration_bounds", "silence_ratio"]);
  });

  it("supports a custom ruleset object", () => {
    const report = validateLibrary([goodEntry], {
      ruleset: {
        name: "web",
        audio: {
          peakClipping: { maxPeak: 0.5 },
          duration: { min: 0.01, max: 10 },
          silenceRatio: { maxRatio: 1, threshold: 0.001 },
        },
      },
      strictness: "error",
    });
    expect(report.ruleset).toBe("web");
    expect(report.perCheck.peak_clipping.error).toBe(1);
  });

  it("returns an empty pass report for no entries", () => {
    const report = validateLibrary([], { ruleset: "mobile" });
    expect(report.entryCount).toBe(0);
    expect(report.status).toBe("pass");
    expect(report.blocking).toBe(false);
    expect(report.counts.pass).toBe(0);
  });
});

describe("validateLibraryDir", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "toneforge-validator-"));
    clearIndexCache();
  });

  afterEach(async () => {
    clearIndexCache();
    await rm(tempDir, { recursive: true, force: true });
  });

  function makeCandidate(): ExploreCandidate {
    const duration = 0.5;
    return {
      id: "ui_seed-1",
      recipe: "ui-confirm",
      seed: 1,
      duration,
      sampleRate: 44100,
      sampleCount: Math.round(duration * 44100),
      analysis: {
        analysisVersion: "1.0",
        sampleRate: 44100,
        sampleCount: Math.round(duration * 44100),
        metrics: { time: { duration, peak: 0.6, rms: 0.3, crestFactor: 1.5 } },
      },
      score: 0.5,
      metricScores: {},
      cluster: -1,
      promoted: false,
      libraryId: null,
      params: {},
    };
  }

  it("validates entries decoded from a library on disk", async () => {
    // Half the samples are loud, half are silent -> silence ratio 0.5.
    const samples = new Float32Array(1000);
    for (let i = 0; i < 500; i++) samples[i] = 0.6;
    const wav = encodeWav(samples, { sampleRate: 44100 });
    const entry = await addEntry(makeCandidate(), wav, tempDir);

    const report = await validateLibraryDir(tempDir, {
      ruleset: "web",
      strictness: "error",
    });

    expect(report.entryCount).toBe(1);
    expect(report.assets[0]!.assetId).toBe(entry.id);
    expect(report.perCheck.silence_ratio.error).toBe(1);
    expect(report.blocking).toBe(true);
  });

  it("skips the silence check when an entry has no decodable WAV", async () => {
    const samples = new Float32Array([0.6, 0.6]);
    const wav = encodeWav(samples, { sampleRate: 44100 });
    const entry = await addEntry(makeCandidate(), wav, tempDir);
    // Remove the WAV behind the library's back.
    await rm(join(tempDir, entry.files.wav), { force: true });

    const report = await validateLibraryDir(tempDir, {
      ruleset: "web",
      strictness: "error",
    });

    expect(report.perCheck.silence_ratio.skipped).toBe(1);
  });
});
