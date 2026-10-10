#!/usr/bin/env node
/**
 * Dev-stack launcher for the web demo.
 *
 * Derives the host's own allowed origins, injects them as `ALLOWED_ORIGINS`
 * for the backend, then builds and starts the backend + Vite dev server via
 * `concurrently`. Using a Node launcher (rather than a `VAR=value cmd` shell
 * prefix) keeps the env injection portable across the platforms npm supports.
 *
 * Extra arguments after `--` (e.g. `npm run dev:web -- --host`) are accepted
 * and ignored: the web `dev` script already binds Vite to all interfaces with
 * `--host`, and the backend is reachable through Vite's WebSocket proxy.
 */

import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";
import { formatAllowedOrigins } from "./allowed-origins.mjs";

const allowedOrigins = formatAllowedOrigins();
console.log(`[dev:web] Backend ALLOWED_ORIGINS=${allowedOrigins}`);

// `npm run` normally puts node_modules/.bin on PATH; add it explicitly so the
// launcher also works when invoked directly as `node scripts/dev-web.mjs`.
const binDir = resolve("node_modules", ".bin");
const env = {
  ...process.env,
  ALLOWED_ORIGINS: allowedOrigins,
  PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}`,
};

function run(command) {
  const result = spawnSync(command, { stdio: "inherit", env, shell: true });
  if (result.error) {
    console.error(`[dev:web] Failed to run: ${command}`);
    console.error(result.error);
    process.exit(1);
  }
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

run("npm run build");
run("npm run build --prefix web");
run(
  "concurrently -k -n backend,vite -c blue,green " +
    '"npm start --prefix web" "npm run dev --prefix web"',
);
