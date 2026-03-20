/**
 * Minimal ToneGraph loader (v0.1 subset)
 *
 * Implements a small, focused loader that can instantiate a subset of
 * Tone.js nodes from a declarative ToneGraph document. This is intentionally
 * small to serve as a PoC for file-backed recipes and to keep parity with
 * existing in-repo recipes used by tests.
 */

import type { Rng } from "./rng.js";

export interface ToneGraphLoaderOptions {
  Tone: any;
  registry?: any;
  registryFactory?: (ns: string, name: string, opts?: any) => any;
  rng?: Rng;
}

export interface ToneGraphHandle {
  graph: any;
  nodes: Record<string, any>;
  duration: number;
  start: (time: number) => void;
  stop: (time: number) => void;
  dispose: () => void;
}

/**
 * Minimal helper to instantiate a ToneGraph in memory and return a handle.
 * Supports a small set of Tone.js node kinds used by current recipes:
 * - tone/Oscillator
 * - tone/Filter
 * - tone/AmplitudeEnvelope
 * - tone/Gain
 * - tone/Destination (special)
 *
 * Routing is a flat list of connections with `from` and `to` node ids.
 */
export function loadToneGraph(graph: any, opts: ToneGraphLoaderOptions): ToneGraphHandle {
  const { Tone, rng } = opts;

  const nodes: Record<string, any> = {};

  // Create nodes
  if (graph.nodes) {
    for (const [id, def] of Object.entries<any>(graph.nodes)) {
      const kind: string = def.kind || "";
      try {
        if (kind === "tone/Oscillator") {
          // Tone.Oscillator(frequency?, type?)
          const freq = def.frequency ?? def.freq ?? 440;
          const type = def.type ?? "sine";
          nodes[id] = new Tone.Oscillator(freq, type);
        } else if (kind === "tone/Filter") {
          // Tone.Filter(frequency?, type?)
          const freq = def.frequency ?? def.cutoff ?? 1000;
          const type = def.type ?? "lowpass";
          nodes[id] = new Tone.Filter(freq, type);
        } else if (kind === "tone/AmplitudeEnvelope") {
          // Tone.AmplitudeEnvelope({attack, decay, sustain, release})
          const cfg = {
            attack: def.attack ?? 0.01,
            decay: def.decay ?? 0.1,
            sustain: def.sustain ?? 0,
            release: def.release ?? 0,
          };
          nodes[id] = new Tone.AmplitudeEnvelope(cfg);
        } else if (kind === "tone/Gain") {
          const gain = def.gain ?? def.value ?? 1;
          nodes[id] = new Tone.Gain(gain);
        } else if (kind === "tone/Destination") {
          // Destination is represented by Tone.Destination
          nodes[id] = Tone.Destination;
        } else {
          // Unknown kind — attempt to resolve via Tone namespace (engine-specific)
          const parts = kind.split("/");
          if (parts[0] === "tone" && parts[1] && Tone[parts[1]]) {
            const Klass = Tone[parts[1]];
            // Try to instantiate with provided params or with no args
            if (def.params && typeof def.params === "object") {
              nodes[id] = new Klass(def.params);
            } else if (def.args && Array.isArray(def.args)) {
              nodes[id] = new Klass(...def.args);
            } else {
              nodes[id] = new Klass();
            }
          } else {
            // Leave undefined for now — caller may supply via registryFactory
            nodes[id] = undefined;
          }
        }
      } catch (err) {
        // Best-effort: store the error so callers can debug
        nodes[id] = { __error: String(err) };
      }
    }
  }

  // Build routing
  if (graph.routing && Array.isArray(graph.routing)) {
    for (const route of graph.routing) {
      const from = nodes[route.from as string];
      const to = nodes[route.to as string];
      if (!from || !to) continue;
      try {
        // If from has `connect` (Tone objects), use it; otherwise try to call `to.connect(from)`
        if (typeof from.connect === "function") {
          from.connect(to);
        } else if (typeof to.connect === "function") {
          // If the target exposes connect, try to connect target to source
          // (this is a fallback and may be a no-op for some objects)
          to.connect(from);
        }
      } catch (e) {
        // ignore routing errors for now
      }
    }
  }

  // Determine a simple duration heuristic: prefer graph.meta.duration, otherwise
  // look for amplitude envelope nodes and sum attack+decay as a conservative estimate.
  let duration = 0;
  if (graph.meta && typeof graph.meta.duration === "number") {
    duration = graph.meta.duration;
  } else {
    for (const def of Object.values<any>(graph.nodes ?? {})) {
      if ((def.kind ?? "") === "tone/AmplitudeEnvelope") {
        duration = Math.max(duration, (def.attack ?? 0) + (def.decay ?? 0) + (def.release ?? 0));
      }
    }
    if (duration === 0) duration = 1; // fallback
  }

  function start(time = 0) {
    // Start oscillators and trigger envelopes if present
    for (const [id, node] of Object.entries(nodes)) {
      try {
        if (node && typeof node.start === "function") node.start(time);
        // If node is an envelope, trigger attack
        if (node && node.triggerAttack && typeof node.triggerAttack === "function") {
          node.triggerAttack(time);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  function stop(time = 0) {
    for (const node of Object.values(nodes)) {
      try {
        if (node && typeof node.stop === "function") node.stop(time);
      } catch (e) {
        // ignore
      }
    }
  }

  function dispose() {
    for (const node of Object.values(nodes)) {
      try {
        if (node && typeof node.dispose === "function") node.dispose();
      } catch (e) {
        // ignore
      }
    }
  }

  return { graph, nodes, duration, start, stop, dispose };
}

/**
 * Create a Recipe-like factory from a ToneGraph object.
 * This is a convenience used by the registry lazy factory loader.
 */
export function createRecipeFactoryFromGraph(graph: any) {
  return (rng: Rng) => {
    // Defer Tone import until runtime — callers will typically wrap this
    // factory inside an async loader that imports Tone and binds it.
    throw new Error("createRecipeFactoryFromGraph must be bound to a Tone instance via a loader");
  };
}

export default loadToneGraph;
