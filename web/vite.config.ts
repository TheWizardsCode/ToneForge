import { defineConfig } from "vite";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || "3000", 10);

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
    },
  },
  server: {
    port: parseInt(process.env.VITE_PORT || "5173", 10),
    proxy: {
      "/terminal": {
        target: `http://localhost:${BACKEND_PORT}`,
        ws: true,
      },
    },
  },
});
