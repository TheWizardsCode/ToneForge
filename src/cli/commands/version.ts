export const command = "version";
export const desc = "Print the ToneForge version";

export function builder(yargs: any) {
  return yargs.option("json", { type: "boolean", describe: "Output JSON" });
}

export async function handler() {
  // Defer to existing exported VERSION in index.js to keep a single source of truth
  // eslint-disable-next-line node/no-missing-import
  const { VERSION } = await import("../../index.js");
  // eslint-disable-next-line no-console
  console.log(VERSION);
  return 0;
}

export default { command, desc, builder, handler };
