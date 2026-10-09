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
 * The registrar is idempotent: re-registering overwrites the same recipe key
 * and library-index id, so re-installing a package is reproducible.
 *
 * Reference: docs/prd/MARKETPLACE_PRD.md Sections 8.1, 10.
 */

import { readFileSync } from "node:fs";
import { extname } from "node:path";

import { load as yamlLoad } from "js-yaml";

import type { RecipeRegistry } from "../core/recipe.js";
import { createFileBackedRegistration } from "../core/recipe.js";
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
          registerRecipeAsset(asset, record.packageDirectory, recipeRegistry);
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Recipe registration
// ---------------------------------------------------------------------------

/**
 * Register a single recipe asset as a file-backed recipe.
 *
 * @param asset - The content-addressed recipe asset.
 * @param packageDirectory - Absolute path to the installed package directory.
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

  recipeRegistry.register(recipeName, {
    ...createFileBackedRegistration(recipeName, graph, rawDoc),
    sourceDirectory: packageDirectory,
    external: true,
  });
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
