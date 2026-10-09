/**
 * Marketplace install pipeline.
 *
 * Orchestrates `install(name@version)` end-to-end for the Marketplace slice
 * (work item TF-0MUZX3YKC002LZYB):
 *
 * ```
 * fetch -> integrity check -> validation gate -> register assets
 *       -> version lock + provenance
 * ```
 *
 * The pipeline is deterministic and offline: it depends only on an injected
 * {@link MarketplaceRegistry} (the local, directory-backed adapter in the
 * demo) and never performs network I/O. Every stage is pure with respect to
 * the registry; the only side effect is the visited
 * {@link MarketplaceInstallStateStore} and the optional
 * {@link MarketplaceAssetRegistrar}, and both are reached **only after** the
 * package has passed integrity and validation — so an invalid package or an
 * integrity failure can never partially register local state
 * (`docs/prd/MARKETPLACE_PRD.md` Sections 7, 8.1, 10).
 *
 * ## Stages
 *
 * 1. **Fetch.** Resolve `name@version` through the registry. Unknown packages
 *    and structured registry failures become field-addressed issues.
 * 2. **Integrity.** For every asset the manifest declares, verify the path is
 *    safe (never escapes the package directory), the file exists and is
 *    readable, and — when the bundle declares an expected content hash —
 *    that the computed SHA-256 matches. Content is always hashed so the
 *    registered state is content-addressed and reproducible.
 * 3. **Validation.** Delegate to the injected {@link MarketplaceValidator}.
 *    The default gate ({@link createManifestValidator}) re-checks the manifest
 *    schema and asserts every JSON asset parses. The Demo 12 Validator plugs
 *    into the same seam via {@link createValidatorGate}, so the install and
 *    publish pipelines share one quality gate.
 * 4. **Register.** Persist a content-addressed installed record (assets,
 *    provenance, exact locked version) and offer it to the optional registrar
 *    (the F8 hook into the library/recipe registry).
 *
 * Re-installing the same version is idempotent: the record is content-addressed
 * with no timestamps and the state is normalised (packages by name, assets by
 * id), so identical registry state yields byte-identical
 * {@link serializeInstallState} output.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 7, 8.1, 10, 13.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import type { InstallOutcome } from "./harness.js";
import { parseManifest } from "./manifest.js";
import { MarketplaceRegistryError } from "./registry.js";
import type { MarketplaceRegistry } from "./registry.js";
import { detectConflicts, type DependencyProvider } from "./version.js";
import {
  MARKETPLACE_ASSET_KINDS,
  type MarketplaceAssetKind,
  type MarketplaceIssue,
  type MarketplaceManifest,
  type MarketplacePackageBundle,
  type MarketplaceProvenance,
} from "./types.js";

/** Schema version of the persisted {@link MarketplaceInstallState}. */
export const MARKETPLACE_INSTALL_STATE_VERSION = "1.0";

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

/** A content-addressed asset registered by a successful install. */
export interface MarketplaceRegisteredAsset {
  /** Asset kind (`recipes`, `stacks`, `sequences`, `palettes`). */
  kind: MarketplaceAssetKind;
  /** Asset path relative to the package directory. */
  path: string;
  /** Content-addressed id: `${kind}:${path}`. */
  id: string;
  /** Lowercase hex SHA-256 of the asset's bytes. */
  contentHash: string;
}

/** A package recorded by a successful install (version lock + provenance). */
export interface MarketplaceInstalledRecord {
  name: string;
  version: string;
  provenance: MarketplaceProvenance;
  assets: MarketplaceRegisteredAsset[];
}

/** Root of the local install state (version lock + provenance + assets). */
export interface MarketplaceInstallState {
  version: string;
  packages: MarketplaceInstalledRecord[];
}

/**
 * Persistence seam for the local install state.
 *
 * The production CLI uses a file-backed store ({@link createFileInstallStateStore});
 * tests use an in-memory one ({@link createInMemoryInstallStateStore}). The
 * contract is intentionally small so a future store (a project-local index,
 * a library-integrated store) can implement it without touching the pipeline.
 */
export interface MarketplaceInstallStateStore {
  load(): MarketplaceInstallState;
  save(state: MarketplaceInstallState): void;
}

/**
 * Registration seam into the local library/recipe registry.
 *
 * Wired by F8 (`TF-0MUZX3ZIU008KIXL`); the pipeline itself only persists
 * marketplace install state and offers the record here. Implementations must
 * be idempotent for a given record (re-install is reproducible).
 *
 * The registrar is called with the installed record **before** the state
 * store is updated, so an idempotent registrar can safely handle re-installs
 * (the record is the same on every pass).
 */
export interface MarketplaceAssetRegistrar {
  register(record: MarketplaceInstalledRecord): void;
}

/**
 * Augmented installed record that includes the package directory.
 *
 * The registrar factory receives this so it can resolve asset file paths.
 */
export interface MarketplaceInstalledRecordWithPackageDirectory
  extends MarketplaceInstalledRecord {
  /** Absolute path to the installed package directory. */
  packageDirectory: string;
}

/**
 * Registration seam that also receives the package directory.
 *
 * This extended interface is used by the pipeline to give registrars
 * access to the installed asset files on disk.
 */
export interface MarketplaceAssetRegistrarWithDirectory {
  register(record: MarketplaceInstalledRecordWithPackageDirectory): void;
}

// ---------------------------------------------------------------------------
// Validation gate
// ---------------------------------------------------------------------------

/** Everything a quality gate needs to validate a fetched package. */
export interface MarketplaceValidationRequest {
  manifest: MarketplaceManifest;
  /** Absolute package directory (for gates that inspect asset files). */
  directory: string;
  /** Content-addressed assets that passed the integrity check. */
  assets: readonly MarketplaceRegisteredAsset[];
}

/**
 * The Marketplace quality gate.
 *
 * This is the seam the Demo 12 Validator plugs into: an install/publish caller
 * supplies a gate (for example via {@link createValidatorGate}) and the
 * pipeline delegates to it before any local registration.
 */
export interface MarketplaceValidator {
  /** Return every field-addressed issue (empty means the package passes). */
  validate(request: MarketplaceValidationRequest): MarketplaceIssue[];
}

/** The plain-function shape of {@link MarketplaceValidator} (Demo 12 seam). */
export type MarketplaceValidatorFunction = (
  request: MarketplaceValidationRequest,
) => MarketplaceIssue[];

/** Adapt a plain validation function into a {@link MarketplaceValidator}. */
export function createValidatorGate(
  validate: MarketplaceValidatorFunction,
): MarketplaceValidator {
  return { validate };
}

// ---------------------------------------------------------------------------
// Install options & result
// ---------------------------------------------------------------------------

/** Construction options for {@link installPackage}. */
export interface MarketplaceInstallOptions {
  /** Registry the package is fetched from (injected; offline in the demo). */
  registry: MarketplaceRegistry;
  /** Persistence for version lock + provenance (default: in-memory). */
  stateStore?: MarketplaceInstallStateStore;
  /** Quality gate (default: {@link createManifestValidator}). */
  validator?: MarketplaceValidator;
  /**
   * Supplier of known package versions used to detect dependency conflicts
   * (the F4 resolver). When omitted the dependency gate is skipped; callers
   * that own a registry index (for example the CLI, F7) pass one so an
   * unsatisfiable dependency is rejected before registration.
   */
  dependencyProvider?: DependencyProvider;
  /**
   * Optional registration hook into the library/recipe registry (F8).
   *
   * Accepts both the basic registrar (for backwards compatibility) and the
   * directory-aware variant so installers that need to resolve asset files
   * on disk can do so without changing the pipeline contract.
   */
  registrar?: MarketplaceAssetRegistrar;
  /**
   * Optional registration hook that also receives the package directory
   * so it can resolve installed asset files on disk (F8 extended seam).
   */
  registrarWithDirectory?: MarketplaceAssetRegistrarWithDirectory;
  /** Registry name recorded in provenance (default: `"local"`). */
  registryName?: string;
}

/** Structured result of an install attempt. */
export interface MarketplaceInstallResult {
  name: string;
  version: string;
  installed: boolean;
  /** Exact locked version, or `null` when the install was rejected. */
  lockedVersion: string | null;
  /** Recorded provenance, or `null` when the install was rejected. */
  provenance: MarketplaceProvenance | null;
  /** Content-addressed assets registered on success (empty on rejection). */
  registeredAssets: MarketplaceRegisteredAsset[];
  /** Every field-addressed issue; empty on success. */
  issues: MarketplaceIssue[];
}

// ---------------------------------------------------------------------------
// Deterministic ordering & normalisation
// ---------------------------------------------------------------------------

/** Deterministic, locale-independent string comparison (code-point order). */
function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Order assets by id. */
function compareAssets(
  a: MarketplaceRegisteredAsset,
  b: MarketplaceRegisteredAsset,
): number {
  return compareStrings(a.id, b.id);
}

/** Rebuild an asset with a fixed key order (stable serialisation). */
function normaliseAsset(
  asset: MarketplaceRegisteredAsset,
): MarketplaceRegisteredAsset {
  return {
    kind: asset.kind,
    path: asset.path,
    id: asset.id,
    contentHash: asset.contentHash,
  };
}

/** Rebuild a provenance record with a fixed key order. */
function normaliseProvenance(
  provenance: MarketplaceProvenance,
): MarketplaceProvenance {
  return {
    name: provenance.name,
    version: provenance.version,
    author: provenance.author,
    license: provenance.license,
    registry: provenance.registry,
  };
}

/** Rebuild an installed record with deterministic asset ordering. */
function normaliseRecord(
  record: MarketplaceInstalledRecord,
): MarketplaceInstalledRecord {
  return {
    name: record.name,
    version: record.version,
    provenance: normaliseProvenance(record.provenance),
    assets: [...record.assets].map(normaliseAsset).sort(compareAssets),
  };
}

/**
 * Deep-copy and canonically order an install state: packages by name then
 * version, assets by id. Deterministic for identical registry state, which is
 * what makes re-installs byte-identical.
 */
export function normaliseInstallState(
  state: MarketplaceInstallState,
): MarketplaceInstallState {
  const packages = [...state.packages]
    .map(normaliseRecord)
    .sort(
      (a, b) => compareStrings(a.name, b.name) || compareStrings(a.version, b.version),
    );
  return {
    version: state.version || MARKETPLACE_INSTALL_STATE_VERSION,
    packages,
  };
}

/** Canonical JSON serialisation of an install state (byte-stable). */
export function serializeInstallState(state: MarketplaceInstallState): string {
  return JSON.stringify(normaliseInstallState(state));
}

// ---------------------------------------------------------------------------
// State stores
// ---------------------------------------------------------------------------

/** An empty, current-version install state. */
function emptyInstallState(): MarketplaceInstallState {
  return { version: MARKETPLACE_INSTALL_STATE_VERSION, packages: [] };
}

/** Coerce a decoded JSON value into an install state, or throw. */
function coerceInstallState(value: unknown): MarketplaceInstallState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("install state must be a JSON object");
  }
  const source = value as Record<string, unknown>;
  if (!Array.isArray(source.packages)) {
    throw new Error("install state packages must be an array");
  }
  return normaliseInstallState({
    version:
      typeof source.version === "string"
        ? source.version
        : MARKETPLACE_INSTALL_STATE_VERSION,
    packages: source.packages as MarketplaceInstalledRecord[],
  });
}

/**
 * An in-memory {@link MarketplaceInstallStateStore}.
 *
 * Values are deep-copied on load/save so callers can never mutate the stored
 * state by reference.
 */
export function createInMemoryInstallStateStore(
  initial?: MarketplaceInstallState,
): MarketplaceInstallStateStore {
  let state = normaliseInstallState(initial ?? emptyInstallState());
  return {
    load: () => normaliseInstallState(state),
    save: (next) => {
      state = normaliseInstallState(next);
    },
  };
}

/**
 * A file-backed {@link MarketplaceInstallStateStore}.
 *
 * Reads a missing file as empty state and writes canonical JSON so re-saving
 * an unchanged state is byte-identical. A malformed file throws rather than
 * silently discarding installed state.
 */
export function createFileInstallStateStore(
  file: string,
): MarketplaceInstallStateStore {
  return {
    load(): MarketplaceInstallState {
      if (!existsSync(file)) return emptyInstallState();
      const raw = readFileSync(file, "utf-8");
      return coerceInstallState(JSON.parse(raw));
    },
    save(state: MarketplaceInstallState): void {
      const normalised = normaliseInstallState(state);
      writeFileSync(file, `${JSON.stringify(normalised, null, 2)}\n`, "utf-8");
    },
  };
}

// ---------------------------------------------------------------------------
// Integrity
// ---------------------------------------------------------------------------

/** True when `target` resolves inside (or is) `root`. */
function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel));
}

/** Result of the integrity stage. */
interface IntegrityOutcome {
  assets: MarketplaceRegisteredAsset[];
  issues: MarketplaceIssue[];
}

/** The declared expected hash for an asset, if the bundle provides one. */
function expectedHash(
  bundle: MarketplacePackageBundle,
  kind: MarketplaceAssetKind,
  path: string,
): string | undefined {
  if (!bundle.integrity) return undefined;
  return bundle.integrity[path] ?? bundle.integrity[`${kind}:${path}`];
}

/**
 * Verify every declared asset without mutating anything.
 *
 * Fails closed: a path that escapes the package directory, an absent or
 * unreadable asset, or a declared-hash mismatch yields a field-addressed
 * issue and no registration.
 */
function verifyIntegrity(bundle: MarketplacePackageBundle): IntegrityOutcome {
  const root = resolve(bundle.directory);
  const assets: MarketplaceRegisteredAsset[] = [];
  const issues: MarketplaceIssue[] = [];

  for (const kind of MARKETPLACE_ASSET_KINDS) {
    const paths = bundle.manifest.assets[kind] ?? [];
    for (const path of paths) {
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
      const expected = expectedHash(bundle, kind, path);
      if (expected !== undefined && expected.toLowerCase() !== contentHash) {
        issues.push({
          field,
          message: `content hash mismatch for ${path} (expected ${expected}, computed ${contentHash})`,
        });
        continue;
      }

      assets.push({ kind, path, id: `${kind}:${path}`, contentHash });
    }
  }

  return { assets: assets.sort(compareAssets), issues };
}

// ---------------------------------------------------------------------------
// Default quality gate
// ---------------------------------------------------------------------------

/**
 * The default {@link MarketplaceValidator}.
 *
 * Re-runs the manifest schema validation (defence in depth — a registry may
 * hand back an already-parsed manifest) and asserts every `.json` asset parses.
 * A malformed asset can therefore never be registered. Textual non-JSON assets
 * (for example YAML) are passed through untouched: their format is owned by
 * the asset kind, not this gate.
 */
export function createManifestValidator(): MarketplaceValidator {
  return {
    validate({ manifest, directory, assets }) {
      const issues: MarketplaceIssue[] = [];

      const parsed = parseManifest(manifest);
      if (!parsed.ok) {
        for (const issue of parsed.issues) {
          issues.push({ field: issue.field, message: issue.message });
        }
      }

      for (const asset of assets) {
        const absolute = resolve(directory, asset.path);
        if (!absolute.endsWith(".json")) continue;
        try {
          JSON.parse(readFileSync(absolute, "utf-8"));
        } catch {
          issues.push({
            field: asset.id,
            message: "asset is not valid JSON",
          });
        }
      }

      return issues;
    },
  };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/** Fetch a bundle, converting registry failures into structured issues. */
function fetchBundle(
  registry: MarketplaceRegistry,
  name: string,
  version: string,
): { bundle?: MarketplacePackageBundle; issues: MarketplaceIssue[] } {
  try {
    const bundle = registry.fetch(name, version);
    if (!bundle) {
      return {
        issues: [
          {
            field: "package",
            message: `package not found in registry: ${name}@${version}`,
          },
        ],
      };
    }
    return { bundle, issues: [] };
  } catch (error) {
    if (error instanceof MarketplaceRegistryError) {
      return {
        issues:
          error.issues.length > 0
            ? error.issues.map(({ field, message }) => ({ field, message }))
            : [{ field: "manifest", message: error.message }],
      };
    }
    return {
      issues: [{ field: "package", message: (error as Error).message }],
    };
  }
}

/** Build a rejected install result carrying the issues seen so far. */
function rejection(
  name: string,
  version: string,
  issues: MarketplaceIssue[],
): MarketplaceInstallResult {
  return {
    name,
    version,
    installed: false,
    lockedVersion: null,
    provenance: null,
    registeredAssets: [],
    issues,
  };
}

/**
 * Install a published package version.
 *
 * Fetches `name@version`, verifies content-hash integrity, runs the quality
 * gate, then records the content-addressed assets, provenance and exact locked
 * version. Registration side effects happen only after every gate passes.
 *
 * @param name - Package name.
 * @param version - Exact semantic version to lock.
 * @param options - Registry, state store, validator and registrar.
 * @returns A structured {@link MarketplaceInstallResult}; never throws for
 *   expected rejections (unknown package, invalid manifest, integrity or
 *   validation failure).
 */
export function installPackage(
  name: string,
  version: string,
  options: MarketplaceInstallOptions,
): MarketplaceInstallResult {
  const stateStore =
    options.stateStore ?? createInMemoryInstallStateStore();
  const validator = options.validator ?? createManifestValidator();
  const registryName = options.registryName ?? "local";

  // 1. Fetch.
  const fetched = fetchBundle(options.registry, name, version);
  if (!fetched.bundle) return rejection(name, version, fetched.issues);
  const bundle = fetched.bundle;

  if (bundle.name !== name || bundle.version !== version) {
    return rejection(name, version, [
      {
        field: "package",
        message: `registry returned ${bundle.name}@${bundle.version} for requested ${name}@${version}`,
      },
    ]);
  }

  // 2. Integrity (no side effects).
  const integrity = verifyIntegrity(bundle);
  if (integrity.issues.length > 0) {
    return rejection(name, version, integrity.issues);
  }

  // 3. Validation gate (no side effects).
  const validationIssues = validator.validate({
    manifest: bundle.manifest,
    directory: resolve(bundle.directory),
    assets: integrity.assets,
  });
  if (validationIssues.length > 0) {
    return rejection(name, version, validationIssues);
  }

  // 3b. Dependency resolution (F4) — reject unsatisfiable dependencies before
  // anything is registered. Opt-in: the caller must supply a version provider.
  if (options.dependencyProvider) {
    const conflicts = detectConflicts(
      {
        name,
        version,
        dependencies: bundle.manifest.dependencies,
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

  // 4. Register. This is the first — and only — side-effecting stage.
  const provenance: MarketplaceProvenance = {
    name,
    version,
    author: bundle.manifest.author,
    license: bundle.manifest.license,
    registry: registryName,
  };
  const record: MarketplaceInstalledRecord = {
    name,
    version,
    provenance,
    assets: integrity.assets,
  };

  // Enrich the record with the package directory for directory-aware registrars.
  const recordWithDir: MarketplaceInstalledRecordWithPackageDirectory = {
    ...record,
    packageDirectory: resolve(bundle.directory),
  };

  try {
    // Call the extended registrar first (it has more context), then the basic
    // registrar for backwards compatibility with older implementations.
    options.registrarWithDirectory?.register(recordWithDir);
    options.registrar?.register(record);
  } catch (error) {
    return rejection(name, version, [
      {
        field: "registration",
        message: `asset registration failed: ${(error as Error).message}`,
      },
    ]);
  }

  const state = normaliseInstallState(stateStore.load());
  const packages = state.packages.filter((pkg) => pkg.name !== name);
  packages.push(normaliseRecord(record));
  stateStore.save(
    normaliseInstallState({
      version: MARKETPLACE_INSTALL_STATE_VERSION,
      packages,
    }),
  );

  return {
    name,
    version,
    installed: true,
    lockedVersion: version,
    provenance,
    registeredAssets: integrity.assets,
    issues: [],
  };
}

/** Project an install result onto the conformance harness `InstallOutcome`. */
export function toInstallOutcome(
  result: MarketplaceInstallResult,
): InstallOutcome {
  return {
    name: result.name,
    version: result.version,
    installed: result.installed,
    registeredAssets: result.registeredAssets.map((asset) => asset.id),
    issues: result.issues,
  };
}
