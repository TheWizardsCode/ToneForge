import type { Arguments } from "yargs";
import { outputInfo, outputTable } from "../../output.js";
import { registry } from "../../recipes/index.js";

export const command = "list [resource]";
export const desc = "List available resources";

export function builder(yargs: any) {
  return yargs
    .positional("resource", {
      type: "string",
      describe: "Resource type to list (e.g. recipes)",
      default: "recipes",
    })
    .option("search", { type: "string", describe: "Search filter" })
    .option("category", { type: "string", describe: "Filter by category" })
    .option("tags", { type: "string", describe: "Filter by tags" })
    .option("json", { type: "boolean", describe: "Output JSON" });
}

export async function handler(argv: Arguments) {
  const resource = argv.resource as string | undefined;
  const jsonMode = argv.json === true;

  if ((resource || "recipes") === "recipes") {
    const names = registry.list();
    if (jsonMode) {
      // For now, just print JSON list
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ command: "list", resource: "recipes", names }, null, 2));
      return 0;
    }

    outputInfo("Available recipes:");
    for (const n of names) {
      outputInfo(`- ${n}`);
    }
    return 0;
  }

  // Unknown resource
  outputInfo(`Unknown resource: ${resource}`);
  return 1;
}

export default { command, desc, builder, handler };
