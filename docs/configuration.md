Configuration: .toneforge/config.yaml

Location
- Place the repository-level configuration at `.toneforge/config.yaml` in the repository root.

Schema
- The loader accepts either a top-level mapping of prefix → category or an object with a
  `prefixToCategory` mapping. Example (recommended):

```yaml
prefixToCategory:
  ui: "User Interface"
  perf: "Performance"
  build: "Build System"
```

Behavior
- The classifier lazy-loads this file on first use and caches the parsed mapping.
- Loaded mappings are normalized and merged with built-in defaults; repository mappings override
  defaults for matching prefixes.
- If the config file is missing the code emits a single console warning (once per process).
- A malformed config root (for example, a YAML array at the top level) causes the loader to
  throw so CI/tests fail fast.

When to update
- Add or adjust prefix→category mappings here to change classification behavior without
  modifying TypeScript sources.

Preset directory overrides (sequences, stacks)
- `toneforge list sequences` and `toneforge list stacks` scan a preset directory that
  can be pointed at an alternative location. The directory is resolved in this order:

  1. `--dir <path>` — explicit override for a single invocation.
  2. `TONEFORGE_SEQUENCES_DIR` / `TONEFORGE_STACKS_DIR` — environment override.
  3. the repository default (`presets/sequences` / `presets/stacks`).

- Relative paths are resolved against the current working directory; absolute paths are
  used as-is. This mirrors the `TONEFORGE_RECIPE_DIR` pattern used for external recipes.
- Files whose basename begins with `__` are treated as test/temp artefacts and are
  skipped by preset discovery, so a leaked or in-flight fixture cannot fail the command.
- Examples:

```sh
# Explicit directory for one invocation
toneforge list sequences --dir ./my-presets --json

# Environment override for a whole shell session
export TONEFORGE_SEQUENCES_DIR=./my-presets
toneforge list sequences --json

# Stacks use a separate variable
export TONEFORGE_STACKS_DIR=./my-stacks
toneforge list stacks --json
```
