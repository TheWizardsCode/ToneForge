// Terminal component: xterm.js + WebSocket connection to backend PTY
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15000;
const MAX_RECONNECT_ATTEMPTS = 10;

export interface TerminalController {
  /** Send a command string to the terminal (types it and presses Enter) */
  sendCommand(command: string): void;
  /** Execute a command and wait for it to complete. Returns the exit code. */
  executeCommand(command: string): Promise<{ exitCode: number }>;
  /** Subscribe to raw PTY output data. Returns an unsubscribe function. */
  onOutput(callback: (data: string) => void): () => void;
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
      background: "#0d1117",
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
  const outputListeners = new Set<(data: string) => void>();
  const commandDoneListeners = new Set<(exitCode: number) => void>();

  function connect(): void {
    if (disposed) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;

    // Show connecting message on first attempt so the terminal isn't blank
    if (reconnectAttempts === 0 && !hasConnectedOnce) {
      term.write("\x1b[2mConnecting to backend...\x1b[0m\r\n");
    }

    console.log(`[ToneForge] WebSocket connecting to ${wsUrl} (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[ToneForge] WebSocket connected");
      reconnectAttempts = 0; // reset on successful connection
      hasConnectedOnce = true;
      // Clear the "Connecting..." message and show connection banner
      term.clear();
      term.write("\x1b[36mToneForge Terminal\x1b[0m\r\n");
      // Send initial size
      const dims = { type: "resize", cols: term.cols, rows: term.rows };
      ws!.send(JSON.stringify(dims));
    };

    ws.onmessage = (event) => {
      const raw = event.data as string;

      // Check if this is a structured JSON message from the server
      if (raw.startsWith("{")) {
        try {
          const msg = JSON.parse(raw);
          if (msg.type === "commandDone" && typeof msg.exitCode === "number") {
            for (const listener of commandDoneListeners) {
              listener(msg.exitCode);
            }
            return;
          }
        } catch {
          // Not valid JSON — treat as raw PTY output
        }
      }

      term.write(raw);
      for (const listener of outputListeners) {
        listener(raw);
      }
    };

    ws.onclose = () => {
      if (disposed) return;

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        if (hasConnectedOnce) {
          console.warn("[ToneForge] WebSocket disconnected — max reconnect attempts reached");
          term.write("\r\n\x1b[31m[Disconnected — max reconnect attempts reached]\x1b[0m\r\n");
        } else {
          console.warn("[ToneForge] Backend not available after max reconnect attempts");
          term.clear();
          term.write(
            "\x1b[33m[Backend not available]\x1b[0m\r\n" +
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
        console.log(`[ToneForge] WebSocket disconnected, reconnecting in ${Math.round(delay / 1000)}s...`);
        term.write("\r\n\x1b[31m[Disconnected]\x1b[0m ");
        term.write(`\x1b[2mReconnecting in ${Math.round(delay / 1000)}s...\x1b[0m\r\n`);
      } else {
        console.log(`[ToneForge] WebSocket connection failed, retrying in ${Math.round(delay / 1000)}s... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      }

      reconnectTimer = setTimeout(connect, delay);
    };

    ws.onerror = (event) => {
      console.error("[ToneForge] WebSocket error:", event);
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
        console.log("[ToneForge] Sending command:", command);
        ws.send(JSON.stringify({ type: "input", data: command + "\n" }));
      } else {
        console.warn("[ToneForge] Cannot send command — WebSocket not connected (readyState:", ws?.readyState ?? "null", ")");
      }
    },
    executeCommand(command: string): Promise<{ exitCode: number }> {
      return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error("WebSocket not connected"));
          return;
        }
        console.log("[ToneForge] Executing command:", command);
        const onDone = (exitCode: number): void => {
          commandDoneListeners.delete(onDone);
          resolve({ exitCode });
        };
        commandDoneListeners.add(onDone);
        ws.send(JSON.stringify({ type: "exec", data: command + "\n" }));
      });
    },
    onOutput(callback: (data: string) => void): () => void {
      outputListeners.add(callback);
      return () => {
        outputListeners.delete(callback);
      };
    },
    dispose(): void {
      disposed = true;
      outputListeners.clear();
      commandDoneListeners.clear();
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
