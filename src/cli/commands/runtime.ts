export const command = "runtime";
export const desc = "Run the render-backed runtime (live session and scripted demo)";

export function builder(yargs: any) {
  return yargs
    .command("start", "Start a live, interactive runtime session", (y: any) => {
      y.option("scenario", {
        type: "string",
        describe: "Path to a runtime scenario JSON file",
      })
        .option("seed", { type: "number", describe: "Override the scenario seed" })
        .option("script", {
          type: "string",
          describe: "Replay a command-per-line script and exit",
        })
        .option("json", {
          type: "boolean",
          describe: "Stream runtime events as JSON (no audio)",
        })
        .option("cache-size", {
          type: "number",
          describe: "Maximum cached renders",
        });
    })
    .command("demo", "Run a scripted runtime audio demo", (y: any) => {
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
