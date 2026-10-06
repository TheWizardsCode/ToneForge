/**
 * Free-port selection for Playwright's `webServer`.
 *
 * The e2e server binds a fixed port (default 3000). When that port is already
 * occupied — for example by another project's dev server — Playwright aborts
 * with "port is already used" before running a single test. Selecting a free
 * port up-front keeps local e2e runs working regardless of what else is
 * running on the machine, while CI (where 3000 is free) keeps using 3000.
 *
 * `findFreePort` probes with an asynchronous `net.Server`; the Playwright
 * config is evaluated synchronously, so `findFreePortSync` runs the same probe
 * in a short-lived child process.
 *
 * Work item: TF-0MOKJJI7N005LT61.
 */
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";

/** Loopback interface the probes bind to. */
const HOST = "127.0.0.1";

/** Return true when `port` can be bound on the loopback interface. */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, HOST, () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * Return the first free port in `[start, start + attempts)`, or `start` when
 * none of the candidates is free.
 */
export async function findFreePort(start: number, attempts = 20): Promise<number> {
  for (let port = start; port < start + attempts; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }
  return start;
}

/**
 * Child-process probe mirroring {@link findFreePort}. Receives `start` and
 * `attempts` as argv and prints the selected port on stdout.
 */
const SYNC_PROBE = `
const net = require("node:net");
const start = Number(process.argv[1]);
const attempts = Number(process.argv[2]);
const tryPort = (port, remaining) => new Promise((resolve) => {
  const server = net.createServer();
  server.unref();
  server.once("error", () => {
    if (remaining > 0) resolve(tryPort(port + 1, remaining - 1));
    else resolve(start);
  });
  server.listen(port, "127.0.0.1", () => server.close(() => resolve(port)));
});
tryPort(start, attempts).then((port) => process.stdout.write(String(port)));
`;

/**
 * Synchronous {@link findFreePort}, safe to call while the Playwright config
 * is being evaluated. Falls back to `start` when the probe cannot run (for
 * example in a restricted sandbox).
 */
export function findFreePortSync(start: number, attempts = 20): number {
  try {
    const output = execFileSync(
      process.execPath,
      ["-e", SYNC_PROBE, String(start), String(attempts)],
      { encoding: "utf8", timeout: 5_000 },
    );
    const port = Number.parseInt(output.trim(), 10);
    return Number.isFinite(port) ? port : start;
  } catch {
    return start;
  }
}
