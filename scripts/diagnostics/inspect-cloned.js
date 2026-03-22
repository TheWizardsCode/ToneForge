import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { validateToneGraph } from '../dist/core/tonegraph-schema.js';
import { createRng } from '../dist/core/rng.js';
import { loadToneGraph } from '../dist/core/tonegraph.js';
const PRESETS = path.resolve(new URL(import.meta.url).pathname, '..', '..', 'presets', 'recipes');

async function run() {
  const file = path.join(PRESETS, 'ui-scifi-confirm.yaml');
  const src = await fs.readFile(file, 'utf8');
  const raw = yaml.load(src);
  const graph = validateToneGraph(raw);

  for (const seed of [1, 2]) {
    const rng = createRng(seed);
    // derive params from meta.parameters
    const derived = {};
    const paramsMeta = graph.meta?.parameters ?? [];
    for (const p of paramsMeta) {
      const min = p.min ?? 0;
      const max = p.max ?? min + 1;
      const val = min + ((max - min) * rng());
      derived[p.name] = val;
    }

    // clone and apply
    const cloned = JSON.parse(JSON.stringify(graph));
    // osc frequency
    if (cloned.nodes.osc && cloned.nodes.osc.params) cloned.nodes.osc.params.frequency = derived.frequency;
    if (cloned.nodes.filter && cloned.nodes.filter.params) cloned.nodes.filter.params.frequency = derived.filterCutoff;
    if (cloned.nodes.env && cloned.nodes.env.params) {
      cloned.nodes.env.params.attack = derived.attack;
      cloned.nodes.env.params.decay = derived.decay;
    }

    const ctx = new (await import('node-web-audio-api')).OfflineAudioContext(1, Math.ceil(44100 * (cloned.meta?.duration ?? 0.1)), 44100);
    const handle = await loadToneGraph(cloned, ctx, createRng(seed));
    // Inspect oscillator frequency node if present
    const oscNode = handle.nodes['osc'];
    const filterNode = handle.nodes['filter'];
    console.log('seed', seed, 'osc freq value:', oscNode?.frequency?.value, 'filter freq value:', filterNode?.frequency?.value);
    const buf = await ctx.startRendering();
    const samples = new Float32Array(buf.getChannelData(0));
    console.log('first10', Array.from(samples.slice(0,10)));
  }
}

run().catch(e=>{console.error(e); process.exit(1)});
