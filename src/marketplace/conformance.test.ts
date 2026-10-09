/**
 * Marketplace conformance suite.
 *
 * Exercises the five Marketplace behaviours the epic specifies — search
 * listings, install registration, publish rejection, version-conflict
 * detection and post-install determinism — through the offline conformance
 * harness over the fixture package registry. Also proves the harness fails
 * closed if a Marketplace test ever attempts live network access.
 *
 * This is the test-first foundation (work item TF-0MUZX3XAI003S1GN); the
 * fixture-backed target below is the reference implementation. The production
 * Marketplace modules (manifest, registry, versioning, install, publish)
 * implement the same {@link MarketplaceConformanceTarget} contract.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 4, 5, 7, 9–13.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import {
  MARKETPLACE_ASSET_KINDS,
  loadMarketplaceRegistry,
  loadPackageManifest,
  marketplaceFixtureDir,
  packageFixtureDir,
  registryIndexPath,
  type MarketplaceAssetKind,
  type MarketplacePackageManifest,
  type MarketplaceRegistryEntry,
  type MarketplaceRegistryIndex,
} from "../test-utils/marketplace-fixtures.js";
import {
  installNetworkGuard,
  networkAttempts,
  runMarketplaceConformance,
  uninstallNetworkGuard,
  type InstallOutcome,
  type MarketplaceConformanceOptions,
  type MarketplaceConformanceTarget,
  type MarketplaceIssue,
  type MarketplaceListing,
  type PublishOutcome,
  type VersionConflict,
} from "./harness.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_ROOT = marketplaceFixtureDir();
const REGISTRY_INDEX = registryIndexPath();

const VALID_PACKAGE = {
  name: "industrial_lasers",
  version: "2.1.0",
  dir: packageFixtureDir("industrial_lasers"),
} as const;
const INVALID_PACKAGE_DIR = packageFixtureDir("broken_manifest");
const VERSION_CONFLICT_DIR = packageFixtureDir("version_conflict");
const MISSING_DEPENDENCY_DIR = packageFixtureDir("missing_dependency");

const CONFORMANCE_OPTIONS: MarketplaceConformanceOptions = {
  searchCategory: "combat",
  validPackage: { ...VALID_PACKAGE },
  invalidPackageDir: INVALID_PACKAGE_DIR,
  conflictPackageDirs: [VERSION_CONFLICT_DIR, MISSING_DEPENDENCY_DIR],
};

// ---------------------------------------------------------------------------
// Minimal semver helpers (reference only — production semantics are F4)
// ---------------------------------------------------------------------------

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parseSemver(version: string): [number, number, number] | null {
  const match = SEMVER_RE.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return a.localeCompare(b);
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
}

/** Split `name>=1.2` into its name and range parts. */
function parseRequirement(requirement: string): {
  name: string;
  range: string;
} {
  const match = /^([A-Za-z0-9_.@/-]+)\s*(.*)$/.exec(requirement.trim());
  if (!match) return { name: requirement.trim(), range: "" };
  return { name: match[1]!, range: (match[2] ?? "").trim() };
}

/** Minimal `>=` / `^` / exact range check used by the reference target. */
function satisfies(version: string, range: string): boolean {
  const parsed = parseSemver(version);
  if (!parsed) return false;
  if (!range || range === "*") return true;

  const greaterOrEqual = /^>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(range);
  if (greaterOrEqual) {
    const major = Number(greaterOrEqual[1]);
    if (parsed[0] !== major) return false;
    const minor = greaterOrEqual[2] !== undefined ? Number(greaterOrEqual[2]) : 0;
    const patch = greaterOrEqual[3] !== undefined ? Number(greaterOrEqual[3]) : 0;
    if (parsed[1] !== minor) return parsed[1] > minor;
    return parsed[2] >= patch;
  }

  const caret = /^\^\s*(\d+)/.exec(range);
  if (caret) return parsed[0] === Number(caret[1]);

  return version === range;
}

// ---------------------------------------------------------------------------
// Fixture-backed reference target
// ---------------------------------------------------------------------------

interface InstalledRecord {
  name: string;
  version: string;
  /** Logical asset id → SHA-256 content hash. */
  assets: Record<string, string>;
}

/** Offline, in-memory reference Marketplace built on the fixture registry. */
class FixtureMarketplace implements MarketplaceConformanceTarget {
  private readonly registry: MarketplaceRegistryEntry[];
  private readonly installed = new Map<string, InstalledRecord>();

  constructor(private readonly fixtureRoot: string, indexFile: string) {
    const index: MarketplaceRegistryIndex = loadMarketplaceRegistry(indexFile);
    this.registry = index.packages.map((entry) => ({
      ...entry,
      assets: { ...entry.assets },
    }));
    for (const pkg of index.installed) {
      this.installed.set(pkg.name, {
        name: pkg.name,
        version: pkg.version,
        assets: {},
      });
    }
  }

  /** Resolve a registry `path` (relative or absolute) to a package directory. */
  private resolvePackageDir(pathOrRelative: string): string {
    return isAbsolute(pathOrRelative)
      ? pathOrRelative
      : join(this.fixtureRoot, pathOrRelative);
  }

  private readManifest(packageDir: string): MarketplacePackageManifest {
    return loadPackageManifest(packageDir);
  }

  private validateManifest(manifest: MarketplacePackageManifest): MarketplaceIssue[] {
    const issues: MarketplaceIssue[] = [];
    if (typeof manifest.name !== "string" || manifest.name.trim() === "") {
      issues.push({ field: "name", message: "name must be a non-empty string" });
    }
    if (typeof manifest.version !== "string" || !parseSemver(manifest.version)) {
      issues.push({
        field: "version",
        message: `version "${String(manifest.version)}" is not semver MAJOR.MINOR.PATCH`,
      });
    }
    if (typeof manifest.type !== "string" || manifest.type.trim() === "") {
      issues.push({ field: "type", message: "type must be a non-empty string" });
    }
    if (typeof manifest.license !== "string" || manifest.license.trim() === "") {
      issues.push({ field: "license", message: "license declaration is required" });
    }
    if (typeof manifest.author !== "string" || manifest.author.trim() === "") {
      issues.push({
        field: "author",
        message: "author/attribution is required",
      });
    }
    if (manifest.assets === null || typeof manifest.assets !== "object") {
      issues.push({ field: "assets", message: "assets inventory is required" });
    }
    return issues;
  }

  private availableVersions(name: string): string[] {
    const versions = this.registry
      .filter((entry) => entry.name === name)
      .map((entry) => entry.version);
    const installed = this.installed.get(name);
    if (installed) versions.push(installed.version);
    return [...new Set(versions)].sort(compareSemver);
  }

  search(category: string): MarketplaceListing[] {
    return this.registry
      .filter((entry) => entry.category === category)
      .map((entry) => ({
        name: entry.name,
        version: entry.version,
        author: entry.author,
        license: entry.license,
        category: entry.category,
        rating: entry.rating,
        assets: { ...entry.assets },
      }))
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) || compareSemver(a.version, b.version),
      );
  }

  publish(packageDir: string): PublishOutcome {
    const manifest = this.readManifest(packageDir);
    const issues = this.validateManifest(manifest);
    const identity = { name: manifest.name, version: manifest.version };
    if (issues.length > 0) return { ...identity, published: false, issues };

    const alreadyPublished = this.registry.some(
      (entry) => entry.name === manifest.name && entry.version === manifest.version,
    );
    if (alreadyPublished) {
      return {
        ...identity,
        published: false,
        issues: [
          {
            field: "version",
            message: `immutable: ${manifest.name}@${manifest.version} is already published`,
          },
        ],
      };
    }

    const assetCounts = Object.fromEntries(
      MARKETPLACE_ASSET_KINDS.map((kind) => [
        kind,
        (manifest.assets?.[kind] ?? []).length,
      ]),
    ) as Record<MarketplaceAssetKind, number>;

    this.registry.push({
      name: manifest.name,
      version: manifest.version,
      type: manifest.type,
      category: manifest.category ?? "unclassified",
      author: manifest.author,
      license: manifest.license,
      rating: 0,
      path: packageDir,
      assets: assetCounts,
    });
    return { ...identity, published: true, issues: [] };
  }

  install(name: string, version: string): InstallOutcome {
    const entry = this.registry.find(
      (candidate) => candidate.name === name && candidate.version === version,
    );
    if (!entry) {
      return {
        name,
        version,
        installed: false,
        registeredAssets: [],
        issues: [{ field: "package", message: `not published: ${name}@${version}` }],
      };
    }

    const packageDir = this.resolvePackageDir(entry.path);
    const manifest = this.readManifest(packageDir);
    const manifestIssues = this.validateManifest(manifest);
    if (manifestIssues.length > 0) {
      return {
        name,
        version,
        installed: false,
        registeredAssets: [],
        issues: manifestIssues,
      };
    }

    const existing = this.installed.get(name);
    const next: InstalledRecord = {
      name,
      version,
      assets: existing?.version === version ? { ...existing.assets } : {},
    };

    const integrityIssues: MarketplaceIssue[] = [];
    const registeredAssets: string[] = [];
    for (const kind of MARKETPLACE_ASSET_KINDS) {
      for (const relative of manifest.assets[kind] ?? []) {
        const absolute = join(packageDir, relative);
        if (!existsSync(absolute)) {
          integrityIssues.push({
            field: `${kind}/${relative}`,
            message: "missing asset (integrity check failed)",
          });
          continue;
        }
        const content = readFileSync(absolute, "utf-8");
        const id = `${kind}:${relative}`;
        next.assets[id] = createHash("sha256").update(content).digest("hex");
        registeredAssets.push(id);
      }
    }

    if (integrityIssues.length > 0) {
      return {
        name,
        version,
        installed: false,
        registeredAssets: [],
        issues: integrityIssues,
      };
    }

    this.installed.set(name, next);
    return {
      name,
      version,
      installed: true,
      registeredAssets: registeredAssets.sort(),
      issues: [],
    };
  }

  detectConflicts(packageDir: string): VersionConflict[] {
    const manifest = this.readManifest(packageDir);
    const conflicts: VersionConflict[] = [];
    for (const requirement of manifest.dependencies ?? []) {
      const { name, range } = parseRequirement(requirement);
      const available = this.availableVersions(name);
      if (available.length === 0) {
        conflicts.push({
          package: manifest.name,
          dependency: name,
          required: requirement,
          available,
          kind: "missing-dependency",
          message: `${manifest.name} requires "${requirement}" but no version of "${name}" is available`,
        });
        continue;
      }
      if (!available.some((version) => satisfies(version, range))) {
        conflicts.push({
          package: manifest.name,
          dependency: name,
          required: requirement,
          available,
          kind: "incompatible-major",
          message: `${manifest.name} requires "${requirement}" but available versions are ${available.join(", ")}`,
        });
      }
    }
    return conflicts;
  }

  installedSnapshot(): string {
    const packages = [...this.installed.values()]
      .map((record) => ({
        name: record.name,
        version: record.version,
        assets: Object.fromEntries(
          Object.entries(record.assets).sort(([a], [b]) => a.localeCompare(b)),
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return JSON.stringify(packages);
  }
}

function createFixtureTarget(): MarketplaceConformanceTarget {
  return new FixtureMarketplace(FIXTURE_ROOT, REGISTRY_INDEX);
}

async function runConformance() {
  return runMarketplaceConformance(createFixtureTarget, CONFORMANCE_OPTIONS);
}

// ---------------------------------------------------------------------------
// AC2 — fixture registry coverage
// ---------------------------------------------------------------------------

describe("Marketplace conformance fixtures", () => {
  it("loads a registry index with published packages and installed state", () => {
    const index = loadMarketplaceRegistry(REGISTRY_INDEX);
    expect(index.version).toBe("1.0");
    const names = index.packages.map((entry) => entry.name).sort();
    expect(names).toEqual([
      "missing_dependency",
      "plasma_rifles",
      "ui_chimes",
      "version_conflict",
    ]);
    expect(index.installed).toContainEqual({ name: "core", version: "1.0.0" });
  });

  it("covers a valid publishable package with a complete manifest", () => {
    const manifest = loadPackageManifest(VALID_PACKAGE.dir);
    expect(manifest.name).toBe("industrial_lasers");
    expect(manifest.version).toBe("2.1.0");
    expect(manifest.license).toBe("commercial");
    const totalAssets = MARKETPLACE_ASSET_KINDS.reduce(
      (sum, kind) => sum + (manifest.assets[kind] ?? []).length,
      0,
    );
    expect(totalAssets).toBeGreaterThan(0);
  });

  it("covers an invalid-manifest package", () => {
    const manifest = loadPackageManifest(INVALID_PACKAGE_DIR);
    expect(parseSemver(manifest.version)).toBeNull();
    expect(manifest.license ?? "").toBe("");
    expect(manifest.author).toBe("");
  });

  it("covers a version-conflict package and a missing-dependency package", () => {
    const conflict = loadPackageManifest(VERSION_CONFLICT_DIR);
    const missing = loadPackageManifest(MISSING_DEPENDENCY_DIR);
    expect(conflict.dependencies).toEqual(["core>=3.0"]);
    expect(missing.dependencies).toEqual(["does_not_exist>=1.0"]);
  });
});

// ---------------------------------------------------------------------------
// AC3 — five-behaviour conformance run
// ---------------------------------------------------------------------------

describe("Marketplace conformance harness", () => {
  it("asserts search listings with metadata and deterministic ordering", async () => {
    const report = await runConformance();
    const names = report.searchListings.map((listing) => listing.name);
    expect(names).toEqual(["plasma_rifles", "version_conflict"]);
    const plasma = report.searchListings[0]!;
    expect(plasma.version).toBe("1.4.2");
    expect(plasma.author).toBe("StudioX");
    expect(plasma.license).toBe("commercial");
    expect(plasma.rating).toBeGreaterThan(0);
    expect(plasma.assets.recipes).toBe(1);
    expect(plasma.assets.stacks).toBe(1);

    // Deterministic: a second run yields an identical listing array.
    const repeat = await runConformance();
    expect(repeat.searchListings).toEqual(report.searchListings);
  });

  it("rejects an invalid-manifest package with structured field errors", async () => {
    const report = await runConformance();
    expect(report.invalidPublishRejected.published).toBe(false);
    const fields = report.invalidPublishRejected.issues.map((issue) => issue.field);
    expect(fields).toContain("version");
    expect(fields).toContain("license");
    expect(fields).toContain("author");
  });

  it("publishes a valid package and rejects republishing (immutability)", async () => {
    const report = await runConformance();
    expect(report.publishAccepted.published).toBe(true);
    expect(report.publishAccepted.name).toBe(VALID_PACKAGE.name);
    expect(report.publishAccepted.issues).toEqual([]);
    expect(report.republishRejected.published).toBe(false);
    expect(report.republishRejected.issues[0]!.field).toBe("version");
    expect(report.republishRejected.issues[0]!.message).toMatch(/immutable/i);
  });

  it("installs a package and registers every contained asset", async () => {
    const report = await runConformance();
    expect(report.install.installed).toBe(true);
    expect(report.install.issues).toEqual([]);
    expect(report.install.registeredAssets).toEqual([
      "palettes:assets/palettes/il-dust-palette.json",
      "recipes:assets/recipes/il-heavy-cannon.json",
      "sequences:assets/sequences/il-laser-sequence.json",
      "stacks:assets/stacks/il-weapon-burst.json",
    ]);
  });

  it("detects missing-dependency and incompatible-major conflicts", async () => {
    const report = await runConformance();
    const kinds = report.conflicts.map((conflict) => conflict.kind).sort();
    expect(kinds).toEqual(["incompatible-major", "missing-dependency"]);

    const incompatible = report.conflicts.find(
      (conflict) => conflict.kind === "incompatible-major",
    )!;
    expect(incompatible.dependency).toBe("core");
    expect(incompatible.available).toEqual(["1.0.0"]);

    const missing = report.conflicts.find(
      (conflict) => conflict.kind === "missing-dependency",
    )!;
    expect(missing.dependency).toBe("does_not_exist");
    expect(missing.available).toEqual([]);
  });

  it("is deterministic — re-install and a second target are byte-identical", async () => {
    const report = await runConformance();
    expect(report.install.installed).toBe(true);
    expect(report.reinstall.installed).toBe(true);
    expect(report.determinism.identical).toBe(true);
    expect(report.determinism.snapshotA1).toBe(report.determinism.snapshotA2);
    expect(report.determinism.snapshotA1).toBe(report.determinism.snapshotB);
  });
});

// ---------------------------------------------------------------------------
// AC1 — offline, fail-closed network guard
// ---------------------------------------------------------------------------

describe("Marketplace live-network guard", () => {
  afterEach(() => {
    uninstallNetworkGuard();
  });

  it("runs the conformance suite with no live network attempts", async () => {
    const report = await runConformance();
    expect(report.offline).toBe(true);
    expect(report.networkAttempts).toEqual([]);
  });

  it("blocks and records a direct fetch attempt", async () => {
    installNetworkGuard();
    expect(() => {
      void fetch("https://registry.example.com/pkg.json");
    }).toThrow(/blocked/i);
    const attempts = networkAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.url).toBe("https://registry.example.com/pkg.json");
    expect(attempts[0]!.method).toBe("GET");
  });

  it("fails the conformance run when a target attempts live network access", async () => {
    const rogueTarget: MarketplaceConformanceTarget = {
      search(): MarketplaceListing[] {
        // Deliberately violate the offline contract.
        void fetch("https://registry.example.com/search");
        return [];
      },
      publish(): PublishOutcome {
        return { name: "", version: "", published: false, issues: [] };
      },
      install(): InstallOutcome {
        return {
          name: "",
          version: "",
          installed: false,
          registeredAssets: [],
          issues: [],
        };
      },
      detectConflicts(): VersionConflict[] {
        return [];
      },
      installedSnapshot(): string {
        return "{}";
      },
    };

    await expect(
      runMarketplaceConformance(() => rogueTarget, CONFORMANCE_OPTIONS),
    ).rejects.toThrow(/blocked/i);
  });
});
