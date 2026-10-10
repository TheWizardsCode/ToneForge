/**
 * WebSocket transport adapter for ToneForge Network.
 *
 * The adapter is *injectable*: the WebSocket implementation (the `ws` package
 * in Node, or the platform `WebSocket` in a browser) is supplied by the caller.
 * This keeps `src/network` free of any WebSocket runtime dependency while still
 * reusing the repository's existing `ws` dependency at the edge (for example
 * `web/server`, which already hosts a `ws` server).
 *
 * Usage (Node, reusing the existing `ws` dependency):
 *
 * ```ts
 * import { WebSocket, WebSocketServer } from "ws";
 * import { createWebSocketTransport } from "./network/ws-transport.js";
 *
 * const transport = createWebSocketTransport({ WebSocket, WebSocketServer });
 * const host = await network.host({ port: 8080, transport });
 * ```
 *
 * Reference: docs/prd/NETWORK_PRD.md §7, docs/network.md.
 *
 * Work item: TF-0MUZYS2JC001AHJQ (Network transport: host/join, broadcast, authority).
 */

import type {
  CloseHandler,
  MessageHandler,
  PeerConnection,
  Transport,
  TransportListener,
  Unsubscribe,
} from "./transport.js";

// ---------------------------------------------------------------------------
// Injectable WebSocket surface
// ---------------------------------------------------------------------------

/**
 * The minimal WebSocket surface the adapter uses.
 *
 * Matches both the WHATWG `WebSocket` (browser, and `ws`'s WHATWG-compatible
 * client) and Node's EventEmitter-style sockets.
 */
export interface WebSocketLike {
  readonly readyState?: number;
  send(data: string): void;
  close(): void;
  addEventListener?(
    type: string,
    listener: (...args: unknown[]) => void,
  ): void;
  removeEventListener?(
    type: string,
    listener: (...args: unknown[]) => void,
  ): void;
  on?(type: string, listener: (...args: unknown[]) => void): void;
  off?(type: string, listener: (...args: unknown[]) => void): void;
}

/** The minimal WebSocket server surface the adapter uses. */
export interface WebSocketServerLike {
  on(type: "connection", listener: (socket: WebSocketLike) => void): void;
  once?(type: string, listener: (...args: unknown[]) => void): void;
  close(callback?: () => void): void;
  address?(): { port: number } | string | null;
}

/** Constructor for a client WebSocket. */
export interface WebSocketConstructor {
  new (url: string): WebSocketLike;
}

/** Constructor for a WebSocket server. */
export interface WebSocketServerConstructor {
  new (options: { port: number; host?: string }): WebSocketServerLike;
}

/**
 * The WebSocket implementation injected into the adapter.
 *
 * `WebSocketServer` is only needed to {@link Transport.listen} (host); a
 * browser client can inject `{ WebSocket: globalThis.WebSocket }`.
 */
export interface WebSocketLibrary {
  WebSocket: WebSocketConstructor;
  WebSocketServer?: WebSocketServerConstructor;
}

/** The WebSocket `OPEN` ready state. */
const WS_OPEN = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Subscribe to a socket event across WHATWG and EventEmitter interfaces. */
function onSocketEvent(
  socket: WebSocketLike,
  type: string,
  handler: (...args: unknown[]) => void,
): Unsubscribe {
  if (typeof socket.addEventListener === "function") {
    socket.addEventListener(type, handler);
    return () => socket.removeEventListener?.(type, handler);
  }
  if (typeof socket.on === "function") {
    socket.on(type, handler);
    return () => socket.off?.(type, handler);
  }
  throw new Error(`websocket implementation does not support events: ${type}`);
}

/** Decode an inbound WebSocket payload to text without a Node-only Buffer. */
function decodeMessage(data: unknown): string {
  // WHATWG `MessageEvent` (the `addEventListener` path) carries the payload on
  // `.data`; unwrap it before decoding.
  if (typeof data === "object" && data !== null && "data" in data) {
    return decodeMessage((data as { data: unknown }).data);
  }
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(data));
  }
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    );
  }
  return String(data);
}

/** Normalise `host:port` to a WebSocket URL. */
function toWebSocketUrl(address: string): string {
  if (address.startsWith("ws://") || address.startsWith("wss://")) {
    return address;
  }
  return `ws://${address}`;
}

// ---------------------------------------------------------------------------
// Peer connection
// ---------------------------------------------------------------------------

class WebSocketPeer implements PeerConnection {
  readonly id: string;
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly closeHandlers = new Set<CloseHandler>();
  private pending: string[] = [];
  private closed = false;

  constructor(
    id: string,
    private readonly socket: WebSocketLike,
    private readonly onClosed?: () => void,
  ) {
    this.id = id;

    // Attach listeners immediately so frames that arrive before the session
    // subscribes (for example the host's welcome) are buffered, not dropped.
    onSocketEvent(socket, "message", (data) => this.enqueue(decodeMessage(data)));
    onSocketEvent(socket, "close", () => this.markClosed());
    // Swallow transport-level errors: `close` (or a subsequent send) is the
    // observable signal for callers.
    onSocketEvent(socket, "error", () => {});
  }

  send(message: string): void {
    if (this.closed) return;
    this.socket.send(message);
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
    try {
      this.socket.close();
    } finally {
      this.markClosed();
    }
  }

  private markClosed(): void {
    if (this.closed) return;
    this.closed = true;
    for (const handler of [...this.closeHandlers]) handler();
    this.closeHandlers.clear();
    this.onClosed?.();
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
}

// ---------------------------------------------------------------------------
// Listener
// ---------------------------------------------------------------------------

class WebSocketListener implements TransportListener {
  readonly address: string;
  private readonly connectionHandlers = new Set<(peer: PeerConnection) => void>();
  private readonly sockets = new Set<WebSocketLike>();
  private nextPeerId = 1;
  private closed = false;

  constructor(
    private readonly server: WebSocketServerLike,
    address: string,
  ) {
    this.address = address;
    this.server.on("connection", (socket) => this.accept(socket));
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
    for (const socket of [...this.sockets]) {
      try {
        socket.close();
      } catch {
        // best-effort
      }
    }
    this.sockets.clear();
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
    this.connectionHandlers.clear();
  }

  private accept(socket: WebSocketLike): void {
    if (this.closed) {
      try {
        socket.close();
      } catch {
        // best-effort
      }
      return;
    }
    const id = `peer-${this.nextPeerId++}`;
    this.sockets.add(socket);
    const peer = new WebSocketPeer(id, socket, () => this.sockets.delete(socket));
    for (const handler of [...this.connectionHandlers]) handler(peer);
  }
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/** Wait for a freshly constructed server to report it is listening. */
function waitForListening(server: WebSocketServerLike): Promise<void> {
  if (typeof server.once !== "function") return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.once!("listening", () => resolve());
    server.once!("error", (error) =>
      reject(error instanceof Error ? error : new Error(String(error))),
    );
  });
}

/** Resolve the bound address, preferring the server's reported port. */
function resolveAddress(
  server: WebSocketServerLike,
  host: string | undefined,
  port: number,
): string {
  const boundHost = host ?? "127.0.0.1";
  if (typeof server.address === "function") {
    const reported = server.address();
    if (reported && typeof reported === "object" && "port" in reported) {
      return `${boundHost}:${reported.port}`;
    }
    if (typeof reported === "string" && reported.length > 0) return reported;
  }
  return `${boundHost}:${port}`;
}

/** Wait for a client socket to open. */
function waitForOpen(socket: WebSocketLike): Promise<void> {
  if (socket.readyState === WS_OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let offError: Unsubscribe | undefined;
    const offOpen = onSocketEvent(socket, "open", () => {
      offError?.();
      resolve();
    });
    offError = onSocketEvent(socket, "error", (error) => {
      offOpen();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

/**
 * Create a WebSocket-backed {@link Transport} from an injected implementation.
 *
 * No WebSocket library is imported by this module; the caller supplies the
 * implementation (`ws` in Node, the platform `WebSocket` in a browser). This is
 * what keeps the network core dependency-free.
 */
export function createWebSocketTransport(library: WebSocketLibrary): Transport {
  let outboundSeq = 1;

  return {
    async listen(port: number, host?: string): Promise<TransportListener> {
      const ServerCtor = library.WebSocketServer;
      if (!ServerCtor) {
        throw new Error(
          "WebSocketServer implementation is required to host; inject one via createWebSocketTransport",
        );
      }
      const server = new ServerCtor({ port, host });
      await waitForListening(server);
      return new WebSocketListener(server, resolveAddress(server, host, port));
    },

    async connect(address: string): Promise<PeerConnection> {
      const socket = new library.WebSocket(toWebSocketUrl(address));
      // Construct the peer (and attach listeners) before awaiting `open` so
      // frames sent during the handshake are captured.
      const peer = new WebSocketPeer(`client-${outboundSeq++}`, socket);
      await waitForOpen(socket);
      return peer;
    },
  };
}
