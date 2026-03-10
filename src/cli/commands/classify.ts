export const command = "classify";
export const desc = "Classify a sound by category, intensity, and texture";

export function builder(yargs: any) {
  return yargs
    .option("recipe", { type: "string", describe: "Recipe name" })
    .option("seed", { type: "number", describe: "Seed for rendering" })
    .option("input", { type: "string", describe: "Path to input WAV file" })
    .option("analysis", { type: "string", describe: "Path to analysis directory" })
    .option("output", { type: "string", describe: "Output directory" })
    .option("format", { type: "string", describe: "Output format (json or table)" })
    .option("json", { type: "boolean", describe: "Output JSON" });
}
