/**
 * CLI Integration Tests for the library command.
 *
 * Tests help text, flag validation, and actual list/search/similar/export/regenerate
 * operations using populated library data.
 *
 * Work item: TF-0MM1GPDOM0EE7U09
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing modules that transitively use them
// ---------------------------------------------------------------------------

// Mock playAudio to avoid actual audio playback
vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

// Mock renderer & wav-encoder so regenerate works without real audio
const mockRenderRecipe = vi.fn().mockResolvedValue({
  samples: new Float32Array([0.1, 0.2, 0.3]),
  sampleRate: 44100,
  duration: 0.5,
});
const mockEncodeWav = vi.fn().mockReturnValue(
  Buffer.from("RIFF\x00\x00\x00\x00WAVEfmt ", "binary"),
);

vi.mock("./core/renderer.js", () => ({
  renderRecipe: (...args: unknown[]) => mockRenderRecipe(...args),
}));

vi.mock("./audio/wav-encoder.js", () => ({
  encodeWav: (...args: unknown[]) => mockEncodeWav(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { main } from "./cli.js";
import { addEntry } from "./library/storage.js";
import { clearIndexCache } from "./library/index-store.js";
import type { ExploreCandidate } from "./explore/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture console output during a function call. */
async function captureOutput(fn: () => Promise<number>): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
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
    return {
      code,
      stdout: stdoutLines.join("\n"),
      stderr: stderrLines.join("\n"),
    };
  } finally {
    console.log = origLog;
    console.error = origError;
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

/** Helper to build a fake argv array. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

/** Helper: create a minimal ExploreCandidate. */
function makeCandidate(
  overrides: Partial<ExploreCandidate> = {},
): ExploreCandidate {
  return {
    id: overrides.id ?? "creature_seed-00042",
    recipe: "creature",
    seed: 42,
    duration: 1.2,
    sampleRate: 44100,
    sampleCount: 52920,
    analysis: {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount: 52920,
      metrics: {
        time: { rms: 0.45, crestFactor: 3.2 },
        spectral: { spectralCentroid: 2400 },
      },
    },
    classification: {
      source: "creature_seed-00042",
      category: "creature",
      intensity: "medium",
      texture: ["growling", "deep"],
      material: null,
      tags: ["monster", "organic"],
      analysisRef: "creature_seed-00042.json",
    },
    score: 0.82,
    metricScores: { rms: 0.9, "spectral-centroid": 0.74 },
    cluster: 1,
    promoted: false,
    libraryId: null,
    params: { pitch: 220, growl: 0.7 },
    ...overrides,
  };
}

/** Helper: create dummy WAV data. */
function dummyWav(): Buffer {
  return Buffer.from("RIFF\x00\x00\x00\x00WAVEfmt ", "binary");
}

/** Populate the library with test entries. */
async function populateLibrary(baseDir: string): Promise<void> {
  // Entry 1: creature category
  await addEntry(
    makeCandidate({
      id: "creature_seed-00042",
      recipe: "creature",
      seed: 42,
      classification: {
        source: "creature_seed-00042",
        category: "creature",
        intensity: "high",
        texture: ["growling", "deep"],
        material: null,
        tags: ["monster", "organic"],
        analysisRef: "creature_seed-00042.json",
      },
    }),
    dummyWav(),
    baseDir,
  );

  // Entry 2: weapon category
  await addEntry(
    makeCandidate({
      id: "impact-crack_seed-00007",
      recipe: "impact-crack",
      seed: 7,
      duration: 0.8,
      classification: {
        source: "impact-crack_seed-00007",
        category: "weapon",
        intensity: "high",
        texture: ["sharp", "metallic"],
        material: "metal",
        tags: ["hit", "impact"],
        analysisRef: "impact-crack_seed-00007.json",
      },
    }),
    dummyWav(),
    baseDir,
  );

  // Entry 3: another creature
  await addEntry(
    makeCandidate({
      id: "creature_seed-00099",
      recipe: "creature",
      seed: 99,
      duration: 2.0,
      classification: {
        source: "creature_seed-00099",
        category: "creature",
        intensity: "low",
        texture: ["hissing", "airy"],
        material: null,
        tags: ["snake", "organic"],
        analysisRef: "creature_seed-00099.json",
      },
    }),
    dummyWav(),
    baseDir,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Use the CWD-based default library dir that the CLI uses
const LIBRARY_DIR = ".toneforge-library";

describe("CLI library — help", () => {
  it("library --help returns 0 and shows subcommands", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("list");
    expect(stdout).toContain("search");
    expect(stdout).toContain("similar");
    expect(stdout).toContain("export");
    expect(stdout).toContain("regenerate");
  });

  it("library with no subcommand shows help", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("list");
    expect(stdout).toContain("search");
  });

  it("top-level --help lists the library command", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("library");
  });

  it("unknown library subcommand returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "nonexistent")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Unknown library subcommand");
  });

  it("unknown library subcommand returns JSON error in --json mode", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "nonexistent", "--json")),
    );
    expect(code).toBe(1);
    const json = JSON.parse(stderr);
    expect(json.error).toContain("Unknown library subcommand");
  });
});

// ── library list ─────────────────────────────────────────────────

describe("CLI library list", () => {
  beforeEach(() => {
    clearIndexCache();
  });

  afterEach(() => {
    clearIndexCache();
    try { rmSync(LIBRARY_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("list --help returns 0", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "list", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("list");
  });

  it("list with empty library shows info message", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "list")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("No library entries found");
  });

  it("list --json with empty library returns empty array", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "list", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("library list");
    expect(json.count).toBe(0);
    expect(json.entries).toEqual([]);
  });

  it("list shows entries after populating", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "list")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("lib-creature_seed-00042");
    expect(stdout).toContain("lib-impact-crack_seed-00007");
    expect(stdout).toContain("3 entries listed");
  });

  it("list --json returns all entries", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "list", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("library list");
    expect(json.count).toBe(3);
    expect(json.entries).toHaveLength(3);

    // Check structure of an entry
    const entry = json.entries.find((e: { id: string }) => e.id === "lib-creature_seed-00042");
    expect(entry).toBeDefined();
    expect(entry.recipe).toBe("creature");
    expect(entry.seed).toBe(42);
    expect(entry.category).toBe("creature");
    expect(entry.tags).toContain("monster");
  });

  it("list --category filters entries", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "list", "--category", "weapon", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.count).toBe(1);
    expect(json.category).toBe("weapon");
    expect(json.entries[0].id).toBe("lib-impact-crack_seed-00007");
  });

  it("list --category with no matches shows empty result", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "list", "--category", "ambient")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("No library entries found for category");
  });
});

// ── library search ───────────────────────────────────────────────

describe("CLI library search", () => {
  beforeEach(() => {
    clearIndexCache();
  });

  afterEach(() => {
    clearIndexCache();
    try { rmSync(LIBRARY_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("search without filters returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "search")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("At least one filter is required");
  });

  it("search without filters returns JSON error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "search", "--json")),
    );
    expect(code).toBe(1);
    const json = JSON.parse(stderr);
    expect(json.error).toContain("At least one filter is required");
  });

  it("search --intensity returns matches", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "search", "--intensity", "high", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("library search");
    expect(json.count).toBe(2);
    expect(json.filters.intensity).toBe("high");
  });

  it("search --category returns matches", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "search", "--category", "creature", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.count).toBe(2);
    // Both creature entries should be returned
    const ids = json.entries.map((e: { id: string }) => e.id);
    expect(ids).toContain("lib-creature_seed-00042");
    expect(ids).toContain("lib-creature_seed-00099");
  });

  it("search --tags returns matches", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "search", "--tags", "organic", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.count).toBe(2); // Both creature entries have "organic"
    expect(json.filters.tags).toContain("organic");
  });

  it("search with no matches returns empty result", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "search", "--intensity", "extreme")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("No matching library entries found");
  });

  it("search --help returns 0", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "search", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("search");
  });
});

// ── library similar ──────────────────────────────────────────────

describe("CLI library similar", () => {
  beforeEach(() => {
    clearIndexCache();
  });

  afterEach(() => {
    clearIndexCache();
    try { rmSync(LIBRARY_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("similar without --id returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "similar")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--id is required");
  });

  it("similar without --id returns JSON error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "similar", "--json")),
    );
    expect(code).toBe(1);
    const json = JSON.parse(stderr);
    expect(json.error).toContain("--id is required");
  });

  it("similar with non-existent ID returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "similar", "--id", "lib-nonexistent")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Library entry not found");
  });

  it("similar returns results for a valid entry", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "similar", "--id", "lib-creature_seed-00042", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("library similar");
    expect(json.queryId).toBe("lib-creature_seed-00042");
    // Should return the other 2 entries as similar
    expect(json.count).toBe(2);
    expect(json.results).toHaveLength(2);

    // Each result should have distance fields
    for (const r of json.results) {
      expect(r.id).toBeDefined();
      expect(typeof r.distance).toBe("number");
      expect(typeof r.metricDistance).toBe("number");
      expect(typeof r.tagSimilarity).toBe("number");
    }
  });

  it("similar respects --limit", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "similar", "--id", "lib-creature_seed-00042", "--limit", "1", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.limit).toBe(1);
    expect(json.count).toBe(1);
    expect(json.results).toHaveLength(1);
  });

  it("similar with invalid --limit returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "similar", "--id", "lib-creature_seed-00042", "--limit", "abc")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--limit must be a positive integer");
  });

  it("similar --help returns 0", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "similar", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("similar");
  });
});

// ── library export ───────────────────────────────────────────────

describe("CLI library export", () => {
  let tempExportDir: string;

  beforeEach(() => {
    clearIndexCache();
    tempExportDir = join(tmpdir(), `toneforge-lib-export-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    clearIndexCache();
    try { rmSync(LIBRARY_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
    try { rmSync(tempExportDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("export without --output returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "export")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--output is required");
  });

  it("export without --output returns JSON error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "export", "--json")),
    );
    expect(code).toBe(1);
    const json = JSON.parse(stderr);
    expect(json.error).toContain("--output is required");
  });

  it("export with unsupported format returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "export", "--output", tempExportDir, "--format", "mp3")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Unsupported format");
  });

  it("export --json exports WAV files", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "export", "--output", tempExportDir, "--format", "wav", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("library export");
    expect(json.format).toBe("wav");
    expect(json.count).toBe(3);
    expect(json.files).toHaveLength(3);
    expect(existsSync(tempExportDir)).toBe(true);
  });

  it("export with --category filters exports", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "export", "--output", tempExportDir, "--category", "weapon", "--format", "wav", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.count).toBe(1);
    expect(json.category).toBe("weapon");
  });

  it("export with empty library shows info message", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "export", "--output", tempExportDir, "--format", "wav")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("No entries to export");
  });

  it("export defaults format to wav when --format omitted", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "export", "--output", tempExportDir, "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.format).toBe("wav");
    expect(json.count).toBe(3);
  });

  it("export --help returns 0", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "export", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("export");
  });
});

// ── library regenerate ───────────────────────────────────────────

describe("CLI library regenerate", () => {
  beforeEach(() => {
    clearIndexCache();
    mockRenderRecipe.mockClear();
    mockEncodeWav.mockClear();
  });

  afterEach(() => {
    clearIndexCache();
    try { rmSync(LIBRARY_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("regenerate without --id returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "regenerate")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--id is required");
  });

  it("regenerate without --id returns JSON error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "regenerate", "--json")),
    );
    expect(code).toBe(1);
    const json = JSON.parse(stderr);
    expect(json.error).toContain("--id is required");
  });

  it("regenerate with non-existent ID returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "regenerate", "--id", "lib-nonexistent")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Library entry not found");
  });

  it("regenerate --json succeeds for a valid entry", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "regenerate", "--id", "lib-creature_seed-00042", "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("library regenerate");
    expect(json.success).toBe(true);
    expect(json.entryId).toBe("lib-creature_seed-00042");
    expect(json.wavPath).toBeDefined();
    expect(json.regeneratedAt).toBeDefined();
    expect(mockRenderRecipe).toHaveBeenCalledWith("creature", 42);
  });

  it("regenerate produces human-readable output", async () => {
    await populateLibrary(LIBRARY_DIR);

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "regenerate", "--id", "lib-creature_seed-00042")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("Regenerated");
    expect(stdout).toContain("lib-creature_seed-00042");
    expect(stdout).toContain("WAV:");
  });

  it("regenerate --help returns 0", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "regenerate", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("regenerate");
  });
});
