/**
 * Integration tests for the web demo server.
 *
 * Tests HTTP serving, WebSocket terminal connectivity, and origin restriction.
 * These tests start a real server instance on a random port and exercise
 * the actual HTTP and WebSocket endpoints.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import {
  app,
  server,
  startServer,
  isOriginAllowed,
} from "../server/index.js";

let port: number;

beforeAll(async () => {
  port = await startServer(0); // port 0 = OS picks a free port
});

afterAll(async () => {
  // Close the HTTP server (and by extension the WebSocket server)
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ── AC 1: HTTP server starts and serves the HTML page ──────────────

describe("HTTP server", () => {
  it("serves the HTML page at / with status 200", async () => {
    const res = await fetch(`http://localhost:${port}/`);

    expect(res.status).toBe(200);

    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType).toContain("text/html");

    const body = await res.text();
    expect(body).toContain("ToneForge");
  });
});

// ── AC 4: Origin restriction rejects disallowed origins ────────────

describe("Origin restriction", () => {
  describe("isOriginAllowed", () => {
    it("allows localhost origin", () => {
      expect(isOriginAllowed("http://localhost:3000")).toBe(true);
    });

    it("allows 127.0.0.1 origin", () => {
      expect(isOriginAllowed("http://127.0.0.1:5173")).toBe(true);
    });

    it("allows undefined origin (same-origin / non-browser)", () => {
      expect(isOriginAllowed(undefined)).toBe(true);
    });

    it("rejects disallowed origin", () => {
      expect(isOriginAllowed("http://evil.example.com")).toBe(false);
    });

    it("rejects malformed origin", () => {
      expect(isOriginAllowed("not-a-url")).toBe(false);
    });
  });

  it("rejects WebSocket upgrade with disallowed Origin header (403)", async () => {
    // Use the ws library with a custom origin — the server checks the Origin
    // header during the HTTP upgrade and responds with 403 + socket destroy.
    const ws = new WebSocket(`ws://localhost:${port}/ws/terminal`, {
      headers: { Origin: "http://evil.example.com" },
    });

    const result = await new Promise<{ event: string; code?: number }>((resolve) => {
      ws.on("open", () => resolve({ event: "open" }));
      ws.on("error", () => resolve({ event: "error" }));
      ws.on("unexpected-response", (_req, res) => {
        resolve({ event: "rejected", code: res.statusCode });
      });
    });

    expect(result.event).toBe("rejected");
    expect(result.code).toBe(403);
  });
});

// ── AC 2: WebSocket connects to terminal endpoint ──────────────────

describe("WebSocket terminal", () => {
  it("establishes a WebSocket connection to /terminal", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/terminal`);

    const connected = await new Promise<boolean>((resolve) => {
      ws.on("open", () => resolve(true));
      ws.on("error", () => resolve(false));
    });

    expect(connected).toBe(true);

    // Send a simple command and verify we receive some output
    const receivedData = await new Promise<string>((resolve, reject) => {
      let data = "";

      ws.on("message", (msg) => {
        data += msg.toString();
        // Once we have some data, resolve
        if (data.length > 0) {
          resolve(data);
        }
      });

      // Send an echo command through the terminal
      ws.send(JSON.stringify({ type: "input", data: "echo TONEFORGE_TEST_OK\n" }));

      // Timeout safety
      setTimeout(() => {
        if (data.length > 0) {
          resolve(data);
        } else {
          reject(new Error("No output received from terminal within timeout"));
        }
      }, 5000);
    });

    expect(receivedData.length).toBeGreaterThan(0);

    ws.close();
    // Give the server a moment to clean up the PTY
    await new Promise((r) => setTimeout(r, 200));
  });

  it("rejects WebSocket connection to non-terminal path", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/invalid-path`);

    const result = await new Promise<string>((resolve) => {
      ws.on("open", () => resolve("connected"));
      ws.on("error", () => resolve("error"));
      ws.on("close", () => resolve("closed"));
    });

    // Should NOT connect; expect error or close
    expect(result).not.toBe("connected");
  });

  it("executes a command sent via WebSocket and returns the output (Run button simulation)", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/terminal`);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", (err) => reject(err));
    });

    // Collect all PTY output until we see the expected marker
    const MARKER = "TONEFORGE_RUN_BTN_OK";
    const output = await new Promise<string>((resolve, reject) => {
      let data = "";

      ws.on("message", (msg) => {
        data += msg.toString();
        if (data.includes(MARKER)) {
          resolve(data);
        }
      });

      // Simulate what the Run button does: send the command as PTY input
      ws.send(
        JSON.stringify({ type: "input", data: `echo ${MARKER}\n` }),
      );

      setTimeout(() => {
        reject(
          new Error(
            `Timed out waiting for command output. Received so far: ${JSON.stringify(data)}`,
          ),
        );
      }, 5000);
    });

    // The PTY should echo the command itself and then its output
    expect(output).toContain(`echo ${MARKER}`); // command echo
    expect(output).toContain(MARKER); // command output

    ws.close();
    await new Promise((r) => setTimeout(r, 200));
  });
});
