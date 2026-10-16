/**
 * Regenerate the instrument determinism golden hash registry.
 *
 * The registry (`src/instruments/__tests__/fixtures/determinism-hashes.json`)
 * stores the SHA-256 of the byte-identical offline render for every
 * {@link DETERMINISM_CASES} case. This script is the **only** sanctioned way
 * to update it — never edit the registry by hand.
 *
 * Run:
 * ```bash
 * npm run regenerate:determinism-fixtures
 * ```
 *
 * Use it when the engine's deterministic output legitimately changes (e.g. a
 * deliberate engine bugfix) — every such change must be intentional, and the
 * determinism test fails loudly until the registry is regenerated through this
 * command.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashBuffer } from "../../src/test-utils/buffer-compare.js";
import {
  DETERMINISM_CASES,
  DETERMINISM_TAIL_SECONDS,
  type DeterminismCase,
} from "../../src/instruments/__tests__/determinism-cases.js";
import { ENGINE_SAMPLE_RATE, renderInstrument } from "../../src/instruments/engine.js";

const REGISTRY_PATH = resolve(
  import.meta.dirname,
  "../../src/instruments/__tests__/fixtures/determinism-hashes.json",
);

/** Render one case to its byte-identical sample hash. */
async function renderCaseHash(caseItem: DeterminismCase): Promise<string> {
  const rendered = await renderInstrument(caseItem.definition, caseItem.events, {
    sampleRate: ENGINE_SAMPLE_RATE,
    tail: DETERMINISM_TAIL_SECONDS,
  });
  return hashBuffer(new Uint8Array(rendered.samples.buffer));
}

async function main(): Promise<void> {
  const cases: Record<string, string> = {};
  for (const caseItem of DETERMINISM_CASES) {
    cases[caseItem.name] = await renderCaseHash(caseItem);
    console.log(`${caseItem.name}: ${cases[caseItem.name]}`);
  }

  const registry = {
    sampleRate: ENGINE_SAMPLE_RATE,
    tailSeconds: DETERMINISM_TAIL_SECONDS,
    generatedBy: "npm run regenerate:determinism-fixtures",
    cases,
  };
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
  console.log(`\nWrote ${Object.keys(cases).length} hashes to ${REGISTRY_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
