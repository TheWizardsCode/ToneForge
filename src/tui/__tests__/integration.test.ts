/**
 * TUI Wizard End-to-End Integration Test.
 *
 * Verifies the full wizard pipeline: Define -> Explore -> Review -> Export
 * with mocked prompts, producing expected WAV output and manifest.json.
 *
 * Reference: Work item TF-0MM8S2ZOH1XPC1X6
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import type { ExploreCandidate } from "../../explore/types.js";

// ---------------------------------------------------------------------------
// vi.mock declarations -- factories must NOT reference top-level variables.
// Vitest hoists these above all imports; use only vi.fn() inline.
// ---------------------------------------------------------------------------

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
  Separator: class Separator {
    separator = true;
  },
}));

vi.mock("../../recipes/index.js", () => ({
  registry: {
    listDetailed: vi.fn(() => [
      {
        name: "card-flip",
        description: "A flicked card impact",
        category: "card-game",
        tags: ["card", "ui"],
        matchedTags: [],
      },
      {
        name: "coin-collect",
        description: "A shiny coin sparkle",
        category: "card-game",
        tags: ["coin", "reward"],
        matchedTags: [],
      },
    ]),
  },
}));

vi.mock("../../explore/sweep.js", () => ({
  sweep: vi.fn(),
  mutate: vi.fn(),
  defaultConcurrency: vi.fn(() => 2),
}));

vi.mock("../../explore/ranking.js", () => ({
  rankCandidates: vi.fn((candidates: ExploreCandidate[]) => candidates),
  keepTopN: vi.fn((candidates: ExploreCandidate[], n: number) =>
    candidates.slice(0, n),
  ),
}));

vi.mock("../../core/renderer.js", () => ({
  renderRecipe: vi.fn(),
}));

vi.mock("../../audio/wav-encoder.js", () => ({
  encodeWav: vi.fn(),
}));

vi.mock("../../library/storage.js", () => ({
  addEntry: vi.fn(),
  entryId: vi.fn((id: string) => `lib-${id}`),
}));

vi.mock("../../audio/player.js", () => ({
  playAudio: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports -- these resolve to the mocked versions (vi.mock is hoisted).
// ---------------------------------------------------------------------------

import { launchWizard } from "../index.js";
import { setTtyOverride } from "../../output.js";
import { select, input, confirm } from "@inquirer/prompts";
import { sweep } from "../../explore/sweep.js";
import { renderRecipe } from "../../core/renderer.js";
import { encodeWav } from "../../audio/wav-encoder.js";
import { addEntry } from "../../library/storage.js";
import { mkdir, writeFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCandidate(recipe: string, seed: number): ExploreCandidate {
  return {
    id: `${recipe}_seed-${String(seed).padStart(5, "0")}`,
    recipe,
    seed,
    duration: 1,
    sampleRate: 44100,
    sampleCount: 44100,
    analysis: {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount: 44100,
      metrics: {
        time: { duration: 1, peak: 0.8, rms: 0.5, crestFactor: 2 },
        spectral: { spectralCentroid: 1200 },
        envelope: { attackTime: 0.03 },
        quality: { clipping: false, silence: false },
      },
    },
    classification: {
      source: `${recipe}_seed-${seed}`,
      category: "card-game",
      intensity: "medium",
      texture: ["smooth"],
      material: null,
      tags: ["card", "ui"],
      embedding: [],
      analysisRef: "",
    },
    score: 1 - seed * 0.01,
    metricScores: {
      rms: 0.8 - seed * 0.01,
      "spectral-centroid": 0.7 - seed * 0.01,
      "transient-density": 0.6 - seed * 0.01,
      "attack-time": 0.5 - seed * 0.005,
    },
    cluster: 0,
    promoted: false,
    libraryId: null,
    params: {},
  };
}

// ---------------------------------------------------------------------------
// Prompt queues -- populated per test in beforeEach
// ---------------------------------------------------------------------------

let selectQueue: Array<unknown> = [];
let inputQueue: Array<string> = [];
let confirmQueue: Array<boolean> = [];

function setupPromptMocks() {
  (select as Mock).mockImplementation(async () => {
    if (selectQueue.length === 0) {
      throw new Error("Select queue exhausted");
    }
    return selectQueue.shift();
  });

  (input as Mock).mockImplementation(async () => {
    if (inputQueue.length === 0) {
      throw new Error("Input queue exhausted");
    }
    return inputQueue.shift();
  });

  (confirm as Mock).mockImplementation(async () => {
    if (confirmQueue.length === 0) {
      throw new Error("Confirm queue exhausted");
    }
    return confirmQueue.shift();
  });
}

function setupSweepMock() {
  (sweep as Mock).mockImplementation(
    async ({ recipe }: { recipe: string }) => [
      makeCandidate(recipe, 0),
      makeCandidate(recipe, 1),
    ],
  );
}

function setupExportMocks() {
  (renderRecipe as Mock).mockResolvedValue({
    samples: new Float32Array([0.1, 0.2]),
    sampleRate: 44100,
    duration: 1,
    numberOfChannels: 1,
  });
  (encodeWav as Mock).mockReturnValue(Buffer.from("fake-wav"));
  (addEntry as Mock).mockResolvedValue({
    id: "lib-entry",
    files: { wav: "fake.wav" },
  });
  (mkdir as Mock).mockResolvedValue(undefined);
  (writeFile as Mock).mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("tui wizard end-to-end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTtyOverride(true);

    // Full pipeline prompt sequence:
    //
    // Define stage:
    //   1. browseRecipes: select "category"
    //   2. browseByCategory: select "card-game"
    //   3. presentRecipeList: select "card-flip"
    //   4. recipeActions: select "add" (adds card-flip to manifest)
    //   5. presentRecipeList: select "coin-collect"
    //   6. recipeActions: select "add" (adds coin-collect to manifest)
    //   7. presentRecipeList: select "__back__" (return to browseRecipes)
    //   8. browseRecipes: select "done" (proceed to buildManifest)
    //   9. buildManifest: select "confirm"
    //      confirm: true (proceed to Explore)
    //
    // Explore stage:
    //  10. auditionRecipe("card-flip"): select {type:"select",candidateIndex:0}
    //  11. auditionRecipe("coin-collect"): select {type:"select",candidateIndex:0}
    //
    // Review stage:
    //  12. runReviewStage: select {type:"confirm"}
    //      confirm: true (advance to Export)
    //
    // Export stage:
    //      input: "./tui-integration-output" (output directory)
    //      confirm: true (organise by category)
    //      confirm: true (proceed with export)

    selectQueue = [
      // Define
      "category",
      "card-game",
      "card-flip",
      "add",
      "coin-collect",
      "add",
      "__back__",
      "done",
      "confirm",
      // Explore
      { type: "select", candidateIndex: 0 },
      { type: "select", candidateIndex: 0 },
      // Review
      { type: "confirm" },
    ];

    inputQueue = [
      "./tui-integration-output",
    ];

    confirmQueue = [
      true, // buildManifest confirm
      true, // review confirm
      true, // export byCategory
      true, // export proceed
    ];

    setupPromptMocks();
    setupSweepMock();
    setupExportMocks();
  });

  afterEach(() => {
    setTtyOverride(undefined);
  });

  it("completes a two-recipe palette and writes a manifest", async () => {
    const exitCode = await launchWizard();
    expect(exitCode).toBe(0);

    // Verify prompt call counts
    expect(select as Mock).toHaveBeenCalledTimes(12);
    expect(input as Mock).toHaveBeenCalledTimes(1);
    expect(confirm as Mock).toHaveBeenCalledTimes(4);

    // Verify export pipeline was invoked for both recipes
    expect((addEntry as Mock).mock.calls).toHaveLength(2);
    expect((renderRecipe as Mock).mock.calls).toHaveLength(2);
    expect((encodeWav as Mock).mock.calls).toHaveLength(2);

    // Verify output directory was created
    // Note: mkdir(outputDir) preserves the raw user input "./tui-integration-output",
    // but path.join("./tui-integration-output", "card-game") strips the "./" prefix.
    const mkdirCalls = (mkdir as Mock).mock.calls.map((args) => args[0]);
    expect(mkdirCalls).toContain("./tui-integration-output");
    expect(mkdirCalls).toContain("tui-integration-output/card-game");

    // Verify manifest.json was written with correct entries
    const writeCalls = (writeFile as Mock).mock.calls;
    const manifestCall = writeCalls.find(([path]) =>
      (path as string).endsWith("manifest.json"),
    );
    expect(manifestCall).toBeDefined();
    const manifestEntries = JSON.parse(manifestCall![1] as string);
    expect(manifestEntries).toHaveLength(2);
    expect(
      manifestEntries.map((entry: Record<string, unknown>) => entry.recipe),
    ).toEqual(["card-flip", "coin-collect"]);

    // Verify all queues were fully consumed
    expect(selectQueue.length).toBe(0);
    expect(inputQueue.length).toBe(0);
    expect(confirmQueue.length).toBe(0);
  });

  it("handles back navigation from Explore to Define with state preserved", async () => {
    // Override explore to return "back" on first audition, then re-enter
    selectQueue = [
      // Define (first pass)
      "category",
      "card-game",
      "card-flip",
      "add",
      "__back__",
      "done",
      "confirm",
      // Explore: user goes back from audition
      { type: "back" },
      // Back in Define: manifest still has card-flip, user adds coin-collect
      "category",
      "card-game",
      "coin-collect",
      "add",
      "__back__",
      "done",
      "confirm",
      // Explore (second pass): select candidates
      { type: "select", candidateIndex: 0 },
      { type: "select", candidateIndex: 0 },
      // Review
      { type: "confirm" },
    ];

    confirmQueue = [
      true, // first buildManifest confirm
      true, // second buildManifest confirm
      true, // review confirm
      true, // export byCategory
      true, // export proceed
    ];

    setupPromptMocks();

    const exitCode = await launchWizard();
    expect(exitCode).toBe(0);

    // Both recipes should be exported
    expect((addEntry as Mock).mock.calls).toHaveLength(2);

    // All queues consumed
    expect(selectQueue.length).toBe(0);
    expect(confirmQueue.length).toBe(0);
  });

  it("handles render failure during export with recipe+seed error message", async () => {
    // Make renderRecipe fail for coin-collect during export
    let renderCallCount = 0;
    (renderRecipe as Mock).mockImplementation(
      async (recipe: string, seed: number) => {
        renderCallCount++;
        if (recipe === "coin-collect") {
          throw new Error("synthesis engine crash");
        }
        return {
          samples: new Float32Array([0.1, 0.2]),
          sampleRate: 44100,
          duration: 1,
          numberOfChannels: 1,
        };
      },
    );

    // Capture stderr to check error messages
    const stderrChunks: string[] = [];
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk) => {
        stderrChunks.push(String(chunk));
        return true;
      });

    const exitCode = await launchWizard();
    expect(exitCode).toBe(0);

    // Verify the error message names both recipe and seed
    const allStderr = stderrChunks.join("");
    expect(allStderr).toContain("coin-collect");
    expect(allStderr).toContain("seed");
    expect(allStderr).toContain("synthesis engine crash");

    // card-flip should still succeed (1 of 2 exported)
    expect((addEntry as Mock).mock.calls).toHaveLength(1);

    stderrSpy.mockRestore();
  });
});
