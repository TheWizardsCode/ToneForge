/**
 * Transport abstraction for ToneForge Network.
 *
 * The network *session* logic (host/join, broadcast, authority) is deliberately
 * transport-agnostic: it only ever sees {@link PeerConnection}s and a
 * {@link TransportListener}. Two adapters ship with this module:
 *
 * - {@link InMemoryTransport} — a synchronous, in-process adapter used by the
 *   unit tests (and as the zero-configuration default).
 * - `createWebSocketTransport` (see `ws-transport.ts`) — a real WebSocket
 *   adapter that reuses the repository's existing `ws` dependency via
 *   dependency injection, so the core never depends on a WebSocket library.
 *
 * Reference: docs/prd/NETWORK_PRD.md §7 (Network API), docs/network.md.
 *
 * Work item: TF-0MUZYS2JC001AHJQ (Network transport: host/join, broadcast, authority).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Handler for an inbound text message. */
export type MessageHandler = (message: string) => void;

/** Handler for a peer disconnecting. */
export type CloseHandler = () => void;

/** Removes a previously registered handler. */
export type Unsubscribe = () => void;

/**
 * A duplex, ordered, text-message channel to a single remote peer.
 *
 * Implementations must preserve send order on a single connection: messages
 * arrive at the remote peer in the order they were sent. This is what lets the
 * session layer guarantee a deterministic receive order.
 */
export interface PeerConnection {
  /** Identifier for the connection (unique within the listener). */
  readonly id: string;
  /** Send a text message to the remote peer. */
  send(message: string): void;
  /** Register a message handler. Returns an unsubscribe function. */
  onMessage(handler: MessageHandler): Unsubscribe;
  /** Register a close handler. Returns an unsubscribe function. */
  onClose(handler: CloseHandler): Unsubscribe;
  /** Close the connection. Idempotent. */
  close(): void;
}

/**
 * A host-side listener that accepts inbound peer connections.
 *
 * `address` is only meaningful once {@link Transport.listen} has resolved.
 */
export interface TransportListener {
  /** The bound `host:port` address. */
  readonly address: string;
  /** Register a handler for newly accepted peers. Returns an unsubscribe. */
  onConnection(handler: (peer: PeerConnection) => void): Unsubscribe;
  /** Stop listening and close every accepted peer. */
  close(): Promise<void>;
}

/**
 * A pluggable transport backend.
 *
 * `host()` calls {@link Transport.listen}; `join()` calls
 * {@link Transport.connect}. Implementations are free to use sockets,
 * BroadcastChannel, WebRTC or anything else, as long as the {@link PeerConnection}
 * ordering contract holds.
 */
export interface Transport {
  /** Begin listening on `port` (0 selects an ephemeral port). */
  listen(port: number, host?: string): Promise<TransportListener>;
  /** Connect to a listener previously published at `address`. */
  connect(address: string): Promise<PeerConnection>;
}

// ---------------------------------------------------------------------------
// In-memory transport
// ---------------------------------------------------------------------------

/**
 * An in-process, synchronous {@link PeerConnection}.
 *
 * Messages are delivered synchronously when a handler is registered. If no
 * handler exists yet (the classic "welcome arrives before the client has
 * subscribed" race) messages are buffered and flushed when the first handler is
 * registered — mirroring how a real socket queues data until the application
 * attaches a listener.
 */
class InMemoryPeer implements PeerConnection {
  readonly id: string;
  /** The peer on the other end of this connection. */
  remote: InMemoryPeer | null = null;
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly closeHandlers = new Set<CloseHandler>();
  private pending: string[] = [];
  private closed = false;

  constructor(id: string) {
    this.id = id;
  }

  send(message: string): void {
    if (this.closed) return;
    const target = this.remote;
    if (!target || target.closed) return;
    target.enqueue(message);
  }

  onMessage(handler: MessageHandler): Unsubscribe {
    this.messageHandlers.add(handler);
    this.flushPending();
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onClose(handler: CloseHandler): Unsubscribe {
    if (this.closed) {
      handler();
      return () => {};
    }
    this.closeHandlers.add(handler);
    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    const target = this.remote;
    this.remote = null;
    this.fireClose();
    if (target) {
      target.remote = null;
      target.markClosed();
    }
  }

  /** Mark the connection closed without touching the other end. */
  markClosed(): void {
    if (this.closed) return;
    this.closed = true;
    this.remote = null;
    this.fireClose();
  }

  private enqueue(message: string): void {
    if (this.messageHandlers.size === 0) {
      this.pending.push(message);
      return;
    }
    for (const handler of [...this.messageHandlers]) handler(message);
  }

  private flushPending(): void {
    if (this.pending.length === 0 || this.messageHandlers.size === 0) return;
    const queued = this.pending;
    this.pending = [];
    for (const message of queued) {
      for (const handler of [...this.messageHandlers]) handler(message);
    }
  }

  private fireClose(): void {
    for (const handler of [...this.closeHandlers]) handler();
    this.closeHandlers.clear();
  }
}

/** A listener on the shared in-memory network. */
class InMemoryListener implements TransportListener {
  readonly address: string;
  private readonly peers = new Map<string, InMemoryPeer>();
  private readonly connectionHandlers = new Set<(peer: PeerConnection) => void>();
  private nextPeerId = 1;
  private closed = false;

  constructor(
    address: string,
    private readonly hub: InMemoryNetwork,
  ) {
    this.address = address;
  }

  onConnection(handler: (peer: PeerConnection) => void): Unsubscribe {
    this.connectionHandlers.add(handler);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const peer of [...this.peers.values()]) peer.close();
    this.peers.clear();
    this.hub.unregister(this.address);
  }

  /** Accept a new inbound connection; called by the hub on `connect`. */
  accept(): InMemoryPeer {
    const id = `peer-${this.nextPeerId++}`;
    const server = new InMemoryPeer(id);
    const client = new InMemoryPeer(id);
    server.remote = client;
    client.remote = server;

    this.peers.set(id, server);
    server.onClose(() => {
      this.peers.delete(id);
    });

    for (const handler of [...this.connectionHandlers]) handler(server);
    return client;
  }

  get isClosed(): boolean {
    return this.closed;
  }
}

/**
 * A shared registry of in-memory listeners.
 *
 * Host and clients must share one {@link InMemoryNetwork} to be able to reach
 * each other; `createInMemoryTransport(network)` returns a transport bound to
 * the supplied registry.
 */
export class InMemoryNetwork {
  private readonly listeners = new Map<string, InMemoryListener>();

  /** @internal — used by the transport. */
  register(address: string, listener: InMemoryListener): void {
    this.listeners.set(address, listener);
  }

  /** @internal — used by the transport. */
  unregister(address: string): void {
    this.listeners.delete(address);
  }

  /** @internal — used by the transport. */
  resolve(address: string): InMemoryListener | undefined {
    return this.listeners.get(address);
  }
}

/** In-process {@link Transport} backed by an {@link InMemoryNetwork}. */
export class InMemoryTransport implements Transport {
  constructor(private readonly hub: InMemoryNetwork) {}

  async listen(port: number, host = "127.0.0.1"): Promise<TransportListener> {
    const address = `${host}:${port}`;
    if (this.hub.resolve(address)) {
      throw new Error(`address already in use: ${address}`);
    }
    const listener = new InMemoryListener(address, this.hub);
    this.hub.register(address, listener);
    return listener;
  }

  async connect(address: string): Promise<PeerConnection> {
    const listener = this.hub.resolve(address);
    if (!listener || listener.isClosed) {
      throw new Error(`no listener at ${address}`);
    }
    return listener.accept();
  }
}

/** Create an isolated in-memory network registry. */
export function createInMemoryNetwork(): InMemoryNetwork {
  return new InMemoryNetwork();
}

/**
 * Create an in-memory {@link Transport}.
 *
 * Pass a shared {@link InMemoryNetwork} to connect a host and clients across
 * separate `createInMemoryTransport` calls; omit it to get a fresh registry.
 */
export function createInMemoryTransport(network?: InMemoryNetwork): Transport {
  return new InMemoryTransport(network ?? createInMemoryNetwork());
}

// ---------------------------------------------------------------------------
// Default transport
// ---------------------------------------------------------------------------

let defaultNetwork: InMemoryNetwork | undefined;

/**
 * The transport used when a caller does not inject one.
 *
 * Defaults to a process-wide in-memory network so `host()`/`join()` work
 * out of the box for local use and tests. Real runtimes (for example the
 * two-window browser demo) inject a WebSocket transport instead — see
 * `createWebSocketTransport`.
 */
export function defaultTransport(): Transport {
  defaultNetwork ??= createInMemoryNetwork();
  return new InMemoryTransport(defaultNetwork);
}
