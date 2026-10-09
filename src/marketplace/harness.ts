/**
 * Marketplace conformance harness.
 *
 * The deterministic, offline test foundation for the Marketplace slice (work
 * item TF-0MUZX3XAI003S1GN). It provides:
 *
 * 1. a **live-network guard** that blocks and records any attempt to reach the
 *    network while a conformance run is active, so the suite fails closed if a
 *    Marketplace test ever depends on a live socket; and
 * 2. a **conformance runner** that drives an injected
 *    {@link MarketplaceConformanceTarget} through the five Marketplace
 *    behaviours the epic specifies: search listings, install registration,
 *    publish rejection, version-conflict detection and post-install
 *    determinism (same input ⇒ byte-identical registered state).
 *
 * The runner is transport- and implementation-agnostic: F1 supplies an offline
 * fixture-backed target to prove the harness, and the production Marketplace
 * modules (manifest, registry, versioning, install, publish) are expected to
 * satisfy the same {@link MarketplaceConformanceTarget} contract.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 4, 5, 7, 9–13.
 */

import http from "node:http";
import https from "node:https";

/** The four asset kinds a demo Marketplace package may contain. */
export type MarketplaceAssetKind =
  | "recipes"
  | "stacks"
  | "sequences"
  | "palettes";

// ---------------------------------------------------------------------------
// Live-network guard
// ---------------------------------------------------------------------------

/** A recorded attempt to perform live network I/O. */
export interface NetworkAttempt {
  /** Requested URL (or `node:http`/`node:https` for socket-level calls). */
  url: string;
  /** HTTP method or `REQUEST`. */
  method: string;
  /** Milliseconds since the Unix epoch when the attempt was recorded. */
  at: number;
}

type FetchLike = (input: unknown, init?: unknown) => unknown;

/** Minimal view of the global object allowing the `fetch` property to be swapped. */
interface MutableGlobal {
  fetch?: FetchLike;
}

interface GuardOriginals {
  fetch: FetchLike | undefined;
  httpRequest: unknown;
  httpGet: unknown;
  httpsRequest: unknown;
  httpsGet: unknown;
}

let guardDepth = 0;
let attempts: NetworkAttempt[] = [];
let originals: GuardOriginals | null = null;

/** Record the attempt and fail closed. */
function recordAttempt(url: string, method: string): never {
  attempts.push({ url, method, at: Date.now() });
  throw new Error(
    `Live network access is blocked by the Marketplace conformance harness (${method} ${url}).`,
  );
}

/** Best-effort property patch that tolerates read-only module namespaces. */
function tryPatch(target: object, key: string, replacement: unknown): void {
  try {
    (target as unknown as Record<string, unknown>)[key] = replacement;
  } catch {
    // Read-only ESM namespaces cannot be patched; fetch remains guarded.
  }
}

/** Attempts recorded since the guard was installed. */
export function networkAttempts(): NetworkAttempt[] {
  return [...attempts];
}

/** Whether the live-network guard is currently installed. */
export function isNetworkGuardInstalled(): boolean {
  return guardDepth > 0;
}

/**
 * Install the live-network guard (reference-counted).
 *
 * Replaces `globalThis.fetch` and, on a best-effort basis, `node:http` /
 * `node:https` `request`/`get` so a Marketplace test cannot silently reach the
 * network. Safe to nest; the guard is only removed when the outermost
 * {@link uninstallNetworkGuard} runs.
 */
export function installNetworkGuard(): void {
  guardDepth += 1;
  if (guardDepth > 1) return;

  attempts = [];
  const globalObject = globalThis as unknown as MutableGlobal;
  originals = {
    fetch: globalObject.fetch,
    httpRequest: (http as unknown as Record<string, unknown>)["request"],
    httpGet: (http as unknown as Record<string, unknown>)["get"],
    httpsRequest: (https as unknown as Record<string, unknown>)["request"],
    httpsGet: (https as unknown as Record<string, unknown>)["get"],
  };

  globalObject.fetch = (input: unknown, init?: unknown) => {
    const url =
      typeof input === "string"
        ? input
        : (input as { url?: string } | null)?.url ?? String(input);
    const method = (init as { method?: string } | undefined)?.method ?? "GET";
    recordAttempt(url, method);
  };

  const blockHttp = (): never => recordAttempt("node:http", "REQUEST");
  const blockHttps = (): never => recordAttempt("node:https", "REQUEST");
  tryPatch(http, "request", blockHttp);
  tryPatch(http, "get", blockHttp);
  tryPatch(https, "request", blockHttps);
  tryPatch(https, "get", blockHttps);
}

/** Remove the live-network guard (reference-counted). */
export function uninstallNetworkGuard(): void {
  if (guardDepth === 0) return;
  guardDepth -= 1;
  if (guardDepth > 0) return;

  const globalObject = globalThis as unknown as MutableGlobal;
  if (originals) {
    if (originals.fetch) globalObject.fetch = originals.fetch;
    tryPatch(http, "request", originals.httpRequest);
    tryPatch(http, "get", originals.httpGet);
    tryPatch(https, "request", originals.httpsRequest);
    tryPatch(https, "get", originals.httpsGet);
  }
  originals = null;
}

/**
 * Run `fn` with the live-network guard installed, restoring it afterwards.
 *
 * Returns the function result together with every network attempt observed
 * during the run (which callers must assert is empty).
 */
export async function withNoNetwork<T>(
  fn: () => T | Promise<T>,
): Promise<{ result: T; attempts: NetworkAttempt[] }> {
  installNetworkGuard();
  try {
    const result = await fn();
    return { result, attempts: networkAttempts() };
  } finally {
    uninstallNetworkGuard();
  }
}

// ---------------------------------------------------------------------------
// Conformance contract
// ---------------------------------------------------------------------------

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

/** A structured manifest/publish/install issue. */
export interface MarketplaceIssue {
  field: string;
  message: string;
}

/** Outcome of a publish attempt. */
export interface PublishOutcome {
  name: string;
  version: string;
  published: boolean;
  issues: MarketplaceIssue[];
}

/** Outcome of an install attempt. */
export interface InstallOutcome {
  name: string;
  version: string;
  installed: boolean;
  /** Content-addressed ids of the assets registered into the local registry. */
  registeredAssets: string[];
  issues: MarketplaceIssue[];
}

/** Classification of a dependency conflict. */
export type VersionConflictKind =
  | "missing-dependency"
  | "incompatible-major"
  | "circular-dependency";

/** A detected dependency conflict. */
export interface VersionConflict {
  package: string;
  dependency: string;
  required: string;
  available: string[];
  kind: VersionConflictKind;
  message: string;
}

/**
 * The contract every Marketplace conformance target implements.
 *
 * F1's fixture-backed target satisfies it today; the production Marketplace
 * modules are expected to satisfy it as they land.
 */
export interface MarketplaceConformanceTarget {
  /** Deterministic category search with full listing metadata. */
  search(category: string): MarketplaceListing[];
  /** Publish a package directory (immutable on success). */
  publish(packageDir: string): PublishOutcome;
  /** Install a published package version, registering its assets. */
  install(name: string, version: string): InstallOutcome;
  /** Detect dependency conflicts declared by a package directory. */
  detectConflicts(packageDir: string): VersionConflict[];
  /** Deterministic, content-addressed snapshot of registered state. */
  installedSnapshot(): string;
}

// ---------------------------------------------------------------------------
// Conformance run
// ---------------------------------------------------------------------------

/** The scenarios the conformance runner exercises. */
export interface MarketplaceConformanceOptions {
  /** Category used for the search assertion. */
  searchCategory: string;
  /** The valid package that must publish and install. */
  validPackage: { name: string; version: string; dir: string };
  /** The invalid-manifest package that must be rejected on publish. */
  invalidPackageDir: string;
  /** Package directories whose dependency conflicts must be detected. */
  conflictPackageDirs: string[];
}

/** Structured result of a full conformance run. */
export interface MarketplaceConformanceReport {
  searchListings: MarketplaceListing[];
  publishAccepted: PublishOutcome;
  republishRejected: PublishOutcome;
  invalidPublishRejected: PublishOutcome;
  conflicts: VersionConflict[];
  install: InstallOutcome;
  reinstall: InstallOutcome;
  determinism: {
    /** True when re-install and a second target produce byte-identical state. */
    identical: boolean;
    snapshotA1: string;
    snapshotA2: string;
    snapshotB: string;
  };
  /** Live-network attempts observed during the run (must be empty). */
  networkAttempts: NetworkAttempt[];
  /** True when the run completed with no live network access. */
  offline: boolean;
}

/**
 * Run the five-behaviour Marketplace conformance suite against a target.
 *
 * @param createTarget - Factory producing an independent, fresh target. Called
 *   twice to prove cross-instance determinism.
 * @param options - Scenario description.
 */
export async function runMarketplaceConformance(
  createTarget: () => MarketplaceConformanceTarget,
  options: MarketplaceConformanceOptions,
): Promise<MarketplaceConformanceReport> {
  const { result, attempts: networkAttemptsSeen } = await withNoNetwork(() => {
    const targetA = createTarget();

    const searchListings = targetA.search(options.searchCategory);

    const publishAccepted = targetA.publish(options.validPackage.dir);
    const republishRejected = targetA.publish(options.validPackage.dir);
    const invalidPublishRejected = targetA.publish(options.invalidPackageDir);

    const conflicts = options.conflictPackageDirs.flatMap((dir) =>
      targetA.detectConflicts(dir),
    );

    const install = targetA.install(
      options.validPackage.name,
      options.validPackage.version,
    );
    const snapshotA1 = targetA.installedSnapshot();
    const reinstall = targetA.install(
      options.validPackage.name,
      options.validPackage.version,
    );
    const snapshotA2 = targetA.installedSnapshot();

    const targetB = createTarget();
    targetB.publish(options.validPackage.dir);
    targetB.install(options.validPackage.name, options.validPackage.version);
    const snapshotB = targetB.installedSnapshot();

    const core: Omit<MarketplaceConformanceReport, "networkAttempts" | "offline"> = {
      searchListings,
      publishAccepted,
      republishRejected,
      invalidPublishRejected,
      conflicts,
      install,
      reinstall,
      determinism: {
        identical:
          snapshotA1 === snapshotA2 && snapshotA1 === snapshotB,
        snapshotA1,
        snapshotA2,
        snapshotB,
      },
    };
    return core;
  });

  return {
    ...result,
    networkAttempts: networkAttemptsSeen,
    offline: networkAttemptsSeen.length === 0,
  };
}
