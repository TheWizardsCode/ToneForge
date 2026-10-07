export const command = "runtime";
export const desc = "Run the render-backed runtime (audible state/context demo)";

export function builder(yargs: any) {
  return yargs.command("demo", "Run a scripted runtime audio demo", (y: any) => {
    y.option("scenario", {
      type: "string",
      describe: "Path to a runtime scenario JSON file",
    })
      .option("seed", {
        type: "number",
        describe: "Override the scenario seed",
      })
      .option("output", {
        type: "string",
        describe: "Directory to export rendered WAVs and the event timeline",
      })
      .option("json", { type: "boolean", describe: "Output JSON" });
  });
}
