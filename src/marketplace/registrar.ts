/**
 * Marketplace Asset Registrar
 *
 * Implements {@link MarketplaceAssetRegistrarWithDirectory} so that installed
 * packages are registered into the local recipe registry and tracked in the
 * library index store — both existing stores, extended rather than forked
 * (`docs/prd/MARKETPLACE_PRD.md` Sections 8.1, 10).
 *
 * For every installed asset:
 *
 * - a record is written to the library index store
 *   (`src/library/index-store.ts`) so the install is durable and inspectable
 *   alongside curated library entries;
 * - recipe assets are additionally loaded from disk, validated as ToneGraph
 *   documents, and registered as file-backed recipes into the shared
 *   `RecipeRegistry` (`src/core/recipe.ts`) — the same seam
 *   `discoverFileBackedRecipes` uses. This makes them immediately available to
 *   `toneforge generate --recipe <installed>`.
 *
 * Stack, sequence and palette assets are tracked in the library index but not
 * added to the recipe registry: the stack renderer resolves stack presets by
 * file path, and sequences/palettes are consumed by their own engines.
 *
 * The registrar is idempotent: re-registering overwrites the same recipe key,
 * library-index id and materialised recipe file, so re-installing a package is
 * reproducible.
 *
 * Recipe assets are additionally **materialised** into the external recipe
 * directory (`TONEFORGE_RECIPE_DIR`, else `~/.toneforge/recipes/`) so that a
 * *separate* `toneforge` process rediscovers them through
 * `initializeRecipeRegistry()` — the same durable seam `toneforge library add`
 * uses. Without this, an installed recipe would only exist in the installing
 * process's registry and `toneforge generate --recipe <installed>` would fail
 * in a new process.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 8.1, 10.
 */

import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, extname, resolve } from "node:path";

import { load as yamlLoad } from "js-yaml";

import type { RecipeRegistry } from "../core/recipe.js";
import {
  DEFAULT_EXTERNAL_RECIPE_SUBDIR,
  createFileBackedRegistration,
} from "../core/recipe.js";
import { validateToneGraph } from "../core/tonegraph-schema.js";
import {
  addRegisteredAssetSync,
} from "../library/index-store.js";
import { DEFAULT_LIBRARY_DIR } from "../library/types.js";

import type {
  MarketplaceAssetRegistrarWithDirectory,
  MarketplaceInstalledRecordWithPackageDirectory,
} from "./install.js";
import type { MarketplaceAssetKind } from "./types.js";

// ---------------------------------------------------------------------------
// Registrar factory
// ---------------------------------------------------------------------------

/** Construction options for {@link createRegistrar}. */
export interface RegistrarOptions {
  /**
   * Base directory for the library index store that tracks registered assets.
   * Defaults to the library module default (`.toneforge-library`).
   */
  libraryBaseDir?: string;
  /**
   * Directory installed recipe assets are materialised into so a separate
   * process rediscovers them through `initializeRecipeRegistry()`.
   *
   * Defaults to the external recipe directory: `TONEFORGE_RECIPE_DIR` when
   * set, else `~/.toneforge/recipes/` (the same precedence the recipe
   * discovery path uses). Tests pass a temp directory to stay isolated.
   */
  recipeDirectory?: string;
}

/**
 * Create a registrar that registers installed assets into the recipe registry
 * and records them in the library index store.
 *
 * @param recipeRegistry - The shared recipe registry to register recipes into.
 * @param options - Optional registrar configuration (library base directory).
 * @returns A {@link MarketplaceAssetRegistrarWithDirectory} implementation.
 */
export function createRegistrar(
  recipeRegistry: RecipeRegistry,
  options: RegistrarOptions = {},
): MarketplaceAssetRegistrarWithDirectory {
  const libraryBaseDir = options.libraryBaseDir ?? DEFAULT_LIBRARY_DIR;
  const recipeDirectory =
    options.recipeDirectory ?? resolveExternalRecipeDirectorySync();

  return {
    register(record: MarketplaceInstalledRecordWithPackageDirectory): void {
      for (const asset of record.assets) {
        // Track every asset kind in the library index (durable provenance).
        addRegisteredAssetSync(
          {
            kind: asset.kind,
            path: asset.path,
            contentHash: asset.contentHash,
            package: record.name,
            version: record.version,
            registry: record.provenance.registry,
          },
          libraryBaseDir,
        );

        // Recipes are additionally registered as renderable recipes.
        if (asset.kind === "recipes") {
          registerRecipeAsset(
            asset,
            record.packageDirectory,
            recipeDirectory,
            recipeRegistry,
          );
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// External recipe directory resolution (synchronous)
// ---------------------------------------------------------------------------

/**
 * Resolve the external recipe directory synchronously.
 *
 * Mirrors the precedence of the asynchronous
 * `resolveExternalRecipeDirectory()` in `src/core/recipe.ts` for the subset
 * the marketplace needs: `TONEFORGE_RECIPE_DIR` when set, else
 * `~/.toneforge/recipes/`. The registrar is synchronous (the install pipeline
 * is synchronous), so it cannot await the async resolver.
 */
function resolveExternalRecipeDirectorySync(
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env["TONEFORGE_RECIPE_DIR"]?.trim();
  if (override) return resolve(override);
  return resolve(homedir(), ...DEFAULT_EXTERNAL_RECIPE_SUBDIR);
}

// ---------------------------------------------------------------------------
// Recipe registration
// ---------------------------------------------------------------------------

/**
 * Register a single recipe asset as a file-backed recipe.
 *
 * @param asset - The content-addressed recipe asset.
 * @param packageDirectory - Absolute path to the installed package directory.
 * @param recipeDirectory - Discoverable external directory to materialise
 *   the recipe into.
 * @param recipeRegistry - The shared recipe registry.
 * @throws If the recipe cannot be read or is not a valid ToneGraph document.
 */
function registerRecipeAsset(
  asset: {
    kind: MarketplaceAssetKind;
    path: string;
    id: string;
    contentHash: string;
  },
  packageDirectory: string,
  recipeDirectory: string,
  recipeRegistry: RecipeRegistry,
): void {
  const filePath = `${packageDirectory}/${asset.path}`;

  let source: string;
  try {
    source = readFileSync(filePath, "utf-8");
  } catch (error) {
    throw new Error(
      `Unable to read recipe file ${asset.path}: ${(error as Error).message}`,
    );
  }

  const rawDoc = parseAsset(source, asset.path);
  const graph = validateToneGraph(rawDoc);
  const recipeName = recipeNameFromAsset(asset);

  // Materialise the recipe into the discoverable external directory so a
  // separate process can resolve it. This is the durable counterpart to the
  // in-process registration below and is idempotent (atomic overwrite of the
  // same bytes on re-install).
  const materialisedDirectory = materialiseRecipe(
    source,
    asset.path,
    recipeDirectory,
  );

  recipeRegistry.register(recipeName, {
    ...createFileBackedRegistration(recipeName, graph, rawDoc),
    sourceDirectory: materialisedDirectory,
    external: true,
  });
}

/**
 * Write a recipe document into the external recipe directory atomically.
 *
 * The contents are written to a temporary sibling file and renamed into place
 * so a concurrent reader (for example a separate `toneforge generate` process)
 * never observes a partial file. Re-materialising the same recipe overwrites
 * it cleanly, so re-installs do not duplicate registrations.
 *
 * @returns The destination directory, used as the registration's
 *   `sourceDirectory` so `library list` surfaces the discoverable location.
 * @throws If the destination cannot be created or written.
 */
function materialiseRecipe(
  source: string,
  assetPath: string,
  recipeDirectory: string,
): string {
  const destinationDirectory = resolve(recipeDirectory);
  const fileName = basename(assetPath);
  const destinationPath = resolve(destinationDirectory, fileName);
  const tempPath = `${destinationPath}.${process.pid}.${Date.now()}.tmp`;

  try {
    mkdirSync(destinationDirectory, { recursive: true });
    writeFileSync(tempPath, source, "utf-8");
    renameSync(tempPath, destinationPath);
  } catch (error) {
    try {
      rmSync(tempPath, { force: true });
    } catch {
      /* best-effort cleanup */
    }
    throw new Error(
      `Unable to materialise recipe ${fileName} into ${destinationDirectory}: ${(error as Error).message}`,
    );
  }

  return destinationDirectory;
}

/**
 * Parse an asset source string into a JSON/YAML document.
 *
 * The extension selects the parser; an unrecognised extension is treated as
 * JSON, matching the file-backed recipe discovery path.
 */
function parseAsset(source: string, assetPath: string): unknown {
  const ext = extname(assetPath).toLowerCase();

  if (ext === ".yaml" || ext === ".yml") {
    return yamlLoad(source);
  }

  return JSON.parse(source);
}

/**
 * Derive the registered recipe name from an asset path.
 *
 * Matches `discoverFileBackedRecipes`, which registers a file-backed recipe
 * under its base filename (without extension), so an installed recipe and an
 * equivalent locally authored file both resolve to the same name.
 */
function recipeNameFromAsset(asset: { id: string; path: string }): string {
  const parts = asset.path.split("/");
  const fileName = parts[parts.length - 1] ?? asset.id;
  return fileName.replace(/\.[^.]+$/, "");
}
