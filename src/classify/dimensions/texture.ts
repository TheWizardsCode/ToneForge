/**
 * Texture Dimension Classifier
 *
 * Derives one or more texture labels from spectral centroid and attack time.
 * Texture describes the timbral character of a sound.
 *
 * Labels: crunchy, smooth, noisy, tonal, harsh, warm, bright, dark, sharp
 *
 * Reference: docs/prd/CLASSIFY_PRD.md Section 5.4
 */

import type { AnalysisResult } from "../../analyze/types.js";
import type { DimensionClassifier, DimensionResult } from "../types.js";

/**
 * Texture dimension classifier.
 *
 * Maps spectral centroid and attack time to a sorted array of 1-3
 * texture labels. Labels are not mutually exclusive: a sound can be
 * both "sharp" and "bright".
 */
export class TextureClassifier implements DimensionClassifier {
  readonly name = "texture";

  classify(analysis: AnalysisResult): DimensionResult {
    const spectral = analysis.metrics["spectral"] ?? {};
    const envelope = analysis.metrics["envelope"] ?? {};
    const time = analysis.metrics["time"] ?? {};

    const centroid = typeof spectral["spectralCentroid"] === "number"
      ? spectral["spectralCentroid"]
      : 1000;
    const attackTime = typeof envelope["attackTime"] === "number"
      ? envelope["attackTime"]
      : 25;
    const crestFactor = typeof time["crestFactor"] === "number"
      ? time["crestFactor"]
      : 3;

    const labels: string[] = [];

    // Spectral brightness/darkness
    if (centroid > 4000) {
      labels.push("bright");
    } else if (centroid < 500) {
      labels.push("dark");
    } else if (centroid >= 500 && centroid <= 1500) {
      labels.push("warm");
    }

    // Attack transient character
    if (attackTime < 5) {
      labels.push("sharp");
    } else if (attackTime > 50) {
      labels.push("smooth");
    }

    // Crest factor / noise character
    if (crestFactor > 8) {
      labels.push("noisy");
    } else if (crestFactor < 2) {
      labels.push("tonal");
    }

    // High centroid + fast attack = harsh
    if (centroid > 3000 && attackTime < 10) {
      labels.push("harsh");
    }

    // Moderate centroid + very fast attack = crunchy
    if (centroid > 1000 && centroid < 4000 && attackTime < 3) {
      labels.push("crunchy");
    }

    // Ensure at least one label
    if (labels.length === 0) {
      labels.push("tonal");
    }

    // Deduplicate, sort alphabetically, limit to 3
    const unique = [...new Set(labels)].sort();
    return { texture: unique.slice(0, 3) };
  }
}
