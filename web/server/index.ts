import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || "3000", 10);

const app = express();

// Serve the Vite-built frontend
const distDir = resolve(__dirname, "..", "dist");
app.use(express.static(distDir));

// Fallback to index.html for SPA routing
app.get("*", (_req, res) => {
  res.sendFile(resolve(distDir, "index.html"));
});

const server = app.listen(PORT, () => {
  console.log(`ToneForge Web Demo server listening on http://localhost:${PORT}`);
});

export { app, server };
