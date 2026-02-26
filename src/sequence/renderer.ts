/**
 * Sequence Renderer
 *
 * Renders a simulation timeline into a single mixed mono audio buffer.
 * Each event in the timeline triggers a recipe render at the appropriate
 * seed and time offset, then all renders are mixed together.
 *
 * The renderer uses the existing Stack/Recipe rendering infrastructure
 * and guarantees byte-identical output for the same preset + seed.
 *
 * Reference: docs/prd/SEQUENCER_PRD.md
 */

import { renderRecipe } from "../core/renderer.js";
import type { RenderResult } from "../core/renderer.js";
import { registry } from "../recipes/index.js";
import { createRng } from "../core/rng.js";
import type { SimulationResult, TimelineEvent } from "./simulator.js";

// ── Constants ─────────────────────────────────────────────────────

const DEFAULT_SAMPLE_RATE = 44100;

/**
 * Estimated default event duration in seconds when the recipe registration
 * cannot be found. Used only for buffer size estimation.
 */
const FALLBACK_EVENT_DURATION = 1.0;

// ── Renderer ──────────────────────────────────────────────────────

/**
 * Render a simulation timeline to a mixed mono audio buffer.
 *
 * Algorithm:
 * 1. Estimate total output buffer size from event positions and durations
 * 2. Render each event independently using its eventSeed
 * 3. Mix into a single output buffer at the correct sample offset with gain
 * 4. Clamp final output to [-1, 1]
 *
 * @param simulation - A SimulationResult from the simulator.
 * @param options - Optional configuration.
 * @returns Promise resolving to the mixed audio RenderResult.
 */
export async function renderSequence(
  simulation: SimulationResult,
  options?: {
    /** Override total duration in seconds. */
    totalDuration?: number;
  },
): Promise<RenderResult> {
  const sampleRate = simulation.sampleRate || DEFAULT_SAMPLE_RATE;

  if (simulation.events.length === 0) {
    return {
      samples: new Float32Array(0),
      sampleRate,
      duration: 0,
      numberOfChannels: 1,
    };
  }

  // Step 1: Estimate total duration and allocate buffer
  // We need to render all events first to know exact durations, but we need
  // a buffer to mix into. We'll render all events first, then compute the
  // exact total duration.

  // Render all events
  const eventRenders: Array<{
    event: TimelineEvent;
    result: RenderResult;
  }> = [];

  for (const evt of simulation.events) {
    const reg = registry.getRegistration(evt.event);
    if (!reg) {
      throw new Error(
        `Sequence references unknown recipe '${evt.event}'. ` +
        `Available recipes: ${registry.list().join(", ")}`,
      );
    }

    const result = await renderRecipe(evt.event, evt.eventSeed, evt.duration);
    eventRenders.push({ event: evt, result });
  }

  // Step 2: Compute total output duration
  let totalDuration: number;
  if (options?.totalDuration !== undefined) {
    totalDuration = options.totalDuration;
  } else {
    totalDuration = 0;
    for (const { event, result } of eventRenders) {
      const eventEnd = event.time_ms / 1000 + result.duration;
      if (eventEnd > totalDuration) {
        totalDuration = eventEnd;
      }
    }
  }

  const totalSamples = Math.ceil(totalDuration * sampleRate);
  const output = new Float32Array(totalSamples);

  // Step 3: Mix events into output buffer
  for (const { event, result } of eventRenders) {
    const offsetSamples = event.sampleOffset;
    const gain = event.gain;

    for (let s = 0; s < result.samples.length; s++) {
      const outIndex = offsetSamples + s;
      if (outIndex >= 0 && outIndex < totalSamples) {
        output[outIndex]! += result.samples[s]! * gain;
      }
    }
  }

  // Step 4: Clamp output to [-1, 1]
  for (let i = 0; i < output.length; i++) {
    if (output[i]! > 1) {
      output[i] = 1;
    } else if (output[i]! < -1) {
      output[i] = -1;
    }
  }

  return {
    samples: output,
    sampleRate,
    duration: totalDuration,
    numberOfChannels: 1,
  };
}
