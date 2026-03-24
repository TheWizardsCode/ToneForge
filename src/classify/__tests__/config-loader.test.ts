import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import type { AnalysisResult } from "../../analyze/types.js";

const CFG_DIR = path.resolve(process.cwd(), ".toneforge");
const CFG_PATH = path.join(CFG_DIR, "config.yaml");

function makeAnalysis(): AnalysisResult {
  return {
    analysisVersion: "1.0",
    sampleRate: 44100,
    sampleCount: 44100,
    metrics: {
      time: { duration: 1.0, peak: 0.5, rms: 0.2, crestFactor: 2.5 },
      quality: { clipping: false, silence: false },
      envelope: { attackTime: 10 },
      spectral: { spectralCentroid: 2000 },
    },
  };
}

async function removeConfig() {
  try {
    if (fs.existsSync(CFG_PATH)) fs.unlinkSync(CFG_PATH);
    if (fs.existsSync(CFG_DIR) && fs.readdirSync(CFG_DIR).length === 0) fs.rmdirSync(CFG_DIR);
  } catch (e) {
    // ignore
  }
}

afterEach(async () => {
  // Ensure module cache is reset between tests and config cleaned up
  vi.resetModules();
  await removeConfig();
  vi.restoreAllMocks();
});

describe("Config loader integration", () => {
  it("applies nested prefixToCategory mapping and normalizes keys/values", async () => {
    if (!fs.existsSync(CFG_DIR)) fs.mkdirSync(CFG_DIR);
    const yaml = `prefixToCategory:\n  Card: "Card Game"\n  SLAM: impact\n`;
    fs.writeFileSync(CFG_PATH, yaml, "utf8");

    const mod = await import("../dimensions/category.js");
    const classifier = new mod.CategoryClassifier();

    const analysis = makeAnalysis();
    // name uses lowercase first segment
    expect(classifier.classify(analysis, { name: "card-flip", category: "" }).category).toBe("card-game");
    // name uses uppercase first segment, should still match
    expect(classifier.classify(analysis, { name: "SLAM-hit", category: "" }).category).toBe("impact");
  });

  it("throws when config YAML root is an array", async () => {
    if (!fs.existsSync(CFG_DIR)) fs.mkdirSync(CFG_DIR);
    const yaml = `- a\n- b\n`;
    fs.writeFileSync(CFG_PATH, yaml, "utf8");

    const mod = await import("../dimensions/category.js");
    const classifier = new mod.CategoryClassifier();
    const analysis = makeAnalysis();

    expect(() => classifier.classify(analysis, { name: "card-flip", category: "" })).toThrow();
  });

  it("warns once when config file is missing", async () => {
    // Ensure config is not present
    await removeConfig();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("../dimensions/category.js");
    const classifier = new mod.CategoryClassifier();
    const analysis = makeAnalysis();

    // First call should warn
    classifier.classify(analysis, { name: "weapon-laser", category: "" });
    expect(warn).toHaveBeenCalledTimes(1);

    // Second call should not warn again (cached)
    classifier.classify(analysis, { name: "weapon-laser", category: "" });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
