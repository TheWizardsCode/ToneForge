// ToneForge Web Demo -- Entry point
import "@xterm/xterm/css/xterm.css";
import { createTerminal } from "./terminal.js";
import { createWizard } from "./wizard.js";
import type { TerminalController } from "./terminal.js";

let terminal: TerminalController | null = null;

function init(): void {
  const terminalContainer = document.getElementById("terminal-container");
  const wizardContainer = document.getElementById("wizard");

  if (!terminalContainer) {
    console.error("Terminal container element not found");
    return;
  }

  terminal = createTerminal(terminalContainer);

  if (wizardContainer) {
    createWizard(wizardContainer, () => terminal);
  }
}

document.addEventListener("DOMContentLoaded", init);

export { terminal };
