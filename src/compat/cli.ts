// Compatibility shim between the legacy hand-rolled CLI and the yargs-based CLI.
// Exports a programmatic `main(argv)` that delegates to the yargs runner for
// migrated commands and falls back to the legacy `main` for everything else.

export async function main(argv: string[] = process.argv): Promise<number> {
  // Detect explicit command from argv[2]
  const cmd = argv[2];

  // Commands that have been migrated to yargs and are safe to route to
  const migrated = new Set(["generate", "list", "show", "play", "version"]);

  // By default keep using the legacy CLI to preserve test stability. To opt in
  // to the new yargs runner for migrated commands set the environment
  // variable `TONEFORGE_USE_YARGS=1` (used during targeted migration).
  const useYargs = process.env.TONEFORGE_USE_YARGS === "1";

  // Only delegate to yargs when explicitly enabled AND an explicit command
  // matches a migrated command. This keeps behavior identical for top-level
  // flags like `--help` and `--version` when invoked without a command
  // (those continue to use the legacy path).
  if (useYargs && typeof cmd === "string" && migrated.has(cmd)) {
    try {
      const mod = await import("./cli.yargs.js");
      if (typeof mod.yargsMain === "function") {
        return await mod.yargsMain(argv);
      }
      // Fallback to non-zero exit to indicate failure to locate yargsMain
      return 1;
    } catch (err) {
      // If yargs runner throws, surface a non-zero exit code
      return 1;
    }
  }

  // Otherwise delegate to the legacy main implementation to preserve exact
  // behavioral parity with existing tests and programmatic consumers.
  try {
    const legacy = await import("./cli.js");
    if (typeof legacy.main === "function") {
      return await legacy.main(argv);
    }
    return 1;
  } catch (err) {
    return 1;
  }
}

export default main;
