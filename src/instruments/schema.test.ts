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
