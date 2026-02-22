// Terminal component: xterm.js + WebSocket connection to backend PTY
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

const RECONNECT_DELAY_MS = 3000;

export interface TerminalController {
  /** Send a command string to the terminal (types it and presses Enter) */
  sendCommand(command: string): void;
  /** Dispose of the terminal and close the WebSocket */
  dispose(): void;
}

export function createTerminal(
  container: HTMLElement,
): TerminalController {
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: '"SF Mono", "Cascadia Code", "Fira Code", "Consolas", monospace',
    theme: {
      background: "#161b22",
      foreground: "#e6edf3",
      cursor: "#58a6ff",
      selectionBackground: "#264f78",
    },
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(container);
  fitAddon.fit();

  let ws: WebSocket | null = null;
  let disposed = false;

  function connect(): void {
    if (disposed) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/terminal`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Send initial size
      const dims = { type: "resize", cols: term.cols, rows: term.rows };
      ws!.send(JSON.stringify(dims));
    };

    ws.onmessage = (event) => {
      term.write(event.data as string);
    };

    ws.onclose = () => {
      if (!disposed) {
        term.write("\r\n\x1b[31m[Disconnected]\x1b[0m\r\n");
        setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  // Relay keyboard input to the WebSocket
  term.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "input", data }));
    }
  });

  // Send resize events
  term.onResize(({ cols, rows }) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  });

  // Re-fit on window resize
  const onWindowResize = (): void => {
    fitAddon.fit();
  };
  window.addEventListener("resize", onWindowResize);

  connect();

  return {
    sendCommand(command: string): void {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data: command + "\n" }));
      }
    },
    dispose(): void {
      disposed = true;
      window.removeEventListener("resize", onWindowResize);
      if (ws) {
        ws.close();
        ws = null;
      }
      term.dispose();
    },
  };
}
