export const command = "sequence";
export const desc = "Work with sound sequences defined by preset files";

export function builder(yargs: any) {
  return yargs
    .command("generate", "Render a sequence to audio", (y: any) => {
      y.option("preset", { type: "string", describe: "Path to sequence preset JSON" })
        .option("seed", { type: "number", describe: "Seed for rendering" })
        .option("output", { type: "string", describe: "Output WAV path" })
        .option("duration", { type: "number", describe: "Duration override in seconds" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("simulate", "Simulate a sequence and show event schedule", (y: any) => {
      y.option("preset", { type: "string", describe: "Path to sequence preset JSON" })
        .option("seed", { type: "number", describe: "Seed for simulation" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("inspect", "Inspect a sequence preset structure", (y: any) => {
      y.option("preset", { type: "string", describe: "Path to sequence preset JSON" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    });
}
