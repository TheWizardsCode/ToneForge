export const command = "library";
export const desc = "Manage the ToneForge sound library";

export function builder(yargs: any) {
  return yargs
    .command("list", "List library entries", (y: any) => {
      y.option("category", { type: "string", describe: "Filter by category" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("search", "Search library entries", (y: any) => {
      y.option("category", { type: "string", describe: "Filter by category" })
        .option("intensity", { type: "string", describe: "Filter by intensity" })
        .option("texture", { type: "string", describe: "Filter by texture" })
        .option("tags", { type: "string", describe: "Filter by tags" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("similar", "Find similar library entries", (y: any) => {
      y.option("id", { type: "string", describe: "Entry ID to compare" })
        .option("limit", { type: "number", default: 10, describe: "Maximum results" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("export", "Export library entries to WAV files", (y: any) => {
      y.option("output", { type: "string", describe: "Output directory" })
        .option("category", { type: "string", describe: "Filter by category" })
        .option("format", { type: "string", default: "wav", describe: "Output format" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("regenerate", "Regenerate a library entry", (y: any) => {
      y.option("id", { type: "string", describe: "Entry ID to regenerate" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    });
}
