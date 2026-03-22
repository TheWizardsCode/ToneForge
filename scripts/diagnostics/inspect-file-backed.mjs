import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const recipeModule = await import(path.resolve(__dirname, '..', 'dist', 'core', 'recipe.js'));
const { RecipeRegistry, discoverFileBackedRecipes } = recipeModule;

const PRESETS_DIR = path.resolve(__dirname, '..', 'presets', 'recipes');

async function run() {
  const registry = new RecipeRegistry();
  const discovered = await discoverFileBackedRecipes(registry, { recipeDirectory: PRESETS_DIR });
  console.log('discovered', discovered);

  const reg = registry.getRegistration('ui-scifi-confirm');
  if (!reg) {
    console.error('ui-scifi-confirm not found');
    process.exit(1);
  }

  // Call getParams with RNGs for seeds 1 and 2
  const { createRng } = await import(path.resolve(__dirname, '..', 'dist', 'core', 'rng.js'));
  const p1 = reg.getParams(createRng(1));
  const p2 = reg.getParams(createRng(2));

  console.log('params seed=1', p1);
  console.log('params seed=2', p2);
}

run().catch(err => { console.error(err); process.exit(1); });
