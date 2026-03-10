#!/usr/bin/env node

import { yargsMain } from "./cli.yargs.js";
export { truncateTags } from "./cli.core.js";

export async function main(argv: string[] = process.argv): Promise<number> {
  return yargsMain(argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}
