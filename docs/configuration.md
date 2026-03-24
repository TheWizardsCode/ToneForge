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
