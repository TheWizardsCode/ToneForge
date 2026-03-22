import crypto from "crypto";
import { renderRecipe } from "../../src/core/renderer.ts";

function hashSamples(samples) {
  // Hash the underlying ArrayBuffer bytes for a compact deterministic fingerprint
  return crypto.createHash("sha256").update(Buffer.from(samples.buffer)).digest("hex");
}

async function run() {
  const recipe = process.argv[2] ?? "ui-scifi-confirm";
  const duration = process.argv[3] ? Number(process.argv[3]) : 0.5;

  console.log(`Rendering recipe=${recipe} duration=${duration}`);

  const seeds = [1, 2];
  const results = [];

  for (const s of seeds) {
    console.log(`  seed ${s}: starting`);
    const res = await renderRecipe(recipe, s, duration);
    const h = hashSamples(res.samples);
    console.log(`  seed ${s}: samples=${res.samples.length} hash=${h}`);
    results.push({ seed: s, hash: h, samples: res.samples });
  }

  const identical = results[0].hash === results[1].hash;
  console.log(`
Result: seeds ${seeds[0]} and ${seeds[1]} ${identical ? "produce IDENTICAL" : "produce DIFFERENT"} outputs`);
  if (!identical) {
    console.log("First few samples (seed 1):", Array.from(results[0].samples.slice(0, 10)));
    console.log("First few samples (seed 2):", Array.from(results[1].samples.slice(0, 10)));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
