/**
 * `toneforge intent` command group.
 *
 * Intent is the structured, inspectable representation of a human goal. It
 * routes through Intelligence and enforces a human approval gate; it never
 * mutates systems directly.
 */
export const command = "intent";
export const desc = "Submit structured intents that route through Intelligence behind an approval gate";

export function builder(yargs: any) {
  return yargs
    .command("submit", "Submit an intent and receive an Intelligence analysis", (y: any) => {
      y.option("goal", { type: "string", describe: "Freeform goal (mapped deterministically to an intent)" })
        .option("scope", { type: "string", describe: "Explicit scope (asset, category, layer or project)" })
        .option("intent", { type: "string", describe: "Explicit intent id override" })
        .option("priority", { type: "string", describe: "Priority: low, medium or high" })
        .option("constraint", { type: "array", describe: "Constraint as key=value (repeatable)" })
        .option("library", { type: "string", describe: "Library directory Intelligence reads" })
        .option("memory-dir", { type: "string", describe: "Override the project-local memory directory" })
        .option("approve", { type: "boolean", describe: "Approve and execute the suggested commands" })
        .option("dry-run", { type: "boolean", describe: "Never execute (suggestions only)" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    })
    .command("vocabulary", "List the controlled intent vocabulary", (y: any) => {
      y.option("json", { type: "boolean", describe: "Output JSON" });
    });
}
