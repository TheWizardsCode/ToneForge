CLI library evaluation for ToneForge
=================================

This document compares candidate Node CLI libraries and recommends a path for replacing the hand-rolled CLI in ToneForge.

Repo constraints and goals
- Preserve the current exported `cli` signature that tests import (compiled) from the top-level entry so tests require minimal changes.
- Provide subcommands, unified help, parsing, and good DX for contributors.
- Keep runtime overhead small and make migration incremental where possible.

Candidates evaluated
- oclif
- yargs
- commander
- cac
- ink

1) oclif
Pros:
- Full-featured CLI framework with command scaffolding, plugin support, and conventions for large CLIs.
- Batteries-included: help, completion, command discovery, testing helpers.

Cons:
- Heavier-weight and more opinionated; standard oclif projects use a specific layout and build step.
- Migration likely requires reorganising commands into the oclif layout and adopting oclif tooling.
- Adds additional build/runtime dependencies and a steeper learning curve for contributors unfamiliar with oclif.

When to choose:
- If ToneForge becomes a very large CLI with many plugins and needs oclif plugin ecosystem, otherwise it is overkill.

2) yargs
Pros:
- Mature, widely-used, and feature-rich: subcommands, nested commands, command modules, middleware, completion, and strong TypeScript support.
- Excellent programmatic API — can build commands in plain JS/TS and call handlers programmatically. That makes preserving an exported `cli` function easy.
- Good balance of features vs minimalism; familiar to many Node developers.

Cons:
- Slightly more configuration/boilerplate than tiny libs, but still straightforward.

When to choose:
- When you want a robust, flexible CLI with good TypeScript experience and an easy migration path while keeping the current programmatic export.

3) commander
Pros:
- Very lightweight and simple API; excellent for small-to-medium CLIs.
- Good programmatic API and terse command definitions.
- Works well with TypeScript when used with types.

Cons:
- Fewer built-in opinionated features than yargs (less middleware, fewer advanced parsing helpers); some patterns require manual wiring.

When to choose:
- For a small, straightforward CLI where minimal footprint and simplicity matter. Migration is simple, but some conveniences (e.g., command modules with isolated builders) are easier in yargs.

4) cac
Pros:
- Minimal, modern CLI library with a small footprint and programmatic API.
- Good DX and simple to wire into existing codebases.

Cons:
- Less widely used than yargs/commander; smaller ecosystem and fewer examples.

When to choose:
- When you want something compact and modern and are comfortable with a smaller community.

5) ink
Pros:
- Great for interactive, React-style terminal UIs.

Cons:
- Not a replacement for a command parser — orthogonal. Use ink for TUI components only (e.g. interactive prompts/menus), not for core parsing/migration.

Recommendation
- Pick yargs.

Rationale:
- Yargs offers the best balance of maturity, flexibility, and programmatic usage. It supports command modules and programmatic invocation which allows us to preserve the existing exported `cli`/handler signature that tests rely on. Yargs has broad adoption, stable TypeScript typings, and built-in conveniences (completion, middleware) that reduce migration work compared to adopting an opinionated framework like oclif.

Migration plan (high-level)
This plan is designed to be incremental and low-risk. Keep the top-level exported API used by tests stable by adding a small glue layer that maps the old export to the new yargs-based command handlers.

Steps:
1. Add `yargs` and types: `npm install yargs` and `npm install -D @types/yargs` (if needed). Prefer the native TS types shipped with modern yargs.
2. Create a `src/cli/` directory to house yargs command modules. For each current command (generate, start, etc.) create a corresponding command module that exports a handler and a builder function. Example file: `src/cli/commands/generate.ts`.
3. Implement a small programmatic entry in `src/cli/index.ts` that composes yargs programmatically and registers the command modules.
   - Example pattern (pseudo):

```ts
import yargs from 'yargs'
import {hideBin} from 'yargs/helpers'
import generateCommand from './commands/generate'

export function cli(argv = process.argv.slice(2)) {
  return yargs(hideBin(['node', 'node', ...argv]))
    .command(generateCommand)
    .help()
    .strict()
    .parse()
}
```

4. Preserve exported signature: if the repo currently exports a function named `cli` or similar from a compiled entry used in tests, ensure the new `src/cli/index.ts` exports the same function name and call signature.
   - If current top-level entry `bin` uses a small wrapper that loads `src/cli` via `tsx` and re-exports, keep that wrapper and point it to the new `cli` function.
5. Replace existing argument parsing in the top-level bin script with a tiny loader that calls `cli(process.argv)` so runtime behavior remains unchanged.
6. Update package.json `bin` entry and npm scripts if necessary. Ensure running `node ./bin/cli` or `npm run start` uses compiled path or `tsx` loader as before.
7. Add integration tests that exercise top-level command entrypoints and verify outputs and exit codes. Keep snapshots/adapters used by tests unchanged where possible by keeping the export stable.
8. Iterate: convert and test each command module one-by-one. This allows incremental PRs per command and small, reviewable changes.

Minimal code shim to preserve tests
- If tests import compiled `cli` function from dist, provide a thin adapter that re-exports from the canonical entrypoint (`src/cli.ts`) to keep import paths stable during migration.

Risk notes
- Tests that import the compiled output via exact file paths may need their import paths adjusted or preserved with compatibility shims. Avoid changing compiled entrypoints until command modules are fully wired.
- Breaking change risk is highest if the exported `cli` signature (parameters or return shape) changes. Keep signature backwards compatible.
- oclif or other opinionated frameworks increase migration complexity and reviewer effort; choose yargs to minimise disruption.

Effort estimate
- Discovery / small POC: low — 2–4 hours to wire a single command using yargs and verify tests can still import the exported function.
- Full migration (convert all commands, update tests, add integration tests, update docs): medium — 12–24 hours. This assumes 3–6 commands and minor test updates.
- If more extensive refactoring is needed (many commands, deep test coupling to parsed args), estimate high — 2–3 days (16–24 hours) plus review time.

Acceptance checklist
- [ ] Add `yargs` to dependencies and create `src/cli` with at least one command module as POC.
- [ ] Provide compatibility shim to preserve exported `cli` signature.
- [ ] Run tests and update import paths only where necessary.

Appendix: example generate command (sketch)

```ts
// src/cli/commands/generate.ts
export default {
  command: 'generate <name>',
  describe: 'Generate a new project or template',
  builder: (yargs) => yargs.positional('name', {type: 'string'}),
  handler: async (argv) => {
    // existing implementation moved here
  }
}
```

Next steps
1. Create a small POC branch that wires `yargs` and converts one command (TF-0MMJ8H4QF0YDO4WX).
