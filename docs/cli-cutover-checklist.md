# CLI cutover checklist

This checklist tracks ownership of user-facing CLI commands after the yargs cutover.

## Command ownership matrix

| Command | Framework owner | Notes |
|---|---|---|
| `generate` | yargs (`src/cli.yargs.ts`) | Routed via yargs command module and delegated to proven runtime behavior. |
| `list` | yargs (`src/cli.yargs.ts`) | Supports text and JSON outputs through framework entrypoint. |
| `show` | yargs (`src/cli.yargs.ts`) | Help, text, and JSON flows validated. |
| `play` | yargs (`src/cli.yargs.ts`) | Uses existing playback runtime with framework routing. |
| `version` | yargs (`src/cli.yargs.ts`) | Flag and command paths covered. |
| `stack` | yargs (`src/cli.yargs.ts`) | `render` and `inspect` subcommands registered under framework. |
| `sequence` | yargs (`src/cli.yargs.ts`) | `generate`, `simulate`, `inspect` subcommands registered. |
| `analyze` | yargs (`src/cli.yargs.ts`) | Automation JSON contract path covered. |
| `classify` | yargs (`src/cli.yargs.ts`) | Includes nested `search` subcommand. |
| `explore` | yargs (`src/cli.yargs.ts`) | Includes `sweep`, `mutate`, `promote`, `show`, `runs`. |
| `library` | yargs (`src/cli.yargs.ts`) | Includes `list`, `search`, `similar`, `export`, `regenerate`. |
| `tui` | yargs (`src/cli.yargs.ts`) | Non-TTY guard behavior preserved. |

## Cutover validation gates

- [x] Framework command ownership matrix documented.
- [x] Top-level CLI entrypoint (`src/cli.ts`) routes through yargs.
- [x] Core parser/dispatcher moved out of canonical entrypoint (`src/cli.core.ts`).
- [x] Compatibility exports retained for test helpers (`truncateTags`).
- [x] Integration tests for yargs entrypoint exist and pass (`src/cli.yargs.integration.test.ts`).
- [x] Full test suite passes (`npm test`).

## Rollback guidance

If rollback is needed, point `src/cli.ts` back to the core `main()` export from `src/cli.core.ts` while preserving the yargs coverage tests for reattempt.
