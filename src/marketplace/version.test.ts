/**
 * Marketplace semantic-version and dependency-resolution tests.
 *
 * Written first (TDD) for work item TF-0MUZX3Y8R008IPVP. These tests pin down
 * the versioning contract from `docs/prd/MARKETPLACE_PRD.md` Sections 5, 9 and
 * 11: strict `MAJOR.MINOR.PATCH` parsing and comparison, range compatibility,
 * and dependency resolution that reports missing, incompatible-major and
 * circular dependencies as distinct, structured, actionable conflicts.
 *
 * They cover each conflict class plus the compatible case (AC4) and prove the
 * resolution is deterministic and independent of input ordering (AC3). The
 * conflict fixtures are loaded through the F1 typed helpers
 * (`src/test-utils/marketplace-fixtures.ts`) so the suite exercises the shared
 * fixture registry rather than ad-hoc copies.
 */

import { describe, it, expect } from "vitest";

import {
  compareVersions,
  detectConflicts,
  isValidVersion,
  parseRequirement,
  parseVersion,
  resolveDependencies,
  satisfiesRange,
  type DependencyGraphNode,
  type DependencyProvider,
} from "./version.js";
import type { VersionConflict } from "./types.js";
import {
  loadFixturePackageManifest,
  loadMarketplaceRegistry,
} from "../test-utils/marketplace-fixtures.js";

// ---------------------------------------------------------------------------
// Semver parsing and comparison
// ---------------------------------------------------------------------------

describe("parseVersion", () => {
  it("parses a MAJOR.MINOR.PATCH version into numeric segments", () => {
    expect(parseVersion("2.1.0")).toEqual({ major: 2, minor: 1, patch: 0 });
    expect(parseVersion(" 1.0.9 ")).toEqual({ major: 1, minor: 0, patch: 9 });
    expect(parseVersion("10.20.30")).toEqual({
      major: 10,
      minor: 20,
      patch: 30,
    });
  });

  it("rejects malformed versions (including abbreviated and pre-release forms)", () => {
    for (const malformed of ["1.0", "1", "1.2.3.4", "1.2.x", "v1.2.3", "1.2.3-beta", ""]) {
      expect(parseVersion(malformed)).toBeNull();
      expect(isValidVersion(malformed)).toBe(false);
    }
    expect(isValidVersion("1.2.3")).toBe(true);
  });
});

describe("compareVersions", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.3.0")).toBeLessThan(0);
    expect(compareVersions("1.3.1", "1.3.0")).toBeGreaterThan(0);
  });

  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("falls back to a deterministic ordering for malformed versions", () => {
    // Deterministic and antisymmetric even when parsing fails.
    expect(compareVersions("nonsense", "nonsense")).toBe(0);
    expect(compareVersions("aaa", "bbb")).toBeLessThan(0);
    expect(compareVersions("bbb", "aaa")).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Range compatibility
// ---------------------------------------------------------------------------

describe("satisfiesRange", () => {
  it("accepts any valid version for the wildcard ranges", () => {
    expect(satisfiesRange("0.0.1", "")).toBe(true);
    expect(satisfiesRange("9.9.9", "*")).toBe(true);
  });

  it("matches exact versions", () => {
    expect(satisfiesRange("1.2.3", "1.2.3")).toBe(true);
    expect(satisfiesRange("1.2.4", "1.2.3")).toBe(false);
    expect(satisfiesRange("1.2.3", "=1.2.3")).toBe(true);
  });

  it("matches comparator ranges, including partial versions", () => {
    expect(satisfiesRange("1.2.3", ">=1.0")).toBe(true);
    expect(satisfiesRange("1.0.0", ">=1.0")).toBe(true);
    expect(satisfiesRange("1.0.0", ">=3.0")).toBe(false);
    expect(satisfiesRange("2.0.0", ">1.9.9")).toBe(true);
    expect(satisfiesRange("1.9.9", "<=1.9.9")).toBe(true);
    expect(satisfiesRange("2.0.0", "<2.0.0")).toBe(false);
  });

  it("matches caret ranges as same-major compatible", () => {
    expect(satisfiesRange("1.9.9", "^1.2.0")).toBe(true);
    expect(satisfiesRange("1.2.0", "^1.2.0")).toBe(true);
    expect(satisfiesRange("2.0.0", "^1.2.0")).toBe(false);
    expect(satisfiesRange("1.1.9", "^1.2.0")).toBe(false);
  });

  it("matches tilde ranges as same-minor compatible", () => {
    expect(satisfiesRange("1.2.9", "~1.2.0")).toBe(true);
    expect(satisfiesRange("1.3.0", "~1.2.0")).toBe(false);
  });

  it("fails closed for malformed versions or ranges", () => {
    expect(satisfiesRange("1.0", ">=1.0.0")).toBe(false);
    expect(satisfiesRange("1.0.0", "not-a-range")).toBe(false);
  });
});

describe("parseRequirement", () => {
  it("splits name and range, tolerating surrounding whitespace", () => {
    expect(parseRequirement("core>=3.0")).toEqual({
      name: "core",
      range: ">=3.0",
    });
    expect(parseRequirement("core >= 1.0.0")).toEqual({
      name: "core",
      range: ">= 1.0.0",
    });
    expect(parseRequirement("@scope/pkg^2.0.0")).toEqual({
      name: "@scope/pkg",
      range: "^2.0.0",
    });
  });

  it("treats a bare name as an unbounded requirement", () => {
    expect(parseRequirement("core")).toEqual({ name: "core", range: "" });
  });

  it("returns null for malformed requirements", () => {
    expect(parseRequirement("")).toBeNull();
    expect(parseRequirement("   ")).toBeNull();
    expect(parseRequirement(">=1.0.0")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Dependency resolution — conflict classes and the compatible case
// ---------------------------------------------------------------------------

/** Build a provider over a fixed list of candidate nodes. */
function providerOf(nodes: DependencyGraphNode[]): DependencyProvider {
  return (name) => nodes.filter((node) => node.name === name);
}

function kindsOf(conflicts: VersionConflict[]): string[] {
  return conflicts.map((conflict) => conflict.kind).sort();
}

const ROOT: DependencyGraphNode = {
  name: "root",
  version: "1.0.0",
  dependencies: ["core>=1.0"],
};

describe("resolveDependencies", () => {
  it("resolves a compatible dependency graph in dependency-first order", () => {
    const resolution = resolveDependencies(
      ROOT,
      providerOf([{ name: "core", version: "1.4.0", dependencies: [] }]),
    );

    expect(resolution.ok).toBe(true);
    expect(resolution.conflicts).toEqual([]);
    expect(resolution.order).toEqual(["core@1.4.0", "root@1.0.0"]);
    expect(resolution.selected).toEqual([
      { name: "core", version: "1.4.0" },
      { name: "root", version: "1.0.0" },
    ]);
  });

  it("selects the highest satisfying version deterministically", () => {
    const resolution = resolveDependencies(
      ROOT,
      providerOf([
        { name: "core", version: "1.0.0", dependencies: [] },
        { name: "core", version: "1.9.0", dependencies: [] },
        { name: "core", version: "1.4.0", dependencies: [] },
      ]),
    );
    expect(resolution.conflicts).toEqual([]);
    expect(resolution.selected).toEqual([
      { name: "core", version: "1.9.0" },
      { name: "root", version: "1.0.0" },
    ]);
  });

  it("resolves transitive dependencies dependency-first", () => {
    const root: DependencyGraphNode = {
      name: "root",
      version: "1.0.0",
      dependencies: ["alpha>=1.0"],
    };
    const resolution = resolveDependencies(
      root,
      providerOf([
        { name: "alpha", version: "2.0.0", dependencies: ["beta>=1.0"] },
        { name: "beta", version: "1.5.0", dependencies: [] },
      ]),
    );
    expect(resolution.ok).toBe(true);
    expect(resolution.order).toEqual([
      "beta@1.5.0",
      "alpha@2.0.0",
      "root@1.0.0",
    ]);
  });

  it("reports a missing dependency with an empty available list", () => {
    const resolution = resolveDependencies(
      { ...ROOT, dependencies: ["does_not_exist>=1.0"] },
      providerOf([{ name: "core", version: "1.0.0", dependencies: [] }]),
    );

    expect(resolution.ok).toBe(false);
    expect(kindsOf(resolution.conflicts)).toEqual(["missing-dependency"]);
    const conflict = resolution.conflicts[0]!;
    expect(conflict.package).toBe("root");
    expect(conflict.dependency).toBe("does_not_exist");
    expect(conflict.required).toBe("does_not_exist>=1.0");
    expect(conflict.available).toEqual([]);
    expect(conflict.message).toMatch(/does_not_exist/);
    expect(conflict.message).toMatch(/no version/i);
  });

  it("reports an incompatible-major conflict with the available versions", () => {
    const resolution = resolveDependencies(
      { ...ROOT, dependencies: ["core>=3.0"] },
      providerOf([
        { name: "core", version: "1.0.0", dependencies: [] },
        { name: "core", version: "2.0.0", dependencies: [] },
      ]),
    );

    expect(resolution.ok).toBe(false);
    expect(kindsOf(resolution.conflicts)).toEqual(["incompatible-major"]);
    const conflict = resolution.conflicts[0]!;
    expect(conflict.dependency).toBe("core");
    expect(conflict.required).toBe("core>=3.0");
    expect(conflict.available).toEqual(["1.0.0", "2.0.0"]);
    expect(conflict.message).toMatch(/core>=3.0/);
    expect(conflict.message).toMatch(/1\.0\.0/);
  });

  it("reports a circular dependency as a distinct conflict class", () => {
    const resolution = resolveDependencies(
      { name: "alpha", version: "1.0.0", dependencies: ["beta>=1.0"] },
      providerOf([
        { name: "alpha", version: "1.0.0", dependencies: ["beta>=1.0"] },
        { name: "beta", version: "1.0.0", dependencies: ["alpha>=1.0"] },
      ]),
    );

    expect(resolution.ok).toBe(false);
    expect(kindsOf(resolution.conflicts)).toEqual(["circular-dependency"]);
    const conflict = resolution.conflicts[0]!;
    expect(conflict.kind).toBe("circular-dependency");
    expect([conflict.package, conflict.dependency].sort()).toEqual([
      "alpha",
      "beta",
    ]);
    expect(conflict.message).toMatch(/circular/i);
  });
});

describe("detectConflicts", () => {
  it("returns an empty array for a compatible graph", () => {
    expect(
      detectConflicts(
        ROOT,
        providerOf([{ name: "core", version: "1.0.0", dependencies: [] }]),
      ),
    ).toEqual([]);
  });

  it("is identical regardless of candidate and requirement ordering", () => {
    const rootA: DependencyGraphNode = {
      name: "root",
      version: "1.0.0",
      dependencies: ["beta>=1.0", "alpha>=1.0"],
    };
    const rootB: DependencyGraphNode = {
      name: "root",
      version: "1.0.0",
      dependencies: ["alpha>=1.0", "beta>=1.0"],
    };
    const nodes = [
      { name: "alpha", version: "1.0.0", dependencies: [] },
      { name: "beta", version: "1.0.0", dependencies: [] },
    ];

    const first = resolveDependencies(rootA, providerOf(nodes));
    const second = resolveDependencies(rootB, providerOf([...nodes].reverse()));

    expect(first.order).toEqual(second.order);
    expect(first.selected).toEqual(second.selected);
    expect(first.conflicts).toEqual(second.conflicts);
  });
});

// ---------------------------------------------------------------------------
// F1 fixture integration — the real conflict fixtures
// ---------------------------------------------------------------------------

describe("fixture conflict detection", () => {
  const index = loadMarketplaceRegistry();

  /** Provider that exposes the fixture registry's installed `core@1.0.0`. */
  const fixtureProvider: DependencyProvider = (name) => {
    const installed = index.installed.filter((pkg) => pkg.name === name);
    return installed.map((pkg) => ({
      name: pkg.name,
      version: pkg.version,
      dependencies: [],
    }));
  };

  it("classifies the version_conflict fixture as incompatible-major", () => {
    const manifest = loadFixturePackageManifest("version_conflict");
    const conflicts = detectConflicts(
      {
        name: manifest.name,
        version: manifest.version,
        dependencies: manifest.dependencies,
      },
      fixtureProvider,
    );

    expect(kindsOf(conflicts)).toEqual(["incompatible-major"]);
    expect(conflicts[0]!.dependency).toBe("core");
    expect(conflicts[0]!.available).toEqual(["1.0.0"]);
  });

  it("classifies the missing_dependency fixture as missing-dependency", () => {
    const manifest = loadFixturePackageManifest("missing_dependency");
    const conflicts = detectConflicts(
      {
        name: manifest.name,
        version: manifest.version,
        dependencies: manifest.dependencies,
      },
      fixtureProvider,
    );

    expect(kindsOf(conflicts)).toEqual(["missing-dependency"]);
    expect(conflicts[0]!.dependency).toBe("does_not_exist");
    expect(conflicts[0]!.available).toEqual([]);
  });

  it("accepts the valid industrial_lasers fixture as compatible", () => {
    const manifest = loadFixturePackageManifest("industrial_lasers");
    const conflicts = detectConflicts(
      {
        name: manifest.name,
        version: manifest.version,
        dependencies: manifest.dependencies,
      },
      fixtureProvider,
    );

    expect(conflicts).toEqual([]);
  });
});
