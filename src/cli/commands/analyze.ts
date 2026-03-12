export const command = "analyze";
export const desc = "Analyze a sound's acoustic properties";

export function builder(yargs: any) {
  return yargs
    .option("recipe", { type: "string", describe: "Recipe name" })
    .option("seed", { type: "number", describe: "Seed for rendering" })
    .option("input", { type: "string", describe: "Path to input WAV file" })
    .option("output", { type: "string", describe: "Output directory for analysis files" })
    .option("format", { type: "string", describe: "Output format (json or table)" })
    .option("json", { type: "boolean", describe: "Output JSON" });
}
