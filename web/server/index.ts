import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import type { IncomingMessage } from "node:http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || "3000", 10);
const PROJECT_ROOT = resolve(__dirname, "..", "..");

const app = express();
const httpServer = createServer(app);

// ── WebSocket terminal server ──────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req: IncomingMessage, socket, head) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (url.pathname === "/terminal") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws: WebSocket) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Terminal WebSocket connected`);

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
    console.log(`[${new Date().toISOString()}] PTY exited with code ${exitCode}`);
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
    console.log(`[${new Date().toISOString()}] Terminal WebSocket disconnected`);
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
});

export { app, httpServer as server };
