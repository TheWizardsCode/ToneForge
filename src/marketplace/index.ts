/**
 * ToneForge Marketplace — public module surface.
 *
 * The Marketplace slice is built test-first. This module currently exposes the
 * offline conformance harness and its contract (work item
 * TF-0MUZX3XAI003S1GN); the manifest, registry, versioning, install and publish
 * modules add their own exports as they land.
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
  type MarketplaceAssetKind,
  type MarketplaceConformanceOptions,
  type MarketplaceConformanceReport,
  type MarketplaceConformanceTarget,
  type MarketplaceIssue,
  type MarketplaceListing,
  type NetworkAttempt,
  type PublishOutcome,
  type VersionConflict,
  type VersionConflictKind,
} from "./harness.js";
