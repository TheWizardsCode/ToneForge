import type { Arguments } from "yargs";
import { registry } from "../../recipes/index.js";
import { createRng } from "../../core/rng.js";
import { outputInfo, outputError } from "../../output.js";

export const command = "show <name>";
export const desc = "Show recipe metadata";

export function builder(yargs: any) {
  return yargs.positional("name", { type: "string" }).option("json", { type: "boolean" });
}

export async function handler(argv: Arguments) {
  const name = argv.name as string;
  const jsonMode = argv.json === true;
  const reg = registry.getRegistration(name);
  if (!reg) {
    outputError(`Unknown recipe: ${name}`);
    return 1;
  }

  const info = {
    name,
    description: reg.description,
    category: reg.category,
    params: reg.getParams ? reg.getParams(createRng(0)) : [],
  };

  if (jsonMode) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(info, null, 2));
  } else {
    outputInfo(`Recipe: ${name}`);
    outputInfo(`  Category: ${info.category}`);
    outputInfo(`  Description: ${info.description}`);
  }

  return 0;
}

export default { command, desc, builder, handler };
