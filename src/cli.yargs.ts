#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

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
  const legacy = await import("./cli.legacy.js");
  if (typeof legacy.main !== "function") {
    return 1;
  }
  return legacy.main(argv);
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
