# Marketplace conformance fixtures

Deterministic, offline **package fixtures** consumed by the Marketplace
conformance harness (`src/marketplace/harness.ts`) and its suite
(`src/marketplace/conformance.test.ts`). This is the test-first foundation for
the Marketplace slice (work item TF-0MUZX3XAI003S1GN); every later Marketplace
feature loads its inputs through the typed helpers in
`src/test-utils/marketplace-fixtures.ts` rather than reaching into the
filesystem directly.

Nothing here touches the network. The registry is a directory-backed, local
catalogue; it is the **only** backend the conformance harness uses.

## Layout

```
marketplace/
├── registry/index.json          # published listings + installed state
└── packages/
    ├── industrial_lasers/       # valid package (published and installed by the suite)
    ├── plasma_rifles/           # valid, seeded in the registry (combat)
    ├── ui_chimes/               # valid, seeded in the registry (ui)
    ├── version_conflict/        # valid manifest, unmet `core>=3.0` dependency
    ├── missing_dependency/      # valid manifest, unknown dependency
    └── broken_manifest/         # invalid manifest (rejected on publish)
```

Each package is a directory bundle (`docs/prd/MARKETPLACE_PRD.md` §5, §9):
a `manifest.json` plus an `assets/` tree of textual, regenerable definitions.

## Fixtures

| Fixture | Purpose |
|---------|---------|
| `industrial_lasers@2.1.0` | The **valid publishable** package. The suite publishes it, then installs it and asserts every asset is registered. |
| `broken_manifest` | The **invalid-manifest** package: malformed semver (`1.0`), missing license and empty author. Publishing it must be rejected with structured field errors. |
| `version_conflict@1.0.0` | Declares `core>=3.0` while `core@1.0.0` is installed — an **incompatible-major** conflict. |
| `missing_dependency@1.0.0` | Declares `does_not_exist>=1.0`, which is in neither the registry nor the installed state — a **missing-dependency** conflict. |
| `plasma_rifles@1.4.2`, `ui_chimes@1.0.0` | Seeded listings used to prove deterministic, metadata-rich category search. |

## Schema

```jsonc
// manifest.json
{
  "name": "industrial_lasers",
  "version": "2.1.0",              // semver MAJOR.MINOR.PATCH
  "type": "stack",
  "category": "combat",            // registry metadata (optional)
  "author": "StudioX",
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

```jsonc
// registry/index.json
{
  "version": "1.0",
  "packages": [
    {
      "name": "plasma_rifles",
      "version": "1.4.2",
      "type": "stack",
      "category": "combat",
      "author": "StudioX",
      "license": "commercial",
      "rating": 4.2,
      "path": "packages/plasma_rifles",
      "assets": { "recipes": 1, "stacks": 1, "sequences": 0, "palettes": 0 }
    }
  ],
  "installed": [{ "name": "core", "version": "1.0.0" }]
}
```

## Determinism

The registry lists packages in a stable order and the harness sorts search
results by name then version, so identical registry state yields identical
output. Install registration is content-addressed (SHA-256 of every asset) and
the suite asserts a re-install and a second, independent target produce
byte-identical registered state.

Keep these files hand-edited and read-only from engine code: a regression in a
Marketplace stage must never silently rewrite its own expected input.

## Reference

`docs/prd/MARKETPLACE_PRD.md` Sections 4 (what can be shared), 5 (asset model),
7 (validation), 9–13 (publishing, consumption, versioning, determinism).
