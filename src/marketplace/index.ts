/**
 * ToneForge Marketplace — public module surface.
 *
 * The Marketplace slice is built test-first. This module exposes the offline
 * conformance harness and its contract (work item TF-0MUZX3XAI003S1GN) plus the
 * manifest domain types and parser/validator (work item TF-0MUZX3XLO006D7HW);
 * the registry, versioning, install and publish modules add their own exports
 * as they land.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md.
 */

export {
  installNetworkGuard,
  isNetworkGuardInstalled,
  networkAttempts,
  runMarketplaceConformance,
  uninstallNetworkGuard,
  withNoNetwork,
  type InstallOutcome,
  type MarketplaceConformanceOptions,
  type MarketplaceConformanceReport,
  type MarketplaceConformanceTarget,
  type NetworkAttempt,
  type PublishOutcome,
  type VersionConflict,
  type VersionConflictKind,
} from "./harness.js";

export {
  MARKETPLACE_ASSET_KINDS,
  type ManifestFailure,
  type ManifestIssue,
  type ManifestIssueCode,
  type ManifestParseResult,
  type ManifestSuccess,
  type MarketplaceAssetKind,
  type MarketplaceInstalledPackage,
  type MarketplaceIssue,
  type MarketplaceLicense,
  type MarketplaceListing,
  type MarketplaceManifest,
  type MarketplaceManifestAssets,
  type MarketplacePackageBundle,
  type MarketplaceProvenance,
  type MarketplaceRegistryEntry,
  type MarketplaceRegistryIndex,
  type MarketplaceSearchListing,
  type MarketplaceSearchResult,
} from "./types.js";

export { parseManifest, validateManifest } from "./manifest.js";

export {
  compareListingOrder,
  compareVersionOrder,
  createSearchResult,
  registryEntryToListing,
  searchEntries,
  sortListings,
  toSearchListing,
} from "./search.js";

export {
  LocalDirectoryRegistry,
  MarketplaceRegistryError,
  coerceRegistryIndex,
  createLocalRegistry,
  loadRegistryIndex,
  type LocalRegistryOptions,
  type MarketplaceRegistry,
  type MarketplaceRegistryErrorCode,
} from "./registry.js";

export {
  compareVersions,
  detectConflicts,
  isValidVersion,
  parseRequirement,
  parseVersion,
  resolveDependencies,
  satisfiesRange,
  type DependencyGraphNode,
  type DependencyProvider,
  type DependencyResolution,
  type ParsedRequirement,
  type ParsedVersion,
  type SelectedDependency,
} from "./version.js";
