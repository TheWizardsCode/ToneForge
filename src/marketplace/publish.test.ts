/**
 * Marketplace publish pipeline tests.
 *
 * Tests the publish flow: manifest parse, asset integrity, quality gate,
 * dependency resolution, immutability and registration
 * (work item TF-0MUZX3YVJ001VHLN).
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 7, 9.
 */

import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  marketplaceFixtureDir,
  packageFixtureDir,
} from "../test-utils/marketplace-fixtures.js";
import { publishPackage } from "./publish.js";
import { createValidatorGate } from "./install.js";
import {
  LocalDirectoryRegistry,
  createLocalRegistry,
  loadRegistryIndex,
  type MutableMarketplaceRegistry,
  type MarketplaceRegistryEntry,
} from "./registry.js";
import type { MarketplaceIssue } from "./types.js";

// ---------------------------------------------------------------------------
// In-memory registry helper
// ---------------------------------------------------------------------------

/** Minimal in-memory registry that satisfies the interface for tests. */
class InMemoryRegistry implements MutableMarketplaceRegistry {
  packages: MarketplaceRegistryEntry[] = [];
  indexFile = ":memory:";
  root = ":memory:";

  has(name: string, version: string): boolean {
    return this.packages.some(
      (p) => p.name === name && p.version === version,
    );
  }

  register(entry: MarketplaceRegistryEntry): void {
    this.packages.push(entry);
  }

  search(): never {
    throw new Error("not implemented");
  }

  searchResult(): never {
    throw new Error("not implemented");
  }

  fetch(): never {
    throw new Error("not implemented");
  }
}

const FIXTURE_ROOT = marketplaceFixtureDir();

/** Write a synthetic registry index to an isolated temporary directory. */
function writeIndexFile(
  base: string,
  packages: MarketplaceRegistryEntry[] = [],
): string {
  const file = join(base, "index.json");
  writeFileSync(
    file,
    JSON.stringify({ version: "1.0", packages, installed: [] }, null, 2) + "\n",
    "utf-8",
  );
  return file;
}

/** A registry backed by a synthetic, writable index over the fixture root. */
function fixtureRegistry(base: string): LocalDirectoryRegistry {
  return createLocalRegistry({
    indexFile: writeIndexFile(base),
    root: FIXTURE_ROOT,
  });
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Create a temporary package directory with the given manifest and assets. */
function createPackage(
  base: string,
  name: string,
  version: string,
  assets: Record<string, string[]>,
  deps: string[] = [],
): string {
  const dir = join(base, name);
  mkdirSync(dir, { recursive: true });

  const assetContents: Record<string, string> = {};
  for (const [kind, paths] of Object.entries(assets)) {
    for (const relPath of paths) {
      const full = join(dir, relPath);
      mkdirSync(dirname(full), { recursive: true });
      const content = JSON.stringify({ kind, path: relPath, seed: 42 });
      writeFileSync(full, content, "utf-8");
      assetContents[relPath] = content;
    }
  }

  const manifest = {
    name,
    version,
    type: "recipe",
    author: "TestAuthor",
    license: "mit",
    dependencies: deps,
    assets: {
      recipes: assets.recipes ?? [],
      stacks: assets.stacks ?? [],
      sequences: assets.sequences ?? [],
      palettes: assets.palettes ?? [],
    },
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  return dir;
}

/** Create a temporary fixture directory for testing. */
function fixtureDir(prefix: string): string {
  const base = join(tmpdir(), `marketplace-test-${prefix}-${Date.now()}`);
  mkdirSync(base, { recursive: true });
  return base;
}

/** Tear down a fixture directory. */
function teardown(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

/** Build a dependency provider that returns known packages. */
function makeProvider(packages: { name: string; version: string }[]): {
  name: string;
  provider: (name: string) => readonly { name: string; version: string; dependencies?: string[] }[];
} {
  const map = new Map<string, { name: string; version: string }[]>();
  for (const pkg of packages) {
    const existing = map.get(pkg.name) ?? [];
    existing.push(pkg);
    map.set(pkg.name, existing);
  }
  return {
    name: "provider",
    provider: (name: string) => (map.get(name) ?? []).map((p) => ({ name: p.name, version: p.version })),
  };
}

// ---------------------------------------------------------------------------
// AC1 — valid package publishes successfully
// ---------------------------------------------------------------------------

describe("publish — valid package", () => {
  it("publishes a well-formed package to an empty registry", () => {
    const fixture = fixtureDir("publish-valid");
    try {
      const pkgDir = createPackage(fixture, "good_package", "1.0.0", {
        recipes: ["assets/recipes/test.json"],
      });

      const registry = new InMemoryRegistry();
      const result = publishPackage(pkgDir, { registry });

      expect(result.published).toBe(true);
      expect(result.name).toBe("good_package");
      expect(result.version).toBe("1.0.0");
      expect(result.issues).toEqual([]);
      expect(registry.packages).toHaveLength(1);
      expect(registry.packages[0]!.name).toBe("good_package");
      expect(registry.packages[0]!.version).toBe("1.0.0");
      expect(registry.packages[0]!.assets.recipes).toBe(1);
    } finally {
      teardown(fixture);
    }
  });

  it("publishes a package with all asset kinds", () => {
    const fixture = fixtureDir("publish-all-kinds");
    try {
      const pkgDir = createPackage(fixture, "full_package", "2.0.0", {
        recipes: ["a.json", "b.json"],
        stacks: ["s.json"],
        sequences: ["q.json"],
        palettes: ["p.json"],
      });

      const registry = new InMemoryRegistry();
      const result = publishPackage(pkgDir, { registry });

      expect(result.published).toBe(true);
      expect(result.issues).toEqual([]);
      const entry = registry.packages[0]!;
      expect(entry.assets.recipes).toBe(2);
      expect(entry.assets.stacks).toBe(1);
      expect(entry.assets.sequences).toBe(1);
      expect(entry.assets.palettes).toBe(1);
    } finally {
      teardown(fixture);
    }
  });

  it("publishes with a custom registry name in provenance", () => {
    const fixture = fixtureDir("publish-registry-name");
    try {
      const pkgDir = createPackage(fixture, "named_pkg", "1.0.0", {
        recipes: ["a.json"],
      });

      const registry = new InMemoryRegistry();
      const result = publishPackage(pkgDir, {
        registry,
        registryName: "private-registry",
      });

      expect(result.published).toBe(true);
      expect(registry.packages[0]!.name).toBe("named_pkg");
    } finally {
      teardown(fixture);
    }
  });
});

// ---------------------------------------------------------------------------
// AC2 — invalid packages are rejected with structured errors
// ---------------------------------------------------------------------------

describe("publish — invalid packages", () => {
  it("rejects a missing manifest", () => {
    const fixture = fixtureDir("publish-no-manifest");
    try {
      mkdirSync(fixture, { recursive: true });
      const result = publishPackage(fixture, { registry: new InMemoryRegistry() });

      expect(result.published).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.field).toBe("manifest");
    } finally {
      teardown(fixture);
    }
  });

  it("rejects an invalid JSON manifest", () => {
    const fixture = fixtureDir("publish-bad-json");
    try {
      mkdirSync(fixture, { recursive: true });
      writeFileSync(join(fixture, "manifest.json"), "{not json}", "utf-8");
      const result = publishPackage(fixture, { registry: new InMemoryRegistry() });

      expect(result.published).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.field).toBe("manifest");
    } finally {
      teardown(fixture);
    }
  });

  it("rejects a missing-required-field manifest", () => {
    const fixture = fixtureDir("publish-missing-fields");
    try {
      const dir = join(fixture, "bad");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "manifest.json"),
        JSON.stringify({ name: "bad" }) + "\n",
        "utf-8",
      );
      const result = publishPackage(dir, { registry: new InMemoryRegistry() });

      expect(result.published).toBe(false);
      const fields = result.issues.map((i) => i.field);
      expect(fields).toContain("version");
      expect(fields).toContain("type");
      expect(fields).toContain("author");
      expect(fields).toContain("license");
      expect(fields).toContain("dependencies");
      expect(fields).toContain("assets");
    } finally {
      teardown(fixture);
    }
  });

  it("rejects a manifest with invalid version format", () => {
    const fixture = fixtureDir("publish-bad-version");
    try {
      const dir = join(fixture, "bad");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "manifest.json"),
        JSON.stringify({
          name: "bad",
          version: "1.0", // not MAJOR.MINOR.PATCH
          type: "recipe",
          author: "A",
          license: "mit",
          dependencies: [],
          assets: { recipes: [], stacks: [], sequences: [], palettes: [] },
        }) + "\n",
        "utf-8",
      );
      const result = publishPackage(dir, { registry: new InMemoryRegistry() });

      expect(result.published).toBe(false);
      expect(result.issues[0]!.field).toBe("version");
    } finally {
      teardown(fixture);
    }
  });

  it("rejects a package with missing asset files", () => {
    const fixture = fixtureDir("publish-missing-assets");
    try {
      const dir = join(fixture, "bad");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "manifest.json"),
        JSON.stringify({
          name: "bad",
          version: "1.0.0",
          type: "recipe",
          author: "A",
          license: "mit",
          dependencies: [],
          assets: {
            recipes: ["assets/recipes/missing.json"],
            stacks: [],
            sequences: [],
            palettes: [],
          },
        }) + "\n",
        "utf-8",
      );
      const result = publishPackage(dir, { registry: new InMemoryRegistry() });

      expect(result.published).toBe(false);
      expect(result.issues[0]!.field).toContain("recipes");
    } finally {
      teardown(fixture);
    }
  });

  it("rejects a package with path-traversal in asset paths", () => {
    const fixture = fixtureDir("publish-path-traversal");
    try {
      const dir = join(fixture, "bad");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "manifest.json"),
        JSON.stringify({
          name: "bad",
          version: "1.0.0",
          type: "recipe",
          author: "A",
          license: "mit",
          dependencies: [],
          assets: {
            recipes: ["../../../etc/passwd"],
            stacks: [],
            sequences: [],
            palettes: [],
          },
        }) + "\n",
        "utf-8",
      );
      const result = publishPackage(dir, { registry: new InMemoryRegistry() });

      expect(result.published).toBe(false);
      expect(result.issues[0]!.message).toMatch(/escapes/i);
    } finally {
      teardown(fixture);
    }
  });
});

// ---------------------------------------------------------------------------
// AC3 — immutability: republishing an existing version fails
// ---------------------------------------------------------------------------

describe("publish — immutability", () => {
  it("rejects republishing an already-published version", () => {
    const fixture = fixtureDir("publish-immutability");
    try {
      const pkgDir = createPackage(fixture, "immutable_pkg", "1.0.0", {
        recipes: ["a.json"],
      });

      const registry = new InMemoryRegistry();

      // First publish succeeds.
      const first = publishPackage(pkgDir, { registry });
      expect(first.published).toBe(true);
      expect(first.issues).toEqual([]);

      // Second publish of the same name@version is rejected.
      const second = publishPackage(pkgDir, { registry });
      expect(second.published).toBe(false);
      expect(second.issues).toHaveLength(1);
      expect(second.issues[0]!.field).toBe("version");
      expect(second.issues[0]!.message).toMatch(/immutable/i);
    } finally {
      teardown(fixture);
    }
  });

  it("allows publishing a different version of the same name", () => {
    const fixture = fixtureDir("publish-different-version");
    try {
      const pkgDir = createPackage(fixture, "same_name", "1.0.0", {
        recipes: ["a.json"],
      });

      const registry = new InMemoryRegistry();

      const v1 = publishPackage(pkgDir, { registry });
      expect(v1.published).toBe(true);

      // Republish v1 is rejected.
      const v1Again = publishPackage(pkgDir, { registry });
      expect(v1Again.published).toBe(false);

      // A different version is allowed (simulated via different manifest).
      const differentPkgDir = createPackage(fixture, "same_name", "2.0.0", {
        recipes: ["b.json"],
      });
      const v2 = publishPackage(differentPkgDir, { registry });
      expect(v2.published).toBe(true);
      expect(v2.version).toBe("2.0.0");
    } finally {
      teardown(fixture);
    }
  });
});

// ---------------------------------------------------------------------------
// AC4 — dependency conflict detection via the F4 resolver
// ---------------------------------------------------------------------------

describe("publish — dependency resolution", () => {
  it("rejects a package with unsatisfiable dependency conflicts", () => {
    const fixture = fixtureDir("publish-dep-conflict");
    try {
      // Create a package that requires core>=3.0 when only 1.0.0 exists.
      const pkgDir = createPackage(fixture, "conflict_pkg", "1.0.0", {
        recipes: ["a.json"],
      }, ["core>=3.0"]);

      const registry = new InMemoryRegistry();
      // Only 1.0.0 is available for core.
      const { provider } = makeProvider([
        { name: "core", version: "1.0.0" },
      ]);

      const result = publishPackage(pkgDir, {
        registry,
        dependencyProvider: provider,
      });

      expect(result.published).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.field).toContain("dependencies");
    } finally {
      teardown(fixture);
    }
  });

  it("accepts a package whose dependencies are all satisfiable", () => {
    const fixture = fixtureDir("publish-dep-ok");
    try {
      const pkgDir = createPackage(fixture, "ok_pkg", "1.0.0", {
        recipes: ["a.json"],
      }, ["core>=1.0"]);

      const registry = new InMemoryRegistry();
      const { provider } = makeProvider([
        { name: "core", version: "1.0.0" },
        { name: "core", version: "2.0.0" },
      ]);

      const result = publishPackage(pkgDir, {
        registry,
        dependencyProvider: provider,
      });

      expect(result.published).toBe(true);
      expect(result.issues).toEqual([]);
    } finally {
      teardown(fixture);
    }
  });

  it("skips dependency resolution when no provider is given", () => {
    const fixture = fixtureDir("publish-no-dep-provider");
    try {
      const pkgDir = createPackage(fixture, "no_dep_pkg", "1.0.0", {
        recipes: ["a.json"],
      }, ["core>=1.0"]);

      const registry = new InMemoryRegistry();
      // No provider means the dependency gate is skipped.
      const result = publishPackage(pkgDir, { registry });

      expect(result.published).toBe(true);
    } finally {
      teardown(fixture);
    }
  });
});

// ---------------------------------------------------------------------------
// Custom validator gate
// ---------------------------------------------------------------------------

describe("publish — validator gate", () => {
  it("rejects when the custom validator returns issues", () => {
    const fixture = fixtureDir("publish-custom-validator");
    try {
      const pkgDir = createPackage(fixture, "validator_pkg", "1.0.0", {
        recipes: ["a.json"],
      });

      const registry = new InMemoryRegistry();
      // A validator that always rejects.
      const rejectingValidator = {
        validate(): { field: string; message: string }[] {
          return [{ field: "quality", message: "custom quality gate failed" }];
        },
      };

      const result = publishPackage(pkgDir, {
        registry,
        validator: rejectingValidator,
      });

      expect(result.published).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.field).toBe("quality");
    } finally {
      teardown(fixture);
    }
  });

  it("publishes when the custom validator passes", () => {
    const fixture = fixtureDir("publish-passing-validator");
    try {
      const pkgDir = createPackage(fixture, "pass_pkg", "1.0.0", {
        recipes: ["a.json"],
      });

      const registry = new InMemoryRegistry();
      const passingValidator = {
        validate(): MarketplaceIssue[] {
          return [];
        },
      };

      const result = publishPackage(pkgDir, {
        registry,
        validator: passingValidator,
      });

      expect(result.published).toBe(true);
      expect(result.issues).toEqual([]);
    } finally {
      teardown(fixture);
    }
  });
});

// ---------------------------------------------------------------------------
// Determinism check
// ---------------------------------------------------------------------------

describe("publish — determinism", () => {
  it("produces an identical asset inventory across repeated publishes", () => {
    const fixture = fixtureDir("publish-determinism");
    try {
      const pkgDir = createPackage(fixture, "det_pkg", "1.0.0", {
        recipes: ["a.json", "b.json"],
      });

      const registry = new InMemoryRegistry();
      const result = publishPackage(pkgDir, { registry });

      expect(result.published).toBe(true);

      // Re-publishing into a fresh registry yields an identical asset
      // inventory (deterministic content addressing).
      const registry2 = new InMemoryRegistry();
      const result2 = publishPackage(pkgDir, { registry: registry2 });
      expect(result2.published).toBe(true);
      expect(registry2.packages[0]!.assets).toEqual(
        registry.packages[0]!.assets,
      );
    } finally {
      teardown(fixture);
    }
  });
});

// ---------------------------------------------------------------------------
// License declaration
// ---------------------------------------------------------------------------

describe("publish — license declaration", () => {
  it("rejects a package that does not declare a license", () => {
    const fixture = fixtureDir("publish-no-license");
    try {
      const dir = join(fixture, "no_license");
      mkdirSync(join(dir, "assets", "recipes"), { recursive: true });
      writeFileSync(
        join(dir, "assets", "recipes", "a.json"),
        JSON.stringify({ seed: 1 }) + "\n",
        "utf-8",
      );
      writeFileSync(
        join(dir, "manifest.json"),
        JSON.stringify({
          name: "no_license",
          version: "1.0.0",
          type: "recipe",
          author: "A",
          // license intentionally omitted
          dependencies: [],
          assets: {
            recipes: ["assets/recipes/a.json"],
            stacks: [],
            sequences: [],
            palettes: [],
          },
        }) + "\n",
        "utf-8",
      );

      const result = publishPackage(dir, { registry: new InMemoryRegistry() });

      expect(result.published).toBe(false);
      expect(result.issues.map((i) => i.field)).toContain("license");
    } finally {
      teardown(fixture);
    }
  });

  it("carries the declared license into the registry entry", () => {
    const fixture = fixtureDir("publish-license-record");
    try {
      const pkgDir = createPackage(fixture, "licensed_pkg", "1.0.0", {
        recipes: ["a.json"],
      });

      const registry = new InMemoryRegistry();
      const result = publishPackage(pkgDir, { registry });

      expect(result.published).toBe(true);
      expect(registry.packages[0]!.license).toBe("mit");
    } finally {
      teardown(fixture);
    }
  });
});

// ---------------------------------------------------------------------------
// Local directory registry integration (real persistence)
// ---------------------------------------------------------------------------

describe("publish — local directory registry", () => {
  it("persists a published package to the registry index file", () => {
    const fixture = fixtureDir("publish-local-registry");
    try {
      const pkgDir = createPackage(fixture, "persisted_pkg", "1.0.0", {
        recipes: ["a.json"],
      });

      const indexFile = join(fixture, "index.json");
      writeFileSync(
        indexFile,
        JSON.stringify({ version: "1.0", packages: [], installed: [] }) + "\n",
        "utf-8",
      );

      const registry = new LocalDirectoryRegistry({
        indexFile,
        root: fixture,
      });

      const result = publishPackage(pkgDir, { registry });
      expect(result.published).toBe(true);

      // Reload from disk: the package must be present.
      const reloaded = loadRegistryIndex(indexFile);
      expect(reloaded.packages).toHaveLength(1);
      expect(reloaded.packages[0]!.name).toBe("persisted_pkg");
      expect(reloaded.packages[0]!.version).toBe("1.0.0");

      // No mutation of the package directory.
      const manifest = JSON.parse(
        readFileSync(join(pkgDir, "manifest.json"), "utf-8"),
      ) as { name: string };
      expect(manifest.name).toBe("persisted_pkg");
    } finally {
      teardown(fixture);
    }
  });

  it("rejects republishing through a file-backed registry after reload", () => {
    const fixture = fixtureDir("publish-local-immutable");
    try {
      const pkgDir = createPackage(fixture, "file_pkg", "1.0.0", {
        recipes: ["a.json"],
      });

      const indexFile = join(fixture, "index.json");
      writeFileSync(
        indexFile,
        JSON.stringify({ version: "1.0", packages: [], installed: [] }) + "\n",
        "utf-8",
      );

      const first = new LocalDirectoryRegistry({ indexFile, root: fixture });
      expect(publishPackage(pkgDir, { registry: first }).published).toBe(true);

      // A fresh registry instance reloads the persisted index and must
      // reject the duplicate.
      const second = new LocalDirectoryRegistry({ indexFile, root: fixture });
      const republish = publishPackage(pkgDir, { registry: second });
      expect(republish.published).toBe(false);
      expect(republish.issues[0]!.message).toMatch(/immutable/i);
    } finally {
      teardown(fixture);
    }
  });
});

// ---------------------------------------------------------------------------
// Demo 12 Validator seam
// ---------------------------------------------------------------------------

describe("publish — Demo 12 Validator seam", () => {
  it("delegates to a gate built with createValidatorGate", () => {
    const fixture = fixtureDir("publish-demo12-validator");
    try {
      const pkgDir = createPackage(fixture, "demo12_pkg", "1.0.0", {
        recipes: ["a.json"],
      });

      const registry = new InMemoryRegistry();
      const seenDirectories: string[] = [];
      const gate = createValidatorGate((request) => {
        seenDirectories.push(request.directory);
        // A passing Demo 12-style gate.
        return [];
      });

      const result = publishPackage(pkgDir, { registry, validator: gate });

      expect(result.published).toBe(true);
      expect(seenDirectories).toHaveLength(1);
      expect(seenDirectories[0]).toBe(resolve(pkgDir));
    } finally {
      teardown(fixture);
    }
  });

  it("propagates a Demo 12-style rejection to the publish result", () => {
    const fixture = fixtureDir("publish-demo12-reject");
    try {
      const pkgDir = createPackage(fixture, "demo12_bad", "1.0.0", {
        recipes: ["a.json"],
      });

      const registry = new InMemoryRegistry();
      const gate = createValidatorGate(() => [
        { field: "audio.peak_clipping", message: "peak clipping detected" },
      ]);

      const result = publishPackage(pkgDir, { registry, validator: gate });

      expect(result.published).toBe(false);
      expect(result.issues[0]!.field).toBe("audio.peak_clipping");
      expect(registry.packages).toHaveLength(0);
    } finally {
      teardown(fixture);
    }
  });
});

// ---------------------------------------------------------------------------
// AC4 — reject and publish paths via the fixture registry
// ---------------------------------------------------------------------------

describe("publish — fixture registry", () => {
  it("publishes the fixture industrial_lasers package and records metadata", () => {
    const fixture = fixtureDir("publish-fixture-valid");
    try {
      const registry = fixtureRegistry(fixture);
      const result = publishPackage(packageFixtureDir("industrial_lasers"), {
        registry,
      });

      expect(result.published).toBe(true);
      expect(result.name).toBe("industrial_lasers");
      expect(result.version).toBe("2.1.0");
      expect(result.issues).toEqual([]);

      const entry = registry.registryIndex.packages[0]!;
      expect(entry.author).toBe("StudioX");
      expect(entry.license).toBe("commercial");
      expect(entry.category).toBe("combat");
      expect(entry.assets).toEqual({
        recipes: 1,
        stacks: 1,
        sequences: 1,
        palettes: 1,
      });
    } finally {
      teardown(fixture);
    }
  });

  it("rejects the fixture broken_manifest package with structured errors", () => {
    const fixture = fixtureDir("publish-fixture-invalid");
    try {
      const registry = fixtureRegistry(fixture);
      const result = publishPackage(packageFixtureDir("broken_manifest"), {
        registry,
      });

      expect(result.published).toBe(false);
      const fields = result.issues.map((issue) => issue.field);
      expect(fields).toContain("version");
      expect(fields).toContain("license");
      expect(fields).toContain("author");
      // Nothing was registered.
      expect(registry.registryIndex.packages).toHaveLength(0);
    } finally {
      teardown(fixture);
    }
  });

  it("rejects republishing the fixture package (immutability)", () => {
    const fixture = fixtureDir("publish-fixture-immutable");
    try {
      const registry = fixtureRegistry(fixture);
      const pkgDir = packageFixtureDir("industrial_lasers");

      expect(publishPackage(pkgDir, { registry }).published).toBe(true);

      const republish = publishPackage(pkgDir, { registry });
      expect(republish.published).toBe(false);
      expect(republish.issues[0]!.field).toBe("version");
      expect(republish.issues[0]!.message).toMatch(/immutable/i);
      // Still exactly one entry.
      expect(registry.registryIndex.packages).toHaveLength(1);
    } finally {
      teardown(fixture);
    }
  });
});
