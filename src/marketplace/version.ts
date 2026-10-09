/**
 * Marketplace semantic versioning and dependency conflict detection.
 *
 * The versioning authority for the Marketplace slice (work item
 * TF-0MUZX3Y8R008IPVP). It implements just enough of Semantic Versioning 2.0.0
 * — `MAJOR.MINOR.PATCH` parsing, ordering and range compatibility — **in-repo**
 * with no new runtime dependency, then resolves a package's dependency graph
 * and classifies every conflict so a dependency bump cannot silently break
 * builds (`docs/prd/MARKETPLACE_PRD.md` Sections 5, 7, 9, 11).
 *
 * Two layers:
 *
 * 1. **Pure semver helpers** — {@link parseVersion}, {@link compareVersions},
 *    {@link satisfiesRange} and {@link parseRequirement}. Deterministic and
 *    total: malformed input never throws, it fails closed (`false`/`null`).
 * 2. **Dependency resolution** — {@link resolveDependencies} walks the graph
 *    from a root package, selects the highest satisfying version of each
 *    dependency and reports `missing-dependency`, `incompatible-major` and
 *    `circular-dependency` conflicts as structured, actionable
 *    {@link VersionConflict}s. {@link detectConflicts} is the conflict-only
 *    convenience view used by the install/publish pipelines.
 *
 * Resolution is deterministic and independent of input ordering: dependency
 * requirements are visited in a stable order and candidate versions are ranked
 * by {@link compareVersions}, so identical registry state always yields an
 * identical order, selection and conflict list.
 *
 * Pre-release/build metadata is out of scope for the demo and rejected, matching
 * the manifest schema (`src/marketplace/manifest.ts`); a future extension can
 * widen {@link ParsedVersion} without changing this module's public shape.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 5, 7, 9, 11.
 */

import type {
  VersionConflict,
  VersionConflictKind,
} from "./types.js";

export type { VersionConflict, VersionConflictKind };

// ---------------------------------------------------------------------------
// Semver primitives
// ---------------------------------------------------------------------------

/** A parsed `MAJOR.MINOR.PATCH` semantic version. */
export interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** Strict semantic-version shape: three dot-separated digit runs. */
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Parse a `MAJOR.MINOR.PATCH` version.
 *
 * @returns the numeric segments, or `null` when `version` is not a valid
 *   (possibly whitespace-padded) semantic version.
 */
export function parseVersion(version: string): ParsedVersion | null {
  if (typeof version !== "string") return null;
  const match = VERSION_PATTERN.exec(version.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/** True when `version` is a valid `MAJOR.MINOR.PATCH` semantic version. */
export function isValidVersion(version: string): boolean {
  return parseVersion(version) !== null;
}

/** Deterministic, locale-independent string comparison (code-point order). */
function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Numeric ordering of two parsed versions. */
function compareParsed(a: ParsedVersion, b: ParsedVersion): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Order two versions by major, then minor, then patch.
 *
 * Malformed versions fall back to a deterministic string comparison so the
 * function stays a total order and never throws (the caller decides whether a
 * malformed version is acceptable via {@link isValidVersion}).
 */
export function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);
  if (parsedA && parsedB) return compareParsed(parsedA, parsedB);
  if (parsedA && !parsedB) return -1;
  if (!parsedA && parsedB) return 1;
  return compareStrings(a.trim(), b.trim());
}

// ---------------------------------------------------------------------------
// Range compatibility
// ---------------------------------------------------------------------------

/** A possibly-abbreviated version from a range comparator (`1`, `1.2`, `1.2.3`). */
interface PartialVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  /** Number of dot-separated segments supplied (1–3). */
  readonly segments: number;
}

/** Shape of a (possibly partial) version inside a range comparator. */
const PARTIAL_PATTERN = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

/** Parse a (possibly partial) version, defaulting absent segments to 0. */
function parsePartialVersion(text: string): PartialVersion | null {
  const match = PARTIAL_PATTERN.exec(text.trim());
  if (!match) return null;
  const major = Number(match[1]);
  const minor = match[2] === undefined ? 0 : Number(match[2]);
  const patch = match[3] === undefined ? 0 : Number(match[3]);
  const segments = match[3] !== undefined ? 3 : match[2] !== undefined ? 2 : 1;
  return { major, minor, patch, segments };
}

/** Split a comparator into its operator and version text. */
const COMPARATOR_PATTERN = /^(>=|<=|>|<|\^|~|=)?\s*(.+)$/;

/** `version >= lower && version < upper`. */
function within(
  version: ParsedVersion,
  lower: ParsedVersion,
  upper: ParsedVersion,
): boolean {
  return compareParsed(version, lower) >= 0 && compareParsed(version, upper) < 0;
}

/** Evaluate one comparator (for example `>=3.0` or `^1.2.0`). */
function satisfiesComparator(
  version: ParsedVersion,
  comparator: string,
): boolean {
  const text = comparator.trim();
  if (text === "" || text === "*") return true;

  const match = COMPARATOR_PATTERN.exec(text);
  if (!match) return false;

  const operator = match[1] ?? "";
  const bound = parsePartialVersion(match[2] ?? "");
  if (!bound) return false;

  const lower: ParsedVersion = {
    major: bound.major,
    minor: bound.minor,
    patch: bound.patch,
  };

  switch (operator) {
    case ">=":
      return compareParsed(version, lower) >= 0;
    case ">":
      return compareParsed(version, lower) > 0;
    case "<=":
      return compareParsed(version, lower) <= 0;
    case "<":
      return compareParsed(version, lower) < 0;
    case "^": {
      const upper: ParsedVersion =
        bound.major > 0
          ? { major: bound.major + 1, minor: 0, patch: 0 }
          : bound.minor > 0
            ? { major: 0, minor: bound.minor + 1, patch: 0 }
            : { major: 0, minor: 0, patch: bound.patch + 1 };
      return within(version, lower, upper);
    }
    case "~": {
      const upper: ParsedVersion =
        bound.segments >= 2
          ? { major: bound.major, minor: bound.minor + 1, patch: 0 }
          : { major: bound.major + 1, minor: 0, patch: 0 };
      return within(version, lower, upper);
    }
    case "":
    case "=": {
      if (bound.segments === 3) return compareParsed(version, lower) === 0;
      // Abbreviated `1` / `1.2` is an x-range.
      const upper: ParsedVersion =
        bound.segments === 2
          ? { major: bound.major, minor: bound.minor + 1, patch: 0 }
          : { major: bound.major + 1, minor: 0, patch: 0 };
      return within(version, lower, upper);
    }
    default:
      return false;
  }
}

/**
 * True when `version` satisfies `range`.
 *
 * Supported grammar (a conjunction is whitespace-separated, disjunctions are
 * joined with `||`): `*`/empty (any), an exact or abbreviated version
 * (`1.2.3`, `1.2`, `1`), the comparators `>=`, `>`, `<=`, `<`, `=`, and the
 * `^` (same-major compatible) and `~` (same-minor compatible) shorthands.
 * Malformed versions and ranges fail closed (`false`).
 */
export function satisfiesRange(version: string, range: string): boolean {
  const parsed = parseVersion(version);
  if (!parsed) return false;

  const text = typeof range === "string" ? range.trim() : "";
  if (text === "" || text === "*") return true;

  return text.split("||").some((group) => {
    const comparators = group.trim().split(/\s+/).filter(Boolean);
    if (comparators.length === 0) return false;
    return comparators.every((comparator) =>
      satisfiesComparator(parsed, comparator),
    );
  });
}

/** A dependency requirement split into its package name and version range. */
export interface ParsedRequirement {
  /** Required package name. */
  name: string;
  /** Version range, or `""` when the requirement is unbounded. */
  range: string;
}

/** Requirement shape: a package name followed by an optional range. */
const REQUIREMENT_PATTERN = /^([A-Za-z0-9_.@/-]+)\s*(.*)$/;

/**
 * Split `name` + optional range (for example `core>=3.0`, `@scope/pkg^2.0.0`)
 * into its parts. Returns `null` for a blank or malformed requirement.
 */
export function parseRequirement(requirement: string): ParsedRequirement | null {
  if (typeof requirement !== "string") return null;
  const match = REQUIREMENT_PATTERN.exec(requirement.trim());
  if (!match || !match[1]) return null;
  return { name: match[1], range: (match[2] ?? "").trim() };
}

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

/** A node in the dependency graph (a package version and its requirements). */
export interface DependencyGraphNode {
  name: string;
  version: string;
  /** Requirement strings, for example `core>=1.0`. */
  dependencies?: string[];
}

/**
 * Supplies every known version of a package (each with its own dependency
 * requirements) so the resolver can traverse the graph transitively.
 */
export type DependencyProvider = (
  name: string,
) => readonly DependencyGraphNode[];

/** An exact package version selected during resolution. */
export interface SelectedDependency {
  name: string;
  version: string;
}

/** Result of {@link resolveDependencies}. */
export interface DependencyResolution {
  /** True when no conflicts were detected. */
  ok: boolean;
  /** Resolved packages in deterministic dependency-first order (`name@version`). */
  order: string[];
  /** Exact versions selected, in deterministic name order. */
  selected: SelectedDependency[];
  /** Every conflict detected, in deterministic order. */
  conflicts: VersionConflict[];
}

/** Rank candidates highest version first; ties broken by raw string. */
function rankCandidates(
  candidates: readonly DependencyGraphNode[],
): DependencyGraphNode[] {
  return [...candidates].sort(
    (a, b) => compareVersions(b.version, a.version) || compareStrings(a.version, b.version),
  );
}

/** Deterministic ordering for the final conflict list. */
function compareConflicts(a: VersionConflict, b: VersionConflict): number {
  return (
    compareStrings(a.kind, b.kind) ||
    compareStrings(a.package, b.package) ||
    compareStrings(a.dependency, b.dependency) ||
    compareStrings(a.required, b.required) ||
    compareStrings(a.message, b.message)
  );
}

/**
 * Resolve a package dependency graph, reporting every conflict.
 *
 * Traverses from `root`, selecting the highest version that satisfies each
 * requirement (dependency-first), and reports:
 *
 * - `missing-dependency` when no version of the dependency is available;
 * - `incompatible-major` when versions exist but none satisfies the range (or
 *   the requirement is malformed);
 * - `circular-dependency` when a package (transitively) depends on itself.
 *
 * Deterministic and independent of input ordering: requirements are visited in
 * name order and candidates are ranked by version, so identical registry state
 * produces identical `order`, `selected` and `conflicts`.
 */
export function resolveDependencies(
  root: DependencyGraphNode,
  provider: DependencyProvider,
): DependencyResolution {
  const conflicts = new Map<string, VersionConflict>();
  const order: string[] = [];
  const selected = new Map<string, SelectedDependency>();
  const state = new Map<string, "visiting" | "done">();

  const addConflict = (conflict: VersionConflict): void => {
    const key = [conflict.kind, conflict.package, conflict.dependency, conflict.required].join(
      "\u0000",
    );
    if (!conflicts.has(key)) conflicts.set(key, conflict);
  };

  const availableVersions = (name: string): string[] =>
    [...new Set(provider(name).map((node) => node.version))].sort(compareVersions);

  const visit = (
    node: DependencyGraphNode,
    from?: { package: string; required: string },
  ): void => {
    const current = state.get(node.name);
    if (current === "done") return;
    if (current === "visiting") {
      if (from) {
        addConflict({
          package: from.package,
          dependency: node.name,
          required: from.required,
          available: availableVersions(node.name),
          kind: "circular-dependency",
          message: `Circular dependency detected: ${from.package} -> ${node.name} (requirement "${from.required}")`,
        });
      }
      return;
    }

    state.set(node.name, "visiting");
    selected.set(node.name, { name: node.name, version: node.version });

    const requirements = [...(node.dependencies ?? [])].sort(compareStrings);
    for (const requirement of requirements) {
      const parsed = parseRequirement(requirement);
      if (!parsed) {
        addConflict({
          package: node.name,
          dependency: requirement,
          required: requirement,
          available: [],
          kind: "incompatible-major",
          message: `${node.name} declares an invalid dependency requirement "${requirement}"`,
        });
        continue;
      }

      const candidates = rankCandidates(provider(parsed.name));
      const available = availableVersions(parsed.name);
      const chosen = candidates.find((candidate) =>
        satisfiesRange(candidate.version, parsed.range),
      );

      if (!chosen) {
        if (available.length === 0) {
          addConflict({
            package: node.name,
            dependency: parsed.name,
            required: requirement,
            available,
            kind: "missing-dependency",
            message: `${node.name} requires "${requirement}" but no version of "${parsed.name}" is available in the registry`,
          });
        } else {
          addConflict({
            package: node.name,
            dependency: parsed.name,
            required: requirement,
            available,
            kind: "incompatible-major",
            message: `${node.name} requires "${requirement}" but available versions (${available.join(", ")}) do not satisfy it`,
          });
        }
        continue;
      }

      visit(chosen, { package: node.name, required: requirement });
    }

    state.set(node.name, "done");
    order.push(`${node.name}@${node.version}`);
  };

  visit(root);

  const sortedConflicts = [...conflicts.values()].sort(compareConflicts);
  const sortedSelected = [...selected.values()].sort((a, b) =>
    compareStrings(a.name, b.name),
  );

  return {
    ok: sortedConflicts.length === 0,
    order,
    selected: sortedSelected,
    conflicts: sortedConflicts,
  };
}

/**
 * Detect every dependency conflict declared by a package (conflict-only view
 * of {@link resolveDependencies}), as consumed by the install/publish gates.
 */
export function detectConflicts(
  root: DependencyGraphNode,
  provider: DependencyProvider,
): VersionConflict[] {
  return resolveDependencies(root, provider).conflicts;
}
