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
import {
  definitionForNote,
  validateInstrumentDefinition,
  DEFAULT_NOISE_SEED,
} from "./schema.js";
import type {
  InstrumentEnvelope,
  InstrumentFilter,
  InstrumentOscillator,
  InstrumentPitchSweep,
  InstrumentVoiceLayer,
} from "./schema.js";
import type { Instrument } from "./instrument.js";
import { midiNoteToFrequency, velocityToGain, MIDI_NOTE_MAX, MIDI_NOTE_MIN } from "./instrument.js";
import { AdsrEnvelope } from "./envelope.js";
import { VoiceManager } from "./voice-manager.js";
import { generateNoiseBuffer } from "../audio/noise.js";
import { createRng } from "../core/rng.js";
import {
  AudioContext,
  OfflineAudioContext,
  isNodeRuntime,
} from "../audio/web-audio.js";

/** The sample rate the engine renders at by default, pinned for determinism. */
export const ENGINE_SAMPLE_RATE = 44100;

/** Extra silence appended after the final event, in seconds. */
export const ENGINE_DEFAULT_TAIL = 0.2;

/**
 * Length of the looping noise buffer used by real-time noise voices, in
 * seconds. Notes longer than this wrap around deterministically.
 */
export const NOISE_LOOP_SECONDS = 1;

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
  /**
   * The voice definition resolved for this note (the definition itself for a
   * single-voice instrument, or the mapped `voices` entry for a multi-timbral
   * one).
   */
  readonly definition: VoiceDefinition;
}

/**
 * The parts of a definition that describe one voice.
 *
 * Per-note dispatch resolves each note to (possibly) a different oscillator,
 * envelope and filter; every audio builder accepts just these sections so the
 * single-voice and multi-timbral paths share one implementation. The optional
 * `pitch` sweep and `layers` are the percussive additions: they let one note
 * combine a pitch-dropping body with extra transients (click, noise body,
 * clap bursts).
 */
type VoiceDefinition = Pick<
  InstrumentDefinition,
  "oscillator" | "envelope" | "filter" | "gain" | "oneShot"
> & {
  readonly pitch?: InstrumentPitchSweep;
  readonly layers?: readonly InstrumentVoiceLayer[];
};

/**
 * One fully-resolved synthesis component of a voice.
 *
 * The main oscillator/envelope/filter from the definition becomes the first
 * layer (gain 1, delay 0); each optional `layers` entry follows it with its
 * own mix gain and start delay.
 */
interface ResolvedVoiceLayer {
  readonly oscillator: InstrumentOscillator;
  readonly envelope: InstrumentEnvelope;
  readonly filter?: InstrumentFilter;
  readonly pitch?: InstrumentPitchSweep;
  /** Whether the layer ignores note-off and always plays out its decay. */
  readonly oneShot: boolean;
  /** Mix gain applied to this component (main layer defaults to 1). */
  readonly gain: number;
  /** Seconds after note-on before this component starts. */
  readonly delay: number;
}

/**
 * Resolve a voice into its synthesis layers, main oscillator first.
 *
 * A definition without `layers` resolves to exactly one component, so the
 * single-voice path builds the same node graph as before (same node count,
 * same scheduling) and existing renders stay byte-identical.
 */
function resolveVoiceLayers(definition: VoiceDefinition): ResolvedVoiceLayer[] {
  const layers: ResolvedVoiceLayer[] = [
    {
      oscillator: definition.oscillator,
      envelope: definition.envelope,
      ...(definition.filter !== undefined ? { filter: definition.filter } : {}),
      ...(definition.pitch !== undefined ? { pitch: definition.pitch } : {}),
      oneShot: definition.oneShot ?? false,
      gain: definition.gain ?? 1,
      delay: 0,
    },
  ];
  for (const layer of definition.layers ?? []) {
    layers.push({
      oscillator: layer.oscillator,
      envelope: layer.envelope,
      ...(layer.filter !== undefined ? { filter: layer.filter } : {}),
      ...(layer.pitch !== undefined ? { pitch: layer.pitch } : {}),
      oneShot: layer.oneShot ?? false,
      gain: layer.gain ?? 1,
      delay: layer.delay ?? 0,
    });
  }
  return layers;
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

/** A source node that can be started and stopped (oscillator or noise). */
type VoiceSource = OscillatorNode | AudioBufferSourceNode;

/** The Web Audio node graph for one voice (unconnected). */
interface VoiceNodes {
  /** Startable/stoppable source: an oscillator or a noise buffer source. */
  readonly source: VoiceSource;
  /**
   * The oscillator node when the voice is waveform-based, or `null` for a
   * noise voice (which has no frequency to set).
   */
  readonly oscillator: OscillatorNode | null;
  readonly gain: GainNode;
  readonly filter: BiquadFilterNode | null;
}

/** Options for {@link buildVoiceNodes}. */
interface BuildVoiceOptions {
  /** Length of the generated noise buffer, in seconds (default 1). */
  noiseBufferSeconds?: number;
  /** Whether the noise buffer loops (default true). */
  loopNoise?: boolean;
}

/**
 * Build the Web Audio node graph for one voice (unconnected).
 *
 * Waveform oscillators create an `OscillatorNode` exactly as before. Noise
 * oscillators create an `AudioBufferSourceNode` filled by the shared seeded
 * generator ({@link generateNoiseBuffer}), so both share the same envelope and
 * filter wiring while the oscillator path stays byte-identical.
 */
function buildVoiceNodes(
  ctx: OfflineAudioContext | AudioContext,
  definition: Pick<VoiceDefinition, "oscillator" | "filter">,
  options: BuildVoiceOptions = {},
): VoiceNodes {
  const oscillator = definition.oscillator;
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

  if (oscillator.type === "noise") {
    const source = ctx.createBufferSource();
    source.buffer = generateNoiseBuffer(
      ctx,
      options.noiseBufferSeconds ?? NOISE_LOOP_SECONDS,
      oscillator.color,
      createRng(oscillator.seed ?? DEFAULT_NOISE_SEED),
    );
    source.loop = options.loopNoise ?? true;
    return { source, oscillator: null, gain, filter };
  }

  const wave = ctx.createOscillator();
  wave.type = oscillator.type;
  wave.detune.value = oscillator.detune ?? 0;

  return { source: wave, oscillator: wave, gain, filter };
}

/** Connect source → (filter →) gain → destination. */
function connectVoice(
  ctx: OfflineAudioContext | AudioContext,
  nodes: VoiceNodes,
): void {
  if (nodes.filter) {
    nodes.source.connect(nodes.filter);
    nodes.filter.connect(nodes.gain);
  } else {
    nodes.source.connect(nodes.gain);
  }
  nodes.gain.connect(ctx.destination);
}

/**
 * Generate the sample-accurate velocity-scaled ADSR curve for one layer,
 * from its (relative) start to the end of its release tail.
 *
 * The release point is voice-absolute (every layer of a note releases at the
 * same moment); a layer that starts after the release point still plays its
 * own short tail so a delayed transient is never lost entirely. A one-shot
 * layer ignores the release point entirely and always runs its full
 * attack→decay to silence.
 */
function buildLayerEnvelopeCurve(
  layer: ResolvedVoiceLayer,
  voice: ActiveVoice,
  relativeStart: number,
  relativeRelease: number,
  sampleRate: number,
): Float32Array {
  const naturalEnd =
    relativeStart + Math.max(layer.envelope.attack, 0) + Math.max(layer.envelope.decay, 0);
  const releaseEnd = relativeRelease + Math.max(layer.envelope.release, 0);
  const curveEnd = Math.max(
    layer.oneShot ? naturalEnd : releaseEnd,
    relativeStart + MIN_STAGE_SECONDS,
  );
  const curve = new Float32Array(Math.max(1, Math.ceil((curveEnd - relativeStart) * sampleRate)));

  const envelope = new AdsrEnvelope(layer.envelope, sampleRate);
  envelope.noteOn();
  const scale = velocityToGain(voice.velocity) * layer.gain;
  let released = false;
  for (let i = 0; i < curve.length; i++) {
    const sampleTime = relativeStart + i / sampleRate;
    if (
      !released
      && !layer.oneShot
      && voice.releaseTime !== null
      && sampleTime >= relativeRelease
    ) {
      envelope.noteOff();
      released = true;
    }
    curve[i] = envelope.nextValue() * scale;
  }
  return curve;
}

/**
 * Apply a pitch sweep to a waveform oscillator: start above the note and
 * fall exponentially to it, deterministically, on both render paths.
 */
function applyPitchSweep(
  oscillator: OscillatorNode,
  frequency: number,
  pitch: InstrumentPitchSweep,
  startTime: number,
): void {
  const startFrequency = frequency * 2 ** (pitch.fromCents / 1200);
  const sweepEnd = startTime + pitch.time;
  oscillator.frequency.setValueAtTime(startFrequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(frequency, sweepEnd);
}

/** Set a static frequency on a waveform oscillator (single-voice path). */
function setStaticFrequency(oscillator: OscillatorNode, frequency: number): void {
  oscillator.frequency.value = frequency;
}

/** Schedule one layer of one voice on an offline context. */
function scheduleOfflineLayer(
  ctx: OfflineAudioContext,
  voice: ActiveVoice,
  layer: ResolvedVoiceLayer,
  offset: number,
  sampleRate: number,
): void {
  const relativeStart = voice.startTime + layer.delay - offset;
  const relativeRelease = Math.max(
    relativeStart,
    (voice.releaseTime ?? voice.startTime) - offset,
  );
  const curve = buildLayerEnvelopeCurve(
    layer,
    voice,
    relativeStart,
    relativeRelease,
    sampleRate,
  );
  const curveDuration = curve.length / sampleRate;

  const nodes = buildVoiceNodes(ctx, layer, {
    noiseBufferSeconds: curveDuration,
    loopNoise: false,
  });
  if (nodes.oscillator) {
    const frequency = midiNoteToFrequency(voice.note);
    if (layer.pitch) {
      applyPitchSweep(nodes.oscillator, frequency, layer.pitch, relativeStart);
    } else {
      setStaticFrequency(nodes.oscillator, frequency);
    }
  }
  nodes.gain.gain.setValueCurveAtTime(curve, relativeStart, curveDuration);
  connectVoice(ctx, nodes);

  nodes.source.start(relativeStart);
  nodes.source.stop(relativeStart + curveDuration + 0.001);
}

/** Schedule one voice (all its layers) on an offline context. */
function scheduleOfflineVoice(
  ctx: OfflineAudioContext,
  voice: ActiveVoice,
  offset: number,
  sampleRate: number,
): void {
  for (const layer of resolveVoiceLayers(voice.definition)) {
    scheduleOfflineLayer(ctx, voice, layer, offset, sampleRate);
  }
}

/**
 * Render an instrument offline and return the sample data.
 *
 * The event sequence is applied deterministically through the same voice
 * manager the real-time path uses (allocation, same-note retrigger,
 * oldest-voice-first stealing), and the result is rendered through
 * `OfflineAudioContext` (always via `src/audio/web-audio.ts`).
 *
 * When the definition carries a per-note `voices` map, each Note On is voiced
 * by its mapped entry and notes without an entry are ignored — no voice is
 * allocated and they contribute silence. A definition without `voices` voices
 * every note with its top-level oscillator/envelope/filter, exactly as before.
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
  const validated = validateInstrumentDefinition(definition);
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
      const voiceDefinition = definitionForNote(validated, event.note);
      if (voiceDefinition === null) {
        // Unmapped note in a multi-timbral definition: ignore it entirely.
        continue;
      }
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
        definition: voiceDefinition,
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
    for (const layer of resolveVoiceLayers(voice.definition)) {
      if (layer.oneShot) {
        // A one-shot drum hit decays to silence on its own — a short note (or
        // a note released before the hit finished) never truncates it.
        renderEnd = Math.max(
          renderEnd,
          voice.startTime
            + layer.delay
            + layer.envelope.attack
            + layer.envelope.decay,
        );
      } else if (voice.releaseTime !== null) {
        // Release tail of every layer (all layers release together).
        renderEnd = Math.max(
          renderEnd,
          voice.releaseTime + layer.envelope.release,
        );
      }
    }
  }
  const duration = renderEnd - offset;
  const length = Math.max(1, Math.ceil(sampleRate * duration));
  const ctx = options.context ?? new OfflineAudioContext(1, length, sampleRate);

  for (const voice of voicesById.values()) {
    scheduleOfflineVoice(ctx, voice, offset, sampleRate);
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

/** One synthesis component of a live real-time voice. */
interface RealtimeComponent {
  /** The component's ADSR envelope (its release drives the release ramp). */
  readonly envelope: InstrumentEnvelope;
  /** Envelope gain node (already voice and layer gain scaled). */
  readonly gain: GainNode;
  /** Startable/stoppable source (oscillator or noise buffer). */
  readonly source: VoiceSource;
  /** Whether the component ignores note-off (plays its full decay out). */
  readonly oneShot: boolean;
}

/** A live real-time voice: one or more synthesis components. */
interface RealtimeVoice {
  readonly components: RealtimeComponent[];
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
 * offline path). When the definition carries a per-note `voices` map, each
 * Note On is voiced by its mapped entry and unmapped notes are ignored.
 *
 * @param definition - The instrument definition.
 * @param options - Instrument options.
 * @returns A playable instrument.
 */
export function createRealtimeInstrument(
  definition: InstrumentDefinition,
  options: RealtimeInstrumentOptions = {},
): Instrument {
  const validated = validateInstrumentDefinition(definition);
  const maxVoices = options.maxVoices ?? 16;
  const context = options.context ?? new AudioContext();
  const manager = new VoiceManager({ maxVoices });
  const live = new Map<number, RealtimeVoice>();

  const release = (voice: RealtimeVoice, at: number): void => {
    for (const component of voice.components) {
      if (component.oneShot) {
        // One-shot components stop themselves after their decay (scheduled at
        // note-on); letting them ring is what a drum hit is.
        continue;
      }
      const releaseTime = Math.max(component.envelope.release, MIN_STAGE_SECONDS);
      const current = component.gain.gain.value;
      component.gain.gain.cancelScheduledValues(at);
      component.gain.gain.setValueAtTime(current, at);
      component.gain.gain.linearRampToValueAtTime(0, at + releaseTime);
      component.source.stop(at + releaseTime + 0.001);
    }
  };

  return {
    id: validated.id,
    noteOn(midiNote: number, velocity: number, time?: number): void {
      const at = time ?? context.currentTime;
      const voiceDefinition = definitionForNote(validated, midiNote);
      if (voiceDefinition === null) {
        // Unmapped note in a multi-timbral definition: ignore it entirely.
        return;
      }
      const allocation = manager.noteOn(midiNote, velocity, at);
      if (allocation.stolen) {
        const stolenVoice = live.get(allocation.stolen.id);
        if (stolenVoice) {
          release(stolenVoice, at);
          live.delete(allocation.stolen.id);
        }
      }

      const components: RealtimeComponent[] = [];
      for (const layer of resolveVoiceLayers(voiceDefinition)) {
        const layerAt = at + layer.delay;
        const nodes = buildVoiceNodes(context, layer);
        if (nodes.oscillator) {
          const frequency = midiNoteToFrequency(midiNote);
          if (layer.pitch) {
            applyPitchSweep(nodes.oscillator, frequency, layer.pitch, layerAt);
          } else {
            setStaticFrequency(nodes.oscillator, frequency);
          }
        }
        const peak = velocityToGain(velocity) * layer.gain;
        const attackEnd = layerAt + Math.max(layer.envelope.attack, MIN_STAGE_SECONDS);
        const decayEnd = attackEnd + Math.max(layer.envelope.decay, MIN_STAGE_SECONDS);
        nodes.gain.gain.setValueAtTime(0, layerAt);
        nodes.gain.gain.linearRampToValueAtTime(peak, attackEnd);
        nodes.gain.gain.linearRampToValueAtTime(
          peak * layer.envelope.sustain,
          decayEnd,
        );
        connectVoice(context, nodes);
        nodes.source.start(layerAt);
        if (layer.oneShot) {
          // The drum hit stops itself once its decay has finished.
          nodes.source.stop(
            layerAt + Math.max(layer.envelope.attack, 0)
              + Math.max(layer.envelope.decay, 0) + 0.001,
          );
        }

        components.push({
          envelope: layer.envelope,
          gain: nodes.gain,
          source: nodes.source,
          oneShot: layer.oneShot,
        });
      }

      live.set(allocation.voice.id, { components });
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
