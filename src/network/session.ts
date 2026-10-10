/**
 * Network session: host/join lifecycle, peer registry and host-authoritative
 * broadcast of behavioural events.
 *
 * A session is a thin, transport-agnostic coordinator over a {@link Transport}:
 *
 * - `host({ port })` starts a listener and owns authority over the session.
 * - `join("host:port")` connects a client and performs a handshake that
 *   assigns it a peer id.
 * - Only the host may {@link NetworkSession.emit} authoritative events; every
 *   connected peer (including the host itself) receives them in a deterministic,
 *   sequence-numbered order.
 *
 * Reference: docs/prd/NETWORK_PRD.md §4.3 (authority), §7 (API), docs/network.md.
 *
 * Work item: TF-0MUZYS2JC001AHJQ (Network transport: host/join, broadcast, authority).
 */

import {
  createBehaviouralEvent,
  validateBehaviouralEvent,
  type BehaviouralEvent,
  type BehaviouralEventInput,
} from "./types.js";
import { canonicalStringify } from "./events.js";
import {
  SnapshotTracker,
  validateSnapshot,
  type StateSnapshot,
} from "./snapshot.js";
import {
  defaultTransport,
  type PeerConnection,
  type Transport,
  type TransportListener,
  type Unsubscribe,
} from "./transport.js";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown when a non-host peer attempts to emit an authoritative event. */
export class NotAuthoritativeError extends Error {
  constructor(peerId: string) {
    super(
      `peer "${peerId}" is not authoritative; only the host may emit events`,
    );
    this.name = "NotAuthoritativeError";
  }
}

/** Thrown when operating on a session that has already been closed. */
export class SessionClosedError extends Error {
  constructor() {
    super("network session is closed");
    this.name = "SessionClosedError";
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The role a session plays in the network. */
export type NetworkRole = "host" | "client";

/** Options for {@link host}. */
export interface HostOptions {
  /** Port to listen on. `0` selects an ephemeral port. */
  port: number;
  /** Interface to bind. Defaults to `127.0.0.1`. */
  host?: string;
  /** Transport backend. Defaults to a process-wide in-memory network. */
  transport?: Transport;
}

/** Options for {@link join}. */
export interface JoinOptions {
  /** Transport backend. Defaults to a process-wide in-memory network. */
  transport?: Transport;
}

/**
 * A live network session (host or client).
 *
 * Handlers registered with `on*` return an unsubscribe function. A session is
 * a participant as well as a coordinator: on the host, `emit` also delivers the
 * event locally via `onReceive`.
 */
export interface NetworkSession {
  /** Whether this session is the host or a client. */
  readonly role: NetworkRole;
  /** This session's peer id (`"host"` on the host; assigned by the host on a client). */
  readonly peerId: string;
  /** The bound (host) or connected (client) `host:port` address. */
  readonly address: string;
  /** Ids of the currently connected peers, sorted for determinism. */
  peers(): string[];
  /** Fires when a peer connects. Returns an unsubscribe function. */
  onPeerConnect(handler: (peerId: string) => void): Unsubscribe;
  /** Fires when a peer disconnects. Returns an unsubscribe function. */
  onPeerDisconnect(handler: (peerId: string) => void): Unsubscribe;
  /** Fires for each received behavioural event, in deterministic order. */
  onReceive(handler: (event: BehaviouralEvent) => void): Unsubscribe;
  /**
   * The most recent state snapshot.
   *
   * On the host this is the snapshot captured from the last event it emitted;
   * on a client it is the snapshot delivered in the join handshake. Returns
   * `undefined` before any event has been captured/delivered.
   */
  snapshot(): StateSnapshot | undefined;
  /**
   * Fires when a state snapshot is captured (host) or applied (client).
   *
   * If a snapshot already exists the handler is invoked immediately with it, so
   * a late joiner that registers after `join()` resolves still observes the
   * current state. Returns an unsubscribe function.
   */
  onSnapshot(handler: (snapshot: StateSnapshot) => void): Unsubscribe;
  /**
   * Broadcast a behavioural event to every peer.
   *
   * @throws {NotAuthoritativeError} on a client session.
   * @throws {SessionClosedError} on a closed session.
   */
  emit(event: BehaviouralEventInput): void;
  /** Close the session and release its transport resources. */
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Wire protocol
// ---------------------------------------------------------------------------

/** The peer id the host always uses. */
export const HOST_PEER_ID = "host";

interface WelcomeMessage {
  t: "welcome";
  peerId: string;
  hostPeerId: string;
  /** Sequence number the host will use for the first event sent to this peer. */
  startSeq: number;
  /** Late-join state snapshot, when the host has already emitted an event. */
  snapshot?: StateSnapshot;
}

interface EventMessage {
  t: "event";
  seq: number;
  event: BehaviouralEvent;
}

type WireMessage = WelcomeMessage | EventMessage;

function parseWireMessage(raw: string): WireMessage | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const message = parsed as Record<string, unknown>;

  if (message.t === "welcome") {
    if (
      typeof message.peerId !== "string" ||
      typeof message.hostPeerId !== "string" ||
      typeof message.startSeq !== "number" ||
      !Number.isInteger(message.startSeq)
    ) {
      return undefined;
    }
    // A corrupt snapshot must not block the join handshake: drop it and let
    // the client wait for the next live event instead.
    let snapshot: StateSnapshot | undefined;
    if (message.snapshot !== undefined) {
      const validated = validateSnapshot(message.snapshot);
      if (validated.valid) snapshot = validated.snapshot;
    }
    return {
      t: "welcome",
      peerId: message.peerId,
      hostPeerId: message.hostPeerId,
      startSeq: message.startSeq,
      ...(snapshot ? { snapshot } : {}),
    };
  }

  if (message.t === "event") {
    if (typeof message.seq !== "number" || !Number.isInteger(message.seq)) {
      return undefined;
    }
    const validated = validateBehaviouralEvent(message.event);
    if (!validated.valid) return undefined;
    return { t: "event", seq: message.seq, event: validated.event };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Shared handler bookkeeping
// ---------------------------------------------------------------------------

class HandlerSet<T> {
  private readonly handlers = new Set<T>();

  add(handler: T): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit(run: (handler: T) => void): void {
    for (const handler of [...this.handlers]) run(handler);
  }

  clear(): void {
    this.handlers.clear();
  }
}

// ---------------------------------------------------------------------------
// Host session
// ---------------------------------------------------------------------------

class HostSession implements NetworkSession {
  readonly role = "host" as const;
  readonly peerId = HOST_PEER_ID;
  address = "";

  private listener!: TransportListener;
  private readonly connections = new Map<string, PeerConnection>();
  private readonly peerConnectHandlers = new HandlerSet<(peerId: string) => void>();
  private readonly peerDisconnectHandlers = new HandlerSet<(peerId: string) => void>();
  private readonly receiveHandlers = new HandlerSet<(event: BehaviouralEvent) => void>();
  private readonly snapshotHandlers = new HandlerSet<(snapshot: StateSnapshot) => void>();
  private readonly snapshotTracker = new SnapshotTracker();
  private nextPeerSeq = 1;
  private nextEventSeq = 1;
  private closed = false;

  static async create(transport: Transport, options: HostOptions): Promise<HostSession> {
    const session = new HostSession();
    session.listener = await transport.listen(options.port, options.host);
    session.address = session.listener.address;
    session.listener.onConnection((connection) => session.addPeer(connection));
    return session;
  }

  peers(): string[] {
    return [...this.connections.keys()].sort();
  }

  onPeerConnect(handler: (peerId: string) => void): Unsubscribe {
    return this.peerConnectHandlers.add(handler);
  }

  onPeerDisconnect(handler: (peerId: string) => void): Unsubscribe {
    return this.peerDisconnectHandlers.add(handler);
  }

  onReceive(handler: (event: BehaviouralEvent) => void): Unsubscribe {
    return this.receiveHandlers.add(handler);
  }

  snapshot(): StateSnapshot | undefined {
    return this.snapshotTracker.latest();
  }

  onSnapshot(handler: (snapshot: StateSnapshot) => void): Unsubscribe {
    const unsubscribe = this.snapshotHandlers.add(handler);
    const current = this.snapshotTracker.latest();
    if (current) handler(current);
    return unsubscribe;
  }

  emit(input: BehaviouralEventInput): void {
    if (this.closed) throw new SessionClosedError();
    const event = createBehaviouralEvent(input);
    const snapshot = this.snapshotTracker.capture(event);
    const seq = this.nextEventSeq++;
    const wire = canonicalStringify({ t: "event", seq, event });

    // The host is a participant: resolve locally first, then broadcast.
    this.deliver(event);
    this.snapshotHandlers.emit((handler) => handler(snapshot));
    for (const connection of this.connections.values()) {
      connection.send(wire);
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const peerIds = [...this.connections.keys()];
    this.connections.clear();
    await this.listener.close();
    for (const peerId of peerIds) this.peerDisconnectHandlers.emit((h) => h(peerId));
    this.peerConnectHandlers.clear();
    this.peerDisconnectHandlers.clear();
    this.receiveHandlers.clear();
    this.snapshotHandlers.clear();
  }

  private addPeer(connection: PeerConnection): void {
    if (this.closed) {
      connection.close();
      return;
    }
    const peerId = `peer-${this.nextPeerSeq++}`;
    this.connections.set(peerId, connection);
    connection.onMessage(() => {
      // Clients never send authoritative events; drain anything inbound.
    });
    connection.onClose(() => this.removePeer(peerId));
    connection.send(
      canonicalStringify({
        t: "welcome",
        peerId,
        hostPeerId: HOST_PEER_ID,
        startSeq: this.nextEventSeq,
        snapshot: this.snapshotTracker.latest(),
      }),
    );
    this.peerConnectHandlers.emit((handler) => handler(peerId));
  }

  private removePeer(peerId: string): void {
    if (!this.connections.delete(peerId)) return;
    this.peerDisconnectHandlers.emit((handler) => handler(peerId));
  }

  private deliver(event: BehaviouralEvent): void {
    this.receiveHandlers.emit((handler) => handler(event));
  }
}

// ---------------------------------------------------------------------------
// Client session
// ---------------------------------------------------------------------------

class ClientSession implements NetworkSession {
  readonly role = "client" as const;
  peerId = "";
  address = "";

  private connection!: PeerConnection;
  private hostPeerId = HOST_PEER_ID;
  private readonly peerConnectHandlers = new HandlerSet<(peerId: string) => void>();
  private readonly peerDisconnectHandlers = new HandlerSet<(peerId: string) => void>();
  private readonly receiveHandlers = new HandlerSet<(event: BehaviouralEvent) => void>();
  private readonly snapshotHandlers = new HandlerSet<(snapshot: StateSnapshot) => void>();
  private currentSnapshot: StateSnapshot | undefined;
  private readonly receiveBuffer = new Map<number, BehaviouralEvent>();
  private lastDeliveredSeq = 0;
  private resolveWelcome: (() => void) | undefined;
  private closed = false;
  private connectedToHost = false;

  static async create(transport: Transport, address: string): Promise<ClientSession> {
    const session = new ClientSession();
    session.address = address;

    const welcome = new Promise<void>((resolve) => {
      session.resolveWelcome = resolve;
    });

    session.connection = await transport.connect(address);
    session.connection.onMessage((raw) => session.handleMessage(raw));
    session.connection.onClose(() => session.handleClose());

    await welcome;
    return session;
  }

  peers(): string[] {
    return this.connectedToHost ? [this.hostPeerId] : [];
  }

  onPeerConnect(handler: (peerId: string) => void): Unsubscribe {
    return this.peerConnectHandlers.add(handler);
  }

  onPeerDisconnect(handler: (peerId: string) => void): Unsubscribe {
    return this.peerDisconnectHandlers.add(handler);
  }

  onReceive(handler: (event: BehaviouralEvent) => void): Unsubscribe {
    return this.receiveHandlers.add(handler);
  }

  snapshot(): StateSnapshot | undefined {
    return this.currentSnapshot;
  }

  onSnapshot(handler: (snapshot: StateSnapshot) => void): Unsubscribe {
    const unsubscribe = this.snapshotHandlers.add(handler);
    if (this.currentSnapshot) handler(this.currentSnapshot);
    return unsubscribe;
  }

  emit(): never {
    throw new NotAuthoritativeError(this.peerId || "client");
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.connection.close();
    this.peerConnectHandlers.clear();
    this.peerDisconnectHandlers.clear();
    this.receiveHandlers.clear();
    this.snapshotHandlers.clear();
    this.receiveBuffer.clear();
  }

  private handleMessage(raw: string): void {
    const message = parseWireMessage(raw);
    if (!message) return;

    if (message.t === "welcome") {
      this.hostPeerId = message.hostPeerId;
      this.peerId = message.peerId;
      this.lastDeliveredSeq = message.startSeq - 1;
      this.connectedToHost = true;
      if (message.snapshot) this.currentSnapshot = message.snapshot;
      this.resolveWelcome?.();
      this.resolveWelcome = undefined;
      this.peerConnectHandlers.emit((handler) => handler(this.hostPeerId));
      if (this.currentSnapshot) {
        this.snapshotHandlers.emit((handler) => handler(this.currentSnapshot!));
      }
      return;
    }

    this.bufferEvent(message.seq, message.event);
  }

  /**
   * Buffer an event and deliver everything contiguous from the current
   * position, so a peer always observes events in ascending sequence order
   * even if the transport reorders them.
   */
  private bufferEvent(seq: number, event: BehaviouralEvent): void {
    if (seq <= this.lastDeliveredSeq) return;
    this.receiveBuffer.set(seq, event);

    while (this.receiveBuffer.has(this.lastDeliveredSeq + 1)) {
      const next = this.lastDeliveredSeq + 1;
      const nextEvent = this.receiveBuffer.get(next)!;
      this.receiveBuffer.delete(next);
      this.lastDeliveredSeq = next;
      this.receiveHandlers.emit((handler) => handler(nextEvent));
    }
  }

  private handleClose(): void {
    if (this.closed) return;
    if (!this.connectedToHost) return;
    this.connectedToHost = false;
    this.peerDisconnectHandlers.emit((handler) => handler(this.hostPeerId));
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a host session.
 *
 * The host owns authority: only it may {@link NetworkSession.emit}. It also
 * participates, receiving its own broadcasts locally.
 */
export async function host(options: HostOptions): Promise<NetworkSession> {
  const transport = options.transport ?? defaultTransport();
  return HostSession.create(transport, options);
}

/**
 * Join a host session at `address` (`"host:port"`).
 *
 * Resolves once the host has completed the welcome handshake and assigned this
 * client a peer id. Clients relay and receive; they never emit authoritative
 * events.
 */
export async function join(
  address: string,
  options: JoinOptions = {},
): Promise<NetworkSession> {
  const transport = options.transport ?? defaultTransport();
  return ClientSession.create(transport, address);
}
