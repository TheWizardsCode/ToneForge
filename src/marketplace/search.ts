/**
 * Marketplace category search — filtering and deterministic ordering.
 *
 * Pure helpers shared by the local registry adapter (and reusable by any
 * future registry implementation). Given identical registry state they always
 * produce an identical listing order, which is what makes the Marketplace
 * `search --json` contract reproducible (`docs/prd/MARKETPLACE_PRD.md`
 * Sections 10, 14).
 *
 * The version comparison here exists **only** to give listings a stable total
 * order; semantic-version range compatibility and dependency resolution are
 * owned by the versioning module (F4, `version.ts`).
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 10, 12, 14.
 */

import {
  type MarketplaceListing,
  type MarketplaceRegistryEntry,
  type MarketplaceSearchListing,
  type MarketplaceSearchResult,
} from "./types.js";

/** Deterministic, locale-independent string comparison (code-point order). */
function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Parse `MAJOR.MINOR.PATCH` into numeric segments, or `null` when malformed. */
function parseVersionSegments(
  version: string,
): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Order two versions.
 *
 * Ordering only — this deliberately does **not** implement range
 * compatibility (`^`, `>=`) or dependency resolution, which belong to the
 * versioning module (F4). Malformed versions fall back to a deterministic
 * string comparison.
 */
export function compareVersionOrder(a: string, b: string): number {
  const pa = parseVersionSegments(a);
  const pb = parseVersionSegments(b);
  if (pa && pb) {
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
  }
  return compareStrings(a, b);
}

/**
 * Total order for listings: by `name`, then by semantic `version`.
 *
 * Deterministic for identical registry state and independent of input order.
 */
export function compareListingOrder(
  a: MarketplaceListing,
  b: MarketplaceListing,
): number {
  return compareStrings(a.name, b.name) || compareVersionOrder(a.version, b.version);
}

/** Return a new array of listings in deterministic order. */
export function sortListings(
  listings: readonly MarketplaceListing[],
): MarketplaceSearchListing[] {
  return listings.map(toSearchListing).sort(compareListingOrder);
}

/** Attach the `name@version` label, idempotently. */
export function toSearchListing(
  listing: MarketplaceListing,
): MarketplaceSearchListing {
  const existing = (listing as Partial<MarketplaceSearchListing>).label;
  return {
    ...listing,
    label:
      typeof existing === "string" ? existing : `${listing.name}@${listing.version}`,
  };
}

/** Project a registry index entry into a labelled search listing. */
export function registryEntryToListing(
  entry: MarketplaceRegistryEntry,
): MarketplaceSearchListing {
  return {
    name: entry.name,
    version: entry.version,
    author: entry.author,
    license: entry.license,
    category: entry.category,
    rating: entry.rating,
    assets: { ...entry.assets },
    label: `${entry.name}@${entry.version}`,
  };
}

/**
 * Filter registry entries by category and order the resulting listings.
 *
 * Matching is case-insensitive and surrounding whitespace is ignored; an
 * absent or blank category returns every entry. The result order is
 * deterministic (`name`, then semantic `version`).
 */
export function searchEntries(
  entries: readonly MarketplaceRegistryEntry[],
  category?: string,
): MarketplaceSearchListing[] {
  const wanted = category?.trim().toLowerCase();
  const matches = entries.filter((entry) => {
    if (wanted === undefined || wanted === "") return true;
    return entry.category.toLowerCase() === wanted;
  });
  return matches.map(registryEntryToListing).sort(compareListingOrder);
}

/**
 * Wrap ordered listings in the JSON-ready `searchResult` shape.
 *
 * Pure: neither the input array nor its listings are mutated.
 */
export function createSearchResult(
  category: string | undefined,
  listings: readonly MarketplaceSearchListing[],
): MarketplaceSearchResult {
  const normalised = listings.map(toSearchListing);
  return {
    category: category ?? null,
    count: normalised.length,
    listings: normalised,
  };
}
