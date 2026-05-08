import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');
const srcDir = resolve(projectRoot, 'presets', 'recipes');
const destDir = resolve(__dirname, '..', 'public', 'presets', 'recipes');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

ensureDir(destDir);

let files = [];
try {
  files = readdirSync(srcDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
} catch (e) {
  console.warn('No presets/recipes found to copy:', e.message || e);
  process.exit(0);
}

for (const f of files) {
  const src = resolve(srcDir, f);
  const dst = resolve(destDir, f);
  try {
    copyFileSync(src, dst);
    console.log(`Copied ${f} -> web/public/presets/recipes/${f}`);
  } catch (e) {
    console.warn(`Failed to copy ${f}:`, e.message || e);
  }
}
