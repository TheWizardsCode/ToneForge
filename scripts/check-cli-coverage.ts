import { readFile } from "node:fs/promises";
import path from "node:path";

const yargsPath = path.resolve("src/cli.yargs.ts");
const docPath = path.resolve("docs/cli-cutover-checklist.md");

function extractFrameworkCommands(content: string): string[] {
  const match = content.match(/export const FRAMEWORK_COMMANDS = \[([\s\S]*?)\];/);
  if (!match) {
    throw new Error("FRAMEWORK_COMMANDS declaration not found in src/cli.yargs.ts");
  }
  const raw = match[1];
  return raw
    .split(",")
    .map((value) => value.replace(/["'`]/g, "").trim())
    .filter((value) => value !== "");
}

function parseCommandRows(content: string): string[] {
  const lines = content.split("\n");
  const headerIndex = lines.findIndex((line) => line.trim().startsWith("| Command |"));
  if (headerIndex === -1) {
    throw new Error("Command ownership table header not found in docs/cli-cutover-checklist.md");
  }

  const rows: string[] = [];
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) {
      break;
    }
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 2) {
      continue;
    }
    const command = cells[1].replace(/`/g, "").trim();
    if (command) {
      rows.push(command);
    }
  }
  return rows;
}

async function main(): Promise<void> {
  const docContent = await readFile(docPath, "utf-8");
  const yargsContent = await readFile(yargsPath, "utf-8");
  const docCommands = parseCommandRows(docContent);
  const frameworkCommands = extractFrameworkCommands(yargsContent);
  const duplicates = docCommands.filter((cmd, idx) => docCommands.indexOf(cmd) !== idx);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate command entries found in the checklist: ${duplicates.join(", ")}`);
  }

  const docSet = new Set(docCommands);
  const missing = frameworkCommands.filter((cmd) => !docSet.has(cmd));
  const unexpected = [...docSet].filter((cmd) => !frameworkCommands.includes(cmd));

  if (missing.length > 0 || unexpected.length > 0) {
    if (missing.length > 0) {
      console.error("Missing commands in docs/cli-cutover-checklist.md:", missing.join(", "));
    }
    if (unexpected.length > 0) {
      console.error("Unexpected commands listed in the checklist:", unexpected.join(", "));
    }
    throw new Error("Command coverage matrix is out of sync with FRAMEWORK_COMMANDS.");
  }

  console.log("Command coverage matrix is in sync with FRAMEWORK_COMMANDS.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
