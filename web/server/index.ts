import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || "3000", 10);
const MAX_PORT_RETRIES = 10;

/** Path to the .port coordination file written after successful listen. */
const PORT_FILE_PATH = resolve(__dirname, "..", ".port");
const PROJECT_ROOT = resolve(__dirname, "..", "..");

// ── Origin restriction ─────────────────────────────────────────────

const DEFAULT_ALLOWED_ORIGINS = "localhost,127.0.0.1";

function getAllowedOriginPatterns(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Check if an origin is allowed. Matches against hostname portion
 * of the origin URL, so `http://localhost:5173` matches the pattern `localhost`.
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // No origin header — could be a same-origin request or a non-browser client.
    // Allow it (server-side tools, curl, etc.)
    return true;
  }

  const patterns = getAllowedOriginPatterns();

  try {
    const url = new URL(origin);
    return patterns.some((p) => url.hostname === p);
  } catch {
    // Malformed origin — reject
    return false;
  }
}

function log(action: string, origin: string | undefined, extra?: string): void {
  const timestamp = new Date().toISOString();
  const originStr = origin ?? "(none)";
  const suffix = extra ? ` ${extra}` : "";
  console.log(`[${timestamp}] ${action} origin=${originStr}${suffix}`);
}

// ── Express app ────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

// ── WebSocket terminal server ──────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const origin = req.headers.origin;

  if (url.pathname !== "/ws/terminal") {
    socket.destroy();
    return;
  }

  // Origin check
  if (!isOriginAllowed(origin)) {
    log("REJECTED", origin, "403 Forbidden");
    socket.write(
      "HTTP/1.1 403 Forbidden\r\n" +
      "Content-Type: text/plain\r\n" +
      "Connection: close\r\n" +
      "\r\n" +
      "Forbidden: origin not allowed\r\n",
    );
    socket.destroy();
    return;
  }

  log("ACCEPTED", origin, "WebSocket upgrade");

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws: WebSocket) => {
  log("CONNECTED", undefined, "Terminal session started");

  const shell = process.platform === "win32" ? "powershell.exe" : "bash";
  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: PROJECT_ROOT,
    env: { ...process.env } as Record<string, string>,
  });

  // Buffer for detecting and stripping OSC 133;D exit-code sequences from PTY output.
  // The OSC sequence format is: \x1b]133;D;<exitCode>\x07
  // We intercept this, strip it from the forwarded output, and send a structured
  // { type: "commandDone", exitCode: number } JSON message to the client.
  let outputBuffer = "";

  // Regex to match the OSC 133;D exit-code sequence (may span chunk boundaries)
  const OSC_DONE_RE = /\x1b\]133;D;(\d+)\x07/;
  // Partial match: detects if we might be in the middle of receiving an OSC sequence
  const OSC_PARTIAL_RE = /\x1b(?:\](?:1(?:3(?:3(?:;(?:D(?:;(?:\d+)?)?)?)?)?)?)?)?$/;

  // The sentinel suffix appended to exec commands for exit-code capture.
  // When bash echoes the command line, this suffix text is visible to the user.
  // We strip it from the PTY output so only the user-facing command is shown.
  const SENTINEL_SUFFIX = "; __TF_EC=$?; printf '\\033]133;D;%d\\007' $__TF_EC";
  // Regex to match the echoed sentinel suffix in PTY output.
  // Matches the literal text that bash echoes back.
  const SENTINEL_ECHO_RE = /; __TF_EC=\$\?; printf '\\033\]133;D;%d\\007' \$__TF_EC/g;

  /**
   * Check if the buffer ends with a partial (incomplete) sentinel echo.
   * Returns the index where the partial match starts, or -1 if no partial match.
   * This handles the case where a PTY output chunk is split in the middle of
   * the sentinel text (e.g. we receive "; __TF_EC=$" and the rest comes later).
   */
  function findPartialSentinel(buf: string): number {
    // The sentinel starts with "; " — only check if the buffer could end with
    // a prefix of the sentinel string. We check progressively longer suffixes
    // of the buffer against prefixes of the sentinel.
    const sentinel = SENTINEL_SUFFIX;
    const maxCheck = Math.min(buf.length, sentinel.length - 1);
    for (let len = maxCheck; len >= 2; len--) {
      const bufSuffix = buf.slice(-len);
      const sentinelPrefix = sentinel.slice(0, len);
      if (bufSuffix === sentinelPrefix) {
        return buf.length - len;
      }
    }
    return -1;
  }

  // PTY output -> WebSocket
  ptyProcess.onData((data: string) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    outputBuffer += data;

    // Strip the sentinel echo text from the output buffer before processing.
    // This removes the "; __TF_EC=$?; printf '...' $__TF_EC" portion that bash
    // echoes when the command line is entered, leaving only the user's command.
    outputBuffer = outputBuffer.replace(SENTINEL_ECHO_RE, "");

    // Process all complete OSC sequences in the buffer
    let match: RegExpExecArray | null;
    while ((match = OSC_DONE_RE.exec(outputBuffer)) !== null) {
      const exitCode = parseInt(match[1], 10);
      // Send everything before the OSC as raw PTY output
      const before = outputBuffer.slice(0, match.index);
      if (before) {
        ws.send(before);
      }
      // Send the structured commandDone message
      ws.send(JSON.stringify({ type: "commandDone", exitCode }));
      // Continue processing after the OSC sequence
      outputBuffer = outputBuffer.slice(match.index + match[0].length);
    }

    // Check if the buffer ends with a partial sentinel echo
    const sentinelPartialIdx = findPartialSentinel(outputBuffer);
    if (sentinelPartialIdx >= 0) {
      // Send everything before the partial sentinel, keep the rest buffered
      const safe = outputBuffer.slice(0, sentinelPartialIdx);
      if (safe) {
        // Check for partial OSC within the safe portion
        const oscPartial = OSC_PARTIAL_RE.exec(safe);
        if (oscPartial) {
          const preSafe = safe.slice(0, oscPartial.index);
          if (preSafe) ws.send(preSafe);
          outputBuffer = safe.slice(oscPartial.index) + outputBuffer.slice(sentinelPartialIdx);
        } else {
          ws.send(safe);
          outputBuffer = outputBuffer.slice(sentinelPartialIdx);
        }
      } else {
        outputBuffer = outputBuffer.slice(sentinelPartialIdx);
      }
      return;
    }

    // Check if the buffer ends with a partial OSC sequence
    const partialMatch = OSC_PARTIAL_RE.exec(outputBuffer);
    if (partialMatch) {
      // Send everything before the partial match, keep the rest buffered
      const safe = outputBuffer.slice(0, partialMatch.index);
      if (safe) {
        ws.send(safe);
      }
      outputBuffer = outputBuffer.slice(partialMatch.index);
    } else {
      // No partial match — flush the entire buffer
      if (outputBuffer) {
        ws.send(outputBuffer);
      }
      outputBuffer = "";
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    log("PTY_EXIT", undefined, `code=${exitCode}`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  // WebSocket messages -> PTY
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "input" && typeof msg.data === "string") {
        ptyProcess.write(msg.data);
      } else if (msg.type === "exec" && typeof msg.data === "string") {
        // Execute a command with exit-code capture.
        // Write the command followed by a shell snippet that emits an OSC 133;D
        // sequence containing the exit code. The OSC sequence is intercepted by
        // the output handler above. The sentinel suffix text that bash echoes
        // back is stripped from the output so only the user-facing command is
        // visible in the terminal.
        const cmd = msg.data.replace(/\n$/, "");
        ptyProcess.write(`${cmd}${SENTINEL_SUFFIX}\n`);
      } else if (
        msg.type === "resize" &&
        typeof msg.cols === "number" &&
        typeof msg.rows === "number"
      ) {
        ptyProcess.resize(
          Math.max(1, Math.floor(msg.cols)),
          Math.max(1, Math.floor(msg.rows)),
        );
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => {
    log("DISCONNECTED", undefined, "Terminal session ended");
    ptyProcess.kill();
  });
});

// ── Static file serving ────────────────────────────────────────────

const distDir = resolve(__dirname, "..", "dist");
app.use(express.static(distDir));

// Fallback to index.html for SPA routing
app.get("/{*splat}", (_req, res) => {
  res.sendFile(resolve(distDir, "index.html"));
});

// ── Port-conflict helpers ──────────────────────────────────────────

/**
 * Best-effort identification of the process occupying a port.
 * Returns a human-readable string like "PID 1234 (node)" or a fallback message.
 */
function identifyPortHolder(port: number): string {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: "utf-8",
        timeout: 3000,
      }).trim();
      const match = out.match(/\s(\d+)\s*$/m);
      if (match) return `PID ${match[1]}`;
    } else {
      const out = execSync(`lsof -i :${port} -sTCP:LISTEN -t 2>/dev/null`, {
        encoding: "utf-8",
        timeout: 3000,
      }).trim();
      if (out) {
        const pid = out.split("\n")[0];
        try {
          const name = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, {
            encoding: "utf-8",
            timeout: 3000,
          }).trim();
          return `PID ${pid} (${name})`;
        } catch {
          return `PID ${pid}`;
        }
      }
    }
  } catch {
    // PID detection is best-effort
  }
  return "unknown process";
}

/**
 * Write the actual port to the `.port` coordination file so that
 * other tools (Vite proxy, scripts) can discover the backend port.
 */
function writePortFile(port: number): void {
  try {
    writeFileSync(PORT_FILE_PATH, String(port), "utf-8");
  } catch (err) {
    console.warn(`Warning: could not write port file at ${PORT_FILE_PATH}:`, err);
  }
}

/** Remove the `.port` file if it exists. */
function removePortFile(): void {
  try {
    if (existsSync(PORT_FILE_PATH)) {
      unlinkSync(PORT_FILE_PATH);
    }
  } catch {
    // Best-effort cleanup
  }
}

// Register cleanup handlers to remove the port file on exit
let cleanupRegistered = false;
function registerPortFileCleanup(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const cleanup = () => removePortFile();

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(128 + 2);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(128 + 15);
  });
}

// ── Start ──────────────────────────────────────────────────────────

/**
 * Start the server on the given port.
 * Returns a promise that resolves with the listening port once ready.
 *
 * If the requested port is in use (EADDRINUSE), the server automatically
 * retries on the next port, up to `MAX_PORT_RETRIES` attempts.
 * Port 0 (OS-assigned) skips retry logic entirely.
 */
export function startServer(port: number = PORT): Promise<number> {
  return new Promise((resolve, reject) => {
    const maxPort = port === 0 ? 0 : port + MAX_PORT_RETRIES - 1;
    let currentPort = port;

    function tryListen() {
      // Remove any previous listeners to avoid stacking on retries
      httpServer.removeAllListeners("error");
      httpServer.removeAllListeners("listening");

      httpServer.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && port !== 0 && currentPort < maxPort) {
          const holder = identifyPortHolder(currentPort);
          console.warn(
            `Port ${currentPort} is in use by ${holder}. Retrying on port ${currentPort + 1}...`,
          );
          currentPort++;
          tryListen();
        } else if (err.code === "EADDRINUSE") {
          const holder = identifyPortHolder(currentPort);
          const msg =
            `All ports ${port}-${maxPort} are in use. ` +
            `Port ${currentPort} is held by ${holder}. ` +
            `Free a port or set the PORT environment variable to a different range.`;
          console.error(msg);
          reject(new Error(msg));
        } else {
          reject(err);
        }
      });

      httpServer.on("listening", () => {
        const addr = httpServer.address();
        const actualPort = typeof addr === "object" && addr ? addr.port : currentPort;
        console.log(`ToneForge Web Demo server listening on http://localhost:${actualPort}`);
        console.log(`Allowed origins: ${getAllowedOriginPatterns().join(", ")}`);

        // Write port file and register cleanup (skip for ephemeral port 0 used in tests)
        if (port !== 0) {
          writePortFile(actualPort);
          registerPortFileCleanup();
        }

        resolve(actualPort);
      });

      httpServer.listen(currentPort);
    }

    tryListen();
  });
}

// Auto-start when run directly (not imported by tests)
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("/index.js") || process.argv[1].endsWith("/index.ts"));

if (isDirectRun) {
  startServer();
}

export {
  app,
  httpServer as server,
  isOriginAllowed,
  getAllowedOriginPatterns,
  PORT_FILE_PATH,
  MAX_PORT_RETRIES,
  identifyPortHolder,
  removePortFile,
};
