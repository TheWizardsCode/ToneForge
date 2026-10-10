/**
 * `toneforge memory` command group.
 *
 * Memory is the append-only, project-local recall layer. It records what
 * happened and what mattered and exposes deterministic queries, an explicit
 * export and an explicit clear. It never makes decisions.
 */
export const command = "memory";
export const desc = "Query, export and clear the project-local append-only Memory store";

export function builder(yargs: any) {
  return yargs
    .command("query", "Query Memory with an optional scope and time range", (y: any) => {
      y.option("scope", { type: "string", describe: "Scope filter (exact match)" })
        .option("time-range", { type: "string", describe: "Time range as <from>:<to> ISO dates, or 'all'" })
        .option("memory-dir", { type: "string", describe: "Override the project-local memory directory" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("export", "Export every Memory record", (y: any) => {
      y.option("memory-dir", { type: "string", describe: "Override the project-local memory directory" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("clear", "Clear the Memory store", (y: any) => {
      y.option("memory-dir", { type: "string", describe: "Override the project-local memory directory" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    });
}
