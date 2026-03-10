export const command = "explore";
export const desc = "Explore and discover sounds through sweep, mutate, and promote workflows";

export function builder(yargs: any) {
  return yargs
    .command("sweep", "Sweep a seed range and rank candidates", (y: any) => {
      y.option("recipe", { type: "string", describe: "Recipe name" })
        .option("seed-range", { type: "string", describe: "Seed range (start:end)" })
        .option("keep-top", { type: "number", default: 5, describe: "Number of top candidates to keep" })
        .option("rank-by", { type: "string", describe: "Metric to rank by" })
        .option("clusters", { type: "number", default: 3, describe: "Number of clusters" })
        .option("concurrency", { type: "number", default: 4, describe: "Concurrency level" })
        .option("output", { type: "string", describe: "Output directory" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("mutate", "Mutate a seed to explore nearby sounds", (y: any) => {
      y.option("recipe", { type: "string", describe: "Recipe name" })
        .option("seed", { type: "number", describe: "Seed to mutate" })
        .option("jitter", { type: "number", default: 0.1, describe: "Jitter amount (0-1)" })
        .option("count", { type: "number", default: 20, describe: "Number of mutations" })
        .option("rank-by", { type: "string", describe: "Metric to rank by" })
        .option("output", { type: "string", describe: "Output directory" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("promote", "Promote a candidate to the library", (y: any) => {
      y.option("run", { type: "string", describe: "Run ID" })
        .option("latest", { type: "boolean", describe: "Use the latest run" })
        .option("id", { type: "string", describe: "Candidate ID to promote" })
        .option("category", { type: "string", describe: "Override category" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("show", "Show details of an exploration run", (y: any) => {
      y.option("run", { type: "string", describe: "Run ID" })
        .option("latest", { type: "boolean", describe: "Use the latest run" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("runs", "List all exploration runs", (y: any) => {
      y.option("json", { type: "boolean", describe: "Output JSON" });
    });
}
