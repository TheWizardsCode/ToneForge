/**
 * `toneforge intelligence` command group.
 *
 * Intelligence is the assistive reasoning layer: it audits the library,
 * recommends sounds for a use case, and suggests exploration targets.
 * It is strictly read-only — it suggests, the human decides.
 *
 * The yargs builder is declared here and mirrored in `src/cli.yargs.ts`
 * (the active registration path); both are kept in sync.
 */
export const command = "intelligence";
export const desc = "Assistive reasoning over the sound library (read-only suggestions)";

export function builder(yargs: any) {
  return yargs
    .command("audit", "Audit a library for coverage gaps, redundancy, and quality issues", (y: any) => {
      y.option("library", { type: "string", describe: "Library directory to audit" })
        .option("json", { type: "boolean", describe: "Output JSON" });
    });
}
