/**
 * Network demo WebSocket relay.
 *
 * The two-window network demo needs a rendezvous point so two browser windows
 * (host + client) can exchange **behavioural events** — never audio. The
 * existing web server already owns the HTTP upgrade path (used by the
 * terminal), so this module attaches a small, host-authoritative relay at
 * `/ws/network`.
 *
 * The relay is deliberately transport-only: it enforces authority (only the
 * host may emit), broadcasts events to every connected peer (including the
 * host, so all windows run the identical receive → runtime-bridge path) and
 * remembers the latest event as a late-join snapshot. All sound resolution
 * happens client-side through the Demo 9 runtime bridge, so no runtime logic is
 * duplicated here.
 *
 * Reference: docs/prd/NETWORK_PRD.md §4.3 (authority), §7 (API), §8.1
 * (late-join resynchronisation); docs/network.md.
 *
 * Work item: TF-0MUZYS3UD00657Q3 (Network→Runtime/State integration).
 */

import type { WebSocket } from "ws";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A connected demo peer. */
export interface NetworkPeer {
  /** Server-assigned peer id. */
  readonly id: string;
  /** The peer's role in the session. */
  role: "host" | "client";
}

/** Relay statistics surfaced to the demo/tests. */
export interface NetworkRelayStats {
  /** Number of currently connected peers. */
  peers: number;
  /** Number of authoritative events relayed. */
  events: number;
  /** Total behavioural-event payload bytes relayed (one count per event). */
  bytesRelayed: number;
}

/** The network demo relay. */
export interface NetworkRelay {
  /** Attach a newly upgraded `/ws/network` socket. */
  handleConnection(socket: WebSocket): void;
  /** Current relay statistics. */
  stats(): NetworkRelayStats;
  /** The latest authoritative event, used as a late-join snapshot. */
  latestSnapshot(): unknown | undefined;
}

// ---------------------------------------------------------------------------
// Wire messages
// ---------------------------------------------------------------------------

interface HelloMessage {
  type: "hello";
  role?: "host" | "client";
}

interface EventMessage {
  type: "event";
  event: unknown;
}

interface RelayEvent {
  event: string;
  state: string;
  seed: number;
  time: number;
  context: Record<string, string>;
  [key: string]: unknown;
}

/** Whether a decoded value looks like a behavioural event. */
function isRelayEvent(value: unknown): value is RelayEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const event = value as Record<string, unknown>;
  return (
    typeof event["event"] === "string" &&
    event["event"].length > 0 &&
    typeof event["state"] === "string" &&
    event["state"].length > 0 &&
    typeof event["seed"] === "number" &&
    Number.isInteger(event["seed"]) &&
    typeof event["time"] === "number" &&
    Number.isFinite(event["time"]) &&
    typeof event["context"] === "object" &&
    event["context"] !== null &&
    !Array.isArray(event["context"])
  );
}

// ---------------------------------------------------------------------------
// Relay
// ---------------------------------------------------------------------------

interface InternalPeer extends NetworkPeer {
  readonly socket: WebSocket;
}

/**
 * Create a host-authoritative behavioural-event relay.
 *
 * The first peer to announce `role: "host"` owns authority. Every event a host
 * relays is broadcast to **all** connected peers, including the sender, so the
 * host window and the client window execute the same receive path and resolve
 * identical sound sequences.
 */
export function createNetworkRelay(): NetworkRelay {
  const peers = new Map<WebSocket, InternalPeer>();
  let nextPeerId = 1;
  let hostSocket: WebSocket | null = null;
  let snapshot: unknown | undefined;
  let eventCount = 0;
  let bytesRelayed = 0;

  function send(socket: WebSocket, message: unknown): void {
    if (socket.readyState !== 1 /* OPEN */) return;
    socket.send(JSON.stringify(message));
  }

  function broadcast(message: unknown): void {
    for (const peer of peers.values()) send(peer.socket, message);
  }

  function stats(): NetworkRelayStats {
    return { peers: peers.size, events: eventCount, bytesRelayed };
  }

  function assignPeerId(): string {
    return `peer-${nextPeerId++}`;
  }

  function welcome(peer: InternalPeer): void {
    send(peer.socket, {
      type: "welcome",
      peerId: peer.id,
      role: peer.role,
      ...(snapshot !== undefined ? { snapshot } : {}),
    });
  }

  function handleHello(socket: WebSocket, peer: InternalPeer, message: HelloMessage): void {
    const requested = message.role === "host" ? "host" : "client";
    if (requested === "host") {
      if (hostSocket !== null && hostSocket !== socket) {
        send(socket, {
          type: "error",
          message: "a host is already connected",
        });
        return;
      }
      hostSocket = socket;
      peer.role = "host";
      snapshot = undefined;
    } else {
      peer.role = "client";
    }
    welcome(peer);
    broadcast({ type: "peers", stats: stats() });
  }

  function handleEvent(socket: WebSocket, message: EventMessage): void {
    if (hostSocket !== socket) {
      send(socket, {
        type: "error",
        message: "only the host may emit behavioural events",
      });
      return;
    }
    if (!isRelayEvent(message.event)) {
      send(socket, { type: "error", message: "malformed behavioural event" });
      return;
    }
    const event = message.event;
    const payload = JSON.stringify(event);
    bytesRelayed += Buffer.byteLength(payload);
    eventCount += 1;
    snapshot = event;
    // Broadcast to all peers (including the host) so every window resolves the
    // same event through the same runtime path.
    broadcast({ type: "event", event });
  }

  function handleMessage(socket: WebSocket, raw: string): void {
    const peer = peers.get(socket);
    if (!peer) return;

    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      send(socket, { type: "error", message: "malformed JSON message" });
      return;
    }

    switch (message["type"]) {
      case "hello":
        handleHello(socket, peer, message as unknown as HelloMessage);
        return;
      case "event":
        handleEvent(socket, message as unknown as EventMessage);
        return;
      case "status":
        send(socket, { type: "status", ...stats() });
        return;
      default:
        send(socket, { type: "error", message: "unknown message type" });
    }
  }

  return {
    handleConnection(socket: WebSocket): void {
      const peer: InternalPeer = {
        id: assignPeerId(),
        // Until `hello` arrives the peer is treated as a client.
        role: "client",
        socket,
      };
      peers.set(socket, peer);
      send(socket, { type: "peers", stats: stats() });

      socket.on("message", (raw: Buffer | string) =>
        handleMessage(socket, raw.toString()),
      );
      socket.on("close", () => {
        peers.delete(socket);
        if (hostSocket === socket) {
          hostSocket = null;
          snapshot = undefined;
        }
        broadcast({ type: "peers", stats: stats() });
      });
      socket.on("error", () => {
        // Errors are surfaced through `close`; nothing else to do here.
      });
    },

    stats,

    latestSnapshot(): unknown | undefined {
      return snapshot;
    },
  };
}
