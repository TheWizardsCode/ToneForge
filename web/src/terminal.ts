// Terminal component: xterm.js + WebSocket connection to backend PTY
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15000;
const MAX_RECONNECT_ATTEMPTS = 10;

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
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let hasConnectedOnce = false;

  function connect(): void {
    if (disposed) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      reconnectAttempts = 0; // reset on successful connection
      hasConnectedOnce = true;
      // Show connection banner so the user knows the terminal is live
      term.write("\x1b[36mToneForge Terminal\x1b[0m\r\n");
      // Send initial size
      const dims = { type: "resize", cols: term.cols, rows: term.rows };
      ws!.send(JSON.stringify(dims));
    };

    ws.onmessage = (event) => {
      term.write(event.data as string);
    };

    ws.onclose = () => {
      if (disposed) return;

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        if (hasConnectedOnce) {
          term.write("\r\n\x1b[31m[Disconnected — max reconnect attempts reached]\x1b[0m\r\n");
        } else {
          term.write(
            "\r\n\x1b[33m[Backend not available]\x1b[0m\r\n" +
              "\x1b[2mEnsure the backend server is running:\r\n" +
              "  cd web && npm start\x1b[0m\r\n",
          );
        }
        return;
      }

      const delay = Math.min(
        INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts),
        MAX_RECONNECT_DELAY_MS,
      );
      reconnectAttempts++;

      if (hasConnectedOnce) {
        term.write("\r\n\x1b[31m[Disconnected]\x1b[0m ");
        term.write(`\x1b[2mReconnecting in ${Math.round(delay / 1000)}s...\x1b[0m\r\n`);
      }
      // Silently retry if we've never connected (avoid spamming on page load)

      reconnectTimer = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror — handle reconnection there
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

  // Re-fit on window resize and container resize
  const onWindowResize = (): void => {
    fitAddon.fit();
  };
  window.addEventListener("resize", onWindowResize);

  const resizeObserver = new ResizeObserver(() => {
    fitAddon.fit();
  });
  resizeObserver.observe(container);

  connect();

  return {
    sendCommand(command: string): void {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data: command + "\n" }));
      }
    },
    dispose(): void {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      window.removeEventListener("resize", onWindowResize);
      resizeObserver.disconnect();
      if (ws) {
        ws.close();
        ws = null;
      }
      term.dispose();
    },
  };
}
