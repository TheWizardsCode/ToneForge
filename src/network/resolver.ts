/**
 * Deterministic event resolver for the Network conformance harness.
 *
 * A resolver takes a behavioural event and produces a resolved-output
 * descriptor that is fully deterministic — given the same input event,
 * the resolver always produces the identical output descriptor.  Two
 * independent resolver instances with the same seed therefore yield
 * byte-identical output when fed the same event stream.
 *
 * Work item: TF-0MUZYS1IL003MCKC (Network determinism & bandwidth conformance).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single behavioural event as received over the network. */
export interface BehaviouralEvent {
  /** Unique event identifier. */
  id: string;
  /** Event type (footstep, state-transition, context-change, late-join). */
  event: string;
  /** Current movement/behavioural state. */
  state: string;
  /** Random seed used for deterministic synthesis. */
  seed: number;
  /** Timestamp in seconds. */
  time: number;
  /** Environmental context snapshot. */
  context: Record<string, string>;
  /** Optional per-event metadata. */
  [key: string]: unknown;
}

/** Deterministic resolved output for a single behavioural event. */
export interface ResolvedOutput {
  /** Canonical event identifier. */
  eventId: string;
  /** Event type. */
  eventType: string;
  /** Resolved state. */
  state: string;
  /** Deterministic seed used. */
  seed: number;
  /** Timestamp. */
  time: number;
  /** Context snapshot as a sorted, JSON-stringified object. */
  contextHash: string;
  /** Synthetic frequency (Hz) derived from seed and state — deterministic. */
  frequency: number;
  /** Synthetic gain derived from seed — deterministic. */
  gain: number;
  /** Serialization byte size of the full resolved output. */
  byteSize: number;
}

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

/**
 * Compute a simple deterministic hash of a context object.
 *
 * Keys are sorted, values are concatenated, and a basic checksum is
 * produced.  This is not cryptographic — it is a fast, stable hash
 * for comparison purposes.
 */
function contextHash(context: Record<string, string>): string {
  const sortedKeys = Object.keys(context).sort();
  const parts = sortedKeys.map((k) => `${k}=${context[k]}`);
  const combined = parts.join("|");
  // Simple checksum: sum of char codes modulo 2^16
  let sum = 0;
  for (let i = 0; i < combined.length; i++) {
    sum = (sum * 31 + combined.charCodeAt(i)) & 0xffff;
  }
  return `ctx-${sum.toString(16).padStart(4, "0")}`;
}

/**
 * Deterministic frequency from seed and state.
 *
 * Maps the seed to a frequency in the 80–400 Hz range based on the
 * state string's length (shorter state → higher frequency).
 */
function resolveFrequency(seed: number, state: string): number {
  const baseFreq = 400 - (state.length * 20);
  const offset = (seed % 60);
  return Math.max(80, baseFreq + offset - 30);
}

/**
 * Deterministic gain from seed.
 *
 * Maps the seed to a gain value in the 0.3–0.9 range.
 */
function resolveGain(seed: number): number {
  // Use seed to pick a gain value deterministically
  const gainIndex = seed % 7;
  const gains = [0.3, 0.5, 0.6, 0.65, 0.7, 0.8, 0.9];
  return gains[gainIndex]!;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Configuration for a deterministic resolver instance.
 */
export interface ResolverConfig {
  /** Random seed offset — different values produce different outputs. */
  seedOffset: number;
  /** Version string for the resolver. */
  version: string;
}

/** Default resolver configuration. */
const DEFAULT_CONFIG: ResolverConfig = {
  seedOffset: 0,
  version: "1.0",
};

/**
 * A deterministic event resolver.
 *
 * Given a behavioural event, produces a fully resolved output descriptor
 * that can be compared across instances for byte-identical determinism.
 */
export class DeterministicResolver {
  private readonly config: ResolverConfig;

  constructor(config?: Partial<ResolverConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Resolve a single behavioural event into a deterministic output descriptor.
   */
  resolve(event: BehaviouralEvent): ResolvedOutput {
    const adjustedSeed = event.seed + this.config.seedOffset;
    const resolved = {
      eventId: event.id,
      eventType: event.event,
      state: event.state,
      seed: adjustedSeed,
      time: event.time,
      contextHash: contextHash(event.context),
      frequency: resolveFrequency(adjustedSeed, event.state),
      gain: resolveGain(adjustedSeed),
      byteSize: 0, // computed below
    } as ResolvedOutput;

    // Compute byte size of the serialized resolved output
    resolved.byteSize = new TextEncoder().encode(
      JSON.stringify({
        eventId: resolved.eventId,
        eventType: resolved.eventType,
        state: resolved.state,
        seed: resolved.seed,
        time: resolved.time,
        contextHash: resolved.contextHash,
        frequency: resolved.frequency,
        gain: resolved.gain,
      }),
    ).length;

    return resolved;
  }

  /**
   * Resolve an entire event stream.
   */
  resolveStream(events: BehaviouralEvent[]): ResolvedOutput[] {
    return events.map((event) => this.resolve(event));
  }

  /**
   * Return the resolver's configuration version.
   */
  version(): string {
    return this.config.version;
  }
}

// ---------------------------------------------------------------------------
// Byte accounting helpers
// ---------------------------------------------------------------------------

/**
 * Measure the byte size of a serialised behavioural event.
 */
export function eventByteSize(event: BehaviouralEvent): number {
  return new TextEncoder().encode(JSON.stringify(event)).length;
}

/**
 * Compute byte-level statistics for an event stream.
 */
export interface ByteStats {
  /** Total bytes across all events. */
  totalBytes: number;
  /** Number of events. */
  eventCount: number;
  /** Average bytes per event. */
  avgBytesPerEvent: number;
  /** Maximum bytes for a single event. */
  maxBytesPerEvent: number;
  /** Projected bandwidth for 1 event/second (B/s). */
  projectedBandwidthBps: number;
  /** Projected bandwidth in KB/s. */
  projectedBandwidthKbps: number;
}

/**
 * Compute byte accounting for an event stream.
 *
 * Assumes a typical gameplay rate of 1 event per second (conservative
 * upper bound for most games).
 */
export function computeByteStats(events: BehaviouralEvent[]): ByteStats {
  const sizes = events.map(eventByteSize);
  const totalBytes = sizes.reduce((sum, s) => sum + s, 0);
  const eventCount = events.length;
  const avgBytesPerEvent = eventCount > 0 ? totalBytes / eventCount : 0;
  const maxBytesPerEvent = eventCount > 0 ? Math.max(...sizes) : 0;
  const projectedBandwidthBps = avgBytesPerEvent;
  const projectedBandwidthKbps = projectedBandwidthBps / 1024;

  return {
    totalBytes,
    eventCount,
    avgBytesPerEvent: Math.round(avgBytesPerEvent * 100) / 100,
    maxBytesPerEvent,
    projectedBandwidthBps: Math.round(projectedBandwidthBps * 100) / 100,
    projectedBandwidthKbps: Math.round(projectedBandwidthKbps * 100) / 100,
  };
}
