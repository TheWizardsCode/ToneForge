import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { request as httpRequest } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";

const projectRoot = resolve(__dirname, "..");
const PORT_FILE = resolve(__dirname, ".port");
const DEFAULT_BACKEND_PORT = 3000;

/**
 * Discover the backend port dynamically on every call.
 * Priority: .port file > BACKEND_PORT env var > default 3000.
 *
 * This is called per-request so that when the backend retries onto a
 * non-default port and writes `.port`, subsequent proxy requests pick
 * up the correct value — even though Vite started before the backend.
 */
function getBackendPort(): number {
  // 1. Try the .port coordination file (written by the backend after listen)
  try {
    if (existsSync(PORT_FILE)) {
      const content = readFileSync(PORT_FILE, "utf-8").trim();
      const port = parseInt(content, 10);
      if (!Number.isNaN(port) && port > 0) return port;
    }
  } catch {
    // Fall through to env var / default
  }

  // 2. BACKEND_PORT env var
  if (process.env.BACKEND_PORT) {
    const port = parseInt(process.env.BACKEND_PORT, 10);
    if (!Number.isNaN(port) && port > 0) return port;
  }

  // 3. Default
  return DEFAULT_BACKEND_PORT;
}

/**
 * Vite plugin that proxies /ws/* requests to the backend with
 * dynamic port resolution on every connection.
 *
 * This replaces the static `server.proxy` config so that the proxy
 * works even when the backend starts on a non-default port after
 * Vite has already loaded its config.
 */
function dynamicBackendProxy(): Plugin {
  return {
    name: "toneforge-dynamic-backend-proxy",
    configureServer(server) {
      // ── WebSocket upgrade proxy ────────────────────────────
      // Vite's httpServer is available once the server is set up.
      // We listen for 'upgrade' events and forward /ws/* to the backend.
      server.httpServer?.on(
        "upgrade",
        (req: IncomingMessage, socket: Socket, head: Buffer) => {
          const url = req.url ?? "/";
          if (!url.startsWith("/ws")) return; // let Vite HMR handle its own upgrades

          const backendPort = getBackendPort();

          const proxyReq = httpRequest({
            hostname: "localhost",
            port: backendPort,
            path: url,
            method: req.method,
            headers: req.headers,
          });

          proxyReq.on("upgrade", (_proxyRes, proxySocket, proxyHead) => {
            socket.write(
              "HTTP/1.1 101 Switching Protocols\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                // Forward any additional headers from the backend response
                Object.entries(_proxyRes.headers)
                  .filter(
                    ([k]) =>
                      !["upgrade", "connection"].includes(k.toLowerCase()),
                  )
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\r\n") +
                "\r\n\r\n",
            );

            if (proxyHead && proxyHead.length > 0) {
              socket.write(proxyHead);
            }

            // Bi-directional pipe
            proxySocket.pipe(socket);
            socket.pipe(proxySocket);

            proxySocket.on("error", () => socket.destroy());
            socket.on("error", () => proxySocket.destroy());
          });

          proxyReq.on("error", (err) => {
            console.error(
              `[toneforge-proxy] WebSocket proxy error to port ${backendPort}:`,
              err.message,
            );
            socket.destroy();
          });

          // Forward the upgrade head data and end the request
          proxyReq.end(head);
        },
      );

      // ── HTTP middleware proxy for /ws/* (non-upgrade) ───────
      // This handles any regular HTTP requests to /ws/* paths,
      // e.g. health checks or HTTP-based fallbacks.
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? "/";
        if (!url.startsWith("/ws")) {
          next();
          return;
        }

        const backendPort = getBackendPort();

        const proxyReq = httpRequest(
          {
            hostname: "localhost",
            port: backendPort,
            path: url,
            method: req.method,
            headers: req.headers,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
            proxyRes.pipe(res);
          },
        );

        proxyReq.on("error", (err) => {
          console.error(
            `[toneforge-proxy] HTTP proxy error to port ${backendPort}:`,
            err.message,
          );
          if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Bad Gateway: backend not available");
          }
        });

        req.pipe(proxyReq);
      });
    },
  };
}

export default defineConfig({
  root: "src",
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      // Allow importing from the main ToneForge src/ directory
      "@toneforge": resolve(projectRoot, "src"),
      // Allow importing demo markdown files from the repo-root demos/ directory
      "@demos": resolve(projectRoot, "demos"),
    },
  },
  plugins: [dynamicBackendProxy()],
  server: {
    port: parseInt(process.env.VITE_PORT || "5173", 10),
    // Proxy is now handled dynamically by the toneforge-dynamic-backend-proxy
    // plugin above — no static proxy config needed.
  },
});
