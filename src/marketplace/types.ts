/**
 * ToneForge Marketplace — shared domain types.
 *
 * The canonical types for the Marketplace slice: the declarative package
 * manifest, its asset inventory, search listings, license, provenance and the
 * structured, field-addressed issues shared by every Marketplace validation
 * stage. The conformance harness (`harness.ts`) re-exports the types it first
 * declared here so its public contract is unchanged.
 *
 * Everything is textual, structured and inspectable — no binaries, no
 * executable code (`docs/prd/MARKETPLACE_PRD.md` Sections 4, 5, 13).
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 4, 5, 6, 13.
 */

/** The four asset kinds a demo Marketplace package may contain. */
export type MarketplaceAssetKind =
  | "recipes"
  | "stacks"
  | "sequences"
  | "palettes";

/** Canonical asset-kind order — used for deterministic iteration. */
export const MARKETPLACE_ASSET_KINDS: readonly MarketplaceAssetKind[] = [
  "recipes",
  "stacks",
  "sequences",
  "palettes",
] as const;

/** A structured, field-addressed Marketplace issue. */
export interface MarketplaceIssue {
  /** Field the issue applies to (for example `version` or `assets.recipes`). */
  field: string;
  /** Human-readable, actionable explanation of the issue. */
  message: string;
}

/** A search listing, as returned by the registry. */
export interface MarketplaceListing {
  name: string;
  version: string;
  author: string;
  license: string;
  category: string;
  rating: number;
  assets: Record<MarketplaceAssetKind, number>;
}

/**
 * A listing enriched with a `name@version` display/JSON label.
 *
 * Structurally a {@link MarketplaceListing}, so registries can return these
 * everywhere the conformance contract expects a plain listing.
 */
export interface MarketplaceSearchListing extends MarketplaceListing {
  /** Convenience label: `name@version`. */
  label: string;
}

/** A JSON-ready search result, as exposed by the registry `searchResult`. */
export interface MarketplaceSearchResult {
  /** The requested category, or `null` when the search was unfiltered. */
  category: string | null;
  /** Number of listings returned. */
  count: number;
  /** Listings in deterministic order. */
  listings: MarketplaceSearchListing[];
}

/**
 * A published package entry in a registry index — the search metadata plus the
 * package directory used to resolve a fetch.
 */
export interface MarketplaceRegistryEntry {
  name: string;
  version: string;
  type: string;
  /** Search category (for example `combat`, `ui`, `ambience`). */
  category: string;
  author: string;
  license: MarketplaceLicense;
  /** Rating in the closed interval [0, 5]. */
  rating: number;
  /** Package directory, relative to the registry root (or absolute). */
  path: string;
  /** Contained asset counts by kind (search metadata). */
  assets: Record<MarketplaceAssetKind, number>;
}

/** A package already present in the local install state. */
export interface MarketplaceInstalledPackage {
  name: string;
  version: string;
}

/** Root index describing the published packages and installed state. */
export interface MarketplaceRegistryIndex {
  version: string;
  packages: MarketplaceRegistryEntry[];
  installed: MarketplaceInstalledPackage[];
}

/** A resolved package bundle returned by a registry `fetch`. */
export interface MarketplacePackageBundle {
  name: string;
  version: string;
  /** Absolute package directory holding `manifest.json` and `assets/`. */
  directory: string;
  /** The parsed, validated package manifest. */
  manifest: MarketplaceManifest;
  /**
   * Optional declared content hashes, keyed by asset path (relative to the
   * package directory) or by content-addressed id (`<kind>:<path>`). When an
   * entry is present the install pipeline verifies the asset's computed
   * SHA-256 against it; absent a declaration only presence/readability is
   * verified.
   */
  integrity?: Record<string, string>;
}

/** Explicit license declaration (for example `commercial`, `mit`, `internal`). */
export type MarketplaceLicense = string;

/** Provenance/attribution metadata recorded when a package is acquired. */
export interface MarketplaceProvenance {
  /** Package name. */
  name: string;
  /** Exact version the package is locked to. */
  version: string;
  /** Author/attribution name from the manifest. */
  author: string;
  /** Explicit license declaration from the manifest. */
  license: MarketplaceLicense;
  /** Registry the package was acquired from. */
  registry: string;
}

/**
 * Classification of a dependency conflict detected during resolution.
 *
 * - `missing-dependency` — a required package is available in no version;
 * - `incompatible-major` — versions exist but none satisfies the requirement;
 * - `circular-dependency` — the dependency graph contains a cycle.
 */
export type VersionConflictKind =
  | "missing-dependency"
  | "incompatible-major"
  | "circular-dependency";

/**
 * A detected dependency conflict.
 *
 * `package`/`dependency` name the edge that produced the conflict, `required`
 * is the original requirement string (for example `core>=3.0`), `available`
 * lists the candidate versions seen (sorted, empty when none exist) and
 * `message` is the actionable, human-readable explanation.
 */
export interface VersionConflict {
  package: string;
  dependency: string;
  required: string;
  available: string[];
  kind: VersionConflictKind;
  message: string;
}

/** The asset inventory a manifest declares, keyed by asset kind. */
export type MarketplaceManifestAssets = Record<MarketplaceAssetKind, string[]>;

/**
 * A validated, declarative Marketplace package manifest.
 *
 * `assets` always carries every {@link MarketplaceAssetKind} (empty arrays are
 * allowed); optional `category`/`description` carry registry/display metadata.
 */
export interface MarketplaceManifest {
  /** Package name (unique within a registry). */
  name: string;
  /** Semantic version (`MAJOR.MINOR.PATCH`). */
  version: string;
  /** Primary asset type; extensible beyond the demo asset kinds. */
  type: string;
  /** Optional search category (registry metadata). */
  category?: string;
  /** Optional human-readable description. */
  description?: string;
  /** Author/attribution name. */
  author: string;
  /** Explicit license declaration. */
  license: MarketplaceLicense;
  /** Dependency requirement strings (for example `core>=1.0`). */
  dependencies: string[];
  /** Contained asset paths, relative to the package directory. */
  assets: MarketplaceManifestAssets;
}

/**
 * Classification of a manifest issue.
 *
 * `missing` — the field is absent (or `null`/`undefined`); `invalid` — the
 * field is present but has the wrong type, is empty, or is malformed.
 */
export type ManifestIssueCode = "missing" | "invalid";

/** A manifest issue that names the offending field. */
export interface ManifestIssue extends MarketplaceIssue {
  /** Machine-readable classification of the issue. */
  code: ManifestIssueCode;
}

/** Successful manifest parse/validation result. */
export interface ManifestSuccess {
  ok: true;
  manifest: MarketplaceManifest;
  /** Always empty on success. */
  issues: [];
}

/** Failed manifest parse/validation result. */
export interface ManifestFailure {
  ok: false;
  /** Every issue found, each naming its offending field. */
  issues: ManifestIssue[];
  manifest?: undefined;
}

/** Result of {@link parseManifest}. */
export type ManifestParseResult = ManifestSuccess | ManifestFailure;
