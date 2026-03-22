export type ToneGraphVersion = "0.1";

export interface ToneGraphEngine {
  backend?: "webaudio";
}

export type ToneGraphParameterType = "number" | "integer" | "boolean" | "string";

export interface ToneGraphParameterDefinition {
  name: string;
  type: ToneGraphParameterType;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  default?: number | boolean | string;
}

export interface ToneGraphMeta {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  duration?: number;
  parameters?: ToneGraphParameterDefinition[];
}

export interface ToneGraphRandom {
  algorithm?: "xorshift32";
  seed?: number;
}

export interface ToneGraphTransport {
  tempo?: number;
  timeSignature?: [number, number];
}

export interface ToneGraphDestinationNode {
  kind: "destination";
}

export interface ToneGraphGainNode {
  kind: "gain";
  params?: {
    gain?: number;
  };
}

export interface ToneGraphOscillatorNode {
  kind: "oscillator";
  params?: {
    type?: "sine" | "square" | "sawtooth" | "triangle";
    frequency?: number;
    detune?: number;
  };
}

export interface ToneGraphNoiseNode {
  kind: "noise";
  params?: {
    color?: "white" | "pink" | "brown";
    level?: number;
  };
}

export interface ToneGraphBiquadFilterNode {
  kind: "biquadFilter";
  params?: {
    type?: "lowpass" | "highpass" | "bandpass";
    frequency?: number;
    Q?: number;
    gain?: number;
  };
}

export interface ToneGraphBufferSourceNode {
  kind: "bufferSource";
  params?: {
    sample?: string;
    loop?: boolean;
    playbackRate?: number;
  };
}

export interface ToneGraphEnvelopeNode {
  kind: "envelope";
  params?: {
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
  };
}

export interface ToneGraphLfoNode {
  kind: "lfo";
  params?: {
    type?: "sine" | "square" | "sawtooth" | "triangle";
    rate?: number;
    depth?: number;
    offset?: number;
  };
}

export interface ToneGraphConstantNode {
  kind: "constant";
  params?: {
    value?: number;
  };
}

export interface ToneGraphFmPatternNode {
  kind: "fmPattern";
  params?: {
    carrierFrequency?: number;
    modulatorFrequency?: number;
    modulationIndex?: number;
  };
}

export type ToneGraphNodeDefinition =
  | ToneGraphDestinationNode
  | ToneGraphGainNode
  | ToneGraphOscillatorNode
  | ToneGraphNoiseNode
  | ToneGraphBiquadFilterNode
  | ToneGraphBufferSourceNode
  | ToneGraphEnvelopeNode
  | ToneGraphLfoNode
  | ToneGraphConstantNode
  | ToneGraphFmPatternNode;

export interface ToneGraphRoutingLink {
  from: string;
  to: string;
}

export interface ToneGraphRoutingChain {
  chain: [string, string, ...string[]];
}

export type ToneGraphRoutingEntry = ToneGraphRoutingLink | ToneGraphRoutingChain;

export interface ToneGraphDocument {
  version: ToneGraphVersion;
  engine?: ToneGraphEngine;
  meta?: ToneGraphMeta;
  random?: ToneGraphRandom;
  transport?: ToneGraphTransport;
  nodes: Record<string, ToneGraphNodeDefinition>;
  routing: ToneGraphRoutingEntry[];
}

type UnknownRecord = Record<string, unknown>;

const ALLOWED_NODE_KINDS = new Set<string>([
  "destination",
  "gain",
  "oscillator",
  "noise",
  "biquadFilter",
  "bufferSource",
  "envelope",
  "lfo",
  "constant",
  "fmPattern",
]);

function isToneGraphParameterType(value: string): value is ToneGraphParameterType {
  return ["number", "integer", "boolean", "string"].includes(value);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, path: string): asserts value is UnknownRecord {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }
}

function assertNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`);
  }
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean.`);
  }
}

function assertOptionalRecord(value: unknown, path: string): asserts value is UnknownRecord | undefined {
  if (value === undefined) {
    return;
  }
  assertRecord(value, path);
}

function validateMetaParameters(value: unknown, path: string): ToneGraphParameterDefinition[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }

  const names = new Set<string>();

  return value.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    assertRecord(entry, entryPath);

    const name = entry.name;
    const typeRaw = entry.type;

    assertString(name, `${entryPath}.name`);
    assertString(typeRaw, `${entryPath}.type`);

    if (!isToneGraphParameterType(typeRaw)) {
      throw new Error(`${entryPath}.type must be one of: number, integer, boolean, string.`);
    }
    const type: ToneGraphParameterType = typeRaw;

    if (names.has(name)) {
      throw new Error(`${path} contains duplicate parameter name \"${name}\".`);
    }
    names.add(name);

    const min = entry.min;
    const max = entry.max;
    const step = entry.step;
    const unit = entry.unit;
    const defaultValue = entry.default;

    if (min !== undefined) {
      assertNumber(min, `${entryPath}.min`);
    }
    if (max !== undefined) {
      assertNumber(max, `${entryPath}.max`);
    }
    if (step !== undefined) {
      assertNumber(step, `${entryPath}.step`);
    }
    if (unit !== undefined) {
      assertString(unit, `${entryPath}.unit`);
    }
    if (min !== undefined && max !== undefined && min > max) {
      throw new Error(`${entryPath} has invalid bounds: min must be <= max.`);
    }

    if (defaultValue !== undefined) {
      if (type === "boolean") {
        assertBoolean(defaultValue, `${entryPath}.default`);
      } else if (type === "string") {
        assertString(defaultValue, `${entryPath}.default`);
      } else {
        assertNumber(defaultValue, `${entryPath}.default`);
        if (type === "integer" && !Number.isInteger(defaultValue)) {
          throw new Error(`${entryPath}.default must be an integer.`);
        }
      }

      if (typeof defaultValue === "number") {
        if (min !== undefined && defaultValue < min) {
          throw new Error(`${entryPath}.default must be >= min.`);
        }
        if (max !== undefined && defaultValue > max) {
          throw new Error(`${entryPath}.default must be <= max.`);
        }
      }
    }

    return {
      name,
      type,
      min,
      max,
      step,
      unit,
      default: defaultValue as number | boolean | string | undefined,
    };
  });
}

function validateNodeDefinition(nodeId: string, value: unknown): ToneGraphNodeDefinition {
  const path = `nodes.${nodeId}`;
  assertRecord(value, path);

  const kind = value.kind;
  assertString(kind, `${path}.kind`);

  if (!ALLOWED_NODE_KINDS.has(kind)) {
    throw new Error(`${path}.kind \"${kind}\" is invalid. Allowed kinds: ${Array.from(ALLOWED_NODE_KINDS).join(", ")}.`);
  }

  const paramsRaw = value.params;
  assertOptionalRecord(paramsRaw, `${path}.params`);
  const params = paramsRaw ?? undefined;

  switch (kind) {
    case "destination":
      return { kind };
    case "gain":
      if (params?.gain !== undefined) {
        assertNumber(params.gain, `${path}.params.gain`);
      }
      return { kind, params: params as ToneGraphGainNode["params"] };
    case "oscillator":
      if (params?.type !== undefined) {
        assertString(params.type, `${path}.params.type`);
        if (!["sine", "square", "sawtooth", "triangle"].includes(params.type)) {
          throw new Error(`${path}.params.type must be one of: sine, square, sawtooth, triangle.`);
        }
      }
      if (params?.frequency !== undefined) {
        assertNumber(params.frequency, `${path}.params.frequency`);
      }
      if (params?.detune !== undefined) {
        assertNumber(params.detune, `${path}.params.detune`);
      }
      return { kind, params: params as ToneGraphOscillatorNode["params"] };
    case "noise":
      if (params?.color !== undefined) {
        assertString(params.color, `${path}.params.color`);
        if (!["white", "pink", "brown"].includes(params.color)) {
          throw new Error(`${path}.params.color must be one of: white, pink, brown.`);
        }
      }
      if (params?.level !== undefined) {
        assertNumber(params.level, `${path}.params.level`);
      }
      return { kind, params: params as ToneGraphNoiseNode["params"] };
    case "biquadFilter":
      if (params?.type !== undefined) {
        assertString(params.type, `${path}.params.type`);
        if (!["lowpass", "highpass", "bandpass"].includes(params.type)) {
          throw new Error(`${path}.params.type must be one of: lowpass, highpass, bandpass.`);
        }
      }
      if (params?.frequency !== undefined) {
        assertNumber(params.frequency, `${path}.params.frequency`);
      }
      if (params?.Q !== undefined) {
        assertNumber(params.Q, `${path}.params.Q`);
      }
      if (params?.gain !== undefined) {
        assertNumber(params.gain, `${path}.params.gain`);
      }
      return { kind, params: params as ToneGraphBiquadFilterNode["params"] };
    case "bufferSource":
      if (params?.sample !== undefined) {
        assertString(params.sample, `${path}.params.sample`);
      }
      if (params?.loop !== undefined) {
        assertBoolean(params.loop, `${path}.params.loop`);
      }
      if (params?.playbackRate !== undefined) {
        assertNumber(params.playbackRate, `${path}.params.playbackRate`);
      }
      return { kind, params: params as ToneGraphBufferSourceNode["params"] };
    case "envelope":
      if (params?.attack !== undefined) {
        assertNumber(params.attack, `${path}.params.attack`);
      }
      if (params?.decay !== undefined) {
        assertNumber(params.decay, `${path}.params.decay`);
      }
      if (params?.sustain !== undefined) {
        assertNumber(params.sustain, `${path}.params.sustain`);
      }
      if (params?.release !== undefined) {
        assertNumber(params.release, `${path}.params.release`);
      }
      return { kind, params: params as ToneGraphEnvelopeNode["params"] };
    case "lfo":
      if (params?.type !== undefined) {
        assertString(params.type, `${path}.params.type`);
        if (!["sine", "square", "sawtooth", "triangle"].includes(params.type)) {
          throw new Error(`${path}.params.type must be one of: sine, square, sawtooth, triangle.`);
        }
      }
      if (params?.rate !== undefined) {
        assertNumber(params.rate, `${path}.params.rate`);
      }
      if (params?.depth !== undefined) {
        assertNumber(params.depth, `${path}.params.depth`);
      }
      if (params?.offset !== undefined) {
        assertNumber(params.offset, `${path}.params.offset`);
      }
      return { kind, params: params as ToneGraphLfoNode["params"] };
    case "constant":
      if (params?.value !== undefined) {
        assertNumber(params.value, `${path}.params.value`);
      }
      return { kind, params: params as ToneGraphConstantNode["params"] };
    case "fmPattern":
      if (params?.carrierFrequency !== undefined) {
        assertNumber(params.carrierFrequency, `${path}.params.carrierFrequency`);
      }
      if (params?.modulatorFrequency !== undefined) {
        assertNumber(params.modulatorFrequency, `${path}.params.modulatorFrequency`);
      }
      if (params?.modulationIndex !== undefined) {
        assertNumber(params.modulationIndex, `${path}.params.modulationIndex`);
      }
      return { kind, params: params as ToneGraphFmPatternNode["params"] };
    default:
      throw new Error(`${path}.kind is unsupported.`);
  }
}

function validateRoutingEntry(value: unknown, index: number): ToneGraphRoutingEntry {
  const path = `routing[${index}]`;
  assertRecord(value, path);

  const hasFrom = Object.prototype.hasOwnProperty.call(value, "from");
  const hasTo = Object.prototype.hasOwnProperty.call(value, "to");
  const hasChain = Object.prototype.hasOwnProperty.call(value, "chain");

  if (hasChain) {
    if (hasFrom || hasTo) {
      throw new Error(`${path} must use either {from,to} or {chain}, not both.`);
    }

    const chain = value.chain;
    if (!Array.isArray(chain)) {
      throw new Error(`${path}.chain must be an array.`);
    }
    if (chain.length < 2) {
      throw new Error(`${path}.chain must include at least 2 node ids.`);
    }
    chain.forEach((entry, chainIndex) => {
      assertString(entry, `${path}.chain[${chainIndex}]`);
    });
    return { chain: chain as [string, string, ...string[]] };
  }

  if (!hasFrom || !hasTo) {
    throw new Error(`${path} must contain either {from,to} or {chain}.`);
  }

  const from = value.from;
  const to = value.to;
  assertString(from, `${path}.from`);
  assertString(to, `${path}.to`);
  return { from, to };
}

function parseEndpointReference(ref: string): { nodeId: string; param?: string } {
  const dotIndex = ref.indexOf(".");
  if (dotIndex < 0) {
    return { nodeId: ref };
  }

  const nodeId = ref.slice(0, dotIndex);
  const param = ref.slice(dotIndex + 1);
  if (nodeId.length === 0 || param.length === 0) {
    throw new Error(`Invalid endpoint reference "${ref}".`);
  }

  return { nodeId, param };
}

export function validateToneGraph(doc: unknown): ToneGraphDocument {
  assertRecord(doc, "ToneGraph document");

  if (Object.prototype.hasOwnProperty.call(doc, "sequences")) {
    throw new Error("ToneGraph field \"sequences\" is reserved for v0.2 and is not allowed in v0.1.");
  }
  if (Object.prototype.hasOwnProperty.call(doc, "namespaces")) {
    throw new Error("ToneGraph field \"namespaces\" is reserved for v0.2 and is not allowed in v0.1.");
  }

  const version = doc.version;
  assertString(version, "version");
  if (version !== "0.1") {
    throw new Error(`Unsupported ToneGraph version: ${version}. Expected 0.1.`);
  }

  if (doc.engine !== undefined) {
    assertRecord(doc.engine, "engine");
    if (doc.engine.backend !== undefined) {
      assertString(doc.engine.backend, "engine.backend");
      if (doc.engine.backend !== "webaudio") {
        throw new Error("engine.backend must be \"webaudio\" for ToneGraph v0.1.");
      }
    }
  }

  if (doc.meta !== undefined) {
    assertRecord(doc.meta, "meta");
    if (doc.meta.name !== undefined) {
      assertString(doc.meta.name, "meta.name");
    }
    if (doc.meta.description !== undefined) {
      assertString(doc.meta.description, "meta.description");
    }
    if (doc.meta.category !== undefined) {
      assertString(doc.meta.category, "meta.category");
    }
    if (doc.meta.tags !== undefined) {
      if (!Array.isArray(doc.meta.tags)) {
        throw new Error("meta.tags must be an array of strings.");
      }
      doc.meta.tags.forEach((tag, index) => assertString(tag, `meta.tags[${index}]`));
    }
    if (doc.meta.duration !== undefined) {
      assertNumber(doc.meta.duration, "meta.duration");
    }
    if (doc.meta.parameters !== undefined) {
      validateMetaParameters(doc.meta.parameters, "meta.parameters");
    }
  }

  if (doc.random !== undefined) {
    assertRecord(doc.random, "random");
    if (doc.random.algorithm !== undefined) {
      assertString(doc.random.algorithm, "random.algorithm");
      if (doc.random.algorithm !== "xorshift32") {
        throw new Error("random.algorithm must be \"xorshift32\" for ToneGraph v0.1.");
      }
    }
    if (doc.random.seed !== undefined) {
      assertNumber(doc.random.seed, "random.seed");
      if (!Number.isInteger(doc.random.seed)) {
        throw new Error("random.seed must be an integer.");
      }
    }
  }

  if (doc.transport !== undefined) {
    assertRecord(doc.transport, "transport");
    if (doc.transport.tempo !== undefined) {
      assertNumber(doc.transport.tempo, "transport.tempo");
    }
    if (doc.transport.timeSignature !== undefined) {
      if (!Array.isArray(doc.transport.timeSignature) || doc.transport.timeSignature.length !== 2) {
        throw new Error("transport.timeSignature must be a [numerator, denominator] tuple.");
      }
      const [numerator, denominator] = doc.transport.timeSignature;
      assertNumber(numerator, "transport.timeSignature[0]");
      assertNumber(denominator, "transport.timeSignature[1]");
      if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || numerator <= 0 || denominator <= 0) {
        throw new Error("transport.timeSignature values must be positive integers.");
      }
    }
  }

  if (doc.nodes === undefined) {
    throw new Error("nodes is required.");
  }
  assertRecord(doc.nodes, "nodes");

  const nodeEntries = Object.entries(doc.nodes);
  if (nodeEntries.length === 0) {
    throw new Error("nodes must include at least one node definition.");
  }

  const nodes: Record<string, ToneGraphNodeDefinition> = {};
  for (const [nodeId, nodeDef] of nodeEntries) {
    if (nodeId.trim().length === 0) {
      throw new Error("nodes contains an empty node id.");
    }
    nodes[nodeId] = validateNodeDefinition(nodeId, nodeDef);
  }

  if (doc.routing === undefined) {
    throw new Error("routing is required.");
  }
  if (!Array.isArray(doc.routing)) {
    throw new Error("routing must be an array.");
  }

  const routing = doc.routing.map((entry, index) => validateRoutingEntry(entry, index));

  const nodeIds = new Set(Object.keys(nodes));
  routing.forEach((entry, index) => {
    if ("chain" in entry) {
      entry.chain.forEach((nodeId, chainIndex) => {
        if (!nodeIds.has(nodeId)) {
          throw new Error(`routing[${index}].chain[${chainIndex}] references unknown node \"${nodeId}\".`);
        }
      });
      return;
    }

    const fromEndpoint = parseEndpointReference(entry.from);
    const toEndpoint = parseEndpointReference(entry.to);

    if (fromEndpoint.param !== undefined) {
      throw new Error(`routing[${index}].from cannot reference AudioParam endpoint \"${entry.from}\".`);
    }
    if (!nodeIds.has(fromEndpoint.nodeId)) {
      throw new Error(`routing[${index}].from references unknown node \"${entry.from}\".`);
    }
    if (!nodeIds.has(toEndpoint.nodeId)) {
      throw new Error(`routing[${index}].to references unknown node \"${entry.to}\".`);
    }
  });

  const validated: ToneGraphDocument = {
    version: "0.1",
    nodes,
    routing,
  };

  if (doc.engine !== undefined) {
    validated.engine = { backend: doc.engine.backend as ToneGraphEngine["backend"] };
  }
  if (doc.meta !== undefined) {
    validated.meta = {
      name: doc.meta.name as string | undefined,
      description: doc.meta.description as string | undefined,
      category: doc.meta.category as string | undefined,
      tags: doc.meta.tags as string[] | undefined,
      duration: doc.meta.duration as number | undefined,
      parameters: doc.meta.parameters
        ? validateMetaParameters(doc.meta.parameters, "meta.parameters")
        : undefined,
    };
  }
  if (doc.random !== undefined) {
    validated.random = {
      algorithm: doc.random.algorithm as ToneGraphRandom["algorithm"],
      seed: doc.random.seed as number | undefined,
    };
  }
  if (doc.transport !== undefined) {
    validated.transport = {
      tempo: doc.transport.tempo as number | undefined,
      timeSignature: doc.transport.timeSignature as [number, number] | undefined,
    };
  }

  return validated;
}
