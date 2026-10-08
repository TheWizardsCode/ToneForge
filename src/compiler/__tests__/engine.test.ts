import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  COMPILE_DECISIONS,
  COMPILE_RULESETS,
  MANIFEST_FILE,
  compileLibrary,
  compileLibraryDir,
  decideAsset,
  getCompileRuleset,
  listCompileRulesets,
  planBuild,
  type CompileRuleset,
} from "../engine.js";
import { hashBytes, type BuildManifest } from "../manifest.js";
import { addEntry, clearIndexCache } from "../../library/index.js";
import { encodeWav } from "../../audio/wav-encoder.js";
import type { ExploreCandidate } from "../../explore/types.js";
import { makeEntry } from "./helpers.js";

describe("decideAsset", () => {
  it("leaves assets procedural when no rules match", () => {
    const entry = makeEntry({ id: "lib-1", category: "UI", duration: 0.5 });
    const plan = decideAsset(entry, { target: "web" });
    expect(plan.decision).toBe("procedural");
    expect(plan.reason).toContain("no bake or hybrid rule matched");
  });

  it("bakes assets matching a category rule (case-insensitive)", () => {
    const entry = makeEntry({ id: "lib-1", category: "Impact", duration: 0.5 });
    const plan = decideAsset(entry, {
      target: "web",
      bake: { category: ["impact"] },
    });
    expect(plan.decision).toBe("baked");
    expect(plan.reason).toContain("category 'Impact'");
  });

  it("bakes assets above a duration threshold", () => {
    const entry = makeEntry({ id: "lib-1", duration: 2.5 });
    const plan = decideAsset(entry, {
      target: "web",
      bake: { durationAbove: 2.0 },
    });
    expect(plan.decision).toBe("baked");
    expect(plan.reason).toContain("duration 2.5s > 2s");
  });

  it("bakes assets below a duration threshold", () => {
    const entry = makeEntry({ id: "lib-1", duration: 0.1 });
    const plan = decideAsset(entry, {
      target: "web",
      bake: { durationBelow: 0.2 },
    });
    expect(plan.decision).toBe("baked");
  });

  it("promotes assets matching a hybrid rule", () => {
    const entry = makeEntry({ id: "lib-1", category: "UI", duration: 0.5 });
    const plan = decideAsset(entry, {
      target: "web",
      hybrid: { category: ["UI"] },
    });
    expect(plan.decision).toBe("hybrid");
  });

  it("matches on tags case-insensitively", () => {
    const entry = makeEntry({ id: "lib-1", tags: ["Cinematic", "Heavy"] });
    const plan = decideAsset(entry, {
      target: "web",
      bake: { tags: ["heavy"] },
    });
    expect(plan.decision).toBe("baked");
    expect(plan.reason).toContain("tag 'heavy'");
  });

  it("requires every specified field to match (AND semantics)", () => {
    const entry = makeEntry({ id: "lib-1", category: "Impact", duration: 1.0 });
    const plan = decideAsset(entry, {
      target: "web",
      bake: { category: ["Impact"], durationAbove: 2.0 },
    });
    // Duration is below the threshold, so the whole rule fails.
    expect(plan.decision).toBe("procedural");
  });

  it("gives bake rules precedence over hybrid rules", () => {
    const entry = makeEntry({ id: "lib-1", category: "Impact" });
    const plan = decideAsset(entry, {
      target: "web",
      bake: { category: ["Impact"] },
      hybrid: { category: ["Impact"] },
    });
    expect(plan.decision).toBe("baked");
  });

  it("treats an empty rule as matching everything", () => {
    const entry = makeEntry({ id: "lib-1" });
    const plan = decideAsset(entry, { target: "web", bake: {} });
    expect(plan.decision).toBe("baked");
    expect(plan.reason).toContain("empty rule");
  });
});

describe("planBuild", () => {
  it("returns one decision per entry in input order with counts", () => {
    const entries = [
      makeEntry({ id: "lib-a", category: "Impact", duration: 3 }),
      makeEntry({ id: "lib-b", category: "UI", duration: 1.5 }),
      makeEntry({ id: "lib-c", category: "Footstep", duration: 0.2 }),
    ];
    const plan = planBuild(entries, {
      target: "mobile",
      maxVoices: 16,
      bake: { category: ["Impact"] },
      hybrid: { category: ["UI"] },
    });

    expect(plan.decisions.map((d) => d.assetId)).toEqual([
      "lib-a",
      "lib-b",
      "lib-c",
    ]);
    expect(plan.decisions.map((d) => d.decision)).toEqual([
      "baked",
      "hybrid",
      "procedural",
    ]);
    expect(plan.bakedAssets).toBe(1);
    expect(plan.hybridAssets).toBe(1);
    expect(plan.proceduralAssets).toBe(1);
    expect(plan.target).toBe("mobile");
    expect(plan.maxVoices).toBe(16);
  });

  it("omits maxVoices when the ruleset does not declare one", () => {
    const plan = planBuild([], { target: "web" });
    expect("maxVoices" in plan).toBe(false);
  });

  it("exposes a canonical decision order", () => {
    expect(COMPILE_DECISIONS).toEqual(["procedural", "hybrid", "baked"]);
  });
});

describe("built-in rulesets", () => {
  it("lists and resolves every built-in ruleset", () => {
    const names = listCompileRulesets();
    expect(names).toContain("web_defaults");
    expect(names).toContain("mobile_aggressive");
    for (const name of names) {
      expect(getCompileRuleset(name)).toBe(COMPILE_RULESETS[name]);
    }
  });

  it("throws an actionable error for an unknown ruleset", () => {
    expect(() => getCompileRuleset("nope")).toThrow(/Unknown compile ruleset/);
  });

  it("bakes impact assets in mobile_aggressive", () => {
    const entry = makeEntry({ id: "lib-1", category: "Impact", duration: 1.5 });
    const plan = decideAsset(entry, getCompileRuleset("mobile_aggressive"));
    expect(plan.decision).toBe("baked");
  });
});

describe("compileLibrary", () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), "toneforge-compiler-"));
    clearIndexCache();
  });

  afterEach(async () => {
    clearIndexCache();
    await rm(outDir, { recursive: true, force: true });
  });

  const ruleset: CompileRuleset = {
    target: "test",
    bake: { category: ["Impact"] },
    hybrid: { category: ["UI"] },
  };

  const entries = [
    makeEntry({ id: "lib-impact", category: "Impact", seed: 1, duration: 0.1 }),
    makeEntry({ id: "lib-ui", category: "UI", seed: 2, duration: 0.1 }),
    makeEntry({ id: "lib-step", category: "Footstep", seed: 3, duration: 0.1 }),
  ];

  it("dry-run returns decisions without writing any files", async () => {
    const result = await compileLibrary(entries, {
      ruleset,
      outputDir: outDir,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.written).toEqual([]);
    expect(result.plan.decisions.map((d) => d.decision)).toEqual([
      "baked",
      "hybrid",
      "procedural",
    ]);

    // No output directory contents or manifest are created.
    expect(await readdir(outDir)).toEqual([]);

    // Dry-run manifest records the intended file but no hash/bytes.
    const baked = result.manifest.assets.find((a) => a.assetId === "lib-impact")!;
    expect(baked.decision).toBe("baked");
    expect(baked.file).toBe("Impact/lib-impact.wav");
    expect(baked.hash).toBeNull();
    expect(baked.bytes).toBeNull();

    const procedural = result.manifest.assets.find((a) => a.assetId === "lib-step")!;
    expect(procedural.decision).toBe("procedural");
    expect(procedural.file).toBeNull();
  });

  it("writes WAVs and a manifest whose hashes match the file bytes", async () => {
    const result = await compileLibrary(entries, { ruleset, outputDir: outDir });

    expect(result.written.sort()).toEqual([
      "Impact/lib-impact.wav",
      "UI/lib-ui.wav",
    ]);

    // Procedural assets emit no WAV.
    expect(existsSync(join(outDir, "Footstep/lib-step.wav"))).toBe(false);
    expect(existsSync(join(outDir, MANIFEST_FILE))).toBe(true);

    for (const asset of result.manifest.assets) {
      if (asset.decision === "procedural") continue;
      const bytes = await readFile(join(outDir, asset.file!));
      expect(asset.bytes).toBe(bytes.length);
      expect(asset.hash).toBe(hashBytes(bytes));
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii")).toBe("WAVE");
    }
  });

  it("writes a manifest.json consistent with the returned manifest", async () => {
    const result = await compileLibrary(entries, { ruleset, outputDir: outDir });
    const onDisk = JSON.parse(
      await readFile(join(outDir, MANIFEST_FILE), "utf8"),
    ) as BuildManifest;
    expect(onDisk).toEqual(result.manifest);
  });

  it("is deterministic across repeated runs", async () => {
    const first = await compileLibrary(entries, { ruleset, outputDir: outDir });
    const firstManifest = await readFile(join(outDir, MANIFEST_FILE), "utf8");
    const firstWav = await readFile(join(outDir, "Impact/lib-impact.wav"));

    const secondDir = await mkdtemp(join(tmpdir(), "toneforge-compiler-"));
    try {
      const second = await compileLibrary(entries, {
        ruleset,
        outputDir: secondDir,
      });
      const secondManifest = await readFile(join(secondDir, MANIFEST_FILE), "utf8");
      const secondWav = await readFile(join(secondDir, "Impact/lib-impact.wav"));

      expect(second.manifest).toEqual(first.manifest);
      expect(secondManifest).toBe(firstManifest);
      expect(Buffer.compare(firstWav, secondWav)).toBe(0);
    } finally {
      await rm(secondDir, { recursive: true, force: true });
    }
  });
});

describe("compileLibraryDir", () => {
  let libraryDir: string;
  let outDir: string;

  beforeEach(async () => {
    libraryDir = await mkdtemp(join(tmpdir(), "toneforge-compiler-lib-"));
    outDir = await mkdtemp(join(tmpdir(), "toneforge-compiler-out-"));
    clearIndexCache();
  });

  afterEach(async () => {
    clearIndexCache();
    await rm(libraryDir, { recursive: true, force: true });
    await rm(outDir, { recursive: true, force: true });
  });

  function candidate(seed: number): ExploreCandidate {
    const duration = 0.1;
    return {
      id: `ui_seed-${seed}`,
      recipe: "ui-notification-chime",
      seed,
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

  it("loads entries from the library index and compiles them", async () => {
    const wav = encodeWav(new Float32Array([0.1, 0.2, 0.3]), { sampleRate: 44100 });
    await addEntry(candidate(1), wav, libraryDir);

    const result = await compileLibraryDir(libraryDir, {
      ruleset: { target: "web", bake: {} },
      outputDir: outDir,
    });

    expect(result.plan.decisions).toHaveLength(1);
    expect(result.plan.bakedAssets).toBe(1);
    expect(result.written).toHaveLength(1);
    await expect(stat(join(outDir, MANIFEST_FILE))).resolves.toBeTruthy();
  });
});
