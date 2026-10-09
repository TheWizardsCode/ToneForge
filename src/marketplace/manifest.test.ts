/**
 * Marketplace package manifest schema tests.
 *
 * Written first (TDD) for work item TF-0MUZX3XLO006D7HW. These tests pin down
 * the manifest contract from `docs/prd/MARKETPLACE_PRD.md` Sections 4, 5 and
 * 13: the required fields, the strict `MAJOR.MINOR.PATCH` version shape, the
 * per-kind asset inventory, and the structured, field-addressed errors that
 * `parseManifest`/`validateManifest` must return for invalid input.
 *
 * They exercise valid, boundary and invalid cases and prove that
 * parse -> validate is idempotent (AC3).
 */

import { describe, it, expect } from "vitest";

import { parseManifest, validateManifest } from "./manifest.js";
import {
  MARKETPLACE_ASSET_KINDS,
  type MarketplaceManifest,
  type ManifestParseResult,
} from "./types.js";
import {
  loadFixturePackageManifest,
  loadPackageManifest,
  packageFixtureDir,
} from "../test-utils/marketplace-fixtures.js";

/** The valid publishable fixture (industrial_lasers@2.1.0). */
const VALID_PACKAGE_DIR = packageFixtureDir("industrial_lasers");
/** The invalid-manifest fixture (malformed semver, empty author, no license). */
const BROKEN_PACKAGE_DIR = packageFixtureDir("broken_manifest");

/** Build a minimal, valid raw manifest with field overrides. */
function rawManifest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: "example_pack",
    version: "1.2.3",
    type: "stack",
    author: "StudioX",
    license: "mit",
    dependencies: [],
    assets: { recipes: [], stacks: [], sequences: [], palettes: [] },
    ...overrides,
  };
}

/** Assert a parse result succeeded and return the typed manifest. */
function expectOk(result: ManifestParseResult): MarketplaceManifest {
  if (!result.ok) {
    throw new Error(
      `expected a valid manifest, got issues: ${JSON.stringify(result.issues)}`,
    );
  }
  return result.manifest;
}

/** Map validation issues to their `field` values. */
function fieldsOf(input: unknown): string[] {
  return validateManifest(input).map((issue) => issue.field);
}

/** Look up a single issue by field, asserting it exists. */
function issueFor(input: unknown, field: string) {
  const issue = validateManifest(input).find((candidate) => candidate.field === field);
  expect(issue).toBeDefined();
  return issue!;
}

// ---------------------------------------------------------------------------
// AC1 — the asset-kind vocabulary
// ---------------------------------------------------------------------------

describe("MARKETPLACE_ASSET_KINDS", () => {
  it("is the canonical, deterministic order of the four demo asset kinds", () => {
    expect(MARKETPLACE_ASSET_KINDS).toEqual([
      "recipes",
      "stacks",
      "sequences",
      "palettes",
    ]);
  });
});

// ---------------------------------------------------------------------------
// AC1/AC2 — validateManifest: valid and boundary manifests
// ---------------------------------------------------------------------------

describe("validateManifest — valid manifests", () => {
  it("accepts a minimal manifest with empty dependencies and inventories", () => {
    expect(validateManifest(rawManifest())).toEqual([]);
  });

  it("accepts the valid industrial_lasers fixture", () => {
    const manifest = loadPackageManifest(VALID_PACKAGE_DIR);
    expect(validateManifest(manifest)).toEqual([]);
  });

  it("accepts boundary values: 0.0.0 version and populated inventories", () => {
    const manifest = rawManifest({
      version: "0.0.0",
      dependencies: ["core>=1.0"],
      assets: {
        recipes: ["assets/recipes/a.json"],
        stacks: [],
        sequences: ["assets/sequences/s.json"],
        palettes: [],
      },
    });
    expect(validateManifest(manifest)).toEqual([]);
  });

  it("accepts optional category and description metadata", () => {
    const manifest = rawManifest({
      category: "combat",
      description: "Layered weapon sounds.",
    });
    expect(validateManifest(manifest)).toEqual([]);
  });

  it("does not mutate the manifest it validates", () => {
    const manifest = rawManifest({ dependencies: ["core>=1.0"] });
    const snapshot = JSON.parse(JSON.stringify(manifest));
    validateManifest(manifest);
    expect(manifest).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// AC2 — validateManifest: structured, field-addressed errors
// ---------------------------------------------------------------------------

describe("validateManifest — invalid manifests", () => {
  it("rejects a non-object manifest with a top-level issue", () => {
    for (const value of [null, undefined, [], "manifest", 42, true]) {
      expect(fieldsOf(value)).toContain("manifest");
    }
  });

  it("names `name` when it is missing or empty", () => {
    const missing = rawManifest();
    delete missing.name;
    expect(issueFor(missing, "name").code).toBe("missing");

    expect(issueFor(rawManifest({ name: "" }), "name").code).toBe("invalid");
    expect(issueFor(rawManifest({ name: "   " }), "name").code).toBe("invalid");
    expect(issueFor(rawManifest({ name: 7 }), "name").code).toBe("invalid");
  });

  it("names `version` when it is missing, non-string or not semver", () => {
    const missing = rawManifest();
    delete missing.version;
    expect(issueFor(missing, "version").code).toBe("missing");

    expect(issueFor(rawManifest({ version: "1.0" }), "version").code).toBe(
      "invalid",
    );
    expect(issueFor(rawManifest({ version: "1.2.3-rc.1" }), "version").code).toBe(
      "invalid",
    );
    expect(issueFor(rawManifest({ version: 2 }), "version").code).toBe("invalid");
  });

  it("names `type` when it is missing or empty", () => {
    const missing = rawManifest();
    delete missing.type;
    expect(issueFor(missing, "type").code).toBe("missing");
    expect(issueFor(rawManifest({ type: "  " }), "type").code).toBe("invalid");
  });

  it("names `license` when it is missing or empty", () => {
    const missing = rawManifest();
    delete missing.license;
    expect(issueFor(missing, "license").code).toBe("missing");
    expect(issueFor(rawManifest({ license: "" }), "license").code).toBe(
      "invalid",
    );
  });

  it("names `author` when it is missing or empty", () => {
    const missing = rawManifest();
    delete missing.author;
    expect(issueFor(missing, "author").code).toBe("missing");
    expect(issueFor(rawManifest({ author: "" }), "author").code).toBe("invalid");
  });

  it("names `dependencies` when it is missing, not an array or holds non-strings", () => {
    const missing = rawManifest();
    delete missing.dependencies;
    expect(issueFor(missing, "dependencies").code).toBe("missing");
    expect(issueFor(rawManifest({ dependencies: "core>=1.0" }), "dependencies").code)
      .toBe("invalid");
    expect(
      issueFor(rawManifest({ dependencies: ["core>=1.0", 42] }), "dependencies[1]")
        .code,
    ).toBe("invalid");
  });

  it("names `assets` and each missing asset kind", () => {
    const missingAssets = rawManifest();
    delete missingAssets.assets;
    expect(issueFor(missingAssets, "assets").code).toBe("missing");

    expect(issueFor(rawManifest({ assets: [] }), "assets").code).toBe("invalid");

    const partial = rawManifest({
      assets: { recipes: [] },
    });
    const fields = fieldsOf(partial);
    expect(fields).toContain("assets.stacks");
    expect(fields).toContain("assets.sequences");
    expect(fields).toContain("assets.palettes");
  });

  it("names the offending asset path when a kind is not an array of strings", () => {
    const manifest = rawManifest({
      assets: {
        recipes: "assets/recipes/a.json",
        stacks: [],
        sequences: [],
        palettes: [],
      },
    });
    expect(issueFor(manifest, "assets.recipes").code).toBe("invalid");

    const nonString = rawManifest({
      assets: {
        recipes: ["assets/recipes/a.json", 3],
        stacks: [],
        sequences: [],
        palettes: [],
      },
    });
    expect(issueFor(nonString, "assets.recipes[1]").code).toBe("invalid");
  });

  it("reports every problem at once for the broken_manifest fixture", () => {
    const broken = loadFixturePackageManifest("broken_manifest");
    const fields = fieldsOf(broken);
    expect(fields).toContain("version");
    expect(fields).toContain("license");
    expect(fields).toContain("author");
  });
});

// ---------------------------------------------------------------------------
// AC3 — parseManifest produces typed manifests
// ---------------------------------------------------------------------------

describe("parseManifest — valid input", () => {
  it("returns a typed manifest carrying every declared field", () => {
    const result = parseManifest(
      rawManifest({
        category: "combat",
        description: "Layered weapon sounds.",
        dependencies: ["core>=1.0"],
        assets: {
          recipes: ["assets/recipes/a.json"],
          stacks: ["assets/stacks/b.json"],
          sequences: [],
          palettes: [],
        },
      }),
    );
    const manifest = expectOk(result);
    expect(manifest).toEqual({
      name: "example_pack",
      version: "1.2.3",
      type: "stack",
      category: "combat",
      description: "Layered weapon sounds.",
      author: "StudioX",
      license: "mit",
      dependencies: ["core>=1.0"],
      assets: {
        recipes: ["assets/recipes/a.json"],
        stacks: ["assets/stacks/b.json"],
        sequences: [],
        palettes: [],
      },
    });
    expect(result.issues).toEqual([]);
  });

  it("normalises the asset inventory to all four known kinds", () => {
    const manifest = expectOk(parseManifest(rawManifest()));
    expect(Object.keys(manifest.assets).sort()).toEqual(
      [...MARKETPLACE_ASSET_KINDS].sort(),
    );
  });

  it("parses the valid industrial_lasers fixture without loss", () => {
    const raw = loadPackageManifest(VALID_PACKAGE_DIR);
    const manifest = expectOk(parseManifest(raw));
    expect(manifest.name).toBe("industrial_lasers");
    expect(manifest.version).toBe("2.1.0");
    expect(manifest.license).toBe("commercial");
    expect(manifest.author).toBe("StudioX");
    expect(manifest.assets.recipes).toEqual([
      "assets/recipes/il-heavy-cannon.json",
    ]);
  });

  it("does not mutate the raw input it was given", () => {
    const raw = rawManifest({ dependencies: ["core>=1.0"] });
    const snapshot = JSON.parse(JSON.stringify(raw));
    parseManifest(raw);
    expect(raw).toEqual(snapshot);
  });
});

describe("parseManifest — invalid input", () => {
  it("returns structured issues instead of throwing", () => {
    const result = parseManifest(
      loadFixturePackageManifest("broken_manifest"),
    );
    expect(result.ok).toBe(false);
    const fields = result.issues.map((issue) => issue.field);
    expect(fields).toContain("version");
    expect(fields).toContain("license");
    expect(fields).toContain("author");
  });

  it("does not expose a manifest when parsing fails", () => {
    const result = parseManifest({ name: "x" });
    expect(result.ok).toBe(false);
    expect(result.manifest).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC3 — parse -> validate is idempotent
// ---------------------------------------------------------------------------

describe("parse -> validate idempotency", () => {
  const raw = rawManifest({
    category: "ui",
    dependencies: ["core>=1.0"],
    assets: {
      recipes: ["assets/recipes/ui.json"],
      stacks: [],
      sequences: [],
      palettes: ["assets/palettes/ui.json"],
    },
  });

  it("considers a freshly parsed manifest valid (no issues)", () => {
    const manifest = expectOk(parseManifest(raw));
    expect(validateManifest(manifest)).toEqual([]);
  });

  it("re-parsing a parsed manifest yields an identical manifest", () => {
    const first = expectOk(parseManifest(raw));
    const second = expectOk(parseManifest(first));
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("validating twice yields identical issue lists", () => {
    const broken = loadFixturePackageManifest("broken_manifest");
    expect(validateManifest(broken)).toEqual(validateManifest(broken));
  });

  it("round-trips the valid fixture through parse and validate", () => {
    const first = expectOk(
      parseManifest(loadPackageManifest(VALID_PACKAGE_DIR)),
    );
    const second = expectOk(parseManifest(first));
    expect(validateManifest(second)).toEqual([]);
    expect(second).toEqual(first);
  });
});
