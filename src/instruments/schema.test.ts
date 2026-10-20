/**
 * Unit tests for the instrument definition schema (`schema.ts`).
 *
 * Covers valid definitions and every invalid-field case: missing top-level
 * fields, wrong types, unknown oscillator waves, out-of-range envelope
 * values, invalid filter shapes and empty ids/names. All errors must be
 * actionable (naming the offending field and the expected values).
 */

import { describe, it, expect } from "vitest";
import {
  validateInstrumentDefinition,
  definitionForNote,
  DEFAULT_NOISE_SEED,
  NOISE_SEED_MAX,
  type InstrumentDefinition,
} from "./schema.js";
import { NOISE_COLORS } from "../audio/noise.js";

/** A minimal valid definition every positive test starts from. */
const VALID_DEFINITION: Omit<InstrumentDefinition, "filter"> & {
  filter?: InstrumentDefinition["filter"];
} = {
  id: "test.pluck",
  name: "Test Pluck",
  oscillator: {
    type: "triangle",
    detune: 0,
  },
  envelope: {
    attack: 0.005,
    decay: 0.2,
    sustain: 0.3,
    release: 0.5,
  },
};

describe("validateInstrumentDefinition", () => {
  it("accepts a valid definition with oscillator + ADSR and no filter", () => {
    const result = validateInstrumentDefinition(VALID_DEFINITION);
    expect(result.id).toBe("test.pluck");
    expect(result.oscillator.type).toBe("triangle");
    expect(result.envelope).toEqual({
      attack: 0.005,
      decay: 0.2,
      sustain: 0.3,
      release: 0.5,
    });
    expect(result.filter).toBeUndefined();
  });

  it("accepts a valid definition with an optional filter", () => {
    const withFilter: InstrumentDefinition = {
      ...VALID_DEFINITION,
      filter: { type: "lowpass", frequency: 1200, Q: 0.7 },
    };
    const result = validateInstrumentDefinition(withFilter);
    expect(result.filter).toEqual({ type: "lowpass", frequency: 1200, Q: 0.7 });
  });

  it("preserves defaults: detune defaults to 0 and Q defaults to its given value", () => {
    const minimal: InstrumentDefinition = {
      id: "minimal",
      name: "Minimal",
      oscillator: { type: "sine" },
      envelope: { attack: 0, decay: 0.1, sustain: 0.5, release: 0.1 },
    };
    const result = validateInstrumentDefinition(minimal);
    expect(result.oscillator.detune).toBe(0);
  });

  // ── Top-level shape ─────────────────────────────────────────────

  it("rejects non-object definitions", () => {
    expect(() => validateInstrumentDefinition(null)).toThrow(
      /must be an object/,
    );
    expect(() => validateInstrumentDefinition(42)).toThrow(/must be an object/);
    expect(() => validateInstrumentDefinition("pluck")).toThrow(
      /must be an object/,
    );
  });

  it("requires an id", () => {
    const { id: _omitted, ...rest } = VALID_DEFINITION;
    expect(() => validateInstrumentDefinition(rest)).toThrow(/id.*required|id/);
  });

  it("rejects an empty or whitespace-only id", () => {
    expect(() =>
      validateInstrumentDefinition({ ...VALID_DEFINITION, id: "   " }),
    ).toThrow(/id/);
  });

  it("requires a name", () => {
    const { name: _omitted, ...rest } = VALID_DEFINITION;
    expect(() => validateInstrumentDefinition(rest)).toThrow(/name/);
  });

  it("rejects an empty name", () => {
    expect(() =>
      validateInstrumentDefinition({ ...VALID_DEFINITION, name: "" }),
    ).toThrow(/name/);
  });

  // ── Oscillator validation ───────────────────────────────────────

  it("requires an oscillator object", () => {
    const { oscillator: _omitted, ...rest } = VALID_DEFINITION;
    expect(() => validateInstrumentDefinition(rest)).toThrow(/oscillator/);
  });

  it("rejects an unknown oscillator wave type", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        oscillator: { type: "fancy" },
      }),
    ).toThrow(/type.*(sine|square|sawtooth|triangle)/);
  });

  it("rejects a non-finite oscillator detune", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        oscillator: { type: "sine", detune: NaN },
      }),
    ).toThrow(/finite number/);
  });

  // ── Envelope validation ─────────────────────────────────────────

  it("requires an envelope object", () => {
    const { envelope: _omitted, ...rest } = VALID_DEFINITION;
    expect(() => validateInstrumentDefinition(rest)).toThrow(/envelope/);
  });

  it("rejects a missing envelope stage", () => {
    const { sustain: _omitted, ...envelope } = VALID_DEFINITION.envelope;
    expect(() =>
      validateInstrumentDefinition({ ...VALID_DEFINITION, envelope }),
    ).toThrow(/sustain/);
  });

  it("rejects a negative attack or release", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        envelope: { ...VALID_DEFINITION.envelope, attack: -0.1 },
      }),
    ).toThrow(/attack/);
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        envelope: { ...VALID_DEFINITION.envelope, release: -1 },
      }),
    ).toThrow(/release/);
  });

  it("rejects a sustain level outside [0, 1]", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        envelope: { ...VALID_DEFINITION.envelope, sustain: 1.5 },
      }),
    ).toThrow(/sustain.*(0|1)/);
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        envelope: { ...VALID_DEFINITION.envelope, sustain: -0.2 },
      }),
    ).toThrow(/sustain/);
  });

  it("rejects a non-number envelope stage", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        envelope: { ...VALID_DEFINITION.envelope, attack: "fast" },
      }),
    ).toThrow(/finite number/);
  });

  // ── Filter validation ───────────────────────────────────────────

  it("rejects a filter with an unknown type", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        filter: { type: "notch", frequency: 1000 },
      }),
    ).toThrow(/type.*(lowpass|highpass|bandpass)/);
  });

  it("rejects a filter with a non-positive frequency", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        filter: { type: "lowpass", frequency: 0 },
      }),
    ).toThrow(/frequency/);
  });

  it("rejects a filter with a non-finite Q", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        filter: { type: "highpass", frequency: 800, Q: Infinity },
      }),
    ).toThrow(/finite number/);
  });

  it("rejects unknown top-level fields", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        // @ts-expect-error deliberately unknown field
        waveform: "sine",
      }),
    ).toThrow(/unknown|waveform/);
  });

  // ── Per-note voices ─────────────────────────────────────────────

  it("accepts a definition without a voices map (single-voice path)", () => {
    const result = validateInstrumentDefinition(VALID_DEFINITION);
    expect(result.voices).toBeUndefined();
  });

  it("accepts a per-note voices map with wave and noise entries", () => {
    const result = validateInstrumentDefinition({
      ...VALID_DEFINITION,
      voices: {
        36: {
          oscillator: { type: "sine" },
          envelope: { attack: 0.001, decay: 0.05, sustain: 0.5, release: 0.1 },
        },
        38: {
          oscillator: { type: "noise", color: "white", seed: 7 },
          envelope: { attack: 0.001, decay: 0.08, sustain: 0.2, release: 0.05 },
          filter: { type: "highpass", frequency: 1200, Q: 0.7 },
        },
      },
    });

    expect(result.voices).toBeDefined();
    expect(Object.keys(result.voices!)).toEqual(["36", "38"]);
    expect(result.voices![36]!.oscillator).toMatchObject({ type: "sine", detune: 0 });
    expect(result.voices![38]!.oscillator).toMatchObject({
      type: "noise",
      color: "white",
      seed: 7,
    });
    expect(result.voices![38]!.filter).toEqual({
      type: "highpass",
      frequency: 1200,
      Q: 0.7,
    });
  });

  it("defaults an omitted noise seed inside a voice entry", () => {
    const result = validateInstrumentDefinition({
      ...VALID_DEFINITION,
      voices: {
        42: {
          oscillator: { type: "noise", color: "pink" },
          envelope: { attack: 0, decay: 0.02, sustain: 0.1, release: 0.02 },
        },
      },
    });
    expect(result.voices![42]!.oscillator).toMatchObject({
      type: "noise",
      color: "pink",
      seed: DEFAULT_NOISE_SEED,
    });
  });

  it("accepts the MIDI range bounds as voice keys", () => {
    const voice = {
      oscillator: { type: "sine" },
      envelope: { attack: 0, decay: 0.1, sustain: 0.5, release: 0.1 },
    };
    const result = validateInstrumentDefinition({
      ...VALID_DEFINITION,
      voices: { 0: voice, 127: voice },
    });
    expect(Object.keys(result.voices!)).toEqual(["0", "127"]);
  });

  it("rejects non-integer voice keys, naming the offending key", () => {
    for (const key of ["kick", "36.5", "036", "+36", " 36", ""]) {
      let caught: unknown;
      try {
        validateInstrumentDefinition({
          ...VALID_DEFINITION,
          voices: {
            [key]: {
              oscillator: { type: "sine" },
              envelope: { attack: 0, decay: 0.1, sustain: 0.5, release: 0.1 },
            },
          },
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toMatch(/invalid MIDI note key/);
      expect(message).toContain(`"${key}"`);
    }
  });

  it("rejects out-of-range voice keys, naming the key and range", () => {
    for (const key of ["-1", "128"]) {
      expect(() =>
        validateInstrumentDefinition({
          ...VALID_DEFINITION,
          voices: {
            [key]: {
              oscillator: { type: "sine" },
              envelope: { attack: 0, decay: 0.1, sustain: 0.5, release: 0.1 },
            },
          },
        }),
      ).toThrow(new RegExp(`key "${key}" must be within 0–127`));
    }
  });

  it("rejects a voices map that is not an object", () => {
    for (const voices of [[], "kit", 42, null]) {
      expect(() =>
        // @ts-expect-error deliberately invalid voices value
        validateInstrumentDefinition({ ...VALID_DEFINITION, voices }),
      ).toThrow(/voices must be an object/);
    }
  });

  it("requires oscillator and envelope in a voice entry, naming the note", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        voices: {
          38: {
            // @ts-expect-error deliberately missing oscillator
            envelope: { attack: 0, decay: 0.1, sustain: 0.5, release: 0.1 },
          },
        },
      }),
    ).toThrow(/voices\[38\]\.oscillator is required/);

    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        voices: {
          38: {
            oscillator: { type: "sine" },
            // @ts-expect-error deliberately missing envelope
          },
        },
      }),
    ).toThrow(/voices\[38\]\.envelope is required/);
  });

  it("rejects an invalid oscillator inside a voice, naming the note and field", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        voices: {
          38: {
            oscillator: { type: "fancy" },
            envelope: { attack: 0, decay: 0.1, sustain: 0.5, release: 0.1 },
          },
        },
      }),
    ).toThrow(/voices\[38\]\.oscillator\.type must be one of/);
  });

  it("rejects an invalid envelope inside a voice, naming the note and field", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        voices: {
          38: {
            oscillator: { type: "sine" },
            envelope: { attack: -1, decay: 0.1, sustain: 0.5, release: 0.1 },
          },
        },
      }),
    ).toThrow(/voices\[38\]\.envelope\.attack/);
  });

  it("rejects an invalid filter inside a voice, naming the note and field", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        voices: {
          42: {
            oscillator: { type: "noise", color: "white" },
            envelope: { attack: 0, decay: 0.1, sustain: 0.5, release: 0.1 },
            filter: { type: "highpass", frequency: 0 },
          },
        },
      }),
    ).toThrow(/voices\[42\]\.filter\.frequency must be greater than 0/);
  });

  it("rejects unknown fields inside a voice entry, naming the note", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        voices: {
          36: {
            oscillator: { type: "sine" },
            envelope: { attack: 0, decay: 0.1, sustain: 0.5, release: 0.1 },
            // @ts-expect-error deliberately unknown voice field
            id: "kick",
          },
        },
      }),
    ).toThrow(/voices\[36\] contains an unknown field "id"/);
  });
});

// ── Per-note resolution ───────────────────────────────────────────

describe("definitionForNote", () => {
  /** A definition with two per-note voices. */
  const KIT: InstrumentDefinition = {
    id: "test.kit",
    name: "Test Kit",
    category: "percussion",
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 },
    voices: {
      36: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.02, sustain: 0.9, release: 0.03 },
      },
      38: {
        oscillator: { type: "noise", color: "white", seed: 7 },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0.2, release: 0.05 },
        filter: { type: "highpass", frequency: 1200 },
      },
    },
  };

  it("returns the definition unchanged when it has no voices map", () => {
    const single: InstrumentDefinition = {
      id: "test.pluck",
      name: "Test Pluck",
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.5 },
    };
    expect(definitionForNote(single, 60)).toBe(single);
  });

  it("returns the mapped entry's sections and inherits identity fields", () => {
    const resolved = definitionForNote(KIT, 38);
    expect(resolved).not.toBeNull();
    expect(resolved).not.toBe(KIT);
    expect(resolved!.id).toBe("test.kit");
    expect(resolved!.name).toBe("Test Kit");
    expect(resolved!.category).toBe("percussion");
    expect(resolved!.oscillator).toEqual(KIT.voices![38]!.oscillator);
    expect(resolved!.envelope).toEqual(KIT.voices![38]!.envelope);
    expect(resolved!.filter).toEqual({ type: "highpass", frequency: 1200 });
    expect(resolved!.voices).toBeUndefined();
  });

  it("returns null for a note with no entry when a voices map is present", () => {
    expect(definitionForNote(KIT, 60)).toBeNull();
  });

  it("is deterministic and side-effect free", () => {
    const first = definitionForNote(KIT, 36);
    const second = definitionForNote(KIT, 36);
    expect(first).toEqual(second);
    // Resolving a voice never mutates the source definition.
    expect(KIT.oscillator.type).toBe("sine");
    expect(KIT.envelope.release).toBe(0.3);
  });
});

// ── Noise oscillator variant ──────────────────────────────────────

/** A minimal valid noise definition every noise test starts from. */
const NOISE_DEFINITION: InstrumentDefinition = {
  id: "test.noise",
  name: "Test Noise",
  oscillator: { type: "noise", color: "white" },
  envelope: { attack: 0.001, decay: 0.05, sustain: 0.5, release: 0.1 },
};

describe("validateInstrumentDefinition noise oscillator", () => {
  it("accepts every supported noise colour", () => {
    for (const color of NOISE_COLORS) {
      const result = validateInstrumentDefinition({
        ...NOISE_DEFINITION,
        oscillator: { type: "noise", color },
      });
      expect(result.oscillator.type).toBe("noise");
      expect(result.oscillator).toMatchObject({ type: "noise", color });
    }
  });

  it("defaults the seed to the fixed default when it is omitted", () => {
    const result = validateInstrumentDefinition(NOISE_DEFINITION);
    expect(result.oscillator).toMatchObject({
      type: "noise",
      color: "white",
      seed: DEFAULT_NOISE_SEED,
    });
  });

  it("accepts an explicit integer seed, including the range bounds", () => {
    for (const seed of [0, 7, NOISE_SEED_MAX]) {
      const result = validateInstrumentDefinition({
        ...NOISE_DEFINITION,
        oscillator: { type: "noise", color: "brown", seed },
      });
      expect(result.oscillator).toMatchObject({ type: "noise", color: "brown", seed });
    }
  });

  it("narrows the oscillator to the noise variant", () => {
    const result = validateInstrumentDefinition({
      ...NOISE_DEFINITION,
      oscillator: { type: "noise", color: "pink", seed: 11 },
    });
    // The union discriminates on `type`, so this compiles only when narrowed.
    if (result.oscillator.type !== "noise") {
      throw new Error("expected the noise oscillator variant");
    }
    expect(result.oscillator.color).toBe("pink");
    expect(result.oscillator.seed).toBe(11);
  });

  it("rejects an unknown noise colour, naming the field and accepted values", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...NOISE_DEFINITION,
        oscillator: { type: "noise", color: "green" },
      }),
    ).toThrow(/oscillator\.color.*white, pink, brown/);
  });

  it("rejects a missing noise colour", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...NOISE_DEFINITION,
        // @ts-expect-error deliberately missing colour
        oscillator: { type: "noise" },
      }),
    ).toThrow(/oscillator\.color.*required/);
  });

  it("rejects a non-integer seed, naming the field and accepted range", () => {
    for (const seed of [1.5, Number.NaN, Number.POSITIVE_INFINITY, "7"]) {
      expect(() =>
        validateInstrumentDefinition({
          ...NOISE_DEFINITION,
          // @ts-expect-error deliberately invalid seed
          oscillator: { type: "noise", color: "white", seed },
        }),
      ).toThrow(/oscillator\.seed.*integer.*0–4294967295/);
    }
  });

  it("rejects an out-of-range seed, naming the field and accepted range", () => {
    for (const seed of [-1, NOISE_SEED_MAX + 1]) {
      expect(() =>
        validateInstrumentDefinition({
          ...NOISE_DEFINITION,
          oscillator: { type: "noise", color: "white", seed },
        }),
      ).toThrow(/oscillator\.seed.*0–4294967295/);
    }
  });

  it("rejects unknown oscillator fields on the noise variant", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...NOISE_DEFINITION,
        oscillator: {
          type: "noise",
          color: "white",
          // @ts-expect-error detune is not a noise field
          detune: 5,
        },
      }),
    ).toThrow(/oscillator.*unknown field "detune"/);
  });

  it("rejects unknown oscillator fields on the waveform variant", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...VALID_DEFINITION,
        oscillator: {
          type: "sine",
          // @ts-expect-error colour is not a waveform field
          color: "white",
        },
      }),
    ).toThrow(/oscillator.*unknown field "color"/);
  });
});

describe("validateInstrumentDefinition: pitch sweeps, layers and one-shots", () => {
  /** A percussive base: a zero-sustain voice that decays to silence. */
  const PERCUSSIVE: InstrumentDefinition = {
    id: "test.percussive",
    name: "Test Percussive",
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.05 },
  };

  it("accepts a pitch sweep, extra layers, mix gains and one-shot flags", () => {
    const definition: InstrumentDefinition = {
      ...PERCUSSIVE,
      gain: 0.8,
      oneShot: true,
      pitch: { fromCents: 2400, time: 0.05 },
      layers: [
        {
          oscillator: { type: "noise", color: "white", seed: 7 },
          envelope: { attack: 0.001, decay: 0.01, sustain: 0, release: 0.005 },
          filter: { type: "highpass", frequency: 2500 },
          gain: 0.5,
          delay: 0.002,
          oneShot: true,
        },
      ],
    };

    const result = validateInstrumentDefinition(definition);
    expect(result.pitch).toEqual({ fromCents: 2400, time: 0.05 });
    expect(result.gain).toBe(0.8);
    expect(result.oneShot).toBe(true);
    expect(result.layers).toHaveLength(1);
    expect(result.layers![0]!.gain).toBe(0.5);
    expect(result.layers![0]!.delay).toBe(0.002);
    expect(result.layers![0]!.oneShot).toBe(true);
  });

  it("accepts a per-note voice with a pitch sweep and layers", () => {
    const result = validateInstrumentDefinition({
      ...PERCUSSIVE,
      voices: {
        36: {
          oscillator: { type: "sine" },
          envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.05 },
          pitch: { fromCents: 2400, time: 0.045 },
          layers: [
            {
              oscillator: { type: "noise", color: "white", seed: 11 },
              envelope: { attack: 0.001, decay: 0.005, sustain: 0, release: 0.002 },
            },
          ],
        },
      },
    });

    const voice = definitionForNote(result, 36);
    expect(voice?.pitch).toEqual({ fromCents: 2400, time: 0.045 });
    expect(voice?.layers).toHaveLength(1);
  });

  it("rejects a pitch sweep on a noise oscillator, saying noise has no pitch", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...PERCUSSIVE,
        oscillator: { type: "noise", color: "white", seed: 1 },
        pitch: { fromCents: 1200, time: 0.05 },
      }),
    ).toThrow(/pitch is not supported on a noise oscillator.*noise has no pitch/);
  });

  it("rejects a pitch sweep without a positive duration or offset", () => {
    expect(() =>
      validateInstrumentDefinition({ ...PERCUSSIVE, pitch: { fromCents: 2400, time: 0 } }),
    ).toThrow(/pitch\.time must be greater than 0/);
    expect(() =>
      validateInstrumentDefinition({ ...PERCUSSIVE, pitch: { fromCents: 0, time: 0.05 } }),
    ).toThrow(/pitch\.fromCents must be greater than 0/);
  });

  it("rejects a one-shot voice that keeps a non-zero sustain", () => {
    expect(() =>
      validateInstrumentDefinition({ ...VALID_DEFINITION, oneShot: true }),
    ).toThrow(/oneShot requires envelope\.sustain to be 0/);
  });

  it("rejects unknown layer fields, naming the layer position", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...PERCUSSIVE,
        layers: [
          {
            oscillator: { type: "noise", color: "white", seed: 3 },
            envelope: { attack: 0.001, decay: 0.01, sustain: 0, release: 0.002 },
            // @ts-expect-error sweep is not a layer field
            sweep: 1,
          },
        ],
      }),
    ).toThrow(/layers\[0\] contains an unknown field "sweep"/);
  });

  it("rejects a non-array layers value", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...PERCUSSIVE,
        // @ts-expect-error layers must be an array
        layers: { 0: {} },
      }),
    ).toThrow(/layers must be an array of voice layers/);
  });

  it("rejects top-level pitch or layers alongside a voices map", () => {
    expect(() =>
      validateInstrumentDefinition({
        ...PERCUSSIVE,
        pitch: { fromCents: 1200, time: 0.05 },
        voices: {
          36: { oscillator: { type: "sine" }, envelope: PERCUSSIVE.envelope },
        },
      }),
    ).toThrow(/must be declared inside each voices entry/);
    expect(() =>
      validateInstrumentDefinition({
        ...PERCUSSIVE,
        layers: [
          {
            oscillator: { type: "noise", color: "white", seed: 5 },
            envelope: PERCUSSIVE.envelope,
          },
        ],
        voices: {
          36: { oscillator: { type: "sine" }, envelope: PERCUSSIVE.envelope },
        },
      }),
    ).toThrow(/must be declared inside each voices entry/);
  });
});
