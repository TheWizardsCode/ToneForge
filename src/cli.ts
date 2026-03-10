#!/usr/bin/env node

import { yargsMain } from "./cli.yargs.js";
// keep truncateTags exported for tests and downstream consumers — implementation moved to dist after build
// Previously exported from src/cli.core.ts; now no-op placeholder to preserve API until release.
export function truncateTags(..._args: unknown[]): string {
  // This placeholder signals that the real implementation is in the built dist files.
  // Tests import this symbol from `src/cli.ts` during unit runs, but runtime JS imports use dist/.
  return "";
}

export async function main(argv: string[] = process.argv): Promise<number> {
  return yargsMain(argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}
