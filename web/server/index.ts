import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || "3000", 10);
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

  if (url.pathname !== "/terminal") {
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

  // PTY output -> WebSocket
  ptyProcess.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
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
app.get("*", (_req, res) => {
  res.sendFile(resolve(distDir, "index.html"));
});

// ── Start ──────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`ToneForge Web Demo server listening on http://localhost:${PORT}`);
  console.log(`Allowed origins: ${getAllowedOriginPatterns().join(", ")}`);
});

export { app, httpServer as server, isOriginAllowed };
