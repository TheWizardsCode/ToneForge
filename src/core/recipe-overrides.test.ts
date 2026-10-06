import { describe, it, expect } from "vitest";
import { OfflineAudioContext } from "node-web-audio-api";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyFileBackedMappings,
  parseFileBackedMappings,
  type FileBackedParameterMapping,
} from "./recipe-overrides.js";
import { validateToneGraph, type ToneGraphDocument } from "./tonegraph-schema.js";
import {
  createFileBackedRegistration,
  discoverFileBackedRecipes,
  RecipeRegistry,
  type RecipeRegistration,
} from "./recipe.js";
import { createRng } from "./rng.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";

const SAMPLE_RATE = 44100;

/** Build a minimal validated graph for mapping tests. */
function makeGraph(overrides: Record<string, unknown> = {}): ToneGraphDocument {
  const raw = {
    version: "0.1",
    meta: {
      name: "mapping-fixture",
      duration: 0.2,
      parameters: [
        { name: "frequency", type: "number", min: 200, max: 800, default: 440 },
        { name: "ratio", type: "number", min: 1, max: 4, default: 2 },
        { name: "depthEnd", type: "number", min: 0, max: 1, default: 0.5 },
      ],
      ...overrides,
    },
    nodes: {
      osc: {
        kind: "oscillator",
        params: { type: "sine", frequency: 440 },
      },
      amp: {
        kind: "gain",
        params: { gain: 0.25 },
        automation: {
          gain: [
            { kind: "set", time: 0, value: 0.25 },
            { kind: "linearRamp", time: 0.2, value: 0.5 },
          ],
        },
      },
      out: { kind: "destination" },
    },
    routing: [{ chain: ["osc", "amp", "out"] }],
  };
  return validateToneGraph(raw);
}

const DERIVED: Record<string, number> = {
  frequency: 440,
  ratio: 2,
  depthEnd: 0.5,
};

describe("parseFileBackedMappings", () => {
  it("returns an empty list when no mappings are declared", () => {
    expect(parseFileBackedMappings({ version: "0.1" })).toEqual([]);
    expect(
      parseFileBackedMappings({
        meta: { parameters: [{ name: "frequency", type: "number" }] },
      }),
    ).toEqual([]);
  });

  it("parses direct, automation and computed targets", () => {
    const mappings = parseFileBackedMappings({
      meta: {
        parameters: [
          {
            name: "frequency",
            type: "number",
            overrides: [
              { target: "osc.frequency" },
              { target: "amp.automation.gain.linearRamp.value" },
              { target: "osc.frequency", expression: "frequency * ratio" },
            ],
          },
        ],
      },
    });

    expect(mappings).toEqual([
      {
        parameter: "frequency",
        overrides: [
          { target: "osc.frequency", expression: undefined },
          { target: "amp.automation.gain.linearRamp.value", expression: undefined },
          { target: "osc.frequency", expression: "frequency * ratio" },
        ],
      },
    ]);
  });

  it("rejects a non-array overrides declaration", () => {
    expect(() =>
      parseFileBackedMappings({
        meta: { parameters: [{ name: "frequency", overrides: "nope" }] },
      }),
    ).toThrow(/must be an array/);
  });

  it("rejects a target without a non-empty target string", () => {
    expect(() =>
      parseFileBackedMappings({
        meta: { parameters: [{ name: "frequency", overrides: [{}] }] },
      }),
    ).toThrow(/requires a non-empty "target"/);
  });

  it("rejects a non-string expression", () => {
    expect(() =>
      parseFileBackedMappings({
        meta: {
          parameters: [
            { name: "frequency", overrides: [{ target: "osc.frequency", expression: 5 }] },
          ],
        },
      }),
    ).toThrow(/non-string "expression"/);
  });
});

describe("applyFileBackedMappings", () => {
  it("is a no-op when no mappings are supplied", () => {
    const cloned = makeGraph();
    const before = JSON.stringify(cloned);
    applyFileBackedMappings([], DERIVED, cloned);
    expect(JSON.stringify(cloned)).toBe(before);
  });

  it("sets a node param directly from the parameter value", () => {
    const cloned = makeGraph();
    applyFileBackedMappings(
      [{ parameter: "frequency", overrides: [{ target: "osc.frequency" }] }],
      { ...DERIVED, frequency: 660 },
      cloned,
    );
    expect((cloned.nodes.osc as { params?: { frequency?: number } }).params?.frequency).toBe(660);
  });

  it("sets an automation event field selected by kind", () => {
    const cloned = makeGraph();
    applyFileBackedMappings(
      [
        {
          parameter: "depthEnd",
          overrides: [{ target: "amp.automation.gain.linearRamp.value" }],
        },
      ],
      { ...DERIVED, depthEnd: 0.9 },
      cloned,
    );
    const automation = (cloned.nodes.amp as {
      automation?: Record<string, Array<Record<string, unknown>>>;
    }).automation;
    expect(automation?.gain?.[1]?.value).toBe(0.9);
  });

  it("sets an automation event field selected by index", () => {
    const cloned = makeGraph();
    applyFileBackedMappings(
      [{ parameter: "depthEnd", overrides: [{ target: "amp.automation.gain.0.value" }] }],
      { ...DERIVED, depthEnd: 0.1 },
      cloned,
    );
    const automation = (cloned.nodes.amp as {
      automation?: Record<string, Array<Record<string, unknown>>>;
    }).automation;
    expect(automation?.gain?.[0]?.value).toBe(0.1);
  });

  it("evaluates a computed mapping against a parameter and a node field", () => {
    const cloned = makeGraph();
    applyFileBackedMappings(
      [
        {
          parameter: "ratio",
          overrides: [{ target: "osc.frequency", expression: "frequency * ratio" }],
        },
      ],
      { ...DERIVED, frequency: 300, ratio: 3 },
      cloned,
    );
    expect((cloned.nodes.osc as { params?: { frequency?: number } }).params?.frequency).toBe(900);
  });

  it("evaluates a division mapping against a constant", () => {
    const cloned = makeGraph();
    // depth = depthEnd / 2 written back onto the param field.
    applyFileBackedMappings(
      [{ parameter: "depthEnd", overrides: [{ target: "amp.gain", expression: "depthEnd / 2" }] }],
      { ...DERIVED, depthEnd: 0.5 },
      cloned,
    );
    expect((cloned.nodes.amp as { params?: { gain?: number } }).params?.gain).toBe(0.25);
  });

  it("resolves computed mappings against post-override parameter values regardless of order", () => {
    // The mapping for `ratio` is declared before the mapping for `frequency`,
    // yet both must see the overridden `frequency` value.
    const cloned = makeGraph();
    const mappings: FileBackedParameterMapping[] = [
      {
        parameter: "ratio",
        overrides: [{ target: "osc.frequency", expression: "frequency * ratio" }],
      },
      {
        parameter: "frequency",
        overrides: [{ target: "amp.gain", expression: "frequency / 1000" }],
      },
    ];
    applyFileBackedMappings(mappings, { ...DERIVED, frequency: 500, ratio: 2 }, cloned);

    const oscFreq = (cloned.nodes.osc as { params?: { frequency?: number } }).params?.frequency;
    const ampGain = (cloned.nodes.amp as { params?: { gain?: number } }).params?.gain;
    expect(oscFreq).toBe(1000);
    expect(ampGain).toBe(0.5);
  });

  it("overwrites a value already written by the heuristic (mapping wins)", () => {
    const cloned = makeGraph();
    // Simulate the heuristic having written the parameter value directly.
    (cloned.nodes.amp as { params?: { gain?: number } }).params!.gain = 0.5;
    applyFileBackedMappings(
      [{ parameter: "depthEnd", overrides: [{ target: "amp.gain", expression: "depthEnd / 2" }] }],
      { ...DERIVED, depthEnd: 0.5 },
      cloned,
    );
    expect((cloned.nodes.amp as { params?: { gain?: number } }).params?.gain).toBe(0.25);
  });

  it("throws for an unknown parameter", () => {
    expect(() =>
      applyFileBackedMappings(
        [{ parameter: "doesNotExist", overrides: [{ target: "osc.frequency" }] }],
        DERIVED,
        makeGraph(),
      ),
    ).toThrow(/unknown parameter "doesNotExist"/);
  });

  it("throws for an unknown node", () => {
    expect(() =>
      applyFileBackedMappings(
        [{ parameter: "frequency", overrides: [{ target: "missing.frequency" }] }],
        DERIVED,
        makeGraph(),
      ),
    ).toThrow(/unknown node "missing"/);
  });

  it("throws for an unknown node param field", () => {
    expect(() =>
      applyFileBackedMappings(
        [{ parameter: "frequency", overrides: [{ target: "osc.unknownField" }] }],
        DERIVED,
        makeGraph(),
      ),
    ).toThrow(/unknown param field "unknownField"/);
  });

  it("throws for an unknown automation param", () => {
    expect(() =>
      applyFileBackedMappings(
        [{ parameter: "frequency", overrides: [{ target: "amp.automation.nope.0.value" }] }],
        DERIVED,
        makeGraph(),
      ),
    ).toThrow(/unknown automation param "nope"/);
  });

  it("throws for an unknown automation field", () => {
    expect(() =>
      applyFileBackedMappings(
        [{ parameter: "frequency", overrides: [{ target: "amp.automation.gain.0.unknown" }] }],
        DERIVED,
        makeGraph(),
      ),
    ).toThrow(/unknown automation field "unknown"/);
  });

  it("throws for a malformed target path", () => {
    expect(() =>
      applyFileBackedMappings(
        [{ parameter: "frequency", overrides: [{ target: "osc" }] }],
        DERIVED,
        makeGraph(),
      ),
    ).toThrow(/Invalid override target/);
  });

  it("throws when an expression references an unknown symbol", () => {
    expect(() =>
      applyFileBackedMappings(
        [{ parameter: "frequency", overrides: [{ target: "osc.frequency", expression: "frequency * nope" }] }],
        DERIVED,
        makeGraph(),
      ),
    ).toThrow(/Unknown reference "nope"/);
  });

  it("throws on division by zero", () => {
    expect(() =>
      applyFileBackedMappings(
        [{ parameter: "frequency", overrides: [{ target: "osc.frequency", expression: "frequency / 0" }] }],
        DERIVED,
        makeGraph(),
      ),
    ).toThrow(/Division by zero/);
  });
});

// ---------------------------------------------------------------------------
// Integration: mappings applied through createFileBackedRegistration
// ---------------------------------------------------------------------------

function makeRawDoc(options: {
  overrides?: unknown;
  ampGain?: number;
  paramName?: string;
  paramDefault?: number;
} = {}): Record<string, unknown> {
  const paramName = options.paramName ?? "level";
  const paramDefault = options.paramDefault ?? 0.25;
  const parameter: Record<string, unknown> = {
    name: paramName,
    type: "number",
    min: 0.1,
    max: 0.5,
    default: paramDefault,
  };
  if (options.overrides !== undefined) {
    parameter.overrides = options.overrides;
  }

  return {
    version: "0.1",
    meta: {
      name: "mapping-integration",
      duration: 0.1,
      parameters: [parameter],
    },
    nodes: {
      dc: { kind: "constant", params: { value: 1 } },
      amp: { kind: "gain", params: { gain: options.ampGain ?? 0.001 } },
      out: { kind: "destination" },
    },
    routing: [{ chain: ["dc", "amp", "out"] }],
  };
}

async function renderRegistration(
  registration: RecipeRegistration,
  seed: number,
  overrides: Record<string, number>,
): Promise<Float32Array> {
  const duration = registration.getDuration(createRng(seed), overrides);
  const ctx = new OfflineAudioContext(1, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE);
  await registration.buildOfflineGraph(createRng(seed), ctx, duration, overrides);
  const rendered = await ctx.startRendering();
  return new Float32Array(rendered.getChannelData(0));
}

function peak(samples: Float32Array): number {
  let result = 0;
  for (const sample of samples) {
    const abs = Math.abs(sample);
    if (abs > result) {
      result = abs;
    }
  }
  return result;
}

describe("file-backed mapping integration", () => {
  it("applies a declared direct mapping through the registration", async () => {
    // The heuristic cannot reach `amp.gain` from `level` (different name, and
    // the node's default does not match the parameter default), so any change
    // must come from the explicit mapping.
    const rawDoc = makeRawDoc({
      ampGain: 0.001,
      paramDefault: 0.25,
      overrides: [{ target: "amp.gain" }],
    });
    const registration = createFileBackedRegistration(
      "mapped-direct",
      validateToneGraph(rawDoc),
      rawDoc,
    );

    const low = await renderRegistration(registration, 5, { level: 0.1 });
    const high = await renderRegistration(registration, 5, { level: 0.4 });

    expect(compareBuffers(low, high).identical).toBe(false);
    expect(peak(high)).toBeGreaterThan(peak(low));
  });

  it("explicit mapping wins over the heuristic for the same field", async () => {
    const withMappingRaw = makeRawDoc({
      overrides: [{ target: "amp.gain", expression: "level * 2" }],
    });
    const withoutMappingRaw = makeRawDoc();

    const withMapping = createFileBackedRegistration(
      "with-mapping",
      validateToneGraph(withMappingRaw),
      withMappingRaw,
    );
    const withoutMapping = createFileBackedRegistration(
      "without-mapping",
      validateToneGraph(withoutMappingRaw),
      withoutMappingRaw,
    );

    const overrides = { level: 0.2 };
    const mapped = await renderRegistration(withMapping, 7, overrides);
    const heuristic = await renderRegistration(withoutMapping, 7, overrides);

    // Heuristic writes 0.2; the mapping overrides it with 0.4.
    expect(peak(mapped)).toBeGreaterThan(peak(heuristic) * 1.5);
  });

  it("leaves a recipe without mappings byte-identical across renders", async () => {
    const rawDoc = makeRawDoc();
    const registration = createFileBackedRegistration(
      "no-mapping",
      validateToneGraph(rawDoc),
      rawDoc,
    );

    const first = await renderRegistration(registration, 11, { level: 0.3 });
    const second = await renderRegistration(registration, 11, { level: 0.3 });
    expect(compareBuffers(first, second).identical).toBe(true);
  });

  it("fails loudly at registration time for an unknown target field", () => {
    const rawDoc = makeRawDoc({ overrides: [{ target: "amp.nope" }] });
    expect(() =>
      createFileBackedRegistration("bad-field", validateToneGraph(rawDoc), rawDoc),
    ).toThrow(/unknown param field "nope"/);
  });

  it("skips a file with an invalid mapping at discovery time", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "toneforge-mapping-"));
    try {
      await writeFile(
        join(tempDir, "bad-mapping.json"),
        JSON.stringify(makeRawDoc({ overrides: [{ target: "amp.nope" }] })),
        "utf-8",
      );

      const registry = new RecipeRegistry();
      const warnings: string[] = [];
      const discovered = await discoverFileBackedRecipes(registry, {
        recipeDirectory: tempDir,
        logger: { warn: (message) => warnings.push(message) },
      });

      expect(discovered).toEqual([]);
      expect(warnings.some((message) => message.includes('unknown param field "nope"'))).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
