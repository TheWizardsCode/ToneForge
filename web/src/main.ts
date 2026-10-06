// ToneForge Web Demo -- Entry point
import "@xterm/xterm/css/xterm.css";
import { createTerminal } from "./terminal.js";
import { createWizard } from "./wizard.js";
import { initializeBrowserRecipeRegistry } from "./browser-recipe-registry.js";
import type { TerminalController } from "./terminal.js";

let terminal: TerminalController | null = null;

function init(): void {
  // Register file-backed recipes inlined into the browser bundle. The Node
  // discovery path is a no-op here, so without this the wizard's Run button
  // would report "Unknown recipe" and never render audio.
  void initializeBrowserRecipeRegistry();

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
