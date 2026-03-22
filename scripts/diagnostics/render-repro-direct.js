import path from 'path';
import { RecipeRegistry, discoverFileBackedRecipes } from '../dist/core/recipe.js';
import { createRng } from '../dist/core/rng.js';
import { OfflineAudioContext } from 'node-web-audio-api';
import crypto from 'crypto';

async function run() {
  const PRESETS_DIR = path.resolve(__dirname, '..', 'presets', 'recipes');
  const registry = new RecipeRegistry();
  await discoverFileBackedRecipes(registry, { recipeDirectory: PRESETS_DIR });
  const reg = registry.getRegistration('ui-scifi-confirm');
  if (!reg) throw new Error('not found');

  for (const s of [1,2]) {
    const duration = reg.getDuration(createRng(s));
    const frameCount = Math.ceil(44100 * duration);
    const ctx = new OfflineAudioContext(1, frameCount, 44100);
    await reg.buildOfflineGraph(createRng(s), ctx, duration);
    const buf = await ctx.startRendering();
    const samples = new Float32Array(buf.getChannelData(0));
    const hash = crypto.createHash('sha256').update(Buffer.from(samples.buffer)).digest('hex');
    console.log(`seed ${s}: duration=${duration} samples=${samples.length} hash=${hash}`);
    console.log('first10', Array.from(samples.slice(0,10)));
  }
}

run().catch(e=>{console.error(e); process.exit(1);});
