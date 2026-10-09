/**
 * ToneForge Network — public module surface.
 *
 * Transport-agnostic host/join sessions with host-authoritative broadcast of
 * behavioural events. The core depends only on the injectable
 * {@link Transport} interface; the WebSocket adapter is created via
 * `createWebSocketTransport` with an injected WebSocket implementation.
 *
 * Reference: docs/prd/NETWORK_PRD.md, docs/network.md.
 *
 * Work item: TF-0MUZYS2JC001AHJQ (Network transport: host/join, broadcast, authority).
 */

export {
  BEHAVIOURAL_EVENT_VERSION,
  SUPPORTED_EVENT_VERSIONS,
  BehaviouralEventValidationError,
  createBehaviouralEvent,
  isBehaviouralEvent,
  isSupportedEventVersion,
  validateBehaviouralEvent,
  type BehaviouralEvent,
  type BehaviouralEventInput,
  type ContextSnapshot,
  type EventValidationError,
  type EventValidationResult,
  type StateLabel,
} from "./types.js";

export {
  MalformedEventError,
  UnsupportedEventVersionError,
  canonicalStringify,
  decodeEvent,
  decodeEventOrThrow,
  decodeEventStream,
  encodeEvent,
  type EventDecodeResult,
  type EventStreamDecodeResult,
  type EventWarning,
  type StreamEventWarning,
} from "./events.js";

export {
  InMemoryNetwork,
  InMemoryTransport,
  createInMemoryNetwork,
  createInMemoryTransport,
  defaultTransport,
  type CloseHandler,
  type MessageHandler,
  type PeerConnection,
  type Transport,
  type TransportListener,
  type Unsubscribe,
} from "./transport.js";

export {
  HOST_PEER_ID,
  NotAuthoritativeError,
  SessionClosedError,
  host,
  join,
  type HostOptions,
  type JoinOptions,
  type NetworkRole,
  type NetworkSession,
} from "./session.js";

export {
  SnapshotTracker,
  applySnapshot,
  captureSnapshot,
  validateSnapshot,
  type SnapshotValidationResult,
  type StateSnapshot,
} from "./snapshot.js";

export {
  DEFAULT_ALIGNMENT_TOLERANCE_SECONDS,
  DEFAULT_CLOCK_SMOOTHING,
  DEFAULT_MAX_CLOCK_OFFSET_SECONDS,
  DEFAULT_MAX_DRIFT_SECONDS,
  DEFAULT_REORDER_WINDOW_SECONDS,
  DriftCompensator,
  EventSequencer,
  SyncPipeline,
  TimestampCorrector,
  runJitterHarness,
  type DriftCompensation,
  type DriftCompensatorOptions,
  type EventSequencerOptions,
  type JitterAlignmentReport,
  type JitterClientConfig,
  type JitterClientReport,
  type JitterHarnessOptions,
  type ScheduledEvent,
  type SequencedEvent,
  type SyncPipelineOptions,
  type TimestampCorrectorOptions,
} from "./sync.js";

export {
  createWebSocketTransport,
  type WebSocketConstructor,
  type WebSocketLibrary,
  type WebSocketLike,
  type WebSocketServerConstructor,
  type WebSocketServerLike,
} from "./ws-transport.js";
