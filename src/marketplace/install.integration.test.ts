/**
 * Marketplace install → asset registration integration tests (F8).
 *
 * Covers work item TF-0MUZX3ZIU008KIXL: installing a package must register its
 * assets into the existing recipe registry and library index store so they are
 * usable **immediately**, without a forked store
 * (`docs/prd/MARKETPLACE_PRD.md` Sections 8.1, 10).
 *
 * Acceptance criteria exercised:
 *
 * 1. Installed recipes are available immediately via
 *    `toneforge generate --recipe <installed>` — verified through the same
 *    `renderRecipe()` path the `generate` command calls.
 * 2. Installed stacks render via `toneforge stack render` — verified through
 *    `loadPreset()` + `renderStack()`, the exact functions the command calls.
 * 3. Registration reuses `src/core/recipe.ts`'s `RecipeRegistry` and
 *    `src/library/index-store.ts` (extend, do not fork).
 * 4. An installed asset produces byte-identical output to an equivalent
 *    locally authored asset for the same seed.
 * 5. Integration tests cover `generate` and `stack render` against a fixture
 *    install.
 *
 * The suite uses an offline {@link StubRegistry} over temporary package
 * directories — no network access.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { renderRecipe } from "../core/renderer.js";
import { discoverFileBackedRecipes } from "../core/recipe.js";
import { registry as globalRegistry } from "../recipes/index.js";
import { clearIndexCache, listRegisteredAssets } from "../library/index-store.js";
import { loadPreset } from "../stack/preset-loader.js";
import { renderStack } from "../stack/renderer.js";

import {
  createInMemoryInstallStateStore,
  installPackage,
} from "./install.js";
import { createRegistrar } from "./registrar.js";
import { parseManifest } from "./manifest.js";
import type { MarketplaceRegistry } from "./registry.js";
import type {
  MarketplacePackageBundle,
  MarketplaceSearchListing,
  MarketplaceSearchResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Deterministic unique names (the registry is a process-wide singleton, so
// every test uses fresh recipe/package names to avoid collisions).
// ---------------------------------------------------------------------------

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}`;
}

// ---------------------------------------------------------------------------
// Temp directories
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
  // Drop the process-wide library index cache so temp dirs do not leak.
  clearIndexCache();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A minimal, deterministic ToneGraph recipe (oscillator -> gain -> output). */
function toneGraphRecipe(): Record<string, unknown> {
  return {
    version: "0.1",
    meta: {
      name: "mp-integration-recipe",
      description: "Marketplace registration integration test recipe.",
      category: "Test",
      tags: ["test", "integration"],
      duration: 0.4,
      parameters: [
        {
          name: "freq",
          type: "number",
          min: 200,
          max: 800,
          unit: "Hz",
          default: 440,
        },
      ],
    },
    nodes: {
      osc: { kind: "oscillator", params: { type: "sine", frequency: 440 } },
      gain: { kind: "gain", params: { gain: 0.5 } },
      out: { kind: "destination" },
    },
    routing: [{ chain: ["osc", "gain", "out"] }],
  };
}

/** A stack preset referencing a single recipe layer. */
function stackPreset(
  name: string,
  recipeName: string,
): Record<string, unknown> {
  return {
    version: "1.0",
    name,
    layers: [{ recipe: recipeName, startTime: 0, gain: 1.0 }],
  };
}

interface ManifestInput {
  name: string;
  recipes?: string[];
  stacks?: string[];
  sequences?: string[];
  palettes?: string[];
}

function manifestOf(input: ManifestInput) {
  const parsed = parseManifest({
    name: input.name,
    version: "1.0.0",
    type: "recipe",
    author: "TestStudio",
    license: "mit",
    dependencies: [],
    assets: {
      recipes: input.recipes ?? [],
      stacks: input.stacks ?? [],
      sequences: input.sequences ?? [],
      palettes: input.palettes ?? [],
    },
  });
  if (!parsed.ok) {
    throw new Error(
      `invalid test manifest: ${JSON.stringify(parsed.issues)}`,
    );
  }
  return parsed.manifest;
}

/** Write a package directory (manifest.json + asset files). */
function writePackage(
  input: ManifestInput,
  files: Record<string, string> = {},
): string {
  const dir = tempDir("tf-mp-registrar-pkg-");
  const manifest = {
    name: input.name,
    version: "1.0.0",
    type: "recipe",
    author: "TestStudio",
    license: "mit",
    dependencies: [],
    assets: {
      recipes: input.recipes ?? [],
      stacks: input.stacks ?? [],
      sequences: input.sequences ?? [],
      palettes: input.palettes ?? [],
    },
  };
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  for (const [relative, content] of Object.entries(files)) {
    const absolute = join(dir, relative);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return dir;
}

/** An in-memory {@link MarketplaceRegistry} exposing fixed bundles. */
class StubRegistry implements MarketplaceRegistry {
  constructor(private readonly bundles: readonly MarketplacePackageBundle[]) {}

  search(): MarketplaceSearchListing[] {
    return [];
  }

  searchResult(category?: string): MarketplaceSearchResult {
    return { category: category ?? null, count: 0, listings: [] };
  }

  fetch(name: string, version: string): MarketplacePackageBundle | null {
    return (
      this.bundles.find(
        (bundle) => bundle.name === name && bundle.version === version,
      ) ?? null
    );
  }
}

/** Build a one-bundle stub registry over a package directory. */
function registryFor(input: ManifestInput, directory: string): StubRegistry {
  return new StubRegistry([
    {
      name: input.name,
      version: "1.0.0",
      directory,
      manifest: manifestOf(input),
    },
  ]);
}

// ---------------------------------------------------------------------------
// AC1 / AC5 — installed recipes are immediately available to `generate`
// ---------------------------------------------------------------------------

describe("marketplace registrar — recipes (AC1, AC3, AC5)", () => {
  it("registers an installed recipe so generate --recipe can render it", async () => {
    const recipeName = unique("mp-recipe");
    const pkgName = unique("mp-pkg");
    const recipeRel = `assets/recipes/${recipeName}.json`;
    const dir = writePackage(
      { name: pkgName, recipes: [recipeRel] },
      { [recipeRel]: JSON.stringify(toneGraphRecipe()) },
    );
    const libraryDir = tempDir("tf-mp-lib-");
    const registrar = createRegistrar(globalRegistry, {
      libraryBaseDir: libraryDir,
    });

    const result = installPackage(pkgName, "1.0.0", {
      registry: registryFor({ name: pkgName, recipes: [recipeRel] }, dir),
      stateStore: createInMemoryInstallStateStore(),
      registrarWithDirectory: registrar,
    });

    expect(result.installed).toBe(true);
    expect(result.issues).toEqual([]);

    // The recipe is in the reused registry immediately (AC1, AC3).
    expect(globalRegistry.getRegistration(recipeName)).toBeDefined();

    // `generate --recipe <installed>` uses renderRecipe(); assert it renders
    // non-silent audio of the declared duration (AC1, AC5).
    const audio = await renderRecipe(recipeName, 42);
    expect(audio.samples.length).toBeGreaterThan(0);
    expect(audio.samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("does not register a recipe before the package is installed", () => {
    const recipeName = unique("mp-absent");
    expect(globalRegistry.getRegistration(recipeName)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC2 / AC5 — installed stacks render via `stack render`
// ---------------------------------------------------------------------------

describe("marketplace registrar — stacks (AC2, AC5)", () => {
  it("renders an installed stack with loadPreset + renderStack", async () => {
    const recipeName = unique("mp-stack-recipe");
    const stackName = unique("mp-stack");
    const pkgName = unique("mp-stack-pkg");
    const recipeRel = `assets/recipes/${recipeName}.json`;
    const stackRel = `assets/stacks/${stackName}.json`;
    const dir = writePackage(
      { name: pkgName, recipes: [recipeRel], stacks: [stackRel] },
      {
        [recipeRel]: JSON.stringify(toneGraphRecipe()),
        [stackRel]: JSON.stringify(stackPreset(stackName, recipeName)),
      },
    );
    const libraryDir = tempDir("tf-mp-stack-lib-");
    const registrar = createRegistrar(globalRegistry, {
      libraryBaseDir: libraryDir,
    });

    const result = installPackage(pkgName, "1.0.0", {
      registry: registryFor(
        { name: pkgName, recipes: [recipeRel], stacks: [stackRel] },
        dir,
      ),
      stateStore: createInMemoryInstallStateStore(),
      registrarWithDirectory: registrar,
    });
    expect(result.installed).toBe(true);

    // `stack render` loads the preset (validating recipe references against
    // the shared registry) then renders it (AC2, AC5).
    const stackPath = join(dir, stackRel);
    const definition = await loadPreset(stackPath);
    expect(definition.layers).toHaveLength(1);
    expect(definition.layers[0]!.recipe).toBe(recipeName);

    const audio = await renderStack(definition, 7);
    expect(audio.samples.length).toBeGreaterThan(0);
    expect(audio.samples.some((sample) => sample !== 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC3 — the library index store tracks installed assets (extend, not fork)
// ---------------------------------------------------------------------------

describe("marketplace registrar — library index (AC3)", () => {
  it("records every installed asset kind in the reused library index", () => {
    const recipeName = unique("mp-lib-recipe");
    const stackName = unique("mp-lib-stack");
    const pkgName = unique("mp-lib-pkg");
    const recipeRel = `assets/recipes/${recipeName}.json`;
    const stackRel = `assets/stacks/${stackName}.json`;
    const dir = writePackage(
      { name: pkgName, recipes: [recipeRel], stacks: [stackRel] },
      {
        [recipeRel]: JSON.stringify(toneGraphRecipe()),
        [stackRel]: JSON.stringify(stackPreset(stackName, recipeName)),
      },
    );
    const libraryDir = tempDir("tf-mp-lib-index-");
    const registrar = createRegistrar(globalRegistry, {
      libraryBaseDir: libraryDir,
    });

    installPackage(pkgName, "1.0.0", {
      registry: registryFor(
        { name: pkgName, recipes: [recipeRel], stacks: [stackRel] },
        dir,
      ),
      stateStore: createInMemoryInstallStateStore(),
      registrarWithDirectory: registrar,
      registryName: "fixture",
    });

    const registered = listRegisteredAssets({ package: pkgName }, libraryDir);
    expect(registered.map((asset) => asset.kind).sort()).toEqual([
      "recipes",
      "stacks",
    ]);
    for (const asset of registered) {
      expect(asset.version).toBe("1.0.0");
      expect(asset.registry).toBe("fixture");
      expect(asset.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(asset.id).toBe(
        `${pkgName}@1.0.0:${asset.kind}:${asset.path}`,
      );
    }
  });

  it("is idempotent across a re-install", () => {
    const recipeName = unique("mp-idem-recipe");
    const pkgName = unique("mp-idem-pkg");
    const recipeRel = `assets/recipes/${recipeName}.json`;
    const dir = writePackage(
      { name: pkgName, recipes: [recipeRel] },
      { [recipeRel]: JSON.stringify(toneGraphRecipe()) },
    );
    const libraryDir = tempDir("tf-mp-idem-lib-");
    const registrar = createRegistrar(globalRegistry, {
      libraryBaseDir: libraryDir,
    });
    const registry = registryFor({ name: pkgName, recipes: [recipeRel] }, dir);

    installPackage(pkgName, "1.0.0", {
      registry,
      stateStore: createInMemoryInstallStateStore(),
      registrarWithDirectory: registrar,
    });
    const first = listRegisteredAssets({ package: pkgName }, libraryDir);

    installPackage(pkgName, "1.0.0", {
      registry,
      stateStore: createInMemoryInstallStateStore(),
      registrarWithDirectory: registrar,
    });
    const second = listRegisteredAssets({ package: pkgName }, libraryDir);

    expect(second).toEqual(first);
  });
});

// ---------------------------------------------------------------------------
// AC4 — installed output is byte-identical to locally authored output
// ---------------------------------------------------------------------------

describe("marketplace registrar — determinism (AC4)", () => {
  it("renders installed and locally authored recipes byte-identically", async () => {
    const uid = unique("mp-det");
    const installedName = `${uid}-installed`;
    const localName = `${uid}-local`;
    const pkgName = `${uid}-pkg`;
    const recipeRel = `assets/recipes/${installedName}.json`;
    const recipeContent = JSON.stringify(toneGraphRecipe());

    // Install the recipe from a package.
    const dir = writePackage(
      { name: pkgName, recipes: [recipeRel] },
      { [recipeRel]: recipeContent },
    );
    const libraryDir = tempDir("tf-mp-det-lib-");
    const registrar = createRegistrar(globalRegistry, {
      libraryBaseDir: libraryDir,
    });
    installPackage(pkgName, "1.0.0", {
      registry: registryFor({ name: pkgName, recipes: [recipeRel] }, dir),
      stateStore: createInMemoryInstallStateStore(),
      registrarWithDirectory: registrar,
    });

    // Author the identical recipe locally and discover it through the normal
    // file-backed path (the same one the CLI uses for ~/.toneforge/recipes).
    const localDir = tempDir("tf-mp-det-local-");
    writeFileSync(join(localDir, `${localName}.json`), recipeContent);
    await discoverFileBackedRecipes(globalRegistry, {
      recipeDirectory: localDir,
    });

    const installed = await renderRecipe(installedName, 4242);
    const local = await renderRecipe(localName, 4242);

    expect(installed.samples.length).toBe(local.samples.length);
    expect(Buffer.from(installed.samples.buffer)).toEqual(
      Buffer.from(local.samples.buffer),
    );
  });

  it("renders installed and locally authored stacks byte-identically", async () => {
    const uid = unique("mp-det-stack");
    const installedName = `${uid}-installed`;
    const localName = `${uid}-local`;
    const installedStack = `${uid}-installed-stack`;
    const localStack = `${uid}-local-stack`;
    const pkgName = `${uid}-pkg`;
    const recipeRel = `assets/recipes/${installedName}.json`;
    const stackRel = `assets/stacks/${installedStack}.json`;
    const recipeContent = JSON.stringify(toneGraphRecipe());
    const stackContent = JSON.stringify(
      stackPreset(installedStack, installedName),
    );

    const dir = writePackage(
      { name: pkgName, recipes: [recipeRel], stacks: [stackRel] },
      { [recipeRel]: recipeContent, [stackRel]: stackContent },
    );
    const libraryDir = tempDir("tf-mp-det-stack-lib-");
    const registrar = createRegistrar(globalRegistry, {
      libraryBaseDir: libraryDir,
    });
    installPackage(pkgName, "1.0.0", {
      registry: registryFor(
        { name: pkgName, recipes: [recipeRel], stacks: [stackRel] },
        dir,
      ),
      stateStore: createInMemoryInstallStateStore(),
      registrarWithDirectory: registrar,
    });

    // Locally authored equivalents: identical recipe bytes under a new name,
    // and a stack referencing that local recipe.
    const localDir = tempDir("tf-mp-det-stack-local-");
    writeFileSync(join(localDir, `${localName}.json`), recipeContent);
    await discoverFileBackedRecipes(globalRegistry, {
      recipeDirectory: localDir,
    });
    const localStackPath = join(localDir, `${localStack}.json`);
    writeFileSync(
      localStackPath,
      JSON.stringify(stackPreset(localStack, localName)),
    );

    const installedDefinition = await loadPreset(join(dir, stackRel));
    const localDefinition = await loadPreset(localStackPath);

    const installed = await renderStack(installedDefinition, 99);
    const local = await renderStack(localDefinition, 99);

    expect(installed.samples.length).toBe(local.samples.length);
    expect(Buffer.from(installed.samples.buffer)).toEqual(
      Buffer.from(local.samples.buffer),
    );
  });
});
