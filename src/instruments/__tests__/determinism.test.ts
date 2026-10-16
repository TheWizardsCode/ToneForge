/**
 * Determinism snapshot verification for the instruments engine.
 *
 * Proves the platform determinism guarantee: the same seed plus the same
 * note/velocity sequence produces byte-identical offline output at the pinned
 * 44100 Hz sample rate, and that output matches the committed golden hashes.
 *
 * The golden registry (`fixtures/determinism-hashes.json`) is committed and
 * regenerated ONLY through the documented command:
 *
 * ```bash
 * npm run regenerate:determinism-fixtures
 * ```
 *
 * If output drifts from the golden result (accidental engine change), the
 * test fails loudly with a clear message — never regenerate ad hoc.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashBuffer } from "../../test-utils/buffer-compare.js";
import { compareBuffers, formatCompareResult } from "../../test-utils/buffer-compare.js";
import { ENGINE_SAMPLE_RATE, renderInstrument } from "../engine.js";
import {
  DETERMINISM_CASES,
  DETERMINISM_TAIL_SECONDS,
} from "./determinism-cases.js";

const REGENERATE_COMMAND = "npm run regenerate:determinism-fixtures";

interface HashRegistry {
  sampleRate: number;
  tailSeconds: number;
  generatedBy: string;
  cases: Record<string, string>;
}

function loadRegistry(): HashRegistry {
  const path = resolve(
    import.meta.dirname,
    "fixtures/determinism-hashes.json",
  );
  return JSON.parse(readFileSync(path, "utf8")) as HashRegistry;
}

/** Render a case and return both the samples and their SHA-256 hash. */
async function renderCase(name: string) {
  const caseItem = DETERMINISM_CASES.find((c) => c.name === name);
  if (!caseItem) {
    throw new Error(`Unknown determinism case "${name}".`);
  }
  const rendered = await renderInstrument(caseItem.definition, caseItem.events, {
    sampleRate: ENGINE_SAMPLE_RATE,
    tail: DETERMINISM_TAIL_SECONDS,
  });
  const hash = hashBuffer(new Uint8Array(rendered.samples.buffer));
  return { rendered, hash };
}

describe("instrument determinism snapshots", () => {
  const registry = loadRegistry();

  it(`ships golden hashes for every determinism case (run ${REGENERATE_COMMAND} if empty)`, () => {
    expect(registry.sampleRate).toBe(ENGINE_SAMPLE_RATE);
    expect(registry.tailSeconds).toBe(DETERMINISM_TAIL_SECONDS);
    const missing = DETERMINISM_CASES.filter((c) => !(c.name in registry.cases));
    expect(
      missing.map((c) => c.name),
      `Golden hash missing for cases. Regenerate with: ${REGENERATE_COMMAND}`,
    ).toEqual([]);
    // At least two representative sequences are golden-tested (AC-1).
    expect(DETERMINISM_CASES.length).toBeGreaterThanOrEqual(2);
  });

  it("renders each case byte-identically across independent runs", async () => {
    for (const caseItem of DETERMINISM_CASES) {
      const first = await renderCase(caseItem.name);
      const second = await renderCase(caseItem.name);

      expect(first.rendered.samples.length).toBe(second.rendered.samples.length);
      expect(first.hash, `${caseItem.name}: same seed + same sequence must hash identically`).toBe(
        second.hash,
      );
      const comparison = compareBuffers(first.rendered.samples, second.rendered.samples);
      expect(
        comparison.identical,
        `${caseItem.name}: same seed + same sequence diverged\n${formatCompareResult(comparison)}`,
      ).toBe(true);
    }
  });

  it("matches the committed golden hashes (fails loudly on drift)", async () => {
    for (const caseItem of DETERMINISM_CASES) {
      const { hash } = await renderCase(caseItem.name);
      const expected = registry.cases[caseItem.name];
      expect(
        hash,
        `${caseItem.name}: deterministic output drifted from the committed golden hash.\n`
          + `Expected ${expected}\n`
          + `Got      ${hash}\n`
          + `If this change is intentional, regenerate the fixture with: ${REGENERATE_COMMAND}`,
      ).toBe(expected);
    }
  });

  it("produces distinct output for different seeds / sequences", async () => {
    const hashes = new Set<string>();
    for (const caseItem of DETERMINISM_CASES) {
      hashes.add((await renderCase(caseItem.name)).hash);
    }
    expect(
      hashes.size,
      "different seeds + different sequences must not collide to identical audio",
    ).toBe(DETERMINISM_CASES.length);
  });
});
