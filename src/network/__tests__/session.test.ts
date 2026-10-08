/**
 * Network session tests: host/join lifecycle, peer registry, host-authoritative
 * broadcast and deterministic receive order.
 *
 * All tests run offline through the in-memory transport; one test injects a
 * deliberately reordering transport to prove the session restores sequence
 * order before delivery.
 *
 * Work item: TF-0MUZYS2JC001AHJQ (Network transport: host/join, broadcast, authority).
 */

import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryNetwork,
  createInMemoryTransport,
  type PeerConnection,
  type Transport,
  type TransportListener,
} from "../transport.js";
import {
  HOST_PEER_ID,
  NotAuthoritativeError,
  host,
  join,
} from "../session.js";
import type { BehaviouralEvent, BehaviouralEventInput } from "../types.js";

function event(name: string, time = 1): BehaviouralEventInput {
  return {
    event: name,
    seed: 42,
    time,
    state: "walk",
    context: { surface: "gravel" },
  };
}

function isolatedTransport(): Transport {
  return createInMemoryTransport(createInMemoryNetwork());
}

/**
 * A transport that holds inbound event messages and can flush them in reverse,
 * simulating a transport that reorders frames. The welcome handshake is always
 * delivered eagerly so `join()` can complete.
 */
class ReorderingClientTransport implements Transport {
  private target: ((raw: string) => void) | undefined;
  private readonly pending: string[] = [];

  constructor(private readonly inner: Transport) {}

  listen(port: number, host?: string): Promise<TransportListener> {
    return this.inner.listen(port, host);
  }

  async connect(address: string): Promise<PeerConnection> {
    const connection = await this.inner.connect(address);
    return {
      id: connection.id,
      send: (message) => connection.send(message),
      onMessage: (handler) => {
        this.target = handler;
        return connection.onMessage((raw) => {
          const parsed = JSON.parse(raw) as { t?: string };
          if (parsed.t === "welcome") {
            handler(raw);
          } else {
            this.pending.push(raw);
          }
        });
      },
      onClose: (handler) => connection.onClose(handler),
      close: () => connection.close(),
    };
  }

  /** Deliver all buffered event frames in reverse arrival order. */
  flushReversed(): void {
    const frames = this.pending.splice(0).reverse();
    for (const frame of frames) this.target?.(frame);
  }
}

describe("Network session — host/join lifecycle", () => {
  it("host() starts a host session bound to an address", async () => {
    const transport = isolatedTransport();
    const session = await host({ port: 0, transport });
    expect(session.role).toBe("host");
    expect(session.peerId).toBe(HOST_PEER_ID);
    expect(session.address).toBe("127.0.0.1:0");
    expect(session.peers()).toEqual([]);
    await session.close();
  });

  it("join() connects a client and assigns it a peer id", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    const client = await join(hostSession.address, { transport });

    expect(client.role).toBe("client");
    expect(client.peerId).toBe("peer-1");
    expect(client.address).toBe(hostSession.address);
    expect(client.peers()).toEqual([HOST_PEER_ID]);

    await client.close();
    await hostSession.close();
  });

  it("emits connect and disconnect lifecycle events on the host", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    const connects: string[] = [];
    const disconnects: string[] = [];
    hostSession.onPeerConnect((peerId) => connects.push(peerId));
    hostSession.onPeerDisconnect((peerId) => disconnects.push(peerId));

    const client = await join(hostSession.address, { transport });
    expect(connects).toEqual(["peer-1"]);
    expect(hostSession.peers()).toEqual(["peer-1"]);

    await client.close();
    expect(disconnects).toEqual(["peer-1"]);
    expect(hostSession.peers()).toEqual([]);

    await hostSession.close();
  });

  it("notifies a client when the host disconnects", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    const client = await join(hostSession.address, { transport });
    const disconnects: string[] = [];
    client.onPeerDisconnect((peerId) => disconnects.push(peerId));

    await hostSession.close();
    expect(disconnects).toEqual([HOST_PEER_ID]);
    expect(client.peers()).toEqual([]);
  });

  it("removes dropped peers from the registry", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    const a = await join(hostSession.address, { transport });
    const b = await join(hostSession.address, { transport });
    expect(hostSession.peers()).toEqual(["peer-1", "peer-2"]);

    await a.close();
    expect(hostSession.peers()).toEqual(["peer-2"]);

    await b.close();
    await hostSession.close();
  });
});

describe("Network session — broadcast", () => {
  it("broadcasts events to every connected peer in deterministic order", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    const clients = await Promise.all([
      join(hostSession.address, { transport }),
      join(hostSession.address, { transport }),
      join(hostSession.address, { transport }),
    ]);

    const received = clients.map(() => [] as string[]);
    clients.forEach((client, index) => {
      client.onReceive((e) => received[index]!.push(e.event));
    });

    for (const name of ["a", "b", "c", "d"]) {
      hostSession.emit(event(name));
    }

    for (const order of received) {
      expect(order).toEqual(["a", "b", "c", "d"]);
    }

    await Promise.all(clients.map((c) => c.close()));
    await hostSession.close();
  });

  it("delivers the emitted event to the host locally", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    const local: BehaviouralEvent[] = [];
    hostSession.onReceive((e) => local.push(e));

    hostSession.emit(event("solo"));
    expect(local.map((e) => e.event)).toEqual(["solo"]);

    await hostSession.close();
  });

  it("round-trips the canonical event to the client", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    const client = await join(hostSession.address, { transport });
    const received: BehaviouralEvent[] = [];
    client.onReceive((e) => received.push(e));

    hostSession.emit({
      event: "footstep",
      seed: 1042,
      time: 123.45,
      state: "walk",
      context: { surface: "gravel" },
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      version: 1,
      event: "footstep",
      seed: 1042,
      time: 123.45,
      state: "walk",
      context: { surface: "gravel" },
    });

    await client.close();
    await hostSession.close();
  });

  it("does not replay events emitted before a client joined", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    hostSession.emit(event("before"));

    const client = await join(hostSession.address, { transport });
    const received: string[] = [];
    client.onReceive((e) => received.push(e.event));

    hostSession.emit(event("after"));
    expect(received).toEqual(["after"]);

    await client.close();
    await hostSession.close();
  });

  it("delivers events in sequence order even when the transport reorders", async () => {
    const base = isolatedTransport();
    const reordering = new ReorderingClientTransport(base);
    const hostSession = await host({ port: 0, transport: base });
    const client = await join(hostSession.address, { transport: reordering });

    const received: string[] = [];
    client.onReceive((e) => received.push(e.event));

    hostSession.emit(event("one"));
    hostSession.emit(event("two"));
    hostSession.emit(event("three"));
    expect(received).toEqual([]);

    reordering.flushReversed();
    expect(received).toEqual(["one", "two", "three"]);

    await client.close();
    await hostSession.close();
  });
});

describe("Network session — authority", () => {
  it("rejects an authoritative emit from a non-host peer", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    const client = await join(hostSession.address, { transport });

    expect(() => client.emit(event("nope"))).toThrow(NotAuthoritativeError);

    await client.close();
    await hostSession.close();
  });

  it("validates events before broadcasting", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    const client = await join(hostSession.address, { transport });
    const received = vi.fn();
    client.onReceive(received);

    expect(() =>
      hostSession.emit({ event: "", seed: 1, time: 0, state: "walk", context: {} }),
    ).toThrow();

    expect(received).not.toHaveBeenCalled();
    await client.close();
    await hostSession.close();
  });

  it("rejects emit after the session is closed", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    await hostSession.close();
    expect(() => hostSession.emit(event("late"))).toThrow(/closed/);
  });
});

describe("Network session — default transport", () => {
  it("host()/join() work without an injected transport", async () => {
    const hostSession = await host({ port: 45999 });
    const client = await join(hostSession.address);
    const received: string[] = [];
    client.onReceive((e) => received.push(e.event));

    hostSession.emit(event("default"));
    expect(received).toEqual(["default"]);

    await client.close();
    await hostSession.close();
  });
});
