/**
 * Marketplace package manifest parsing and schema validation.
 *
 * Validates the declarative, versioned package manifest deterministically
 * before any asset is published or installed, with no runtime dependency: the
 * manifest shape is checked in TypeScript (`docs/prd/MARKETPLACE_PRD.md`
 * Sections 4, 5, 7, 13).
 *
 * Two pure entry points are exposed:
 *
 * - {@link validateManifest} checks a decoded manifest value and returns every
 *   structured, field-addressed issue (an empty array means valid).
 * - {@link parseManifest} validates the value and, on success, returns a fully
 *   typed {@link MarketplaceManifest}.
 *
 * Both functions accept `unknown` and never throw on malformed input, and both
 * are pure: the input is never mutated. `parse -> validate` is idempotent.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 4, 5, 7, 13.
 */

import {
  MARKETPLACE_ASSET_KINDS,
  type ManifestIssue,
  type ManifestIssueCode,
  type ManifestParseResult,
  type MarketplaceManifest,
  type MarketplaceManifestAssets,
} from "./types.js";

/**
 * Strict semantic-version pattern: `MAJOR.MINOR.PATCH`, each a run of digits.
 *
 * Deliberately shape-only — comparison and range compatibility are owned by
 * the versioning module (F4). Pre-release/build metadata and abbreviated
 * versions such as `1.0` are rejected here.
 */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/** True when `value` is a non-empty (non-whitespace) string. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** True when `value` is a plain object (not `null`, not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when the field is absent, `null` or `undefined`. */
function isAbsent(source: Record<string, unknown>, field: string): boolean {
  return source[field] === undefined || source[field] === null;
}

/** Build a structured manifest issue. */
function issue(
  field: string,
  code: ManifestIssueCode,
  message: string,
): ManifestIssue {
  return { field, code, message };
}

/** Validate a required non-empty string field, appending any issue found. */
function requireNonEmptyString(
  source: Record<string, unknown>,
  field: string,
  issues: ManifestIssue[],
): void {
  if (isAbsent(source, field)) {
    issues.push(issue(field, "missing", `${field} is required`));
  } else if (!isNonEmptyString(source[field])) {
    issues.push(
      issue(field, "invalid", `${field} must be a non-empty string`),
    );
  }
}

/** Validate the dependency requirement list, appending any issue found. */
function validateDependencies(
  source: Record<string, unknown>,
  issues: ManifestIssue[],
): void {
  if (isAbsent(source, "dependencies")) {
    issues.push(
      issue(
        "dependencies",
        "missing",
        "dependencies is required (use [] when there are none)",
      ),
    );
    return;
  }
  const dependencies = source.dependencies;
  if (!Array.isArray(dependencies)) {
    issues.push(
      issue("dependencies", "invalid", "dependencies must be an array"),
    );
    return;
  }
  dependencies.forEach((dependency, index) => {
    if (!isNonEmptyString(dependency)) {
      issues.push(
        issue(
          `dependencies[${index}]`,
          "invalid",
          "dependency must be a non-empty requirement string",
        ),
      );
    }
  });
}

/** Validate the per-kind asset inventory, appending any issue found. */
function validateAssets(
  source: Record<string, unknown>,
  issues: ManifestIssue[],
): void {
  if (isAbsent(source, "assets")) {
    issues.push(issue("assets", "missing", "assets inventory is required"));
    return;
  }
  const assets = source.assets;
  if (!isRecord(assets)) {
    issues.push(
      issue("assets", "invalid", "assets must be an object keyed by asset kind"),
    );
    return;
  }
  for (const kind of MARKETPLACE_ASSET_KINDS) {
    const field = `assets.${kind}`;
    if (isAbsent(assets, kind)) {
      issues.push(
        issue(field, "missing", `${field} is required (use [] when empty)`),
      );
      continue;
    }
    const paths = assets[kind];
    if (!Array.isArray(paths)) {
      issues.push(issue(field, "invalid", `${field} must be an array of paths`));
      continue;
    }
    paths.forEach((path, index) => {
      if (!isNonEmptyString(path)) {
        issues.push(
          issue(
            `assets.${kind}[${index}]`,
            "invalid",
            "asset path must be a non-empty string",
          ),
        );
      }
    });
  }
}

/**
 * Validate a decoded manifest value.
 *
 * Never throws and never mutates `input`. Returns every issue found — each
 * naming its offending `field` — or an empty array when the value is a valid
 * manifest.
 *
 * @param input - A decoded JSON value (typically `JSON.parse` output).
 */
export function validateManifest(input: unknown): ManifestIssue[] {
  if (!isRecord(input)) {
    return [issue("manifest", "invalid", "manifest must be a JSON object")];
  }

  const issues: ManifestIssue[] = [];

  requireNonEmptyString(input, "name", issues);

  if (isAbsent(input, "version")) {
    issues.push(issue("version", "missing", "version is required"));
  } else if (
    typeof input.version !== "string" ||
    !SEMVER_PATTERN.test(input.version)
  ) {
    issues.push(
      issue(
        "version",
        "invalid",
        `version "${String(input.version)}" is not semver MAJOR.MINOR.PATCH`,
      ),
    );
  }

  requireNonEmptyString(input, "type", issues);
  requireNonEmptyString(input, "author", issues);
  requireNonEmptyString(input, "license", issues);

  validateDependencies(input, issues);
  validateAssets(input, issues);

  return issues;
}

/**
 * Parse a decoded manifest value into a typed manifest.
 *
 * Validates via {@link validateManifest}; on success returns `{ ok: true,
 * manifest }` carrying every declared field (the asset inventory normalised to
 * all {@link MARKETPLACE_ASSET_KINDS}). On failure returns `{ ok: false,
 * issues }` with the same structured errors and no manifest.
 *
 * The returned manifest round-trips: `parseManifest(manifest)` yields an
 * identical manifest and `validateManifest(manifest)` reports no issues.
 *
 * @param input - A decoded JSON value (typically `JSON.parse` output).
 */
export function parseManifest(input: unknown): ManifestParseResult {
  const issues = validateManifest(input);
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  // `validateManifest` has proven the shape, so these reads are safe.
  const source = input as Record<string, unknown>;
  const assetsSource = source.assets as Record<string, unknown>;

  const assets = {} as MarketplaceManifestAssets;
  for (const kind of MARKETPLACE_ASSET_KINDS) {
    assets[kind] = [...(assetsSource[kind] as string[])];
  }

  const manifest: MarketplaceManifest = {
    name: source.name as string,
    version: source.version as string,
    type: source.type as string,
    author: source.author as string,
    license: source.license as string,
    dependencies: [...(source.dependencies as string[])],
    assets,
  };
  if (typeof source.category === "string") manifest.category = source.category;
  if (typeof source.description === "string") {
    manifest.description = source.description;
  }

  return { ok: true, manifest, issues: [] };
}
