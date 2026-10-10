/**
 * In-memory transport adapter tests.
 *
 * The in-memory transport is the offline, deterministic backend used by the
 * network unit tests. These tests pin its contract: ordered delivery,
 * buffering before subscription, close propagation and listener lifecycle.
 *
 * Work item: TF-0MUZYS2JC001AHJQ (Network transport: host/join, broadcast, authority).
 */

import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryNetwork,
  createInMemoryTransport,
  type PeerConnection,
} from "../transport.js";

function makeTransport() {
  const network = createInMemoryNetwork();
  return { network, transport: createInMemoryTransport(network) };
}

describe("InMemoryTransport", () => {
  it("listen() exposes a host:port address", async () => {
    const { transport } = makeTransport();
    const listener = await transport.listen(0, "127.0.0.1");
    expect(listener.address).toBe("127.0.0.1:0");
    await listener.close();
  });

  it("connect() rejects when no listener is registered", async () => {
    const { transport } = makeTransport();
    await expect(transport.connect("127.0.0.1:9999")).rejects.toThrow(
      /no listener/,
    );
  });

  it("rejects a duplicate listen on the same address", async () => {
    const { transport } = makeTransport();
    const listener = await transport.listen(4242);
    await expect(transport.listen(4242)).rejects.toThrow(/already in use/);
    await listener.close();
  });

  it("delivers messages in send order", async () => {
    const { transport } = makeTransport();
    const listener = await transport.listen(0);
    let server: PeerConnection | undefined;
    listener.onConnection((peer) => {
      server = peer;
    });

    const client = await transport.connect(listener.address);
    const received: string[] = [];
    server!.onMessage((message) => received.push(message));

    client.send("one");
    client.send("two");
    client.send("three");

    expect(received).toEqual(["one", "two", "three"]);
    await listener.close();
  });

  it("buffers messages sent before a handler is registered", async () => {
    const { transport } = makeTransport();
    const listener = await transport.listen(0);
    let server: PeerConnection | undefined;
    listener.onConnection((peer) => {
      server = peer;
    });

    const client = await transport.connect(listener.address);
    // Send before the server subscribes — must not be lost.
    client.send("early");
    const received: string[] = [];
    server!.onMessage((message) => received.push(message));

    expect(received).toEqual(["early"]);
    await listener.close();
  });

  it("unsubscribing a message handler stops delivery", async () => {
    const { transport } = makeTransport();
    const listener = await transport.listen(0);
    let server: PeerConnection | undefined;
    listener.onConnection((peer) => {
      server = peer;
    });

    const client = await transport.connect(listener.address);
    const received: string[] = [];
    const unsubscribe = server!.onMessage((message) => received.push(message));

    client.send("first");
    unsubscribe();
    client.send("second");

    expect(received).toEqual(["first"]);
    await listener.close();
  });

  it("propagates close from client to server", async () => {
    const { transport } = makeTransport();
    const listener = await transport.listen(0);
    let server: PeerConnection | undefined;
    listener.onConnection((peer) => {
      server = peer;
    });

    const client = await transport.connect(listener.address);
    const onClose = vi.fn();
    server!.onClose(onClose);

    client.close();
    expect(onClose).toHaveBeenCalledTimes(1);
    await listener.close();
  });

  it("propagates close from server to client", async () => {
    const { transport } = makeTransport();
    const listener = await transport.listen(0);
    let server: PeerConnection | undefined;
    listener.onConnection((peer) => {
      server = peer;
    });

    const client = await transport.connect(listener.address);
    const onClose = vi.fn();
    client.onClose(onClose);

    server!.close();
    expect(onClose).toHaveBeenCalledTimes(1);
    await listener.close();
  });

  it("closing the listener closes accepted peers", async () => {
    const { transport } = makeTransport();
    const listener = await transport.listen(0);
    let server: PeerConnection | undefined;
    listener.onConnection((peer) => {
      server = peer;
    });

    const client = await transport.connect(listener.address);
    const onClose = vi.fn();
    client.onClose(onClose);

    await listener.close();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(server).toBeDefined();
  });

  it("onConnection fires for each accepted peer with a unique id", async () => {
    const { transport } = makeTransport();
    const listener = await transport.listen(0);
    const ids: string[] = [];
    listener.onConnection((peer) => ids.push(peer.id));

    await transport.connect(listener.address);
    await transport.connect(listener.address);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    await listener.close();
  });
});
