/**
 * WebSocket transport integration test.
 *
 * This is the one test that exercises the real WebSocket adapter end to end:
 * it hosts on an ephemeral loopback port and joins over an actual TCP
 * connection. The `ws` implementation is injected (loaded from the existing
 * `web` workspace dependency) so the network core stays dependency-free.
 *
 * Work item: TF-0MUZYS2JC001AHJQ (Network transport: host/join, broadcast, authority).
 */

import { beforeAll, describe, expect, it } from "vitest";
import { join as joinPath } from "node:path";
import { pathToFileURL } from "node:url";

import { createWebSocketTransport, type WebSocketLibrary } from "../ws-transport.js";
import { host, join } from "../session.js";
import type { BehaviouralEventInput } from "../types.js";

/** Load the repository's existing `ws` implementation for injection. */
async function loadWebSocketLibrary(): Promise<WebSocketLibrary> {
  // Prefer a root install if one ever exists…
  try {
    const specifier = "ws";
    const mod = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
    return {
      WebSocket: mod.WebSocket as WebSocketLibrary["WebSocket"],
      WebSocketServer: mod.WebSocketServer as WebSocketLibrary["WebSocketServer"],
    };
  } catch {
    // …otherwise reuse the `ws` already installed for the `web` workspace.
    const url = pathToFileURL(
      joinPath(process.cwd(), "web", "node_modules", "ws", "wrapper.mjs"),
    ).href;
    const mod = (await import(/* @vite-ignore */ url)) as Record<string, unknown>;
    return {
      WebSocket: mod.WebSocket as WebSocketLibrary["WebSocket"],
      WebSocketServer: mod.WebSocketServer as WebSocketLibrary["WebSocketServer"],
    };
  }
}

function event(name: string, time = 1): BehaviouralEventInput {
  return { event: name, seed: 7, time, state: "walk", context: {} };
}

/** Resolve once `check` passes, or reject after `timeoutMs`. */
function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      if (check()) {
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        reject(new Error("timed out waiting for condition"));
      } else {
        setTimeout(poll, 5);
      }
    };
    poll();
  });
}

describe("WebSocket transport (integration)", () => {
  let library: WebSocketLibrary;

  beforeAll(async () => {
    library = await loadWebSocketLibrary();
  });

  it("hosts and joins over a real loopback socket", async () => {
    const transport = createWebSocketTransport(library);
    const hostSession = await host({ port: 0, transport });
    expect(hostSession.address).toMatch(/^127\.0\.0\.1:\d+$/);

    const client = await join(hostSession.address, { transport });
    expect(client.role).toBe("client");
    expect(client.peerId).toBe("peer-1");
    expect(hostSession.peers()).toEqual(["peer-1"]);

    await client.close();
    await hostSession.close();
  });

  it("broadcasts events to a WebSocket client in order", async () => {
    const transport = createWebSocketTransport(library);
    const hostSession = await host({ port: 0, transport });
    const client = await join(hostSession.address, { transport });

    const received: string[] = [];
    client.onReceive((e) => received.push(e.event));

    hostSession.emit(event("one"));
    hostSession.emit(event("two"));
    hostSession.emit(event("three"));

    await waitFor(() => received.length === 3);
    expect(received).toEqual(["one", "two", "three"]);

    await client.close();
    await hostSession.close();
  });

  it("tracks WebSocket peer connect/disconnect in the registry", async () => {
    const transport = createWebSocketTransport(library);
    const hostSession = await host({ port: 0, transport });
    const client = await join(hostSession.address, { transport });
    expect(hostSession.peers()).toEqual(["peer-1"]);

    await client.close();
    await waitFor(() => hostSession.peers().length === 0);
    expect(hostSession.peers()).toEqual([]);

    await hostSession.close();
  });

  it("requires an injected WebSocketServer to host", async () => {
    const transport = createWebSocketTransport({ WebSocket: library.WebSocket });
    await expect(host({ port: 0, transport })).rejects.toThrow(
      /WebSocketServer implementation is required/,
    );
  });
});
