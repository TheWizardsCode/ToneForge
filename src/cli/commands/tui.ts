import type { Arguments } from "yargs";

export const command = "tui";
export const desc = "Launch the interactive terminal UI";

export function builder(yargs: any) {
  return yargs
    .option("resume", {
      type: "string",
      describe: "Resume a session from the specified file path",
    })
    .option("session-file", {
      type: "string",
      describe:
        "Use a custom path for the auto-save session file " +
        "(default: .toneforge-session.json in cwd)",
    })
    .conflicts("resume", "session-file")
    .example(
      "tui",
      "Launch the wizard (auto-detects existing session)",
    )
    .example(
      "tui --resume .toneforge-session.json",
      "Resume from a specific session file",
    )
    .example(
      "tui --session-file my-palette-session.json",
      "Use a custom auto-save path",
    );
}

export default { command, desc, builder };
