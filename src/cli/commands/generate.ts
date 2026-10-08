import type { Arguments } from "yargs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { renderRecipe } from "../../core/renderer.js";
import { registry } from "../../recipes/index.js";
import { encodeWav } from "../../audio/wav-encoder.js";
import { outputInfo, outputError, outputTable } from "../../output.js";
import { buildParamsTable, seedParams } from "../helpers.js";

export const command = "generate";
export const desc = "Render and export procedural sounds";

export function builder(yargs: any) {
  return yargs
    .option("recipe", {
      type: "string",
      describe: "Recipe name (e.g. ui-scifi-confirm)",
    })
    .option("seed", {
      type: "string",
      describe: "Integer seed for deterministic rendering",
    })
    .option("seed-range", {
      type: "string",
      describe: "Seed range for batch generation (e.g. 1:10)",
    })
    .option("output", {
      type: "string",
      describe: "Output WAV path or directory (for --seed-range)",
    })
    .option("json", { type: "boolean", describe: "Output JSON" })
    .example("generate --recipe ui-scifi-confirm --seed 42", "Render a specific seed")
    .example("generate --recipe ui-scifi-confirm", "Render with a random seed");
}

export async function handler(argv: Arguments) {
  const recipeName = argv.recipe as string;
  const seed = argv.seed as number | undefined;
  const output = argv.output as string | undefined;
  const jsonMode = argv.json === true;
  const resolvedSeed = seed ?? Math.floor(Math.random() * 2 ** 31);

  try {
    outputInfo(`Generating recipe ${recipeName} (seed=${seed ?? "random"})`);
    // renderRecipe expects (recipeName, seed, duration?) — seed is a number.
    const audio = await renderRecipe(recipeName, resolvedSeed);
    const registration = registry.getRegistration(recipeName);
    const wavBuffer = encodeWav(audio.samples, { sampleRate: audio.sampleRate });

    if (output) {
      // Ensure parent directory exists
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, wavBuffer);
      outputInfo(`Wrote ${output}`);
    }

    if (jsonMode) {
      process.stdout.write(
        JSON.stringify({
          recipe: recipeName,
          seed: resolvedSeed,
          duration: audio.duration,
          params: registration ? seedParams(registration, resolvedSeed) : {},
        }) + "\n",
      );
    } else if (registration) {
      const table = buildParamsTable(registration, resolvedSeed);
      outputInfo("Parameters:");
      outputTable(table.columns, table.rows, { rowSeparators: false });
    }

    return 0;
  } catch (err) {
    outputError(`Failed to generate ${recipeName}: ${String(err)}`);
    return 1;
  }
}

export default { command, desc, builder, handler };
