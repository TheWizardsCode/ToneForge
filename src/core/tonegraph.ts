import { loadSample } from "../audio/sample-loader.js";
import { createRng, type Rng } from "./rng.js";
import type {
  ToneGraphDocument,
  ToneGraphNodeDefinition,
  ToneGraphRoutingEntry,
} from "./tonegraph-schema.js";

type ModulationWave = "sine" | "square" | "sawtooth" | "triangle";

interface AutomationSetEvent {
  kind: "set";
  time: number;
  value: number;
}

interface AutomationLinearRampEvent {
  kind: "linearRamp";
  time: number;
  value: number;
}

interface AutomationLfoEvent {
  kind: "lfo";
  rate: number;
  depth: number;
  offset?: number;
  start?: number;
  end?: number;
  step?: number;
  wave?: ModulationWave;
}

type AutomationEvent =
  | AutomationSetEvent
  | AutomationLinearRampEvent
  | AutomationLfoEvent;

interface RuntimeNode {
  output: AudioNode;
  params: Record<string, AudioParam>;
  startables: AudioScheduledSourceNode[];
  stoppables: AudioScheduledSourceNode[];
  internals: AudioNode[];
  envelope?: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
    gain: AudioParam;
  };
}

export interface ToneGraphHandle {
  graph: ToneGraphDocument;
  nodes: Record<string, AudioNode>;
  duration: number;
  start: (time?: number) => void;
  stop: (time?: number) => void;
  dispose: () => void;
}

type NodeFactory = (
  ctx: BaseAudioContext,
  id: string,
  def: ToneGraphNodeDefinition,
  rng: Rng,
) => Promise<RuntimeNode>;

const SUPPORTED_OSC_TYPES = new Set(["sine", "square", "sawtooth", "triangle"]);
const SUPPORTED_FILTER_TYPES = new Set(["lowpass", "highpass", "bandpass"]);

function ensureNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function getDurationHint(graph: ToneGraphDocument): number {
  if (typeof graph.meta?.duration === "number" && Number.isFinite(graph.meta.duration) && graph.meta.duration > 0) {
    return graph.meta.duration;
  }

  let duration = 0;
  for (const def of Object.values(graph.nodes)) {
    if (def.kind === "envelope") {
      const attack = def.params?.attack ?? 0.01;
      const decay = def.params?.decay ?? 0.1;
      const release = def.params?.release ?? 0;
      duration = Math.max(duration, attack + decay + release);
    }
  }

  return duration > 0 ? duration : 1;
}

function generateNoiseBuffer(
  ctx: BaseAudioContext,
  durationSeconds: number,
  color: "white" | "pink" | "brown",
  rng: Rng,
): AudioBuffer {
  const frameCount = Math.max(1, Math.ceil(ctx.sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (color === "white") {
    for (let i = 0; i < frameCount; i += 1) {
      data[i] = (rng() * 2) - 1;
    }
    return buffer;
  }

  if (color === "brown") {
    let last = 0;
    for (let i = 0; i < frameCount; i += 1) {
      const white = (rng() * 2) - 1;
      last = (last + (0.02 * white)) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < frameCount; i += 1) {
    const white = (rng() * 2) - 1;
    b0 = (0.99886 * b0) + (white * 0.0555179);
    b1 = (0.99332 * b1) + (white * 0.0750759);
    b2 = (0.96900 * b2) + (white * 0.1538520);
    b3 = (0.86650 * b3) + (white * 0.3104856);
    b4 = (0.55000 * b4) + (white * 0.5329522);
    b5 = (-0.7616 * b5) - (white * 0.0168980);
    const sample = b0 + b1 + b2 + b3 + b4 + b5 + (b6 + (white * 0.5362));
    data[i] = sample * 0.11;
    b6 = white * 0.115926;
  }

  return buffer;
}

function parseAutomationList(raw: unknown, nodeId: string, paramName: string): AutomationEvent[] {
  if (!Array.isArray(raw)) {
    throw new Error(`Node "${nodeId}" automation for param "${paramName}" must be an array.`);
  }

  return raw.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`Node "${nodeId}" automation[${index}] for param "${paramName}" must be an object.`);
    }

    const event = entry as Record<string, unknown>;
    const kindRaw = event.kind;
    if (typeof kindRaw !== "string") {
      throw new Error(`Node "${nodeId}" automation[${index}] for param "${paramName}" requires string kind.`);
    }

    if (kindRaw === "set") {
      return {
        kind: "set",
        time: ensureNumber(event.time, `Node "${nodeId}" automation[${index}].time`),
        value: ensureNumber(event.value, `Node "${nodeId}" automation[${index}].value`),
      };
    }

    if (kindRaw === "linearRamp") {
      return {
        kind: "linearRamp",
        time: ensureNumber(event.time, `Node "${nodeId}" automation[${index}].time`),
        value: ensureNumber(event.value, `Node "${nodeId}" automation[${index}].value`),
      };
    }

    if (kindRaw === "lfo") {
      const waveRaw = event.wave;
      const wave: ModulationWave =
        waveRaw === "square" || waveRaw === "sawtooth" || waveRaw === "triangle" ? waveRaw : "sine";

      const lfoEvent: AutomationLfoEvent = {
        kind: "lfo",
        rate: ensureNumber(event.rate, `Node "${nodeId}" automation[${index}].rate`),
        depth: ensureNumber(event.depth, `Node "${nodeId}" automation[${index}].depth`),
        wave,
      };

      if (event.offset !== undefined) {
        lfoEvent.offset = ensureNumber(event.offset, `Node "${nodeId}" automation[${index}].offset`);
      }
      if (event.start !== undefined) {
        lfoEvent.start = ensureNumber(event.start, `Node "${nodeId}" automation[${index}].start`);
      }
      if (event.end !== undefined) {
        lfoEvent.end = ensureNumber(event.end, `Node "${nodeId}" automation[${index}].end`);
      }
      if (event.step !== undefined) {
        lfoEvent.step = ensureNumber(event.step, `Node "${nodeId}" automation[${index}].step`);
      }

      return lfoEvent;
    }

    throw new Error(
      `Node "${nodeId}" automation[${index}] for param "${paramName}" has unsupported kind "${kindRaw}".`,
    );
  });
}

function extractNodeAutomation(nodeId: string, def: ToneGraphNodeDefinition): Map<string, AutomationEvent[]> {
  const result = new Map<string, AutomationEvent[]>();

  const raw = (def as unknown as { automation?: unknown }).automation;
  if (raw === undefined) {
    return result;
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`Node "${nodeId}" automation must be an object map of param name -> events.`);
  }

  for (const [paramName, events] of Object.entries(raw as Record<string, unknown>)) {
    result.set(paramName, parseAutomationList(events, nodeId, paramName));
  }

  return result;
}

function waveformSample(wave: ModulationWave, phase: number): number {
  const wrapped = phase - Math.floor(phase);
  if (wave === "sine") {
    return Math.sin(wrapped * Math.PI * 2);
  }
  if (wave === "square") {
    return wrapped < 0.5 ? 1 : -1;
  }
  if (wave === "sawtooth") {
    return (2 * wrapped) - 1;
  }
  return 1 - (4 * Math.abs(wrapped - 0.5));
}

function applyAutomationEvents(
  param: AudioParam,
  events: AutomationEvent[],
  durationHint: number,
  baseTime = 0,
): void {
  for (const event of events) {
    if (event.kind === "set") {
      param.setValueAtTime(event.value, baseTime + event.time);
      continue;
    }

    if (event.kind === "linearRamp") {
      param.linearRampToValueAtTime(event.value, baseTime + event.time);
      continue;
    }

    const start = baseTime + (event.start ?? 0);
    const end = baseTime + (event.end ?? durationHint);
    const step = event.step ?? (1 / 128);
    const offset = event.offset ?? 0;
    const dt = Math.max(1 / 2048, step);

    for (let t = start; t <= end; t += dt) {
      const phase = (t - start) * event.rate;
      const value = offset + (event.depth * waveformSample(event.wave ?? "sine", phase));
      param.setValueAtTime(value, t);
    }
  }
}

function resolveEndpoint(
  ref: string,
  nodes: Map<string, RuntimeNode>,
): { output?: AudioNode; param?: AudioParam } {
  const dotIndex = ref.indexOf(".");
  if (dotIndex < 0) {
    const node = nodes.get(ref);
    return { output: node?.output };
  }

  const nodeId = ref.slice(0, dotIndex);
  const paramName = ref.slice(dotIndex + 1);
  const node = nodes.get(nodeId);
  if (!node) {
    return {};
  }
  return { param: node.params[paramName] };
}

async function createRuntimeNode(
  ctx: BaseAudioContext,
  id: string,
  def: ToneGraphNodeDefinition,
  rng: Rng,
  durationHint: number,
): Promise<RuntimeNode> {
  const factoryMap: Record<ToneGraphNodeDefinition["kind"], NodeFactory> = {
    destination: async (context) => ({
      output: context.destination,
      params: {},
      startables: [],
      stoppables: [],
      internals: [context.destination],
    }),
    gain: async (context, _id, nodeDef) => {
      const gainNode = context.createGain();
      gainNode.gain.value = nodeDef.kind === "gain" ? (nodeDef.params?.gain ?? 1) : 1;
      return {
        output: gainNode,
        params: { gain: gainNode.gain },
        startables: [],
        stoppables: [],
        internals: [gainNode],
      };
    },
    oscillator: async (context, _id, nodeDef) => {
      const oscillator = context.createOscillator();
      const type = nodeDef.kind === "oscillator" ? (nodeDef.params?.type ?? "sine") : "sine";
      if (!SUPPORTED_OSC_TYPES.has(type)) {
        throw new Error(`Node "${id}" oscillator type "${type}" is unsupported.`);
      }
      oscillator.type = type;
      oscillator.frequency.value = nodeDef.kind === "oscillator" ? (nodeDef.params?.frequency ?? 440) : 440;
      oscillator.detune.value = nodeDef.kind === "oscillator" ? (nodeDef.params?.detune ?? 0) : 0;
      return {
        output: oscillator,
        params: { frequency: oscillator.frequency, detune: oscillator.detune },
        startables: [oscillator],
        stoppables: [oscillator],
        internals: [oscillator],
      };
    },
    biquadFilter: async (context, _id, nodeDef) => {
      const filter = context.createBiquadFilter();
      const type = nodeDef.kind === "biquadFilter" ? (nodeDef.params?.type ?? "lowpass") : "lowpass";
      if (!SUPPORTED_FILTER_TYPES.has(type)) {
        throw new Error(`Node "${id}" filter type "${type}" is unsupported.`);
      }
      filter.type = type;
      filter.frequency.value = nodeDef.kind === "biquadFilter" ? (nodeDef.params?.frequency ?? 1000) : 1000;
      filter.Q.value = nodeDef.kind === "biquadFilter" ? (nodeDef.params?.Q ?? 1) : 1;
      filter.gain.value = nodeDef.kind === "biquadFilter" ? (nodeDef.params?.gain ?? 0) : 0;
      return {
        output: filter,
        params: { frequency: filter.frequency, Q: filter.Q, gain: filter.gain, detune: filter.detune },
        startables: [],
        stoppables: [],
        internals: [filter],
      };
    },
    noise: async (context, _id, nodeDef, activeRng) => {
      const color = nodeDef.kind === "noise" ? (nodeDef.params?.color ?? "white") : "white";
      const level = nodeDef.kind === "noise" ? (nodeDef.params?.level ?? 1) : 1;
      const source = context.createBufferSource();
      source.buffer = generateNoiseBuffer(context, durationHint, color, activeRng);
      source.loop = false;
      const levelGain = context.createGain();
      levelGain.gain.value = level;
      source.connect(levelGain);
      return {
        output: levelGain,
        params: { level: levelGain.gain },
        startables: [source],
        stoppables: [source],
        internals: [source, levelGain],
      };
    },
    bufferSource: async (context, nodeId, nodeDef) => {
      const source = context.createBufferSource();
      if (nodeDef.kind !== "bufferSource") {
        throw new Error(`Node "${nodeId}" must be bufferSource.`);
      }

      if (!nodeDef.params?.sample) {
        throw new Error(`Node "${nodeId}" of kind bufferSource requires params.sample.`);
      }

      const sampleCtx = context as Parameters<typeof loadSample>[1];
      source.buffer = await loadSample(nodeDef.params.sample, sampleCtx);
      source.loop = nodeDef.params.loop ?? false;
      source.playbackRate.value = nodeDef.params.playbackRate ?? 1;
      return {
        output: source,
        params: { playbackRate: source.playbackRate, detune: source.detune },
        startables: [source],
        stoppables: [source],
        internals: [source],
      };
    },
    envelope: async (context, _id, nodeDef) => {
      const gainNode = context.createGain();
      gainNode.gain.value = 0;
      const attack = nodeDef.kind === "envelope" ? (nodeDef.params?.attack ?? 0.01) : 0.01;
      const decay = nodeDef.kind === "envelope" ? (nodeDef.params?.decay ?? 0.1) : 0.1;
      const sustain = nodeDef.kind === "envelope" ? (nodeDef.params?.sustain ?? 0) : 0;
      const release = nodeDef.kind === "envelope" ? (nodeDef.params?.release ?? 0) : 0;
      return {
        output: gainNode,
        params: { gain: gainNode.gain },
        startables: [],
        stoppables: [],
        internals: [gainNode],
        envelope: { attack, decay, sustain, release, gain: gainNode.gain },
      };
    },
    lfo: async (context, _id, nodeDef) => {
      const osc = context.createOscillator();
      const depthGain = context.createGain();
      const offset = context.createConstantSource();
      const output = context.createGain();

      const rate = nodeDef.kind === "lfo" ? (nodeDef.params?.rate ?? 1) : 1;
      const depth = nodeDef.kind === "lfo" ? (nodeDef.params?.depth ?? 1) : 1;
      const offsetValue = nodeDef.kind === "lfo" ? (nodeDef.params?.offset ?? 0) : 0;
      const type = nodeDef.kind === "lfo" ? (nodeDef.params?.type ?? "sine") : "sine";
      if (!SUPPORTED_OSC_TYPES.has(type)) {
        throw new Error(`Node "${id}" lfo type "${type}" is unsupported.`);
      }

      osc.type = type;
      osc.frequency.value = rate;
      depthGain.gain.value = depth;
      offset.offset.value = offsetValue;

      osc.connect(depthGain);
      depthGain.connect(output);
      offset.connect(output);

      return {
        output,
        params: { rate: osc.frequency, depth: depthGain.gain, offset: offset.offset },
        startables: [osc, offset],
        stoppables: [osc, offset],
        internals: [osc, depthGain, offset, output],
      };
    },
    constant: async (context, _id, nodeDef) => {
      const source = context.createConstantSource();
      source.offset.value = nodeDef.kind === "constant" ? (nodeDef.params?.value ?? 0) : 0;
      return {
        output: source,
        params: { value: source.offset },
        startables: [source],
        stoppables: [source],
        internals: [source],
      };
    },
    fmPattern: async (context, _id, nodeDef) => {
      const carrier = context.createOscillator();
      const modulator = context.createOscillator();
      const modulationGain = context.createGain();
      const output = context.createGain();

      const carrierFrequency = nodeDef.kind === "fmPattern"
        ? (nodeDef.params?.carrierFrequency ?? 440)
        : 440;
      const modulatorFrequency = nodeDef.kind === "fmPattern"
        ? (nodeDef.params?.modulatorFrequency ?? 220)
        : 220;
      const modulationIndex = nodeDef.kind === "fmPattern"
        ? (nodeDef.params?.modulationIndex ?? 1)
        : 1;

      carrier.type = "sine";
      modulator.type = "sine";
      carrier.frequency.value = carrierFrequency;
      modulator.frequency.value = modulatorFrequency;
      modulationGain.gain.value = modulationIndex;

      modulator.connect(modulationGain);
      modulationGain.connect(carrier.frequency);
      carrier.connect(output);

      return {
        output,
        params: {
          carrierFrequency: carrier.frequency,
          modulatorFrequency: modulator.frequency,
          modulationIndex: modulationGain.gain,
        },
        startables: [carrier, modulator],
        stoppables: [carrier, modulator],
        internals: [carrier, modulator, modulationGain, output],
      };
    },
  };

  const factory = factoryMap[def.kind];
  if (!factory) {
    throw new Error(`Unsupported node kind "${def.kind}" for node "${id}".`);
  }
  return factory(ctx, id, def, rng);
}

function expandRouting(entries: ToneGraphRoutingEntry[]): Array<{ from: string; to: string }> {
  const links: Array<{ from: string; to: string }> = [];
  for (const entry of entries) {
    if ("chain" in entry) {
      for (let i = 0; i < entry.chain.length - 1; i += 1) {
        links.push({ from: entry.chain[i]!, to: entry.chain[i + 1]! });
      }
      continue;
    }
    links.push(entry);
  }
  return links;
}

export async function loadToneGraph(
  graph: ToneGraphDocument,
  ctx: BaseAudioContext,
  rng: Rng,
): Promise<ToneGraphHandle> {
  const duration = getDurationHint(graph);
  const activeRng = graph.random?.seed !== undefined ? createRng(graph.random.seed) : rng;

  const runtimeNodes = new Map<string, RuntimeNode>();
  for (const [id, def] of Object.entries(graph.nodes)) {
    runtimeNodes.set(id, await createRuntimeNode(ctx, id, def, activeRng, duration));
  }

  for (const route of expandRouting(graph.routing)) {
    const from = resolveEndpoint(route.from, runtimeNodes);
    const to = resolveEndpoint(route.to, runtimeNodes);

    if (from.param) {
      throw new Error(`Invalid route ${route.from} -> ${route.to}: routing from AudioParam is not supported.`);
    }
    if (!from.output) {
      throw new Error(`Invalid route ${route.from} -> ${route.to}: source node is missing.`);
    }
    if (!to.output && !to.param) {
      throw new Error(`Invalid route ${route.from} -> ${route.to}: destination is missing.`);
    }

    if (to.param) {
      from.output.connect(to.param);
    } else {
      from.output.connect(to.output as AudioNode);
    }
  }

  for (const [id, def] of Object.entries(graph.nodes)) {
    const runtime = runtimeNodes.get(id);
    if (!runtime) {
      continue;
    }

    const automation = extractNodeAutomation(id, def);
    for (const [paramName, events] of automation) {
      const param = runtime.params[paramName];
      if (!param) {
        throw new Error(`Node "${id}" automation targets unknown AudioParam "${paramName}".`);
      }
      applyAutomationEvents(param, events, duration);
    }
  }

  const started = new Set<AudioScheduledSourceNode>();
  const nodes: Record<string, AudioNode> = {};
  for (const [id, runtime] of runtimeNodes) {
    nodes[id] = runtime.output;
  }

  const start = (time = 0): void => {
    for (const runtime of runtimeNodes.values()) {
      if (runtime.envelope) {
        const attackEnd = time + runtime.envelope.attack;
        const decayEnd = attackEnd + runtime.envelope.decay;
        runtime.envelope.gain.cancelScheduledValues(time);
        runtime.envelope.gain.setValueAtTime(0, time);
        runtime.envelope.gain.linearRampToValueAtTime(1, attackEnd);
        runtime.envelope.gain.linearRampToValueAtTime(runtime.envelope.sustain, decayEnd);
      }

      for (const source of runtime.startables) {
        if (started.has(source)) {
          continue;
        }
        source.start(time);
        started.add(source);
      }
    }
  };

  const stop = (time = duration): void => {
    for (const runtime of runtimeNodes.values()) {
      if (runtime.envelope) {
        const releaseEnd = time + runtime.envelope.release;
        runtime.envelope.gain.cancelScheduledValues(time);
        runtime.envelope.gain.setValueAtTime(runtime.envelope.sustain, time);
        runtime.envelope.gain.linearRampToValueAtTime(0, releaseEnd);
      }

      for (const source of runtime.stoppables) {
        if (!started.has(source)) {
          continue;
        }
        source.stop(time);
      }
    }
  };

  const dispose = (): void => {
    for (const runtime of runtimeNodes.values()) {
      for (const node of runtime.internals) {
        node.disconnect();
      }
    }
  };

  return {
    graph,
    nodes,
    duration,
    start,
    stop,
    dispose,
  };
}

export default loadToneGraph;
