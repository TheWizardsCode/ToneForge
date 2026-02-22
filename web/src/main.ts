// ToneForge Web Demo -- Entry point
import "@xterm/xterm/css/xterm.css";
import { createTerminal } from "./terminal.js";
import type { TerminalController } from "./terminal.js";

let terminal: TerminalController | null = null;

function init(): void {
  const container = document.getElementById("terminal-container");
  if (!container) {
    console.error("Terminal container element not found");
    return;
  }

  terminal = createTerminal(container);

  // Expose sendCommand globally for the wizard UI to use
  (window as unknown as Record<string, unknown>).__toneforgeTerminal = terminal;
}

document.addEventListener("DOMContentLoaded", init);

export { terminal };
