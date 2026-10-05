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

/**
 * A named mixer bus declared at the document level. The loader materialises
 * each bus as a GainNode in the Web Audio graph, addressed by the reserved
 * reference `bus:<id>` from routing entries.
 */
export interface ToneGraphBusDefinition {
  gain?: number;
}

export interface ToneGraphDestinationNode {
  kind: "destination";
  automation?: ToneGraphNodeAutomation;
}

export interface ToneGraphGainNode {
  kind: "gain";
  params?: {
    gain?: number;
  };
  automation?: ToneGraphNodeAutomation;
}

export interface ToneGraphOscillatorNode {
  kind: "oscillator";
  params?: {
    type?: "sine" | "square" | "sawtooth" | "triangle";
    frequency?: number;
    detune?: number;
  };
  automation?: ToneGraphNodeAutomation;
}

export interface ToneGraphNoiseNode {
  kind: "noise";
  params?: {
    color?: "white" | "pink" | "brown";
    level?: number;
  };
  automation?: ToneGraphNodeAutomation;
}

export interface ToneGraphBiquadFilterNode {
  kind: "biquadFilter";
  params?: {
    type?: "lowpass" | "highpass" | "bandpass";
    frequency?: number;
    Q?: number;
    gain?: number;
  };
  automation?: ToneGraphNodeAutomation;
}

export interface ToneGraphBufferSourceNode {
  kind: "bufferSource";
  params?: {
    sample?: string;
    loop?: boolean;
    playbackRate?: number;
  };
  automation?: ToneGraphNodeAutomation;
}

export interface ToneGraphEnvelopeNode {
  kind: "envelope";
  params?: {
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
  };
  automation?: ToneGraphNodeAutomation;
}

export interface ToneGraphLfoNode {
  kind: "lfo";
  params?: {
    type?: "sine" | "square" | "sawtooth" | "triangle";
    rate?: number;
    depth?: number;
    offset?: number;
  };
  automation?: ToneGraphNodeAutomation;
}

export interface ToneGraphConstantNode {
  kind: "constant";
  params?: {
    value?: number;
  };
  automation?: ToneGraphNodeAutomation;
}

export interface ToneGraphFmPatternNode {
  kind: "fmPattern";
  params?: {
    carrierFrequency?: number;
    modulatorFrequency?: number;
    modulationIndex?: number;
  };
  automation?: ToneGraphNodeAutomation;
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

/**
 * Bus routing entry: fans `from` inputs into the named bus and fans the bus
 * out to `to` outputs. `from`/`to` accept either a single endpoint reference
 * or a list, enabling fan-in (`from` array) and fan-out (`to` array).
 */
export interface ToneGraphRoutingBus {
  bus: string;
  from?: string | string[];
  to?: string | string[];
}

export type ToneGraphSequenceEventKind = "set" | "linearRamp" | "exponentialRamp" | "lfo";

export interface ToneGraphSequenceSetEvent {
  kind: "set";
  time: number;
  value: number;
}

export interface ToneGraphSequenceLinearRampEvent {
  kind: "linearRamp";
  time: number;
  value: number;
}

export interface ToneGraphSequenceExponentialRampEvent {
  kind: "exponentialRamp";
  time: number;
  value: number;
}

export interface ToneGraphSequenceLfoEvent {
  kind: "lfo";
  rate: number;
  depth: number;
  wave?: "sine" | "square" | "sawtooth" | "triangle";
  offset?: number;
  start?: number;
  end?: number;
  step?: number;
}

export type ToneGraphSequenceEvent =
  | ToneGraphSequenceSetEvent
  | ToneGraphSequenceLinearRampEvent
  | ToneGraphSequenceExponentialRampEvent
  | ToneGraphSequenceLfoEvent;

/**
 * Per-node automation map: AudioParam name -> ordered event list. Uses the
 * same event kinds as document-level `sequences` so authors only learn one
 * contract. Preserved verbatim by the validator and consumed by the loader.
 */
export type ToneGraphNodeAutomation = Record<string, ToneGraphSequenceEvent[]>;

export interface ToneGraphSequence {
  node: string;
  param: string;
  events: ToneGraphSequenceEvent[];
}

export type ToneGraphRoutingEntry =
  | ToneGraphRoutingLink
  | ToneGraphRoutingChain
  | ToneGraphRoutingBus;

export interface ToneGraphDocument {
  version: ToneGraphVersion;
  engine?: ToneGraphEngine;
  meta?: ToneGraphMeta;
  random?: ToneGraphRandom;
  transport?: ToneGraphTransport;
  nodes: Record<string, ToneGraphNodeDefinition>;
  routing: ToneGraphRoutingEntry[];
  buses?: Record<string, ToneGraphBusDefinition>;
  sequences?: ToneGraphSequence[];
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
  const automation = validateNodeAutomation(value.automation, `${path}.automation`);

  let node: ToneGraphNodeDefinition;
  switch (kind) {
    case "destination":
      node = { kind };
      break;
    case "gain":
      if (params?.gain !== undefined) {
        assertNumber(params.gain, `${path}.params.gain`);
      }
      node = { kind, params: params as ToneGraphGainNode["params"] };
      break;
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
      node = { kind, params: params as ToneGraphOscillatorNode["params"] };
      break;
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
      node = { kind, params: params as ToneGraphNoiseNode["params"] };
      break;
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
      node = { kind, params: params as ToneGraphBiquadFilterNode["params"] };
      break;
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
      node = { kind, params: params as ToneGraphBufferSourceNode["params"] };
      break;
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
      node = { kind, params: params as ToneGraphEnvelopeNode["params"] };
      break;
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
      node = { kind, params: params as ToneGraphLfoNode["params"] };
      break;
    case "constant":
      if (params?.value !== undefined) {
        assertNumber(params.value, `${path}.params.value`);
      }
      node = { kind, params: params as ToneGraphConstantNode["params"] };
      break;
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
      node = { kind, params: params as ToneGraphFmPatternNode["params"] };
      break;
    default:
      throw new Error(`${path}.kind is unsupported.`);
  }

  if (automation !== undefined) {
    node.automation = automation;
  }

  return node;
}

function isEndpointList(value: unknown): value is string | string[] {
  if (typeof value === "string") {
    return true;
  }
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateRoutingEntry(value: unknown, index: number): ToneGraphRoutingEntry {
  const path = `routing[${index}]`;
  assertRecord(value, path);

  const hasFrom = Object.prototype.hasOwnProperty.call(value, "from");
  const hasTo = Object.prototype.hasOwnProperty.call(value, "to");
  const hasChain = Object.prototype.hasOwnProperty.call(value, "chain");
  const hasBus = Object.prototype.hasOwnProperty.call(value, "bus");

  if (hasBus) {
    if (hasChain) {
      throw new Error(`${path} must not combine "bus" with "chain".`);
    }

    const bus = value.bus;
    assertString(bus, `${path}.bus`);
    if (bus.trim().length === 0) {
      throw new Error(`${path}.bus must not be empty.`);
    }

    const from = value.from;
    const to = value.to;

    if (from === undefined && to === undefined) {
      throw new Error(`${path} must declare at least one input or output.`);
    }

    if (from !== undefined) {
      if (!isEndpointList(from)) {
        throw new Error(`${path}.from must be a string or an array of strings.`);
      }
      if (Array.isArray(from) && from.length === 0) {
        throw new Error(`${path}.from must not be empty.`);
      }
    }

    if (to !== undefined) {
      if (!isEndpointList(to)) {
        throw new Error(`${path}.to must be a string or an array of strings.`);
      }
      if (Array.isArray(to) && to.length === 0) {
        throw new Error(`${path}.to must not be empty.`);
      }
    }

    return {
      bus,
      from: from as string | string[] | undefined,
      to: to as string | string[] | undefined,
    };
  }

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

const SUPPORTED_WAVES = new Set(["sine", "square", "sawtooth", "triangle"]);

function validateSequenceEvent(
  event: unknown,
  path: string,
): ToneGraphSequenceEvent {
  assertRecord(event, path);

  const kind = event.kind;
  assertString(kind, `${path}.kind`);

  if (kind === "set" || kind === "linearRamp") {
    return {
      kind,
      time: ensureFiniteNumber(event.time, `${path}.time`),
      value: ensureFiniteNumber(event.value, `${path}.value`),
    };
  }

  if (kind === "exponentialRamp") {
    const value = ensureFiniteNumber(event.value, `${path}.value`);
    if (value <= 0) {
      throw new Error(`${path}.value must be greater than 0 for an exponentialRamp event.`);
    }
    return {
      kind: "exponentialRamp",
      time: ensureFiniteNumber(event.time, `${path}.time`),
      value,
    };
  }

  if (kind === "lfo") {
    const lfoEvent: ToneGraphSequenceLfoEvent = {
      kind: "lfo",
      rate: ensureFiniteNumber(event.rate, `${path}.rate`),
      depth: ensureFiniteNumber(event.depth, `${path}.depth`),
    };

    if (event.wave !== undefined) {
      assertString(event.wave, `${path}.wave`);
      if (!SUPPORTED_WAVES.has(event.wave)) {
        throw new Error(`${path}.wave must be one of: sine, square, sawtooth, triangle.`);
      }
      lfoEvent.wave = event.wave as ToneGraphSequenceLfoEvent["wave"];
    }
    if (event.offset !== undefined) {
      lfoEvent.offset = ensureFiniteNumber(event.offset, `${path}.offset`);
    }
    if (event.start !== undefined) {
      lfoEvent.start = ensureFiniteNumber(event.start, `${path}.start`);
    }
    if (event.end !== undefined) {
      lfoEvent.end = ensureFiniteNumber(event.end, `${path}.end`);
    }
    if (event.step !== undefined) {
      lfoEvent.step = ensureFiniteNumber(event.step, `${path}.step`);
    }

    return lfoEvent;
  }

  throw new Error(
    `${path}.kind "${kind}" is invalid. Allowed kinds: set, linearRamp, exponentialRamp, lfo.`,
  );
}

function validateNodeAutomation(
  raw: unknown,
  path: string,
): ToneGraphNodeAutomation | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${path} must be an object mapping AudioParam names to event arrays.`);
  }

  const automation: ToneGraphNodeAutomation = {};
  for (const [paramName, events] of Object.entries(raw as UnknownRecord)) {
    if (paramName.trim().length === 0) {
      throw new Error(`${path} contains an empty AudioParam name.`);
    }
    if (!Array.isArray(events)) {
      throw new Error(`${path}.${paramName} must be an array of events.`);
    }
    automation[paramName] = events.map((event, index) =>
      validateSequenceEvent(event, `${path}.${paramName}[${index}]`),
    );
  }

  return automation;
}

function validateSequences(value: unknown, path: string): ToneGraphSequence[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }

  return value.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    assertRecord(entry, entryPath);

    const node = entry.node;
    const param = entry.param;
    assertString(node, `${entryPath}.node`);
    assertString(param, `${entryPath}.param`);

    const events = entry.events;
    if (!Array.isArray(events)) {
      throw new Error(`${entryPath}.events must be an array.`);
    }

    return {
      node,
      param,
      events: events.map((event, eventIndex) =>
        validateSequenceEvent(event, `${entryPath}.events[${eventIndex}]`),
      ),
    };
  });
}

function ensureFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`);
  }
  return value;
}

export function validateToneGraph(doc: unknown): ToneGraphDocument {
  assertRecord(doc, "ToneGraph document");

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

  const buses: Record<string, ToneGraphBusDefinition> = {};
  if (doc.buses !== undefined) {
    assertRecord(doc.buses, "buses");
    for (const [busId, busDef] of Object.entries(doc.buses)) {
      if (busId.trim().length === 0) {
        throw new Error("buses contains an empty bus id.");
      }
      if (nodeIds.has(busId)) {
        throw new Error(`Bus id "${busId}" collides with a node id.`);
      }
      if (nodeIds.has(`bus:${busId}`)) {
        throw new Error(`Node id "bus:${busId}" conflicts with bus reference for bus "${busId}".`);
      }
      assertRecord(busDef, `buses.${busId}`);
      if (busDef.gain !== undefined) {
        assertNumber(busDef.gain, `buses.${busId}.gain`);
      }
      buses[busId] = { gain: busDef.gain as number | undefined };
    }
  }

  const busIds = new Set(Object.keys(buses));

  const toEndpointList = (value: string | string[] | undefined): string[] =>
    value === undefined ? [] : Array.isArray(value) ? value : [value];

  const assertNodeEndpoint = (ref: string, path: string, allowParam: boolean): void => {
    const endpoint = parseEndpointReference(ref);
    if (endpoint.param !== undefined && !allowParam) {
      throw new Error(`${path} cannot reference AudioParam endpoint "${ref}".`);
    }
    if (!nodeIds.has(endpoint.nodeId)) {
      throw new Error(`${path} references unknown node "${ref}".`);
    }
  };

  routing.forEach((entry, index) => {
    if ("chain" in entry) {
      entry.chain.forEach((nodeId, chainIndex) => {
        if (!nodeIds.has(nodeId)) {
          throw new Error(`routing[${index}].chain[${chainIndex}] references unknown node \"${nodeId}\".`);
        }
      });
      return;
    }

    if ("bus" in entry) {
      if (!busIds.has(entry.bus)) {
        throw new Error(`routing[${index}].bus references unknown bus "${entry.bus}".`);
      }
      toEndpointList(entry.from).forEach((ref, refIndex) => {
        assertNodeEndpoint(ref, `routing[${index}].from[${refIndex}]`, false);
      });
      toEndpointList(entry.to).forEach((ref, refIndex) => {
        assertNodeEndpoint(ref, `routing[${index}].to[${refIndex}]`, true);
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

  const sequences = doc.sequences !== undefined
    ? validateSequences(doc.sequences, "sequences")
    : undefined;
  sequences?.forEach((sequence, index) => {
    if (!nodeIds.has(sequence.node)) {
      throw new Error(`sequences[${index}].node references unknown node "${sequence.node}".`);
    }
    if (sequence.param.trim().length === 0) {
      throw new Error(`sequences[${index}].param must not be empty.`);
    }
  });

  const validated: ToneGraphDocument = {
    version: "0.1",
    nodes,
    routing,
  };

  if (sequences !== undefined) {
    validated.sequences = sequences;
  }

  if (doc.buses !== undefined) {
    validated.buses = buses;
  }

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
