/**
 * Intensity Dimension Classifier
 *
 * Maps RMS loudness and peak amplitude to categorical intensity labels:
 * soft, medium, hard, aggressive, subtle.
 *
 * Reference: docs/prd/CLASSIFY_PRD.md Section 5.3
 */

import type { AnalysisResult } from "../../analyze/types.js";
import type { DimensionClassifier, DimensionResult } from "../types.js";

/**
 * Intensity dimension classifier.
 *
 * Derives an intensity label from time-domain metrics (rmsLoudness,
 * peakAmplitude) and optionally spectral centroid for the `subtle` label.
 */
export class IntensityClassifier implements DimensionClassifier {
  readonly name = "intensity";

  classify(analysis: AnalysisResult): DimensionResult {
    const time = analysis.metrics["time"] ?? {};
    const spectral = analysis.metrics["spectral"] ?? {};

    const rms = typeof time["rms"] === "number" ? time["rms"] : 0;
    const peak = typeof time["peak"] === "number" ? time["peak"] : 0;
    const centroid = typeof spectral["spectralCentroid"] === "number"
      ? spectral["spectralCentroid"]
      : 0;

    // Subtle: low peak but moderate spectral centroid (ambient textures)
    if (peak < 0.15 && centroid > 1000) {
      return { intensity: "subtle" };
    }

    // Soft: very low RMS and peak
    if (rms < 0.05 && peak < 0.1) {
      return { intensity: "soft" };
    }

    // Aggressive: high RMS and high peak
    if (rms > 0.3 && peak > 0.8) {
      return { intensity: "aggressive" };
    }

    // Hard: moderately high RMS or peak
    if (rms > 0.2 || peak > 0.6) {
      return { intensity: "hard" };
    }

    // Medium: everything else
    return { intensity: "medium" };
  }
}
