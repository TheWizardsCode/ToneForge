/**
 * Marketplace install pipeline tests.
 *
 * Written first (work item TF-0MUZX3YKC002LZYB) against the F1 fixture
 * registry. They pin the contract the install pipeline must satisfy:
 *
 * - fetch -> integrity check -> validation gate -> register assets ->
 *   version lock + provenance (`docs/prd/MARKETPLACE_PRD.md` Sections 7, 8.1, 10);
 * - invalid packages and integrity failures are rejected **before** any local
 *   registration occurs;
 * - a successful install registers every asset kind, records provenance and
 *   locks the exact version;
 * - re-installing the same version is reproducible (identical registered state);
 * - the whole pipeline runs offline over the fixture registry (no live network).
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 7, 8.1, 10, 13.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  marketplaceFixtureDir,
  packageFixtureDir,
} from "../test-utils/marketplace-fixtures.js";
import { withNoNetwork } from "./harness.js";
import {
  createFileInstallStateStore,
  createInMemoryInstallStateStore,
  createManifestValidator,
  createValidatorGate,
  installPackage,
  normaliseInstallState,
  serializeInstallState,
  toInstallOutcome,
  type MarketplaceAssetRegistrar,
  type MarketplaceInstalledRecord,
  type MarketplaceInstallState,
  type MarketplaceInstallStateStore,
  type MarketplaceValidator,
} from "./install.js";
import {
  LocalDirectoryRegistry,
  MarketplaceRegistryError,
  createLocalRegistry,
} from "./registry.js";
import { parseManifest } from "./manifest.js";
import type {
  MarketplacePackageBundle,
  MarketplaceRegistry,
  MarketplaceRegistryEntry,
  MarketplaceSearchListing,
  MarketplaceSearchResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

const FIXTURE_ROOT = marketplaceFixtureDir();
const REGISTRY_INDEX = join(FIXTURE_ROOT, "registry", "index.json");

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
});

/** Build a registry index entry with sensible defaults. */
function entry(
  overrides: Partial<MarketplaceRegistryEntry> & {
    name: string;
    version: string;
  },
): MarketplaceRegistryEntry {
  return {
    type: "stack",
    category: "combat",
    author: "StudioX",
    license: "commercial",
    rating: 4,
    path: packageFixtureDir("industrial_lasers"),
    assets: { recipes: 0, stacks: 0, sequences: 0, palettes: 0 },
    ...overrides,
  };
}

/** Write a synthetic registry index to an isolated temporary directory. */
function writeIndex(
  packages: MarketplaceRegistryEntry[],
  installed: { name: string; version: string }[] = [],
): string {
  const dir = tempDir("tf-mp-install-index-");
  const file = join(dir, "index.json");
  writeFileSync(file, JSON.stringify({ version: "1.0", packages, installed }, null, 2));
  return file;
}

/** A registry backed by a synthetic index over the fixture packages. */
function fixtureRegistry(
  packages: MarketplaceRegistryEntry[],
  installed: { name: string; version: string }[] = [],
): LocalDirectoryRegistry {
  return createLocalRegistry({ indexFile: writeIndex(packages, installed), root: FIXTURE_ROOT });
}

/** The fixture `industrial_lasers@2.1.0` package (not in the seeded index). */
function industrialLasersEntry(): MarketplaceRegistryEntry {
  return entry({
    name: "industrial_lasers",
    version: "2.1.0",
    path: packageFixtureDir("industrial_lasers"),
    assets: { recipes: 1, stacks: 1, sequences: 1, palettes: 1 },
  });
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

/** A registrar that records every registration it receives. */
function collectingRegistrar(): {
  registrar: MarketplaceAssetRegistrar;
  records: MarketplaceInstalledRecord[];
} {
  const records: MarketplaceInstalledRecord[] = [];
  return {
    records,
    registrar: {
      register(record: MarketplaceInstalledRecord): void {
        records.push(record);
      },
    },
  };
}

/** Build a package directory (manifest + asset files) under a temp dir. */
function writePackage(
  manifest: Record<string, unknown>,
  files: Record<string, string> = {},
): string {
  const dir = tempDir("tf-mp-install-pkg-");
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  for (const [relative, content] of Object.entries(files)) {
    const absolute = join(dir, relative);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return dir;
}

/** Parse a manifest object into the typed bundle manifest. */
function manifestOf(value: unknown) {
  const parsed = parseManifest(value);
  if (!parsed.ok) throw new Error(`invalid test manifest: ${JSON.stringify(parsed.issues)}`);
  return parsed.manifest;
}

/** Canonical registered-state snapshot of a store. */
function snapshot(store: MarketplaceInstallStateStore): string {
  return serializeInstallState(store.load());
}

// ---------------------------------------------------------------------------
// Failure paths (must run before any local registration)
// ---------------------------------------------------------------------------

describe("installPackage — rejection paths", () => {
  it("rejects a package the registry does not know, without registering", () => {
    const registry = fixtureRegistry([industrialLasersEntry()]);
    const store = createInMemoryInstallStateStore();
    const { registrar, records } = collectingRegistrar();

    const result = installPackage("does_not_exist", "1.0.0", {
      registry,
      stateStore: store,
      registrar,
    });

    expect(result.installed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.field).toBe("package");
    expect(result.registeredAssets).toEqual([]);
    expect(result.provenance).toBeNull();
    expect(records).toEqual([]);
    expect(store.load().packages).toEqual([]);
  });

  it("rejects an invalid manifest with structured field errors before registering", () => {
    const registry = fixtureRegistry([
      entry({
        name: "broken_manifest",
        version: "1.0.0",
        path: packageFixtureDir("broken_manifest"),
      }),
    ]);
    const store = createInMemoryInstallStateStore();
    const { registrar, records } = collectingRegistrar();

    const result = installPackage("broken_manifest", "1.0.0", {
      registry,
      stateStore: store,
      registrar,
    });

    expect(result.installed).toBe(false);
    const fields = result.issues.map((issue) => issue.field);
    expect(fields).toContain("version");
    expect(fields).toContain("license");
    expect(fields).toContain("author");
    expect(records).toEqual([]);
    expect(store.load().packages).toEqual([]);
  });

  it("rejects a missing asset as an integrity failure before registering", () => {
    const dir = writePackage({
      name: "missing_asset",
      version: "1.0.0",
      type: "recipe",
      author: "StudioX",
      license: "mit",
      dependencies: [],
      assets: {
        recipes: ["assets/recipes/absent.json"],
        stacks: [],
        sequences: [],
        palettes: [],
      },
    });
    const registry = new StubRegistry([
      {
        name: "missing_asset",
        version: "1.0.0",
        directory: dir,
        manifest: manifestOf({
          name: "missing_asset",
          version: "1.0.0",
          type: "recipe",
          author: "StudioX",
          license: "mit",
          dependencies: [],
          assets: {
            recipes: ["assets/recipes/absent.json"],
            stacks: [],
            sequences: [],
            palettes: [],
          },
        }),
      },
    ]);
    const store = createInMemoryInstallStateStore();
    const { registrar, records } = collectingRegistrar();

    const result = installPackage("missing_asset", "1.0.0", {
      registry,
      stateStore: store,
      registrar,
    });

    expect(result.installed).toBe(false);
    expect(result.issues[0]!.field).toBe("recipes/assets/recipes/absent.json");
    expect(result.issues[0]!.message).toMatch(/missing asset/i);
    expect(records).toEqual([]);
    expect(store.load().packages).toEqual([]);
  });

  it("rejects a declared content-hash mismatch before registering", () => {
    const dir = writePackage(
      {
        name: "hash_mismatch",
        version: "1.0.0",
        type: "recipe",
        author: "StudioX",
        license: "mit",
        dependencies: [],
        assets: {
          recipes: ["assets/recipes/x.json"],
          stacks: [],
          sequences: [],
          palettes: [],
        },
      },
      { "assets/recipes/x.json": '{"kind":"recipe"}' },
    );
    const manifest = manifestOf({
      name: "hash_mismatch",
      version: "1.0.0",
      type: "recipe",
      author: "StudioX",
      license: "mit",
      dependencies: [],
      assets: {
        recipes: ["assets/recipes/x.json"],
        stacks: [],
        sequences: [],
        palettes: [],
      },
    });
    const registry = new StubRegistry([
      {
        name: "hash_mismatch",
        version: "1.0.0",
        directory: dir,
        manifest,
        integrity: { "assets/recipes/x.json": "deadbeef".repeat(8) },
      },
    ]);
    const store = createInMemoryInstallStateStore();
    const { registrar, records } = collectingRegistrar();

    const result = installPackage("hash_mismatch", "1.0.0", {
      registry,
      stateStore: store,
      registrar,
    });

    expect(result.installed).toBe(false);
    expect(result.issues[0]!.message).toMatch(/hash mismatch/i);
    expect(records).toEqual([]);
    expect(store.load().packages).toEqual([]);
  });

  it("rejects an asset path that escapes the package directory", () => {
    const dir = writePackage({
      name: "traversal",
      version: "1.0.0",
      type: "recipe",
      author: "StudioX",
      license: "mit",
      dependencies: [],
      assets: {
        recipes: ["../../../etc/passwd"],
        stacks: [],
        sequences: [],
        palettes: [],
      },
    });
    const manifest = manifestOf({
      name: "traversal",
      version: "1.0.0",
      type: "recipe",
      author: "StudioX",
      license: "mit",
      dependencies: [],
      assets: {
        recipes: ["../../../etc/passwd"],
        stacks: [],
        sequences: [],
        palettes: [],
      },
    });
    const registry = new StubRegistry([
      { name: "traversal", version: "1.0.0", directory: dir, manifest },
    ]);
    const store = createInMemoryInstallStateStore();
    const { registrar, records } = collectingRegistrar();

    const result = installPackage("traversal", "1.0.0", {
      registry,
      stateStore: store,
      registrar,
    });

    expect(result.installed).toBe(false);
    expect(result.issues[0]!.message).toMatch(/escapes the package directory/i);
    expect(records).toEqual([]);
    expect(store.load().packages).toEqual([]);
  });

  it("rejects an unsatisfiable dependency through the F4 resolver before registering", () => {
    const registry = fixtureRegistry([
      entry({
        name: "version_conflict",
        version: "1.0.0",
        path: packageFixtureDir("version_conflict"),
      }),
    ]);
    const store = createInMemoryInstallStateStore();
    const { registrar, records } = collectingRegistrar();
    const dependencyProvider = (dependency: string) =>
      dependency === "core"
        ? [{ name: "core", version: "1.0.0", dependencies: [] }]
        : [];

    const result = installPackage("version_conflict", "1.0.0", {
      registry,
      stateStore: store,
      registrar,
      dependencyProvider,
    });

    expect(result.installed).toBe(false);
    expect(result.issues[0]!.field).toBe("dependencies.core");
    expect(result.issues[0]!.message).toMatch(/core/);
    expect(records).toEqual([]);
    expect(store.load().packages).toEqual([]);
  });

  it("accepts a satisfiable dependency through the F4 resolver", () => {
    const registry = fixtureRegistry([industrialLasersEntry()]);
    const store = createInMemoryInstallStateStore();
    const dependencyProvider = (dependency: string) =>
      dependency === "core"
        ? [{ name: "core", version: "1.0.0", dependencies: [] }]
        : [];

    const result = installPackage("industrial_lasers", "2.1.0", {
      registry,
      stateStore: store,
      dependencyProvider,
    });

    expect(result.installed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("delegates to the injected validation gate and rejects before registering", () => {
    const registry = fixtureRegistry([industrialLasersEntry()]);
    const store = createInMemoryInstallStateStore();
    const { registrar, records } = collectingRegistrar();
    const seen: string[] = [];
    const validator: MarketplaceValidator = {
      validate({ manifest }) {
        seen.push(`${manifest.name}@${manifest.version}`);
        return [{ field: "quality", message: "rejected by quality gate" }];
      },
    };

    const result = installPackage("industrial_lasers", "2.1.0", {
      registry,
      stateStore: store,
      registrar,
      validator,
    });

    expect(result.installed).toBe(false);
    expect(result.issues).toEqual([
      { field: "quality", message: "rejected by quality gate" },
    ]);
    expect(seen).toEqual(["industrial_lasers@2.1.0"]);
    expect(records).toEqual([]);
    expect(store.load().packages).toEqual([]);
  });

  it("rejects a structurally invalid asset through the default quality gate", () => {
    const dir = writePackage(
      {
        name: "bad_json_asset",
        version: "1.0.0",
        type: "recipe",
        author: "StudioX",
        license: "mit",
        dependencies: [],
        assets: {
          recipes: ["assets/recipes/bad.json"],
          stacks: [],
          sequences: [],
          palettes: [],
        },
      },
      { "assets/recipes/bad.json": "this is not json" },
    );
    const manifest = manifestOf({
      name: "bad_json_asset",
      version: "1.0.0",
      type: "recipe",
      author: "StudioX",
      license: "mit",
      dependencies: [],
      assets: {
        recipes: ["assets/recipes/bad.json"],
        stacks: [],
        sequences: [],
        palettes: [],
      },
    });
    const registry = new StubRegistry([
      { name: "bad_json_asset", version: "1.0.0", directory: dir, manifest },
    ]);
    const store = createInMemoryInstallStateStore();
    const { registrar, records } = collectingRegistrar();

    const result = installPackage("bad_json_asset", "1.0.0", {
      registry,
      stateStore: store,
      registrar,
    });

    expect(result.installed).toBe(false);
    expect(result.issues[0]!.message).toMatch(/not valid JSON/i);
    expect(records).toEqual([]);
    expect(store.load().packages).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe("installPackage — success path", () => {
  it("registers every asset kind, records provenance and locks the version", async () => {
    const registry = fixtureRegistry([industrialLasersEntry()]);
    const store = createInMemoryInstallStateStore();
    const { registrar, records } = collectingRegistrar();

    const { result, attempts } = await withNoNetwork(() =>
      installPackage("industrial_lasers", "2.1.0", {
        registry,
        stateStore: store,
        registrar,
        registryName: "fixture",
      }),
    );

    expect(attempts).toEqual([]);
    expect(result.installed).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.lockedVersion).toBe("2.1.0");
    expect(result.provenance).toEqual({
      name: "industrial_lasers",
      version: "2.1.0",
      author: "StudioX",
      license: "commercial",
      registry: "fixture",
    });

    const ids = result.registeredAssets.map((asset) => asset.id);
    expect(ids).toEqual(
      [
        "palettes:assets/palettes/il-dust-palette.json",
        "recipes:assets/recipes/il-heavy-cannon.json",
        "sequences:assets/sequences/il-laser-sequence.json",
        "stacks:assets/stacks/il-weapon-burst.json",
      ].sort(),
    );
    for (const asset of result.registeredAssets) {
      expect(asset.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }

    const state = store.load();
    expect(state.packages).toHaveLength(1);
    expect(state.packages[0]!.name).toBe("industrial_lasers");
    expect(state.packages[0]!.version).toBe("2.1.0");
    expect(state.packages[0]!.provenance.registry).toBe("fixture");
    expect(state.packages[0]!.assets).toHaveLength(4);

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(state.packages[0]);
  });

  it("pins the content hash to the exact asset bytes", () => {
    const registry = fixtureRegistry([industrialLasersEntry()]);
    const store = createInMemoryInstallStateStore();

    const result = installPackage("industrial_lasers", "2.1.0", {
      registry,
      stateStore: store,
    });

    const recipe = result.registeredAssets.find((asset) =>
      asset.id.startsWith("recipes:"),
    )!;
    const bytes = readFileSync(
      join(packageFixtureDir("industrial_lasers"), recipe.path),
    );
    expect(recipe.contentHash).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  });

  it("locks the latest installed version and leaves one record per package", () => {
    const registry = fixtureRegistry([
      entry({
        name: "industrial_lasers",
        version: "1.0.0",
        path: packageFixtureDir("industrial_lasers"),
      }),
      entry({
        name: "industrial_lasers",
        version: "2.1.0",
        path: packageFixtureDir("industrial_lasers"),
      }),
    ]);
    const store = createInMemoryInstallStateStore();

    installPackage("industrial_lasers", "1.0.0", { registry, stateStore: store });
    installPackage("industrial_lasers", "2.1.0", { registry, stateStore: store });

    const state = store.load();
    expect(state.packages).toHaveLength(1);
    expect(state.packages[0]!.version).toBe("2.1.0");
  });

  it("exposes the conformance install outcome", () => {
    const registry = fixtureRegistry([industrialLasersEntry()]);
    const store = createInMemoryInstallStateStore();

    const result = installPackage("industrial_lasers", "2.1.0", {
      registry,
      stateStore: store,
    });
    const outcome = toInstallOutcome(result);

    expect(outcome.installed).toBe(true);
    expect(outcome.issues).toEqual([]);
    expect(outcome.registeredAssets).toEqual(
      result.registeredAssets.map((asset) => asset.id),
    );
  });
});

// ---------------------------------------------------------------------------
// Determinism & state store
// ---------------------------------------------------------------------------

describe("installPackage — reproducibility", () => {
  it("produces byte-identical registered state on re-install and independent targets", () => {
    const registry = fixtureRegistry([industrialLasersEntry()]);

    const storeA = createInMemoryInstallStateStore();
    installPackage("industrial_lasers", "2.1.0", { registry, stateStore: storeA });
    const first = snapshot(storeA);
    installPackage("industrial_lasers", "2.1.0", { registry, stateStore: storeA });
    const reinstall = snapshot(storeA);

    const storeB = createInMemoryInstallStateStore();
    installPackage("industrial_lasers", "2.1.0", { registry, stateStore: storeB });
    const second = snapshot(storeB);

    expect(reinstall).toBe(first);
    expect(second).toBe(first);
  });

  it("normalises package and asset ordering deterministically", () => {
    const state: MarketplaceInstallState = {
      version: "1.0",
      packages: [
        {
          name: "zeta",
          version: "1.0.0",
          provenance: { name: "zeta", version: "1.0.0", author: "A", license: "mit", registry: "r" },
          assets: [
            { kind: "stacks", path: "b.json", id: "stacks:b.json", contentHash: "bb" },
            { kind: "recipes", path: "a.json", id: "recipes:a.json", contentHash: "aa" },
          ],
        },
        {
          name: "alpha",
          version: "2.0.0",
          provenance: { name: "alpha", version: "2.0.0", author: "A", license: "mit", registry: "r" },
          assets: [],
        },
      ],
    };

    const normalised = normaliseInstallState(state);
    expect(normalised.packages.map((pkg) => pkg.name)).toEqual(["alpha", "zeta"]);
    expect(normalised.packages[1]!.assets.map((asset) => asset.id)).toEqual([
      "recipes:a.json",
      "stacks:b.json",
    ]);
  });

  it("round-trips install state through a file store deterministically", () => {
    const dir = tempDir("tf-mp-install-state-");
    const file = join(dir, "installed.json");
    const registry = fixtureRegistry([industrialLasersEntry()]);

    const writer = createFileInstallStateStore(file);
    installPackage("industrial_lasers", "2.1.0", {
      registry,
      stateStore: writer,
    });
    const firstBytes = readFileSync(file, "utf-8");

    const reader = createFileInstallStateStore(file);
    const loaded = reader.load();
    expect(serializeInstallState(loaded)).toBe(
      serializeInstallState(writer.load()),
    );

    // Re-saving the loaded state is byte-identical.
    reader.save(loaded);
    expect(readFileSync(file, "utf-8")).toBe(firstBytes);
  });

  it("starts from an empty state when the file does not exist", () => {
    const dir = tempDir("tf-mp-install-empty-");
    const store = createFileInstallStateStore(join(dir, "absent.json"));
    expect(store.load()).toEqual({ version: "1.0", packages: [] });
  });
});

// ---------------------------------------------------------------------------
// Default validator construction
// ---------------------------------------------------------------------------

describe("createManifestValidator / createValidatorGate", () => {
  it("accepts a valid package through the default gate", () => {
    const registry = fixtureRegistry([industrialLasersEntry()]);
    const store = createInMemoryInstallStateStore();
    const result = installPackage("industrial_lasers", "2.1.0", {
      registry,
      stateStore: store,
      validator: createManifestValidator(),
    });
    expect(result.installed).toBe(true);
  });

  it("adapts a plain validation function into a gate (Demo 12 seam)", () => {
    const gate = createValidatorGate(() => [
      { field: "demo12", message: "validator unavailable" },
    ]);
    expect(
      gate.validate({
        manifest: manifestOf({
          name: "x",
          version: "1.0.0",
          type: "recipe",
          author: "A",
          license: "mit",
          dependencies: [],
          assets: { recipes: [], stacks: [], sequences: [], palettes: [] },
        }),
        directory: "/tmp",
        assets: [],
      }),
    ).toEqual([{ field: "demo12", message: "validator unavailable" }]);
  });
});

// ---------------------------------------------------------------------------
// Registry error surfacing
// ---------------------------------------------------------------------------

describe("installPackage — registry errors", () => {
  it("surfaces a structured registry error as a rejection", () => {
    class ExplodingRegistry implements MarketplaceRegistry {
      search(): MarketplaceSearchListing[] {
        return [];
      }
      searchResult(category?: string): MarketplaceSearchResult {
        return { category: category ?? null, count: 0, listings: [] };
      }
      fetch(): MarketplacePackageBundle | null {
        throw new MarketplaceRegistryError("manifest-invalid", "bad manifest", [
          { field: "version", message: "version is required" },
        ]);
      }
    }

    const result = installPackage("exploding", "1.0.0", {
      registry: new ExplodingRegistry(),
    });

    expect(result.installed).toBe(false);
    expect(result.issues).toEqual([
      { field: "version", message: "version is required" },
    ]);
  });
});
