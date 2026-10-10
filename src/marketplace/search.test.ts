/**
 * Marketplace registry abstraction and deterministic search tests.
 *
 * Written first (work item TF-0MUZX3XWW008FO77) against the F1 fixture
 * registry. They pin the contract later features build on:
 *
 * - a {@link MarketplaceRegistry} interface with `search` and `fetch`;
 * - a local, directory-backed adapter that reads the fixture registry with no
 *   live network access;
 * - metadata-rich listings (`name@version`, author, asset counts, rating and
 *   license) in a deterministic, JSON-ready order.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 10, 12, 14.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MARKETPLACE_ASSET_KINDS,
  packageFixtureDir,
  marketplaceFixtureDir,
  registryIndexPath,
} from "../test-utils/marketplace-fixtures.js";
import {
  LocalDirectoryRegistry,
  MarketplaceRegistryError,
  createLocalRegistry,
} from "./registry.js";
import {
  compareListingOrder,
  createSearchResult,
  registryEntryToListing,
  toSearchListing,
} from "./search.js";
import { withNoNetwork } from "./harness.js";
import type {
  MarketplaceRegistryEntry,
  MarketplaceRegistryIndex,
} from "./types.js";

const FIXTURE_ROOT = marketplaceFixtureDir();
const REGISTRY_INDEX = registryIndexPath();

const tempDirs: string[] = [];

/** Write a synthetic registry index to an isolated temporary directory. */
function writeTempIndex(index: MarketplaceRegistryIndex): string {
  const dir = mkdtempSync(join(tmpdir(), "tf-marketplace-registry-"));
  tempDirs.push(dir);
  const file = join(dir, "index.json");
  writeFileSync(file, JSON.stringify(index, null, 2));
  return file;
}

/** Build a registry index entry with sensible defaults for tests. */
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

function createFixtureRegistry(): LocalDirectoryRegistry {
  return createLocalRegistry({ indexFile: REGISTRY_INDEX, root: FIXTURE_ROOT });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Local adapter — fixture registry + offline guarantee
// ---------------------------------------------------------------------------

describe("LocalDirectoryRegistry (fixture registry)", () => {
  it("reads the fixture registry without any live network access", async () => {
    const { result, attempts } = await withNoNetwork(() => {
      const registry = createFixtureRegistry();
      const listings = registry.search("combat");
      const fetched = registry.fetch("plasma_rifles", "1.4.2");
      return { listings, fetched };
    });

    expect(attempts).toEqual([]);
    expect(result.listings.length).toBe(2);
    expect(result.fetched?.manifest.name).toBe("plasma_rifles");
  });

  it("fetches a published package's manifest and resolves its directory", () => {
    const registry = createFixtureRegistry();
    const bundle = registry.fetch("plasma_rifles", "1.4.2");

    expect(bundle).not.toBeNull();
    expect(bundle!.name).toBe("plasma_rifles");
    expect(bundle!.version).toBe("1.4.2");
    expect(bundle!.directory).toBe(packageFixtureDir("plasma_rifles"));
    expect(bundle!.manifest.author).toBe("StudioX");
    expect(bundle!.manifest.license).toBe("commercial");
    expect(bundle!.manifest.dependencies).toEqual(["core>=1.0"]);
    expect(bundle!.manifest.assets.recipes).toHaveLength(1);
    expect(bundle!.manifest.assets.stacks).toHaveLength(1);
    // The parsed manifest always carries every asset kind (empty when unused).
    for (const kind of MARKETPLACE_ASSET_KINDS) {
      expect(Array.isArray(bundle!.manifest.assets[kind])).toBe(true);
    }
  });

  it("returns null for an unknown package or an unpublished version", () => {
    const registry = createFixtureRegistry();
    expect(registry.fetch("does_not_exist", "1.0.0")).toBeNull();
    expect(registry.fetch("plasma_rifles", "9.9.9")).toBeNull();
  });

  it("rejects an invalid stored manifest with structured field issues", () => {
    const indexFile = writeTempIndex({
      version: "1.0",
      packages: [
        entry({
          name: "broken_manifest",
          version: "1.0",
          category: "ui",
          path: packageFixtureDir("broken_manifest"),
        }),
      ],
      installed: [],
    });
    const registry = createLocalRegistry({ indexFile, root: "/" });

    let caught: unknown;
    try {
      registry.fetch("broken_manifest", "1.0");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MarketplaceRegistryError);
    const failure = caught as MarketplaceRegistryError;
    expect(failure.code).toBe("manifest-invalid");
    const fields = failure.issues.map((issue) => issue.field);
    expect(fields).toContain("version");
    expect(fields).toContain("license");
    expect(fields).toContain("author");
  });

  it("throws a structured error when the registry index is unreadable", () => {
    expect(() =>
      createLocalRegistry({
        indexFile: join(FIXTURE_ROOT, "registry", "does-not-exist.json"),
        root: FIXTURE_ROOT,
      }),
    ).toThrow(MarketplaceRegistryError);
  });

  it("throws a structured error when the registry index is malformed JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "tf-marketplace-registry-"));
    tempDirs.push(dir);
    const indexFile = join(dir, "index.json");
    writeFileSync(indexFile, "{ not json");

    let caught: unknown;
    try {
      createLocalRegistry({ indexFile, root: "/" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MarketplaceRegistryError);
    expect((caught as MarketplaceRegistryError).code).toBe("index-invalid");
  });
});

// ---------------------------------------------------------------------------
// Search — metadata, filtering and deterministic ordering
// ---------------------------------------------------------------------------

describe("Marketplace search", () => {
  it("filters by category and returns full listing metadata", () => {
    const registry = createFixtureRegistry();
    const listings = registry.search("combat");

    expect(listings.map((listing) => listing.name)).toEqual([
      "plasma_rifles",
      "version_conflict",
    ]);

    const plasma = listings[0]!;
    expect(plasma.version).toBe("1.4.2");
    expect(plasma.author).toBe("StudioX");
    expect(plasma.license).toBe("commercial");
    expect(plasma.category).toBe("combat");
    expect(plasma.rating).toBe(4.2);
    expect(plasma.assets).toEqual({
      recipes: 1,
      stacks: 1,
      sequences: 0,
      palettes: 0,
    });
  });

  it("exposes a `name@version` label on every listing", () => {
    const registry = createFixtureRegistry();
    const listings = registry.search("combat");
    expect(listings[0]!.label).toBe("plasma_rifles@1.4.2");
    expect(listings[1]!.label).toBe("version_conflict@1.0.0");
  });

  it("returns every listing when no category is supplied", () => {
    const registry = createFixtureRegistry();
    const names = registry.search().map((listing) => listing.name);
    expect(names).toEqual([
      "missing_dependency",
      "plasma_rifles",
      "ui_chimes",
      "version_conflict",
    ]);
  });

  it("matches categories case-insensitively and trims whitespace", () => {
    const registry = createFixtureRegistry();
    expect(registry.search(" Combat ").map((listing) => listing.name)).toEqual(
      registry.search("combat").map((listing) => listing.name),
    );
  });

  it("returns an empty list for an unknown category", () => {
    const registry = createFixtureRegistry();
    expect(registry.search("no-such-category")).toEqual([]);
  });

  it("orders identical registry state identically across instances and calls", () => {
    const first = createFixtureRegistry().search();
    const second = createFixtureRegistry().search();
    expect(first).toEqual(second);
    expect(createFixtureRegistry().search()).toEqual(first);
  });

  it("orders same-name packages by semantic version", () => {
    const indexFile = writeTempIndex({
      version: "1.0",
      packages: [
        entry({ name: "alpha", version: "10.0.0" }),
        entry({ name: "alpha", version: "2.0.0" }),
        entry({ name: "alpha", version: "2.10.0" }),
      ],
      installed: [],
    });
    const registry = createLocalRegistry({ indexFile, root: "/" });
    expect(registry.search("combat").map((listing) => listing.version)).toEqual([
      "2.0.0",
      "2.10.0",
      "10.0.0",
    ]);
  });

  it("exposes a JSON-ready search result shape via searchResult()", () => {
    const registry = createFixtureRegistry();
    const result = registry.searchResult("combat");

    expect(result.category).toBe("combat");
    expect(result.count).toBe(2);
    expect(result.listings.map((listing) => listing.label)).toEqual([
      "plasma_rifles@1.4.2",
      "version_conflict@1.0.0",
    ]);

    // JSON-round-trippable: no undefined, no cycles, stable shape.
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("reports a null category when the search is unfiltered", () => {
    const registry = createFixtureRegistry();
    const result = registry.searchResult();
    expect(result.category).toBeNull();
    expect(result.count).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Pure search helpers
// ---------------------------------------------------------------------------

describe("search helpers", () => {
  it("registryEntryToListing carries every metadata field and a label", () => {
    const listing = registryEntryToListing(
      entry({
        name: "ui_chimes",
        version: "1.0.0",
        category: "ui",
        license: "mit",
        rating: 4.1,
        assets: { recipes: 1, stacks: 0, sequences: 0, palettes: 1 },
      }),
    );
    expect(listing).toMatchObject({
      name: "ui_chimes",
      version: "1.0.0",
      label: "ui_chimes@1.0.0",
      author: "StudioX",
      license: "mit",
      category: "ui",
      rating: 4.1,
      assets: { recipes: 1, stacks: 0, sequences: 0, palettes: 1 },
    });
  });

  it("toSearchListing is idempotent for an already-labelled listing", () => {
    const registry = createFixtureRegistry();
    const listing = registry.search("combat")[0]!;
    expect(toSearchListing(listing)).toEqual(listing);
  });

  it("compareListingOrder is a total order (name, then version)", () => {
    const a = { name: "alpha", version: "1.0.0" };
    const b = { name: "beta", version: "1.0.0" };
    const c = { name: "alpha", version: "2.0.0" };

    expect(compareListingOrder(a, b)).toBeLessThan(0);
    expect(compareListingOrder(b, a)).toBeGreaterThan(0);
    expect(compareListingOrder(a, c)).toBeLessThan(0);
    expect(compareListingOrder(a, { ...a })).toBe(0);
  });

  it("createSearchResult is pure and reports category, count and listings", () => {
    const listings = createFixtureRegistry().search("ui");
    const result = createSearchResult("ui", listings);
    expect(result.category).toBe("ui");
    expect(result.count).toBe(1);
    expect(result.listings).toEqual(listings);
    // The input array is not mutated.
    expect(listings).toHaveLength(1);
  });
});
