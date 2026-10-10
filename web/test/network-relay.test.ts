/**
 * Integration tests for the network demo relay (`/ws/network`).
 *
 * Covers the server side of TF-0MUZYS3UD00657Q3 AC3:
 *
 * - a host can relay a behavioural event and every peer receives it;
 * - clients are not authoritative (NETWORK_PRD §4.3);
 * - a late joiner receives the latest event as a snapshot;
 * - the relay reports bandwidth-relevant statistics.
 *
 * These start a real server on an ephemeral port and use real WebSocket
 * clients.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { server, startServer } from "../server/index.js";

let port: number;

beforeAll(async () => {
  port = await startServer(0);
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

interface RelayMessage {
  type: string;
  [key: string]: unknown;
}

/** Open a `/ws/network` client and resolve once connected. */
function openPeer(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${port}/ws/network`);
    socket.on("open", () => resolve(socket));
    socket.on("error", reject);
  });
}

/** Wait for the next relay message matching `predicate`. */
function nextMessage(
  socket: WebSocket,
  predicate: (message: RelayMessage) => boolean,
): Promise<RelayMessage> {
  return new Promise((resolve, reject) => {
    const onMessage = (raw: Buffer | string): void => {
      let parsed: RelayMessage;
      try {
        parsed = JSON.parse(raw.toString()) as RelayMessage;
      } catch {
        return;
      }
      if (predicate(parsed)) {
        socket.off("message", onMessage);
        resolve(parsed);
      }
    };
    socket.on("message", onMessage);
    setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("timed out waiting for relay message"));
    }, 5000);
  });
}

const sampleEvent = {
  version: 1,
  event: "state-transition",
  seed: 42,
  time: 0,
  state: "walk",
  context: { surface: "stone" },
};

describe("network relay — host broadcast (AC3)", () => {
  it("broadcasts a host event to every peer, including the host", async () => {
    const host = await openPeer();
    const client = await openPeer();

    host.send(JSON.stringify({ type: "hello", role: "host" }));
    await nextMessage(host, (m) => m.type === "welcome");
    client.send(JSON.stringify({ type: "hello", role: "client" }));
    await nextMessage(client, (m) => m.type === "welcome");

    const clientEvent = nextMessage(client, (m) => m.type === "event");
    const hostEvent = nextMessage(host, (m) => m.type === "event");
    host.send(JSON.stringify({ type: "event", event: sampleEvent }));

    const [receivedByClient, receivedByHost] = await Promise.all([
      clientEvent,
      hostEvent,
    ]);
    expect(receivedByClient["event"]).toEqual(sampleEvent);
    expect(receivedByHost["event"]).toEqual(sampleEvent);

    host.close();
    client.close();
  });

  it("rejects an event emitted by a non-authoritative client", async () => {
    const host = await openPeer();
    const client = await openPeer();
    host.send(JSON.stringify({ type: "hello", role: "host" }));
    await nextMessage(host, (m) => m.type === "welcome");
    client.send(JSON.stringify({ type: "hello", role: "client" }));
    await nextMessage(client, (m) => m.type === "welcome");

    const error = nextMessage(client, (m) => m.type === "error");
    client.send(JSON.stringify({ type: "event", event: sampleEvent }));
    const message = await error;
    expect(message["message"]).toMatch(/host/i);

    host.close();
    client.close();
  });

  it("delivers the latest event to a late-joining client as a snapshot", async () => {
    const host = await openPeer();
    host.send(JSON.stringify({ type: "hello", role: "host" }));
    await nextMessage(host, (m) => m.type === "welcome");

    host.send(JSON.stringify({ type: "event", event: sampleEvent }));
    await nextMessage(host, (m) => m.type === "event");

    // Join after the event was relayed.
    const late = await openPeer();
    late.send(JSON.stringify({ type: "hello", role: "client" }));
    const welcome = await nextMessage(late, (m) => m.type === "welcome");
    expect(welcome["snapshot"]).toEqual(sampleEvent);

    host.close();
    late.close();
  });

  it("reports relay statistics for bandwidth measurement", async () => {
    const host = await openPeer();
    host.send(JSON.stringify({ type: "hello", role: "host" }));
    await nextMessage(host, (m) => m.type === "welcome");
    host.send(JSON.stringify({ type: "event", event: sampleEvent }));
    await nextMessage(host, (m) => m.type === "event");

    const status = nextMessage(host, (m) => m.type === "status");
    host.send(JSON.stringify({ type: "status" }));
    const message = await status;
    expect(message["events"]).toBeGreaterThanOrEqual(1);
    expect(message["bytesRelayed"]).toBeGreaterThan(0);

    host.close();
  });
});
