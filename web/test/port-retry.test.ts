/**
 * Tests for EADDRINUSE port retry logic, .port file coordination,
 * and Promise reject path in startServer().
 *
 * These tests run in an isolated vitest worker so the module-level
 * httpServer singleton does not conflict with server.test.ts.
 */
import { describe, it, expect, afterAll, afterEach } from "vitest";
import * as net from "node:net";
import { readFileSync, existsSync } from "node:fs";
import {
  startServer,
  server,
  PORT_FILE_PATH,
  removePortFile,
} from "../server/index.js";

/**
 * Helper: create a TCP server listening on a specific port.
 * Returns the server and the port it is listening on.
 */
function occupyPort(port: number): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const blocker = net.createServer();
    blocker.on("error", reject);
    blocker.listen(port, () => resolve(blocker));
  });
}

/** Helper: close a server and wait for it to finish. */
function closeServer(srv: net.Server | typeof server): Promise<void> {
  return new Promise((resolve, reject) => {
    srv.close((err) => (err ? reject(err) : resolve()));
  });
}

// Track blockers and the main server so we clean up even on failure
const blockers: net.Server[] = [];

afterEach(async () => {
  // Close any blockers opened during the test
  for (const b of blockers) {
    try {
      await closeServer(b);
    } catch {
      // Already closed
    }
  }
  blockers.length = 0;

  // Close the main HTTP server if it was started
  try {
    await closeServer(server);
  } catch {
    // Not listening — that's fine
  }

  // Clean up port file
  removePortFile();
});

// ── EADDRINUSE retry logic ─────────────────────────────────────────

describe("EADDRINUSE port retry", () => {
  it("retries on the next port when the requested port is occupied", async () => {
    // Pick an ephemeral base port unlikely to be in use
    const basePort = 19200;

    // Block the base port
    const blocker = await occupyPort(basePort);
    blockers.push(blocker);

    // startServer should auto-increment to basePort + 1
    const actualPort = await startServer(basePort);

    expect(actualPort).toBe(basePort + 1);
  });

  it("retries multiple times when consecutive ports are occupied", async () => {
    const basePort = 19210;

    // Block ports 0, 1, and 2
    for (let i = 0; i < 3; i++) {
      const b = await occupyPort(basePort + i);
      blockers.push(b);
    }

    const actualPort = await startServer(basePort);
    expect(actualPort).toBe(basePort + 3);
  });

  it("rejects with a clear error when all retry ports are exhausted", async () => {
    const basePort = 19220;

    // Block all 10 ports (basePort through basePort + 9)
    for (let i = 0; i < 10; i++) {
      const b = await occupyPort(basePort + i);
      blockers.push(b);
    }

    await expect(startServer(basePort)).rejects.toThrow(
      /All ports 19220-19229 are in use/,
    );
  }, 60_000); // PID detection via lsof on each retry can be slow

  it("rejects immediately for non-EADDRINUSE errors", async () => {
    // Port -1 is invalid and should cause an error other than EADDRINUSE
    await expect(startServer(-1)).rejects.toThrow();
  });
});

// ── .port file coordination ────────────────────────────────────────

describe(".port file", () => {
  it("writes the actual port to the .port file after successful listen (non-zero port)", async () => {
    const basePort = 19240;
    const actualPort = await startServer(basePort);

    expect(existsSync(PORT_FILE_PATH)).toBe(true);
    const content = readFileSync(PORT_FILE_PATH, "utf-8").trim();
    expect(content).toBe(String(actualPort));
  });

  it("does NOT write the .port file when started with port 0 (test mode)", async () => {
    removePortFile(); // ensure clean state
    await startServer(0);

    expect(existsSync(PORT_FILE_PATH)).toBe(false);
  });
});
