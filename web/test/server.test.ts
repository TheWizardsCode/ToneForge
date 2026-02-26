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

// ── Exec message handling and sentinel stripping ───────────────────

describe("exec message handling", () => {
  /**
   * Helper: open a WebSocket, wait for connection, and wait for the shell
   * prompt to appear (indicating the PTY is ready for commands).
   */
  async function openTerminal(): Promise<WebSocket> {
    const ws = new WebSocket(`ws://localhost:${port}/ws/terminal`);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", (err) => reject(err));
    });

    // Wait for initial shell output (prompt) before sending commands
    await new Promise<void>((resolve) => {
      const onMessage = (): void => {
        ws.off("message", onMessage);
        resolve();
      };
      ws.on("message", onMessage);
      // Safety timeout — resolve even if no output (shell may not send prompt immediately)
      setTimeout(resolve, 1000);
    });

    return ws;
  }

  /**
   * Helper: collect all messages from the WebSocket until a commandDone
   * message is received or a timeout expires. Returns the collected raw
   * output and the commandDone exit code.
   */
  async function collectUntilDone(
    ws: WebSocket,
    timeoutMs = 10_000,
  ): Promise<{ rawOutput: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      let rawOutput = "";
      let exitCode = -1;

      const onMessage = (msg: Buffer | string): void => {
        const str = msg.toString();

        // Check if this is a commandDone JSON message
        if (str.startsWith("{")) {
          try {
            const parsed = JSON.parse(str);
            if (parsed.type === "commandDone" && typeof parsed.exitCode === "number") {
              exitCode = parsed.exitCode;
              ws.off("message", onMessage);
              resolve({ rawOutput, exitCode });
              return;
            }
          } catch {
            // Not JSON — treat as raw output
          }
        }

        rawOutput += str;
      };

      ws.on("message", onMessage);

      setTimeout(() => {
        ws.off("message", onMessage);
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for commandDone. ` +
              `Raw output so far: ${JSON.stringify(rawOutput)}`,
          ),
        );
      }, timeoutMs);
    });
  }

  it("sends a commandDone message with exit code 0 for a successful command", async () => {
    const ws = await openTerminal();

    // Send an exec message
    ws.send(JSON.stringify({ type: "exec", data: "echo EXEC_TEST_OK\n" }));

    const { rawOutput, exitCode } = await collectUntilDone(ws);

    expect(exitCode).toBe(0);
    // The command's output should be present
    expect(rawOutput).toContain("EXEC_TEST_OK");

    ws.close();
    await new Promise((r) => setTimeout(r, 200));
  });

  it("sends a commandDone message with non-zero exit code for a failing command", async () => {
    const ws = await openTerminal();

    // Use a subshell exit so the parent bash session stays alive and the
    // sentinel can still emit the OSC sequence with the captured exit code.
    ws.send(JSON.stringify({ type: "exec", data: "(exit 42)\n" }));

    const { exitCode } = await collectUntilDone(ws);

    expect(exitCode).toBe(42);

    ws.close();
    await new Promise((r) => setTimeout(r, 200));
  });

  it("strips the sentinel echo text from PTY output", async () => {
    const ws = await openTerminal();

    // Send an exec message and collect all raw output until commandDone
    ws.send(JSON.stringify({ type: "exec", data: "echo SENTINEL_STRIP_TEST\n" }));

    const { rawOutput, exitCode } = await collectUntilDone(ws);

    expect(exitCode).toBe(0);

    // The sentinel suffix should NOT appear in the raw output forwarded to the client.
    // The sentinel text is: ; __TF_EC=$?; printf '\033]133;D;%d\007' $__TF_EC
    expect(rawOutput).not.toContain("__TF_EC");
    expect(rawOutput).not.toContain("printf");
    expect(rawOutput).not.toContain("133;D");

    // But the command echo and output should still be present
    expect(rawOutput).toContain("SENTINEL_STRIP_TEST");

    ws.close();
    await new Promise((r) => setTimeout(r, 200));
  });

  it("does not forward the raw OSC 133;D sequence to the client", async () => {
    const ws = await openTerminal();

    ws.send(JSON.stringify({ type: "exec", data: "echo OSC_INTERCEPT_TEST\n" }));

    const { rawOutput, exitCode } = await collectUntilDone(ws);

    expect(exitCode).toBe(0);

    // The OSC escape sequence \x1b]133;D;0\x07 should be intercepted and
    // never forwarded as raw output
    expect(rawOutput).not.toContain("\x1b]133;D");
    expect(rawOutput).not.toContain("\x07");

    ws.close();
    await new Promise((r) => setTimeout(r, 200));
  });

  it("preserves the user command echo in the output", async () => {
    const ws = await openTerminal();

    const MARKER = "USER_CMD_ECHO_TEST_12345";
    ws.send(JSON.stringify({ type: "exec", data: `echo ${MARKER}\n` }));

    const { rawOutput, exitCode } = await collectUntilDone(ws);

    expect(exitCode).toBe(0);

    // The terminal should echo the user's command (the "echo ..." part)
    // and also show the command's output
    expect(rawOutput).toContain(`echo ${MARKER}`);
    expect(rawOutput).toContain(MARKER);

    ws.close();
    await new Promise((r) => setTimeout(r, 200));
  });
});
