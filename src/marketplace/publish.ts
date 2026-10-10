/**
 * Marketplace publish pipeline.
 *
 * Implements `publish(packageDir, options)` — validates a package (manifest
 * schema, integrity, Validator quality gate, dependency resolution) and
 * publishes immutably to the registry. Republishing an existing version is
 * rejected with a structured, actionable error (`docs/prd/MARKETPLACE_PRD.md`
 * Sections 7, 9).
 *
 * ## Stages
 *
 * 1. **Manifest parse.** Read `manifest.json` from the package directory,
 *    parse and validate via {@link parseManifest}.
 * 2. **Asset integrity.** Verify every declared asset is inside the package
 *    directory, exists and is readable (no path traversal, no missing files).
 * 3. **Validator gate.** Delegate to the injected {@link MarketplaceValidator}.
 *    The default gate ({@link createManifestValidator}) re-checks the manifest
 *    schema and asserts every `.json` asset parses. The Demo 12 Validator
 *    plugs into the same seam via {@link createValidatorGate}.
 * 4. **Dependency resolution.** Use the F4 conflict detector
 *    ({@link detectConflicts}); reject on any unsatisfied dependency.
 * 5. **Immutability check.** Reject if the registry already contains
 *    `name@version`.
 * 6. **Register.** Append the entry to the registry index.
 *
 * The pipeline never mutates the package directory and only reaches the
 * registry after every gate passes — so an invalid package can never corrupt
 * the registry.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 7, 9, 13.
 */

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve, join } from "node:path";

import { parseManifest } from "./manifest.js";
import {
  detectConflicts,
  type DependencyProvider,
} from "./version.js";
import {
  createManifestValidator,
  type MarketplaceRegisteredAsset,
  type MarketplaceValidationRequest,
  type MarketplaceValidator,
} from "./install.js";
import type { MutableMarketplaceRegistry } from "./registry.js";
import type {
  MarketplaceAssetKind,
  MarketplaceIssue,
  MarketplaceManifest,
  MarketplaceRegistryEntry,
} from "./types.js";

// ---------------------------------------------------------------------------
// Publish options & outcome
// ---------------------------------------------------------------------------

/** Construction options for {@link publishPackage}. */
export interface MarketplacePublishOptions {
  /** Registry to publish into (local, remote or in-memory). */
  registry: MutableMarketplaceRegistry;
  /** Quality gate (default: {@link createManifestValidator}). */
  validator?: MarketplaceValidator;
  /**
   * Supplier of known package versions used to detect dependency conflicts.
   * When omitted the dependency gate is skipped.
   */
  dependencyProvider?: DependencyProvider;
}

/** Structured result of a publish attempt, matching the harness `PublishOutcome`. */
export interface MarketplacePublishResult {
  name: string;
  version: string;
  published: boolean;
  issues: MarketplaceIssue[];
}

// ---------------------------------------------------------------------------
// Deterministic string comparison
// ---------------------------------------------------------------------------

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True when `target` resolves inside (or is) `root`. */
function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel));
}

/** Count asset paths by kind, keyed by {@link MarketplaceAssetKind}. */
function countAssets(
  manifest: MarketplaceManifest,
): Record<MarketplaceAssetKind, number> {
  const counts = {} as Record<MarketplaceAssetKind, number>;
  for (const kind of ["recipes", "stacks", "sequences", "palettes"] as const) {
    counts[kind] = (manifest.assets[kind] ?? []).length;
  }
  return counts;
}

/** Verify every declared asset; return integrity-checked assets or issues. */
function verifyAssets(
  packageDir: string,
  manifest: MarketplaceManifest,
): { assets: MarketplaceRegisteredAsset[]; issues: MarketplaceIssue[] } {
  const root = resolve(packageDir);
  const assets: MarketplaceRegisteredAsset[] = [];
  const issues: MarketplaceIssue[] = [];
  const kinds = ["recipes", "stacks", "sequences", "palettes"] as const;

  for (const kind of kinds) {
    for (const path of manifest.assets[kind] ?? []) {
      const field = `${kind}/${path}`;
      const absolute = resolve(root, path);

      if (!isInside(root, absolute)) {
        issues.push({
          field,
          message: `asset path escapes the package directory: ${path}`,
        });
        continue;
      }
      if (!existsSync(absolute)) {
        issues.push({ field, message: "missing asset (integrity check failed)" });
        continue;
      }

      let content: Buffer;
      try {
        content = readFileSync(absolute);
      } catch (error) {
        issues.push({
          field,
          message: `unable to read asset: ${(error as Error).message}`,
        });
        continue;
      }

      const contentHash = createHash("sha256").update(content).digest("hex");
      const id = `${kind}:${path}`;

      assets.push({ kind, path, id, contentHash });
    }
  }

  // Deterministic sort by id.
  assets.sort((a, b) => compareStrings(a.id, b.id));

  return { assets, issues };
}

/**
 * Prove the package is deterministic: re-read and re-hash every verified
 * asset and assert the content hash is stable. A package whose bytes change
 * between reads cannot be published, because the registry would record a
 * content address that does not describe the published bytes
 * (`docs/prd/MARKETPLACE_PRD.md` Sections 7, 9).
 */
function verifyDeterminism(
  packageDir: string,
  assets: readonly MarketplaceRegisteredAsset[],
): MarketplaceIssue[] {
  const root = resolve(packageDir);
  const issues: MarketplaceIssue[] = [];

  for (const asset of assets) {
    const absolute = resolve(root, asset.path);
    let content: Buffer;
    try {
      content = readFileSync(absolute);
    } catch (error) {
      issues.push({
        field: asset.id,
        message: `determinism check failed (asset became unreadable): ${(error as Error).message}`,
      });
      continue;
    }
    const rehash = createHash("sha256").update(content).digest("hex");
    if (rehash !== asset.contentHash) {
      issues.push({
        field: asset.id,
        message: `determinism check failed (content hash changed between reads: ${asset.contentHash} -> ${rehash})`,
      });
    }
  }

  return issues;
}

/** Build a rejection result. */
function rejection(
  name: string,
  version: string,
  issues: MarketplaceIssue[],
): MarketplacePublishResult {
  return { name, version, published: false, issues };
}

/** Build a success result. */
function success(
  name: string,
  version: string,
): MarketplacePublishResult {
  return { name, version, published: true, issues: [] };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Publish a package directory into the registry.
 *
 * Validates the manifest, checks asset integrity, runs the quality gate,
 * resolves dependencies, enforces immutability and registers the package.
 *
 * @param packageDir - Directory containing `manifest.json` and `assets/`.
 * @param options - Registry, validator, dependency provider, registrar.
 * @returns A structured {@link MarketplacePublishResult}; never throws for
 *   expected rejections (invalid manifest, integrity failure, immutability).
 */
export function publishPackage(
  packageDir: string,
  options: MarketplacePublishOptions,
): MarketplacePublishResult {
  const validator = options.validator ?? createManifestValidator();

  // 1. Parse and validate manifest.
  const manifestFile = resolve(packageDir, "manifest.json");
  if (!existsSync(manifestFile)) {
    return rejection("unknown", "0.0.0", [
      { field: "manifest", message: `manifest not found: ${manifestFile}` },
    ]);
  }

  let raw: string;
  try {
    raw = readFileSync(manifestFile, "utf-8");
  } catch (error) {
    return rejection("unknown", "0.0.0", [
      { field: "manifest", message: `unable to read manifest: ${(error as Error).message}` },
    ]);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return rejection("unknown", "0.0.0", [
      { field: "manifest", message: "manifest is not valid JSON" },
    ]);
  }

  const parsed = parseManifest(decoded);
  if (!parsed.ok) {
    return rejection("unknown", "0.0.0", parsed.issues);
  }

  const name = parsed.manifest.name;
  const version = parsed.manifest.version;

  // 2. Asset integrity.
  const integrity = verifyAssets(packageDir, parsed.manifest);
  if (integrity.issues.length > 0) {
    return rejection(name, version, integrity.issues);
  }

  // 2b. Determinism check — prove asset reads are stable.
  const determinismIssues = verifyDeterminism(packageDir, integrity.assets);
  if (determinismIssues.length > 0) {
    return rejection(name, version, determinismIssues);
  }

  // 3. Validator gate (quality gate — default manifest validator, pluggable).
  const validationRequest: MarketplaceValidationRequest = {
    manifest: parsed.manifest,
    directory: resolve(packageDir),
    assets: integrity.assets,
  };
  const validationIssues = validator.validate(validationRequest);
  if (validationIssues.length > 0) {
    return rejection(name, version, validationIssues);
  }

  // 4. Dependency resolution (F4) — reject unsatisfiable dependencies.
  if (options.dependencyProvider) {
    const conflicts = detectConflicts(
      {
        name,
        version,
        dependencies: parsed.manifest.dependencies,
      },
      options.dependencyProvider,
    );
    if (conflicts.length > 0) {
      return rejection(
        name,
        version,
        conflicts.map((conflict) => ({
          field: `dependencies.${conflict.dependency}`,
          message: conflict.message,
        })),
      );
    }
  }

  // 5. Immutability — reject if already published.
  if (options.registry.has(name, version)) {
    return rejection(name, version, [
      {
        field: "version",
        message: `immutable: ${name}@${version} is already published`,
      },
    ]);
  }

  // 6. Register.
  const assetCounts = countAssets(parsed.manifest);
  const entry: MarketplaceRegistryEntry = {
    name,
    version,
    type: parsed.manifest.type,
    category: parsed.manifest.category ?? "unclassified",
    author: parsed.manifest.author,
    license: parsed.manifest.license,
    rating: 0,
    path: packageDir,
    assets: assetCounts,
  };

  try {
    options.registry.register(entry);
  } catch (error) {
    return rejection(name, version, [
      { field: "registry", message: `failed to register: ${(error as Error).message}` },
    ]);
  }

  return success(name, version);
}
