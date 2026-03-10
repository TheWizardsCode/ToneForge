export const command = "stack";
export const desc = "Work with layered sound stacks defined by preset files";

export function builder(yargs: any) {
  return yargs
    .command("render", "Render a stack preset to audio", (y: any) => {
      y.option("preset", { type: "string", describe: "Path to stack preset JSON" })
        .option("seed", { type: "string", describe: "Seed for rendering" })
        .option("output", { type: "string", describe: "Output WAV path" })
        .option("layer", { type: "array", describe: "Inline layer spec overrides" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("inspect", "Inspect a stack preset structure", (y: any) => {
      y.option("preset", { type: "string", describe: "Path to stack preset JSON" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    });
}
