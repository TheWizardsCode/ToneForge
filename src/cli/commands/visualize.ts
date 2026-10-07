export const command = "visualize";
export const desc = "Generate deterministic, audio-synchronised visual effects";

export function builder(yargs: any) {
  return yargs.command("export", "Export deterministic visual effects for a recipe", (y: any) => {
    y.option("recipe", { type: "string", describe: "Recipe name" })
      .option("seed", { type: "number", describe: "Seed for deterministic output" })
      .option("format", { type: "string", describe: "Export format: spritesheet or frames" })
      .option("output", { type: "string", describe: "Output directory" })
      .option("palette", { type: "string", describe: "Aesthetic palette name" })
      .option("frames", { type: "number", describe: "Number of animation frames" })
      .option("width", { type: "number", describe: "Frame width in pixels" })
      .option("height", { type: "number", describe: "Frame height in pixels" })
      .option("json", { type: "boolean", describe: "Output JSON" });
  });
}
