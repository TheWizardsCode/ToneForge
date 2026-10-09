# Marketplace usage

The ToneForge Marketplace is an exchange for **procedural assets** — recipes,
stacks, sequences and palettes — distributed as versioned, license-declared,
Validated bundles rather than static audio. Installing a package registers its
assets into the local library so the procedural content is reproducible at its
original quality: one install yields infinite deterministic variation.

This guide covers the three `toneforge marketplace` commands:

- [`search`](#search) — browse listings by category;
- [`install`](#install) — fetch, verify, validate and register a package;
- [`publish`](#publish) — validate and immutably publish a package.

For the authoritative product specification — the asset model, licensing and
provenance rules, validation gate, versioning semantics and determinism
guarantees — see [`docs/prd/MARKETPLACE_PRD.md`](../prd/MARKETPLACE_PRD.md).
For the demo narrative see the
[Demo 16 roadmap](../prd/DEMO_ROADMAP.md#demo-16-marketplace----asset-exchange).

## Concepts

| Term | Meaning |
|---|---|
| **Package** | A directory bundle: `manifest.json` plus an `assets/` tree of textual, regenerable definitions. No binaries, no executable code. |
| **Manifest** | The declarative `manifest.json` describing name, semver version, type, author, license, dependencies and contained assets. |
| **Asset kinds** | `recipes`, `stacks`, `sequences`, `palettes` (the demo scope; the manifest `type` is extensible to the wider PRD list later). |
| **Registry** | A pluggable catalogue of published packages. The demo ships an offline, directory-backed registry; a remote adapter can implement the same interface. |
| **License & provenance** | Every package declares an explicit license and author; install records provenance (name, version, author, license, registry) alongside a version lock. |
| **Validator gate** | Publish and install run manifest/schema, integrity, dependency, determinism and (through the Demo 12 seam) quality checks. Invalid packages are rejected, never imported. |

### Registry location

The CLI resolves its registry in this order:

1. `TONEFORGE_MARKETPLACE_DIR` — an explicit registry root, when set;
2. `./.toneforge-marketplace` — a project-local registry, when it contains
   `registry/index.json`;
3. the bundled demo registry under
   `src/test-utils/fixtures/marketplace` — read-only reference data so
   `search` and `install` work out of the box.

A registry root holds `registry/index.json` plus a `packages/` tree of package
directories. Point `TONEFORGE_MARKETPLACE_DIR` at a writable directory before
publishing (the bundled demo registry is intended to stay pristine).

```bash
# Optional: use your own registry root instead of the bundled demo registry.
export TONEFORGE_MARKETPLACE_DIR=./.toneforge-marketplace
```

## search

`toneforge marketplace search [--category <c>] [--json]`

Search returns deterministic, metadata-rich listings: `name@version`, author,
contained asset counts by kind, rating and license. Identical registry state
always yields identical output.

```bash
toneforge marketplace search --category combat
```

```text
Marketplace Results: "combat"
Found 2 packages.
  plasma_rifles@1.4.2 by StudioX — 1 recipes, 1 stacks — 4.2/5
  version_conflict@1.0.0 by StudioX — 1 stacks — 3.3/5
```

Add `--json` for the machine-readable contract:

```bash
toneforge marketplace search --category ui --json
```

```json
{
  "command": "marketplace search",
  "category": "ui",
  "count": 1,
  "listings": [
    {
      "name": "ui_chimes",
      "version": "1.0.0",
      "author": "StudioX",
      "license": "mit",
      "category": "ui",
      "rating": 4.1,
      "assets": { "recipes": 1, "stacks": 0, "sequences": 0, "palettes": 1 },
      "label": "ui_chimes@1.0.0"
    }
  ]
}
```

An omitted `--category` returns every package; `category` is then `null` in the
JSON result and the text header reads `all categories`. A search with no
matches exits `0` with an empty `listings` array (`count: 0`).

## install

`toneforge marketplace install <package>@<version> [--json]`

Install fetches the package, verifies asset integrity, runs the validation
gate, resolves dependencies, registers the contained assets into the local
library and the active recipe registry, records provenance, and locks the
installed version. The version argument is required and must be an exact
semver (`name@MAJOR.MINOR.PATCH`).

```bash
toneforge marketplace install ui_chimes@1.0.0
```

```text
Installed ui_chimes@1.0.0 (2 assets registered)
Registered recipes: assets/recipes/ui-chime
```

The `--json` contract reports the outcome, the locked version and every
registered asset (content-addressed by SHA-256):

```bash
toneforge marketplace install plasma_rifles@1.4.2 --json
```

```json
{
  "command": "marketplace install",
  "name": "plasma_rifles",
  "version": "1.4.2",
  "installed": true,
  "lockedVersion": "1.4.2",
  "registeredAssets": [
    {
      "kind": "recipes",
      "id": "recipes:assets/recipes/plasma-burst.json",
      "contentHash": "261f86bcf7cebe1d1d60e83255b2b815eeae3ec2dd7e7c6eac1fd19c3ae76359"
    },
    {
      "kind": "stacks",
      "id": "stacks:assets/stacks/plasma-rifle.json",
      "contentHash": "d5c7ffdf917628150ab119ad723fb904b31c9167c3e6c1e797f9da688c508fe8"
    }
  ],
  "issues": []
}
```

Rejections are structured and actionable. A rejected install exits `1` and
returns `installed: false`, `lockedVersion: null` and one or more
field-addressed `issues`:

```bash
toneforge marketplace install version_conflict@1.0.0
```

```text
Install failed for version_conflict@1.0.0: version_conflict requires "core>=3.0" but available versions (1.0.0) do not satisfy it
```

An unknown package or an unknown version is reported the same way with an
`issues` entry naming the package/version.

## publish

`toneforge marketplace publish --package <dir> --name <n> --version <v> [--json]`

Publish validates a package directory before registering it: manifest schema,
asset integrity, determinism, dependency resolution,
and the Validator quality gate. Invalid packages are rejected with structured
errors and **no** registry mutation. Published versions are **immutable** —
re-publishing `name@version` is rejected; ship a new version instead.

| Option | Meaning |
|---|---|
| `--package <dir>` | Package directory containing `manifest.json` and `assets/` (required). |
| `--name <n>` | Package name; must match `manifest.json` (required). |
| `--version <v>` | Exact package semver; must match `manifest.json` (required). |
| `--json` | Emit the structured result as JSON. |

Publish into a writable registry (see [Registry location](#registry-location));
the example below publishes a package you authored under `./my-package`:

```bash
toneforge marketplace publish \
  --package ./my-package --name my_package --version 1.0.0
```

```text
Published my_package@1.0.0
```

```bash
toneforge marketplace publish \
  --package ./my-package --name my_package --version 1.0.0 --json
```

```json
{
  "command": "marketplace publish",
  "name": "my_package",
  "version": "1.0.0",
  "published": true,
  "issues": []
}
```

A one-off runnable example seeds a fresh writable registry from the bundled
demo package:

```bash
mkdir -p .toneforge-marketplace/registry .toneforge-marketplace/packages
echo '{"version":"1.0","packages":[],"installed":[]}' \
  > .toneforge-marketplace/registry/index.json
cp -r src/test-utils/fixtures/marketplace/packages/industrial_lasers \
  .toneforge-marketplace/packages/
export TONEFORGE_MARKETPLACE_DIR=./.toneforge-marketplace
toneforge marketplace publish \
  --package ./.toneforge-marketplace/packages/industrial_lasers \
  --name industrial_lasers --version 2.1.0
# Published industrial_lasers@2.1.0
```

A rejected publish exits `1` and reports the offending fields:

```text
Publish failed for industrial_lasers@2.1.0: immutable: industrial_lasers@2.1.0 is already published
```

`--name`/`--version` are required and must agree with the package manifest —
the manifest is authoritative, so a mismatch is rejected before anything is
written:

```text
{"error":"--name/--version must match manifest.json (industrial_lasers@2.1.0), got wrong@2.1.0."}
```

## Authoring a package

A package is a directory with a `manifest.json` and an `assets/` tree. Paths in
`assets` are relative to the package directory.

```jsonc
// manifest.json
{
  "name": "industrial_lasers",
  "version": "2.1.0",              // semver MAJOR.MINOR.PATCH
  "type": "stack",                 // primary asset type
  "category": "combat",            // registry/search metadata (optional)
  "description": "Heavy industrial laser weapons.",
  "author": "StudioX",             // attribution (required)
  "license": "commercial",         // explicit license declaration (required)
  "dependencies": ["core>=1.0"],
  "assets": {
    "recipes":   ["assets/recipes/il-heavy-cannon.json"],
    "stacks":    ["assets/stacks/il-weapon-burst.json"],
    "sequences": ["assets/sequences/il-laser-sequence.json"],
    "palettes":  ["assets/palettes/il-dust-palette.json"]
  }
}
```

Recipe assets are ToneGraph documents and are validated when installed so
they can be registered and rendered:

```jsonc
// assets/recipes/il-heavy-cannon.json
{
  "version": "0.1",
  "meta": {
    "name": "il-heavy-cannon",
    "description": "Heavy industrial laser cannon.",
    "category": "Weapon",
    "tags": ["marketplace", "laser", "cannon"],
    "duration": 0.85
  },
  "nodes": {
    "osc": { "kind": "oscillator", "params": { "type": "sine", "frequency": 220 } },
    "gain": { "kind": "gain", "params": { "gain": 0.6 } },
    "out": { "kind": "destination" }
  },
  "routing": [{ "chain": ["osc", "gain", "out"] }]
}
```

The manifest must satisfy the Marketplace schema: a valid semver `version`, a
non-empty `author` and `license`, dependency requirement strings, and an
`assets` object with every asset kind (empty arrays are allowed). Malformed
manifests are rejected on both publish and install with field-addressed
errors.

## License & provenance

- Every package declares an explicit `license` (for example `commercial`,
  `mit`, `internal`) and an `author`; there is no implicit license.
- Dependency license compatibility is part of the PRD's licensing model
  ([`MARKETPLACE_PRD.md` §6](../prd/MARKETPLACE_PRD.md#6-licensing--provenance)).
- Installing records provenance — package name, exact locked version, author,
  license and the registry it came from — so the origin of every asset is
  auditable and inspectable. Nothing is hidden or executable.

## Versioning & conflicts

The Marketplace enforces semantic versioning:

- **patch** — bug fixes; **minor** — backward-compatible improvements;
  **major** — breaking changes.
- Published versions are **immutable**; updates arrive as new versions and are
  **opt-in**, never forced.
- Install and publish resolve the dependency graph before registering and
  reject:
  - **missing-dependency** — the package requires a dependency available in no
    version;
  - **incompatible-major** — versions exist but none satisfies the requirement;
  - **circular-dependency** — the graph contains a cycle.

```text
Install failed for version_conflict@1.0.0: version_conflict requires "core>=3.0" but available versions (1.0.0) do not satisfy it
```

## Determinism

Installed assets are content-addressed and deterministic: assets are sorted
before registration, re-installs are idempotent, and identical registry state
produces identical listings. The same seed renders byte-identical output, so a
recipe authored locally and the same recipe installed from a package behave
identically.

Install also **materialises** recipe assets into the discoverable external
recipe directory (`TONEFORGE_RECIPE_DIR` when set, else
`~/.toneforge/recipes/`) — the same location `toneforge library add` writes
to. A separate `toneforge` process therefore rediscovers installed recipes
through the normal file-backed recipe path, so the documented post-install
workflow works:

```bash
toneforge marketplace install ui_chimes@1.0.0
toneforge generate --recipe ui-chime --seed 42   # resolves in a new process
toneforge stack render --preset ./assets/stacks/plasma-rifle.json --seed 42 --output out.wav
```

Materialisation is atomic (temporary file + rename) and idempotent: a
re-install overwrites the same bytes, so cross-process discovery never sees a
partial file and never duplicates a registration.

## Programmatic use

The Marketplace module is exported from `src/marketplace/index.ts`:

```js
import {
  createLocalRegistry,
  installPackage,
  publishPackage,
} from "./marketplace/index.js";

const registry = createLocalRegistry({
  indexFile: "./.toneforge-marketplace/registry/index.json",
  root: "./.toneforge-marketplace",
});

const result = installPackage("industrial_lasers", "2.1.0", { registry });
```

The registry is an injectable `MarketplaceRegistry` interface, so tests and
offline mirrors use the local directory adapter while a remote adapter can
delegate to the Network module later.

## Related documentation

- [`docs/prd/MARKETPLACE_PRD.md`](../prd/MARKETPLACE_PRD.md) — authoritative
  Marketplace specification.
- [`docs/prd/DEMO_ROADMAP.md` §Demo 16](../prd/DEMO_ROADMAP.md#demo-16-marketplace----asset-exchange) — demo narrative.
- [`docs/guides/external-recipes.md`](external-recipes.md) — authoring and
  loading external recipes.
- [`docs/guides/ci-integration.md`](ci-integration.md) — the non-interactive
  `toneforge pipeline` workflow.
