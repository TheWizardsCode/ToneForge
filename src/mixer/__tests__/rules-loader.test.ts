/**
 * Mixer Rule Config Loader Tests
 *
 * Tests for loadMixRules(): directory loading, built-in-default fallback when
 * absent, merging of multiple rule files, and actionable validation failures.
 *
 * Work item: TF-0MMLC8PXU0D3O594
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMixRules, resolveMixRulesDir } from "../rules-loader.js";
import { BUILT_IN_MIX_RULES, parseMixRuleSet } from "../schema.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "toneforge-mixer-"));
  tempDirs.push(dir);
  return dir;
}

function writeRuleFile(dir: string, name: string, data: unknown): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return file;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe("loadMixRules — fallback to built-in defaults", () => {
  it("warns and returns built-in defaults when the directory is absent", () => {
    const warn = vi.fn();
    const missing = path.join(makeTempDir(), "does-not-exist");
    const set = loadMixRules({ dir: missing, warn });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("built-in defaults");
    expect(set.rules).toEqual(BUILT_IN_MIX_RULES.rules);
    expect(set.groups).toEqual(BUILT_IN_MIX_RULES.groups);
  });

  it("warns and returns built-in defaults when the directory is empty", () => {
    const warn = vi.fn();
    const set = loadMixRules({ dir: makeTempDir(), warn });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(set.rules).toEqual(BUILT_IN_MIX_RULES.rules);
  });

  it("returns a fresh clone that cannot mutate the shared fallback", () => {
    const set = loadMixRules({ dir: makeTempDir(), warn: () => {} });
    set.groups.combat.maxVoices = 999;
    set.rules.length = 0;
    expect(BUILT_IN_MIX_RULES.groups.combat.maxVoices).toBe(4);
    expect(BUILT_IN_MIX_RULES.rules.length).toBeGreaterThan(0);
  });

  it("ignores non-JSON files when deciding whether rules are present", () => {
    const warn = vi.fn();
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "README.md"), "not rules", "utf8");
    const set = loadMixRules({ dir, warn });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(set.rules).toEqual(BUILT_IN_MIX_RULES.rules);
  });
});

describe("loadMixRules — loading valid rules", () => {
  it("loads and validates a rules file from the directory", () => {
    const dir = makeTempDir();
    writeRuleFile(dir, "rules.json", {
      version: "1.0",
      groups: { combat: { priority: 55 } },
      rules: [
        {
          id: "combat-focus",
          when: { state: "combat" },
          then: { duck: ["ambience"], boost: ["combat"], limit: ["ui"] },
        },
      ],
    });

    const set = loadMixRules({ dir, warn: () => {} });
    expect(set.rules).toHaveLength(1);
    expect(set.groups.combat.priority).toBe(55);
    expect(set.rules[0]!.then.duck[0]).toEqual({ group: "ambience", depthDb: 6 });
  });

  it("merges multiple rule files deterministically in filename order", () => {
    const dir = makeTempDir();
    writeRuleFile(dir, "b-second.json", {
      version: "1.0",
      defaults: { maxVoices: 9 },
      rules: [{ when: { state: "combat" }, then: { duck: [{ group: "ambience", depthDb: 9 }] } }],
    });
    writeRuleFile(dir, "a-first.json", {
      version: "1.0",
      rules: [{ when: { state: "ui" }, then: { duck: ["footsteps"] } }],
    });

    const set = loadMixRules({ dir, warn: () => {} });
    // a-first contributes rule 0, b-second rule 1.
    expect(set.rules).toHaveLength(2);
    expect(set.rules[0]!.when.state).toBe("ui");
    expect(set.rules[1]!.when.state).toBe("combat");
    // Later defaults merge over earlier ones and propagate to groups.
    expect(set.defaults.maxVoices).toBe(9);
    expect(set.groups.ambience.maxVoices).toBe(9);
  });
});

describe("loadMixRules — validation failures", () => {
  it("throws when a rule file contains invalid JSON", () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "broken.json"), "{ not valid json", "utf8");
    expect(() => loadMixRules({ dir, warn: () => {} })).toThrow(/Failed to parse mixer rules/);
  });

  it("throws an actionable error for an unknown mix group", () => {
    const dir = makeTempDir();
    writeRuleFile(dir, "rules.json", {
      version: "1.0",
      rules: [{ when: { state: "combat" }, then: { duck: ["music"] } }],
    });
    expect(() => loadMixRules({ dir, warn: () => {} })).toThrow(/Unknown mix group 'music'/);
  });

  it("throws rather than silently falling back when a present file is malformed", () => {
    const dir = makeTempDir();
    writeRuleFile(dir, "rules.json", { rules: [] }); // missing version
    expect(() => loadMixRules({ dir, warn: () => {} })).toThrow(/missing.*version|version/i);
  });

  it("reports the offending file path in validation errors", () => {
    const dir = makeTempDir();
    const file = writeRuleFile(dir, "rules.json", { rules: [] });
    expect(() => loadMixRules({ dir, warn: () => {} })).toThrow(new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

describe("resolveMixRulesDir", () => {
  it("resolves to .toneforge/mixer under the given cwd", () => {
    expect(resolveMixRulesDir("/repo")).toBe(path.join("/repo", ".toneforge", "mixer"));
  });
});

describe("committed seed rules file", () => {
  it("exists, validates, and matches the built-in defaults", () => {
    const seedPath = path.join(REPO_ROOT, ".toneforge", "mixer", "rules.json");
    expect(fs.existsSync(seedPath)).toBe(true);
    const parsed = parseMixRuleSet(JSON.parse(fs.readFileSync(seedPath, "utf8")), seedPath);
    expect(parsed).toEqual(BUILT_IN_MIX_RULES);
  });

  it("loads through the public loader from the repository directory", () => {
    const set = loadMixRules({
      dir: path.join(REPO_ROOT, ".toneforge", "mixer"),
      warn: () => {},
    });
    expect(set.rules.length).toBeGreaterThan(0);
  });
});
