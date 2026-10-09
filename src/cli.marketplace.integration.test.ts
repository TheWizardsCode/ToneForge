/**
 * Marketplace CLI integration tests.
 *
 * Exercise the `toneforge marketplace` command group end-to-end through the
 * real CLI entrypoint (a child process per invocation) against an isolated,
 * writable copy of the bundled demo registry. No live network is used.
 *
 * These tests pin the documented `--json` contracts and the CLI help text for
 * `search`, `install` and `publish` (work item TF-0MUZX3ZU3008FQH3, verifying
 * the contracts documented in `docs/guides/marketplace.md`), and guard the
 * read-only bundled fixtures against accidental mutation.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "../test/run-yargs-child.js";

/** Bundled, read-only demo registry (fixtures). */
const REPO_FIXTURES = join(import.meta.dirname, "test-utils/fixtures/marketplace");
/** The bundled registry index that must never be mutated by a CLI run. */
const REPO_REGISTRY_INDEX = join(REPO_FIXTURES, "registry", "index.json");

describe("marketplace CLI integration", () => {
  let tempDir: string;
  /** A writable copy of the demo registry used by every invocation. */
  let registryDir: string;
  /**
   * Isolated external recipe directory. Installs materialise recipe assets
   * here and a later process rediscovers them from here. Passing it explicitly
   * keeps every invocation away from the real `~/.toneforge/recipes/`.
   */
  let recipeDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "toneforge-marketplace-"));
    registryDir = join(tempDir, "registry");
    cpSync(REPO_FIXTURES, registryDir, { recursive: true });
    recipeDir = join(tempDir, "recipes");
    mkdirSync(recipeDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  /** Run a marketplace CLI command against the temp registry. */
  function runMarketplace(args: string[]) {
    return runCli(args, {
      env: {
        TONEFORGE_MARKETPLACE_DIR: registryDir,
        TONEFORGE_RECIPE_DIR: recipeDir,
      },
    });
  }

  /** Read the temp registry index as JSON. */
  function readTempIndex(): {
    packages: Array<{ name: string; version: string }>;
  } {
    return JSON.parse(
      readFileSync(join(registryDir, "registry", "index.json"), "utf-8"),
    );
  }

  // -----------------------------------------------------------------
  // search
  // -----------------------------------------------------------------

  it("search --json returns the documented listing contract", async () => {
    const { code, stdout } = await runMarketplace([
      "marketplace",
      "search",
      "--category",
      "combat",
      "--json",
    ]);

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("marketplace search");
    expect(data.category).toBe("combat");
    expect(data.count).toBe(2);
    expect(Array.isArray(data.listings)).toBe(true);

    const plasma = data.listings.find(
      (listing: { name: string }) => listing.name === "plasma_rifles",
    );
    expect(plasma).toMatchObject({
      name: "plasma_rifles",
      version: "1.4.2",
      author: "StudioX",
      license: "commercial",
      category: "combat",
      rating: 4.2,
      label: "plasma_rifles@1.4.2",
      assets: { recipes: 1, stacks: 1, sequences: 0, palettes: 0 },
    });
  });

  it("search output is deterministic for identical registry state", async () => {
    const first = await runMarketplace(["marketplace", "search", "--json"]);
    const second = await runMarketplace(["marketplace", "search", "--json"]);

    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    expect(JSON.parse(first.stdout).listings).toEqual(
      JSON.parse(second.stdout).listings,
    );
  });

  it("search without a category returns every package and nulls the category", async () => {
    const { code, stdout } = await runMarketplace([
      "marketplace",
      "search",
      "--json",
    ]);

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.category).toBeNull();
    expect(data.count).toBe(4);
  });

  it("search --json returns an empty result for an unknown category", async () => {
    const { code, stdout } = await runMarketplace([
      "marketplace",
      "search",
      "--category",
      "does-not-exist",
      "--json",
    ]);

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.count).toBe(0);
    expect(data.listings).toEqual([]);
  });

  it("search text output names the packages", async () => {
    const { code, stdout } = await runMarketplace([
      "marketplace",
      "search",
      "--category",
      "ui",
    ]);

    expect(code).toBe(0);
    expect(stdout).toContain('Marketplace Results: "ui"');
    expect(stdout).toContain("ui_chimes@1.0.0");
  });

  // -----------------------------------------------------------------
  // install
  // -----------------------------------------------------------------

  it("install --json registers a package's assets and locks the version", async () => {
    const { code, stdout } = await runMarketplace([
      "marketplace",
      "install",
      "plasma_rifles@1.4.2",
      "--json",
    ]);

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("marketplace install");
    expect(data.name).toBe("plasma_rifles");
    expect(data.version).toBe("1.4.2");
    expect(data.installed).toBe(true);
    expect(data.lockedVersion).toBe("1.4.2");
    expect(data.issues).toEqual([]);
    expect(
      data.registeredAssets.map((asset: { id: string }) => asset.id),
    ).toEqual([
      "recipes:assets/recipes/plasma-burst.json",
      "stacks:assets/stacks/plasma-rifle.json",
    ]);
    for (const asset of data.registeredAssets) {
      expect(typeof asset.contentHash).toBe("string");
      expect(asset.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("install reports a version conflict as a structured issue", async () => {
    const { code, stdout } = await runMarketplace([
      "marketplace",
      "install",
      "version_conflict@1.0.0",
      "--json",
    ]);

    expect(code).toBe(1);
    const data = JSON.parse(stdout);
    expect(data.installed).toBe(false);
    expect(data.lockedVersion).toBeNull();
    expect(data.issues[0].field).toBe("dependencies.core");
    expect(data.issues[0].message).toContain("core");
  });

  it("install rejects a malformed package argument", async () => {
    const { code, stderr } = await runMarketplace([
      "marketplace",
      "install",
      "not-a-versioned-package",
      "--json",
    ]);

    expect(code).toBe(1);
    expect(JSON.parse(stderr).error).toContain("Expected format: name@version");
  });

  it("install does not mutate the registry index", async () => {
    const before = readTempIndex();
    await runMarketplace(["marketplace", "install", "ui_chimes@1.0.0"]);
    expect(readTempIndex()).toEqual(before);
  });

  // -----------------------------------------------------------------
  // Cross-process discovery (AC1, AC2, AC4)
  // -----------------------------------------------------------------

  it("a new process renders an installed recipe deterministically (AC1, AC2, AC4)", async () => {
    // Process 1: install. This must materialise the recipe into the
    // discoverable external recipe directory, not merely the installing
    // process's in-memory registry.
    const install = await runMarketplace([
      "marketplace",
      "install",
      "ui_chimes@1.0.0",
      "--json",
    ]);
    expect(install.code).toBe(0);
    expect(JSON.parse(install.stdout).installed).toBe(true);
    expect(existsSync(join(recipeDir, "ui-chime.json"))).toBe(true);

    // Process 2 and 3: render the installed recipe in fresh processes. No
    // live network is involved at any point.
    const outA = join(tempDir, "ui-chime-a.wav");
    const outB = join(tempDir, "ui-chime-b.wav");
    const first = await runMarketplace([
      "generate",
      "--recipe",
      "ui-chime",
      "--seed",
      "42",
      "--output",
      outA,
      "--json",
    ]);
    expect(first.code, first.stderr).toBe(0);
    const firstData = JSON.parse(first.stdout);
    expect(firstData.command).toBe("generate");
    expect(firstData.recipe).toBe("ui-chime");
    expect(firstData.duration).toBeGreaterThan(0);
    expect(firstData.samples).toBeGreaterThan(0);

    const second = await runMarketplace([
      "generate",
      "--recipe",
      "ui-chime",
      "--seed",
      "42",
      "--output",
      outB,
      "--json",
    ]);
    expect(second.code, second.stderr).toBe(0);

    // Same seed => byte-identical output across separate processes.
    expect(readFileSync(outA)).toEqual(readFileSync(outB));
  });

  it("a new process renders an installed stack (AC1, AC4)", async () => {
    // The bundled `plasma_rifles` stack fixture is listing-only and does not
    // use the renderable layer schema, so write a valid preset into the temp
    // copy before installing.
    const stackPath = join(
      registryDir,
      "packages",
      "plasma_rifles",
      "assets",
      "stacks",
      "plasma-rifle.json",
    );
    writeFileSync(
      stackPath,
      JSON.stringify({
        version: "1.0",
        name: "plasma-rifle",
        layers: [{ recipe: "plasma-burst", startTime: 0, gain: 1.0 }],
      }),
    );

    const install = await runMarketplace([
      "marketplace",
      "install",
      "plasma_rifles@1.4.2",
      "--json",
    ]);
    expect(install.code).toBe(0);
    expect(JSON.parse(install.stdout).installed).toBe(true);

    // A separate process renders the installed stack; its recipe resolves
    // only because install materialised it for rediscovery.
    const output = join(tempDir, "plasma-rifle.wav");
    const render = await runMarketplace([
      "stack",
      "render",
      "--preset",
      stackPath,
      "--seed",
      "7",
      "--output",
      output,
      "--json",
    ]);
    expect(render.code, render.stderr).toBe(0);
    const renderData = JSON.parse(render.stdout);
    expect(renderData.command).toBe("stack render");
    expect(renderData.name).toBe("plasma-rifle");
    expect(renderData.samples).toBeGreaterThan(0);
    expect(existsSync(output)).toBe(true);
    expect(statSync(output).size).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------
  // publish
  // -----------------------------------------------------------------

  it("publish --json validates and publishes a package", async () => {
    const packageDir = join(registryDir, "packages", "industrial_lasers");
    const { code, stdout } = await runMarketplace([
      "marketplace",
      "publish",
      "--package",
      packageDir,
      "--name",
      "industrial_lasers",
      "--version",
      "2.1.0",
      "--json",
    ]);

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data).toEqual({
      command: "marketplace publish",
      name: "industrial_lasers",
      version: "2.1.0",
      published: true,
      issues: [],
    });

    // The published entry is now searchable in the temp registry.
    const published = readTempIndex().packages.find(
      (pkg) => pkg.name === "industrial_lasers",
    );
    expect(published?.version).toBe("2.1.0");
  });

  it("publish rejects re-publishing an existing version (immutability)", async () => {
    const packageDir = join(registryDir, "packages", "industrial_lasers");
    const args = [
      "marketplace",
      "publish",
      "--package",
      packageDir,
      "--name",
      "industrial_lasers",
      "--version",
      "2.1.0",
      "--json",
    ];

    const first = await runMarketplace(args);
    expect(first.code).toBe(0);
    expect(JSON.parse(first.stdout).published).toBe(true);

    const second = await runMarketplace(args);
    expect(second.code).toBe(1);
    const data = JSON.parse(second.stdout);
    expect(data.published).toBe(false);
    expect(data.issues[0].field).toBe("version");
    expect(data.issues[0].message).toContain("immutable");
  });

  it("publish rejects an invalid manifest before writing to the registry", async () => {
    const before = readTempIndex();
    const packageDir = join(registryDir, "packages", "broken_manifest");
    const { code, stderr } = await runMarketplace([
      "marketplace",
      "publish",
      "--package",
      packageDir,
      "--name",
      "broken_manifest",
      "--version",
      "1.0.0",
      "--json",
    ]);

    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(data.error).toContain("Invalid manifest");
    expect(data.error).toContain("version");
    expect(readTempIndex()).toEqual(before);
  });

  it("publish rejects --name/--version that disagree with the manifest", async () => {
    const packageDir = join(registryDir, "packages", "industrial_lasers");
    const { code, stderr } = await runMarketplace([
      "marketplace",
      "publish",
      "--package",
      packageDir,
      "--name",
      "wrong_name",
      "--version",
      "2.1.0",
      "--json",
    ]);

    expect(code).toBe(1);
    expect(JSON.parse(stderr).error).toContain("must match manifest.json");
  });

  // -----------------------------------------------------------------
  // help & fixture safety
  // -----------------------------------------------------------------

  it("help lists the command group and every documented flag", async () => {
    const { code, stdout } = await runMarketplace(["marketplace", "--help"]);

    expect(code).toBe(0);
    for (const token of [
      "search",
      "install",
      "publish",
      "--category",
      "--package",
      "--name",
      "--version",
      "--json",
    ]) {
      expect(stdout).toContain(token);
    }
  });

  it("search against the bundled demo registry does not modify it", async () => {
    // The default (no TONEFORGE_MARKETPLACE_DIR) registry is bundled,
    // read-only reference data; a search must never write to it.
    const before = readFileSync(REPO_REGISTRY_INDEX, "utf-8");
    const { code } = await runCli(["marketplace", "search", "--json"]);
    expect(code).toBe(0);
    expect(readFileSync(REPO_REGISTRY_INDEX, "utf-8")).toBe(before);
  });
});
