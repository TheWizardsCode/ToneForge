/**
 * Instrument engine: builds instrument voices as Web Audio nodes (oscillator
 * + ADSR envelope gain + optional filter), drives them from the note API and
 * renders deterministically offline.
 *
 * Web Audio is accessed only through `src/audio/web-audio.ts`, so this module
 * contains no direct runtime-specific imports: the same code drives the
 * browser's native Web Audio API and Node's `node-web-audio-api`, offline via
 * `OfflineAudioContext` and real-time via `AudioContext`.
 *
 * This module is the core vertical slice of the playable instruments epic
 * (parent TF-0MV9PIBNV008C00R, child TF-0MV9WXML6002HCW9): the note API
 * (schema → envelope → voices) meets audio here, deterministically.
 */

import type { InstrumentDefinition } from "./schema.js";
import { validateInstrumentDefinition } from "./schema.js";
import type { Instrument } from "./instrument.js";
import { midiNoteToFrequency, velocityToGain, MIDI_NOTE_MAX, MIDI_NOTE_MIN } from "./instrument.js";
import { AdsrEnvelope } from "./envelope.js";
import { VoiceManager } from "./voice-manager.js";
import {
  AudioContext,
  OfflineAudioContext,
  isNodeRuntime,
} from "../audio/web-audio.js";

/** The sample rate the engine renders at by default, pinned for determinism. */
export const ENGINE_SAMPLE_RATE = 44100;

/** Extra silence appended after the final event, in seconds. */
export const ENGINE_DEFAULT_TAIL = 0.2;

/** Shortest non-zero stage length used when a config declares a zero time. */
const MIN_STAGE_SECONDS = 0.001;

/** A structured note event for offline rendering. */
export interface InstrumentEvent {
  readonly type: "midiNoteOn" | "midiNoteOff";
  /** MIDI note number (0–127). */
  readonly note: number;
  /** MIDI velocity (0–127). */
  readonly velocity: number;
  /** Event time in seconds (>= 0, relative to the render start). */
  readonly time: number;
}

/** A rendered instrument fragment. */
export interface RenderedInstrument {
  /** Mono samples. */
  readonly samples: Float32Array;
  /** The sample rate the render used. */
  readonly sampleRate: number;
  /** Rendered duration in seconds. */
  readonly duration: number;
}

/** Options for {@link renderInstrument}. */
export interface RenderInstrumentOptions {
  /** Sample rate in Hz (default {@link ENGINE_SAMPLE_RATE}). */
  sampleRate?: number;
  /** Extra silence after the final event, in seconds (default 0.2). */
  tail?: number;
  /** Maximum simultaneous voices (default 16). */
  maxVoices?: number;
  /** Injectable offline context for hermetic tests (optional). */
  context?: OfflineAudioContext;
}

/** A voice being rendered: note identity plus its envelope timing. */
interface ActiveVoice {
  readonly voiceId: number;
  readonly note: number;
  readonly velocity: number;
  readonly startTime: number;
  releaseTime: number | null;
}

function assertEvent(event: InstrumentEvent): void {
  if (!Number.isFinite(event.note) || event.note < MIDI_NOTE_MIN || event.note > MIDI_NOTE_MAX) {
    throw new RangeError(
      `renderInstrument: note ${event.note} out of range ${MIDI_NOTE_MIN}–${MIDI_NOTE_MAX}.`,
    );
  }
  if (!Number.isFinite(event.velocity) || event.velocity < 0 || event.velocity > 127) {
    throw new RangeError(`renderInstrument: velocity ${event.velocity} out of range 0–127.`);
  }
  if (!Number.isFinite(event.time) || event.time < 0) {
    throw new RangeError("renderInstrument: event time must be a non-negative number of seconds.");
  }
}

/** Build the Web Audio node graph for one voice (unconnected). */
function buildVoiceNodes(
  ctx: OfflineAudioContext | AudioContext,
  definition: InstrumentDefinition,
): { oscillator: OscillatorNode; gain: GainNode; filter: BiquadFilterNode | null } {
  const oscillator = ctx.createOscillator();
  oscillator.type = definition.oscillator.type;
  oscillator.detune.value = definition.oscillator.detune ?? 0;

  const gain = ctx.createGain();

  let filter: BiquadFilterNode | null = null;
  if (definition.filter) {
    filter = ctx.createBiquadFilter();
    filter.type = definition.filter.type;
    filter.frequency.value = definition.filter.frequency;
    if (definition.filter.Q !== undefined) {
      filter.Q.value = definition.filter.Q;
    }
  }

  return { oscillator, gain, filter };
}

/** Connect oscillator → (filter →) gain → destination. */
function connectVoice(
  ctx: OfflineAudioContext | AudioContext,
  nodes: { oscillator: OscillatorNode; gain: GainNode; filter: BiquadFilterNode | null },
): void {
  if (nodes.filter) {
    nodes.oscillator.connect(nodes.filter);
    nodes.filter.connect(nodes.gain);
  } else {
    nodes.oscillator.connect(nodes.gain);
  }
  nodes.gain.connect(ctx.destination);
}

/**
 * Generate the sample-accurate velocity-scaled ADSR curve for one voice,
 * from its (relative) start to the end of its release tail.
 */
function buildEnvelopeCurve(
  definition: InstrumentDefinition,
  voice: ActiveVoice,
  relativeStart: number,
  relativeRelease: number,
  sampleRate: number,
): Float32Array {
  const releaseTail = Math.max(definition.envelope.release, 0);
  const curveEnd = relativeRelease + releaseTail;
  const curveSamples = Math.max(1, Math.ceil((curveEnd - relativeStart) * sampleRate));
  const curve = new Float32Array(curveSamples);

  const envelope = new AdsrEnvelope(definition.envelope, sampleRate);
  envelope.noteOn();
  const scale = velocityToGain(voice.velocity);
  let released = false;
  for (let i = 0; i < curveSamples; i++) {
    const sampleTime = relativeStart + i / sampleRate;
    if (!released && voice.releaseTime !== null && sampleTime >= relativeRelease) {
      envelope.noteOff();
      released = true;
    }
    curve[i] = envelope.nextValue() * scale;
  }
  return curve;
}

/** Schedule one voice on an offline context at render-relative times. */
function scheduleOfflineVoice(
  ctx: OfflineAudioContext,
  definition: InstrumentDefinition,
  voice: ActiveVoice,
  offset: number,
  sampleRate: number,
): void {
  const relativeStart = voice.startTime - offset;
  const relativeRelease =
    (voice.releaseTime ?? voice.startTime) - offset;
  const curve = buildEnvelopeCurve(
    definition,
    voice,
    relativeStart,
    relativeRelease,
    sampleRate,
  );
  const curveDuration = curve.length / sampleRate;

  const nodes = buildVoiceNodes(ctx, definition);
  const frequency = midiNoteToFrequency(voice.note);
  nodes.oscillator.frequency.value = frequency;
  nodes.gain.gain.setValueCurveAtTime(curve, relativeStart, curveDuration);
  connectVoice(ctx, nodes);

  nodes.oscillator.start(relativeStart);
  nodes.oscillator.stop(relativeStart + curveDuration + 0.001);
}

/**
 * Render an instrument offline and return the sample data.
 *
 * The event sequence is applied deterministically through the same voice
 * manager the real-time path uses (allocation, same-note retrigger,
 * oldest-voice-first stealing), and the result is rendered through
 * `OfflineAudioContext` (always via `src/audio/web-audio.ts`).
 *
 * @param definition - The instrument definition.
 * @param events - The note events to render (sorted internally by time).
 * @param options - Render options.
 * @returns The rendered samples and duration.
 */
export async function renderInstrument(
  definition: InstrumentDefinition,
  events: InstrumentEvent[],
  options: RenderInstrumentOptions = {},
): Promise<RenderedInstrument> {
  validateInstrumentDefinition(definition);
  const sampleRate = options.sampleRate ?? ENGINE_SAMPLE_RATE;
  const tail = options.tail ?? ENGINE_DEFAULT_TAIL;
  const maxVoices = options.maxVoices ?? 16;

  if (events.length === 0) {
    return { samples: new Float32Array(0), sampleRate, duration: 0 };
  }
  for (const event of events) {
    assertEvent(event);
  }

  // Apply events in time order through the voice manager (allocation policy).
  const voicesById = new Map<number, ActiveVoice>();
  const manager = new VoiceManager({ maxVoices });
  const sorted = [...events].sort((a, b) => a.time - b.time);

  let lastEventTime = 0;
  for (const event of sorted) {
    lastEventTime = Math.max(lastEventTime, event.time);
    if (event.type === "midiNoteOn") {
      const allocation = manager.noteOn(event.note, event.velocity, event.time);
      if (allocation.stolen) {
        const stolen = voicesById.get(allocation.stolen.id);
        // A stolen voice is released immediately so its audio decays away.
        if (stolen && stolen.releaseTime === null) {
          voicesById.set(stolen.voiceId, { ...stolen, releaseTime: event.time });
        }
      }
      voicesById.set(allocation.voice.id, {
        voiceId: allocation.voice.id,
        note: allocation.voice.note,
        velocity: allocation.voice.velocity,
        startTime: allocation.voice.time,
        releaseTime: null,
      });
    } else {
      const released = manager.noteOff(event.note);
      if (released) {
        const voice = voicesById.get(released.id);
        if (voice && voice.releaseTime === null) {
          voicesById.set(voice.voiceId, { ...voice, releaseTime: event.time });
        }
      }
    }
  }

  const offset = Math.min(...sorted.map((e) => e.time));
  let renderEnd = lastEventTime + tail;
  for (const voice of voicesById.values()) {
    if (voice.releaseTime !== null) {
      renderEnd = Math.max(
        renderEnd,
        voice.releaseTime + definition.envelope.release,
      );
    }
  }
  const duration = renderEnd - offset;
  const length = Math.max(1, Math.ceil(sampleRate * duration));
  const ctx = options.context ?? new OfflineAudioContext(1, length, sampleRate);

  for (const voice of voicesById.values()) {
    scheduleOfflineVoice(ctx, definition, voice, offset, sampleRate);
  }

  const audioBuffer = await ctx.startRendering();
  if (!audioBuffer) {
    throw new Error(
      "renderInstrument: startRendering() returned null. Retry with reduced load.",
    );
  }

  return {
    samples: new Float32Array(audioBuffer.getChannelData(0)),
    sampleRate,
    duration,
  };
}

// ── Real-time playback path ───────────────────────────────────────

/** Options for {@link createRealtimeInstrument}. */
export interface RealtimeInstrumentOptions {
  /** Maximum simultaneous voices (default 16). */
  maxVoices?: number;
  /** Injectable real-time context (hermetic tests / node-web-audio-api). */
  context?: AudioContext;
}

/** A live real-time voice: its gain node and oscillator. */
interface RealtimeVoice {
  readonly gain: GainNode;
  readonly oscillator: OscillatorNode;
}

/**
 * Create a playable {@link Instrument} backed by a real-time `AudioContext`.
 *
 * The context is created via {@link AudioContext} (from `src/audio/web-audio.ts`),
 * which resolves to the browser's native Web Audio API in browsers and to
 * `node-web-audio-api` in Node. Pass an explicit *context* to inject a mock
 * or a pre-existing context (hermetic tests / `node-web-audio-api`).
 *
 * Note On starts a voice through {@link VoiceManager}; Note Off releases it
 * (an attack→decay→sustain ramp on the gain, then a release ramp to 0); at the
 * voice limit the oldest sounding voice is stolen (the same policy as the
 * offline path).
 *
 * @param definition - The instrument definition.
 * @param options - Instrument options.
 * @returns A playable instrument.
 */
export function createRealtimeInstrument(
  definition: InstrumentDefinition,
  options: RealtimeInstrumentOptions = {},
): Instrument {
  validateInstrumentDefinition(definition);
  const maxVoices = options.maxVoices ?? 16;
  const context = options.context ?? new AudioContext();
  const manager = new VoiceManager({ maxVoices });
  const live = new Map<number, RealtimeVoice>();

  const release = (voice: RealtimeVoice, at: number): void => {
    const releaseTime = Math.max(definition.envelope.release, MIN_STAGE_SECONDS);
    const current = voice.gain.gain.value;
    voice.gain.gain.cancelScheduledValues(at);
    voice.gain.gain.setValueAtTime(current, at);
    voice.gain.gain.linearRampToValueAtTime(0, at + releaseTime);
    voice.oscillator.stop(at + releaseTime + 0.001);
  };

  return {
    id: definition.id,
    noteOn(midiNote: number, velocity: number, time?: number): void {
      const at = time ?? context.currentTime;
      const allocation = manager.noteOn(midiNote, velocity, at);
      if (allocation.stolen) {
        const stolenVoice = live.get(allocation.stolen.id);
        if (stolenVoice) {
          release(stolenVoice, at);
          live.delete(allocation.stolen.id);
        }
      }

      const nodes = buildVoiceNodes(context, definition);
      const peak = velocityToGain(velocity);
      const attackEnd = at + Math.max(definition.envelope.attack, MIN_STAGE_SECONDS);
      const decayEnd = attackEnd + Math.max(definition.envelope.decay, MIN_STAGE_SECONDS);
      nodes.gain.gain.setValueAtTime(0, at);
      nodes.gain.gain.linearRampToValueAtTime(peak, attackEnd);
      nodes.gain.gain.linearRampToValueAtTime(peak * definition.envelope.sustain, decayEnd);
      nodes.oscillator.frequency.value = midiNoteToFrequency(midiNote);
      connectVoice(context, nodes);
      nodes.oscillator.start(at);

      live.set(allocation.voice.id, { gain: nodes.gain, oscillator: nodes.oscillator });
    },
    noteOff(midiNote: number, time?: number): void {
      const released = manager.noteOff(midiNote);
      if (!released) {
        return;
      }
      const voice = live.get(released.id);
      if (voice) {
        release(voice, time ?? context.currentTime);
        live.delete(released.id);
      }
    },
  };
}

export { isNodeRuntime };
