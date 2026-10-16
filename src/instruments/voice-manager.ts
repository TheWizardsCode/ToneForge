/**
 * Polyphonic voice manager: allocation, a configurable voice limit and a
 * deterministic voice-stealing policy.
 *
 * This module is an injectable, pure data structure — it owns no audio graph
 * and requires no `AudioContext`, so it is fully unit-testable. The
 * instrument engine (a later child of the playable instruments epic, parent
 * TF-0MV9PIBNV008C00R) owns the actual audio voices and drives allocation
 * through this manager.
 *
 * ## Stealing policy
 *
 * - **Same-note retrigger:** retriggering a note that is already sounding
 *   replaces that note's own voice — the voice keeps its identity (same id)
 *   but its velocity/time are refreshed and it becomes the *newest* voice.
 *   A second voice for the same note is never created.
 * - **At the limit:** when a Note On arrives while `maxVoices` voices are
 *   sounding, the **oldest sounding voice is stolen first** (the voice whose
 *   most recent trigger is earliest). The stolen voice is reported on the
 *   allocation result so callers can stop its audio.
 * - **Under the limit:** a voice is allocated without stealing.
 *
 * Voice ids increase monotonically from 0, so allocation is deterministic for
 * a given Note On/Note Off sequence.
 */

/** A single sounding voice. */
export interface VoiceSnapshot {
  /** Monotonic, process-stable voice identifier. */
  readonly id: number;
  /** MIDI note number (0–127). */
  readonly note: number;
  /** MIDI velocity at the most recent trigger (0–127). */
  readonly velocity: number;
  /** Time of the most recent trigger, in seconds. */
  readonly time: number;
}

/** Options for {@link VoiceManager}. */
export interface VoiceManagerOptions {
  /** Maximum number of simultaneous voices (integer >= 1). */
  maxVoices: number;
}

/** Result of a Note On allocation. */
export interface VoiceAllocation {
  /** The voice now sounding the note. */
  readonly voice: VoiceSnapshot;
  /** True when this allocation retriggered an existing voice for the note. */
  readonly retriggered: boolean;
  /** The voice stolen to make room, if the limit forced a steal. */
  readonly stolen?: VoiceSnapshot;
}

/**
 * A polyphonic voice allocator.
 *
 * Call {@link noteOn} on Note On and {@link noteOff} on Note Off; the manager
 * keeps the note→voice mapping and the age ordering used for stealing.
 */
export class VoiceManager {
  /** The configured maximum number of simultaneous voices. */
  readonly maxVoices: number;

  /** Voices in age order (oldest first); the last element is the newest. */
  private readonly voicesById = new Map<number, VoiceSnapshot>();
  private readonly ageOrder: number[] = [];
  private nextVoiceId = 0;

  /**
   * @param options - Manager options.
   * @throws {RangeError} If `maxVoices` is not an integer >= 1.
   */
  constructor(options: VoiceManagerOptions) {
    if (!Number.isInteger(options.maxVoices) || options.maxVoices < 1) {
      throw new RangeError("VoiceManager: maxVoices must be an integer >= 1.");
    }
    this.maxVoices = options.maxVoices;
  }

  /** Number of voices currently sounding. */
  get activeCount(): number {
    return this.ageOrder.length;
  }

  /** Whether the manager is at its voice limit. */
  get isAtLimit(): boolean {
    return this.activeCount >= this.maxVoices;
  }

  /** Whether a voice is currently sounding for *note*. */
  has(note: number): boolean {
    for (const voice of this.voicesById.values()) {
      if (voice.note === note) {
        return true;
      }
    }
    return false;
  }

  /**
   * The active MIDI notes in age order (oldest first).
   */
  notes(): number[] {
    return this.ageOrder.map((id) => this.voicesById.get(id)!.note);
  }

  /**
   * A snapshot of all active voices, oldest first.
   *
   * The returned objects are copies — mutating them does not affect the
   * manager.
   */
  snapshot(): VoiceSnapshot[] {
    return this.ageOrder.map((id) => ({ ...this.voicesById.get(id)! }));
  }

  /**
   * Allocate (or retrigger) a voice for a Note On.
   *
   * @param note - MIDI note number.
   * @param velocity - MIDI velocity.
   * @param time - Trigger time in seconds (default 0).
   * @returns The allocation, including any stolen voice.
   */
  noteOn(note: number, velocity: number, time = 0): VoiceAllocation {
    const existing = this.voiceFor(note);
    if (existing) {
      // Same-note retrigger: refresh the voice and make it the newest.
      const refreshed: VoiceSnapshot = {
        id: existing.id,
        note,
        velocity,
        time,
      };
      this.voicesById.set(existing.id, refreshed);
      this.touch(existing.id);
      return { voice: { ...refreshed }, retriggered: true };
    }

    let stolen: VoiceSnapshot | undefined;
    if (this.isAtLimit) {
      stolen = this.stealOldest();
    }

    const voice: VoiceSnapshot = { id: this.nextVoiceId++, note, velocity, time };
    this.voicesById.set(voice.id, voice);
    this.ageOrder.push(voice.id);
    return stolen
      ? { voice: { ...voice }, retriggered: false, stolen: { ...stolen } }
      : { voice: { ...voice }, retriggered: false };
  }

  /**
   * Free the voice sounding *note* (Note Off).
   *
   * @param note - MIDI note number.
   * @returns The released voice, or `null` when the note is not sounding.
   */
  noteOff(note: number): VoiceSnapshot | null {
    const existing = this.voiceFor(note);
    if (!existing) {
      return null;
    }
    this.remove(existing.id);
    return { ...existing };
  }

  /** Release every sounding voice. */
  reset(): void {
    this.voicesById.clear();
    this.ageOrder.length = 0;
  }

  /** The active voice for *note*, or undefined. */
  private voiceFor(note: number): VoiceSnapshot | undefined {
    for (const voice of this.voicesById.values()) {
      if (voice.note === note) {
        return voice;
      }
    }
    return undefined;
  }

  /** Remove a voice from the ledger and age order. */
  private remove(id: number): void {
    this.voicesById.delete(id);
    const index = this.ageOrder.indexOf(id);
    if (index >= 0) {
      this.ageOrder.splice(index, 1);
    }
  }

  /** Move a voice to the newest position in the age order. */
  private touch(id: number): void {
    const index = this.ageOrder.indexOf(id);
    if (index >= 0) {
      this.ageOrder.splice(index, 1);
    }
    this.ageOrder.push(id);
  }

  /** Remove and return the oldest sounding voice. */
  private stealOldest(): VoiceSnapshot {
    const oldestId = this.ageOrder[0]!;
    const oldest = this.voicesById.get(oldestId)!;
    this.remove(oldestId);
    return oldest;
  }
}
