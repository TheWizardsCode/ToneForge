import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";

const projectRoot = resolve(__dirname, "..");
const PORT_FILE = resolve(__dirname, ".port");

/**
 * Discover the backend port for the WebSocket proxy.
 * Priority: .port file > BACKEND_PORT env var > default 3000.
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
  return 3000;
}

const BACKEND_PORT = getBackendPort();

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
  server: {
    port: parseInt(process.env.VITE_PORT || "5173", 10),
    proxy: {
      "/ws": {
        target: `http://localhost:${BACKEND_PORT}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
