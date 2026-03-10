#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
// Allow dynamic import of built artifacts; TypeScript can't statically verify these paths
// so declare a minimal ambient type for the dynamic module to satisfy tsc.
type LegacyCore = { main?: (argv?: string[]) => Promise<number> };

export const FRAMEWORK_COMMANDS = [
  "generate",
  "list",
  "show",
  "play",
  "version",
  "stack",
  "sequence",
  "analyze",
  "classify",
  "explore",
  "library",
  "tui",
];

const MIGRATED_COMMANDS = new Set(FRAMEWORK_COMMANDS);

async function runLegacy(argv: string[]): Promise<number> {
  // Legacy core was removed as part of cleanup. Use a runtime-safe dynamic import
  // which will attempt to load a built artifact if present under dist/, otherwise
  // short-circuit with an explanatory error code.
  // We must avoid static import errors during tsc. Use dynamic import with a relative
  // path that Node.js can resolve at runtime. TypeScript will still check the import
  // at compile time, so instead we construct the path string dynamically to keep tsc
  // from trying to type-check the module.

  // Prefer loading the source sibling during test runs so that test-time mocks
  // (vitest/vi.mock) and module identity match the modules imported by tests.
  const builtPath = "../dist/cli.core.js";
  const runtimePath = "./cli.core.js";

  // Prefer the source sibling by default so runtime module identity aligns
  // with test mocks and source imports. Falling back to dist only if the
  // sibling is not present keeps runtime behavior predictable during dev/test.
  const tryPaths = [runtimePath, builtPath];

  for (const p of tryPaths) {
    try {
      const coreMod = await import(p as string);
      const core = (coreMod as unknown) as LegacyCore;
      // Avoid calling back into our own migrated yargsMain shim which would
      // create a recursive loop (cli.yargs -> runLegacy -> cli.core.js ->
      // yargsMain -> runLegacy ...). If the imported module's main is the
      // same function reference as our yargsMain, skip it.
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (typeof core.main === "function") {
        // runtime comparison — treat as any to avoid TS errors
        if ((core.main as any) === (yargsMain as any)) continue;
        return await core.main(argv);
      }
    } catch {
      // ignore and try next path
    }
  }

  // No legacy core available — return a nonzero exit code and print a helpful message
  // (when running in-process the caller may capture stderr). Returning 127 indicates
  // missing command support.
  // eslint-disable-next-line no-console
  console.error("Legacy CLI core not found. Please ensure the project is built or use the yargs commands.");
  return 127;
}

function makeLegacyHandler(raw: string[], commandPrefix: string[] = []): () => Promise<number> {
  return async () => {
    return runLegacy(["node", "cli.ts", ...commandPrefix, ...raw.slice(commandPrefix.length)]);
  };
}

export async function yargsMain(argv: string[] = process.argv): Promise<number> {
  const raw = hideBin(argv);
  const command = raw[0];

  if (raw.includes("--help") || raw.includes("-h") || raw.includes("--version") || raw.includes("-V")) {
    return runLegacy(argv);
  }

  if (typeof command !== "string" || !MIGRATED_COMMANDS.has(command)) {
    return runLegacy(argv);
  }

  const y = yargs(raw).scriptName("toneforge");
  let exitCode: number | undefined;

  // When used programmatically we must avoid yargs calling process.exit().
  // Disable automatic exiting and let the caller decide how to handle exit codes.
  y.exitProcess(false);
  y.strictCommands();
  y.parserConfiguration({ "unknown-options-as-args": true });
  y.showHelpOnFail(false);
  y.fail((msg, err) => {
    throw err ?? new Error(msg ?? "yargs parse failed");
  });

  y.command("generate", false, () => {}, async () => {
    exitCode = await makeLegacyHandler(raw)();
  });
  y.command("list [resource]", false, () => {}, async () => {
    exitCode = await makeLegacyHandler(raw)();
  });
  y.command("show <recipe>", false, () => {}, async () => {
    exitCode = await makeLegacyHandler(raw)();
  });
  y.command("play <file>", false, () => {}, async () => {
    exitCode = await makeLegacyHandler(raw)();
  });
  y.command("version", false, () => {}, async () => {
    exitCode = await makeLegacyHandler(raw)();
  });
  y.command(
    "stack <subcommand>",
    false,
    (cmd) => cmd
      .command("render", false, () => {}, () => {})
      .command("inspect", false, () => {}, () => {}),
    async () => {
      exitCode = await makeLegacyHandler(raw)();
    },
  );
  y.command(
    "sequence <subcommand>",
    false,
    (cmd) => cmd
      .command("generate", false, () => {}, () => {})
      .command("simulate", false, () => {}, () => {})
      .command("inspect", false, () => {}, () => {}),
    async () => {
      exitCode = await makeLegacyHandler(raw)();
    },
  );
  y.command("analyze", false, () => {}, async () => {
    exitCode = await makeLegacyHandler(raw)();
  });
  y.command(
    "classify [subcommand]",
    false,
    (cmd) => cmd.command("search", false, () => {}, () => {}),
    async () => {
      exitCode = await makeLegacyHandler(raw)();
    },
  );
  y.command(
    "explore <subcommand>",
    false,
    (cmd) => cmd
      .command("sweep", false, () => {}, () => {})
      .command("mutate", false, () => {}, () => {})
      .command("promote", false, () => {}, () => {})
      .command("show", false, () => {}, () => {})
      .command("runs", false, () => {}, () => {}),
    async () => {
      exitCode = await makeLegacyHandler(raw)();
    },
  );
  y.command(
    "library <subcommand>",
    false,
    (cmd) => cmd
      .command("list", false, () => {}, () => {})
      .command("search", false, () => {}, () => {})
      .command("similar", false, () => {}, () => {})
      .command("export", false, () => {}, () => {})
      .command("regenerate", false, () => {}, () => {}),
    async () => {
      exitCode = await makeLegacyHandler(raw)();
    },
  );
  y.command("tui", false, () => {}, async () => {
    exitCode = await makeLegacyHandler(raw)();
  });

  try {
    await y.parse();
    if (typeof exitCode === "number") {
      return exitCode;
    }
    return runLegacy(argv);
  } catch (err) {
    // Preserve legacy UX and machine output for any parse edge cases.
    return runLegacy(argv);
  }
}

// If executed directly, run yargsMain
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await yargsMain();
}
