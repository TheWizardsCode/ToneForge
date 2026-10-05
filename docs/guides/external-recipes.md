---
title: "External Recipes: Registering ToneGraph Recipes from Outside the Repo"
id: external-recipes
order: 30
description: >
  Register ToneGraph recipe files that live outside the ToneForge repository so
  a separate `tf generate` process discovers them. Covers `tf library add`,
  `--destination`, the `TONEFORGE_RECIPE_DIR` environment variable, path
  resolution, idempotency, validation and listing.
---

## Overview

By default, `tf generate --recipe <name>` resolves recipes from two sources:

1. the built-in TypeScript recipes in `src/recipes/`, and
2. file-backed ToneGraph recipes in the repository's `presets/recipes/`
   directory.

`tf library add` extends this with an **external recipe directory** so tools and
build pipelines can register recipes without editing the ToneForge source tree.
The recipe is copied into the external directory, and every later `tf` process
discovers it alongside the baked-in recipes.

## Registering a recipe

```bash
# Persist to the default external directory (~/.toneforge/recipes/)
tf library add --file ./game-weapon.yaml

# Render it in a separate process
tf generate --recipe game-weapon --seed 42 --output ./game-weapon.wav
```

The recipe name is derived from the file name without its extension
(`game-weapon.yaml` → `game-weapon`). Use `--name <name>` to override it; the
persisted file is then written as `<name>.<ext>` so the separate process finds
it under the same name.

Inline and stdin inputs are persisted as YAML:

```bash
tf library add --inline "$(cat game-weapon.yaml)" --name game-weapon
tf library add --stdin --name game-weapon < game-weapon.yaml
```

## Choosing the destination directory

The destination is resolved in this order:

1. `--destination <dir>` — single-operation override.
2. `TONEFORGE_RECIPE_DIR` — environment variable.
3. `~/.toneforge/recipes/` — platform-agnostic default (uses the OS home
   directory).

```bash
tf library add --file ./game-weapon.yaml --destination ./project-recipes

TONEFORGE_RECIPE_DIR=./project-recipes tf library add --file ./game-weapon.yaml
```

### Path resolution

Both relative and absolute paths are supported for `--file`, `--destination`
and `TONEFORGE_RECIPE_DIR`:

- **Relative paths** are resolved against the current working directory.
- **Absolute paths** are used as-is.

`~` is **not** expanded by ToneForge; the shell expands it before the CLI runs.
The default (`~/.toneforge/recipes/`) is expanded programmatically using the OS
home directory, so it works on every platform.

## Idempotency and validation

- Re-registering the same recipe overwrites the persisted file and re-registers
  the recipe in-process — it never errors and never creates duplicates. The
  write is atomic (temp file + rename), so a concurrent `tf generate` never
  reads a partial file.
- Invalid recipe files (non-ToneGraph, schema-violating, or corrupt) are
  rejected with a clear, non-zero-exit error message. Validation happens
  **before** anything is written, so the external directory is left unchanged.
- Recipe names that contain path separators (e.g. `../escape`) are rejected so
  persistence can never write outside the destination directory.

## Listing externally registered recipes

`tf library list` lists the recipe catalogue (built-in, baked-in and external)
with each recipe's source directory and kind:

```bash
tf library list
tf library list --json
```

In JSON mode, the `recipes` array entries carry `source` (the directory) and
`external` (boolean). `externalRecipeCount` reports how many recipes came from
the external directory.

## How discovery works

`initializeRecipeRegistry()` scans the baked-in `presets/recipes/` directory
first and then the external directory. A recipe in the external directory with
the same name as a baked-in recipe **overrides** it. Discovery is a no-op in
browser runtimes; external directories are Node-only.
