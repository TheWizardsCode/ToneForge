/**
 * Instruments module — public API.
 *
 * A family of playable, polyphonic instruments driven by a structured Note On
 * / Note Off API on a deterministic, sample-accurate voice engine (parent epic
 * TF-0MV9PIBNV008C00R):
 *
 * - {@link validateInstrumentDefinition} — the ToneGraph-shaped instrument
 *   schema (oscillator + ADSR + optional filter).
 * - {@link midiNoteToFrequency} / {@link velocityToGain} and the structured
 *   `midiNoteOn` / `midiNoteOff` message builders plus the {@link Instrument}
 *   interface.
 * - {@link AdsrEnvelope} — the sample-accurate ADSR state machine.
 * - {@link VoiceManager} — polyphonic allocation, voice limit and stealing.
 * - {@link renderInstrument} / {@link createRealtimeInstrument} — the offline
 *   and real-time engine paths.
 */

export {
  validateInstrumentDefinition,
  DEFAULT_NOISE_SEED,
  NOISE_SEED_MIN,
  NOISE_SEED_MAX,
  type InstrumentDefinition,
  type InstrumentEnvelope,
  type InstrumentFilter,
  type InstrumentOscillator,
  type InstrumentWaveOscillator,
  type InstrumentNoiseOscillator,
  type OscillatorWave,
  type FilterType,
} from "./schema.js";

export {
  A4_FREQUENCY,
  A4_MIDI_NOTE,
  MIDI_NOTE_MIN,
  MIDI_NOTE_MAX,
  MIDI_VELOCITY_MIN,
  MIDI_VELOCITY_MAX,
  midiNoteToFrequency,
  velocityToGain,
  midiNoteOn,
  midiNoteOff,
  type Instrument,
  type MidiNoteOnMessage,
  type MidiNoteOffMessage,
} from "./instrument.js";

export { AdsrEnvelope, type AdsrConfig, type EnvelopeStage } from "./envelope.js";

export {
  VoiceManager,
  type VoiceManagerOptions,
  type VoiceAllocation,
  type VoiceSnapshot,
} from "./voice-manager.js";

export {
  ENGINE_SAMPLE_RATE,
  ENGINE_DEFAULT_TAIL,
  renderInstrument,
  createRealtimeInstrument,
  type InstrumentEvent,
  type RenderedInstrument,
  type RenderInstrumentOptions,
  type RealtimeInstrumentOptions,
} from "./engine.js";

export {
  InstrumentRegistry,
  instrumentRegistry,
  registerInstrumentPreset,
  loadInstrumentPresetsFromDirectory,
  loadBundledInstrumentPresets,
  listInstruments,
  listInstrumentSummaries,
  getInstrument,
  type InstrumentPreset,
  type InstrumentSummary,
  type LoadInstrumentPresetsOptions,
} from "./presets.js";

export {
  DRUM_KIT_DEFINITION,
  DRUM_KIT_NOTES,
  DRUM_KIT_NOTE_MAP,
  DRUM_KIT_PRESET_ID,
  DRUM_KIT_VOICES,
} from "./drum-kit.js";
