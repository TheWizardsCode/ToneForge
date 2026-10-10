/**
 * recipe-meta.ts — Shared recipe metadata extraction for the recipe book.
 *
 * Both `generate-pages.ts` (per-recipe pages) and `generate-capstones.ts`
 * (layered arrangements) load ToneGraph recipe YAML through this module so the
 * `## At a glance` metadata section uses one consistent derivation for the
 * default frequency and duration.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const RECIPES_DIR = resolve(ROOT, "presets", "recipes");

export interface ContourEvent {
  kind: string;
  time: number;
  value: number;
}

export interface EnvelopeShape {
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

export interface RecipeMeta {
  name: string;
  description: string;
  tags: string[];
  kind: string;
  category: string;
  duration?: number;
  waveform?: string;
  parameters: Array<{ name: string; type: string; min?: number; max?: number; unit?: string; default?: unknown }>;
  contour?: ContourEvent[];
  envelope?: EnvelopeShape;
  sourceKind?: string;
  noiseColor?: string;
  filterType?: string;
  filterQ?: number;
  /** Default oscillator frequency, if the recipe declares one. */
  oscFrequency?: number;
  /** Default filter centre frequency, if the recipe declares one. */
  filterFrequency?: number;
  /** Default FM carrier frequency, if the recipe declares one. */
  fmCarrierFrequency?: number;
  /** The declared `frequency` parameter, if present. */
  frequencyParam?: { default?: unknown; unit?: string };
}

/** Load a recipe YAML from `presets/recipes/` and extract its metadata. */
export function loadRecipeMeta(name: string): RecipeMeta | null {
  const filePath = resolve(RECIPES_DIR, `${name}.yaml`);
  if (!existsSync(filePath)) return null;
  const doc = yaml.load(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  const meta = (doc.meta ?? {}) as Record<string, unknown>;
  const nodes = (doc.nodes ?? {}) as Record<string, any>;
  const kinds = Object.values(nodes).map((n) => (n && typeof n === "object" ? n.kind : "") ?? "");
  const kind =
    kinds.find((k) => ["oscillator", "noise", "fmPattern", "bufferSource", "lfo"].includes(k)) ??
    "oscillator";

  let waveform: string | undefined;
  let noiseColor: string | undefined;
  let filterType: string | undefined;
  let filterQ: number | undefined;
  let fmIndex: number | undefined;
  let contour: ContourEvent[] | undefined;
  let envelope: EnvelopeShape | undefined;
  let oscFrequency: number | undefined;
  let filterFrequency: number | undefined;
  let fmCarrierFrequency: number | undefined;
  const extractContour = (events: unknown): ContourEvent[] | undefined => {
    if (!Array.isArray(events)) return undefined;
    const out = events
      .filter((e: any) => e && typeof e.value === "number")
      .map((e: any) => ({ kind: String(e.kind), time: Number(e.time), value: Number(e.value) }));
    return out.length > 1 ? out : undefined;
  };
  for (const node of Object.values(nodes)) {
    if (!node || typeof node !== "object") continue;
    if (node.kind === "oscillator") {
      if (waveform === undefined) waveform = node.params?.type;
      if (oscFrequency === undefined && typeof node.params?.frequency === "number") {
        oscFrequency = node.params.frequency;
      }
    }
    if (node.kind === "noise" && noiseColor === undefined) {
      noiseColor = node.params?.color;
    }
    if (node.kind === "fmPattern") {
      if (fmIndex === undefined) {
        fmIndex = node.params?.modulationIndex;
      }
      if (fmCarrierFrequency === undefined && typeof node.params?.carrierFrequency === "number") {
        fmCarrierFrequency = node.params.carrierFrequency;
      }
    }
    if (node.kind === "biquadFilter") {
      if (filterType === undefined) {
        filterType = node.params?.type;
        filterQ = node.params?.Q;
      }
      if (filterFrequency === undefined && typeof node.params?.frequency === "number") {
        filterFrequency = node.params.frequency;
      }
    }
    if (contour === undefined) {
      contour = extractContour(node.automation?.frequency);
    }
    if (node.kind === "envelope" && !envelope) {
      envelope = node.params as EnvelopeShape;
    }
  }

  const params = (meta.parameters as RecipeMeta["parameters"]) ?? [];
  const durationRaw = Number(meta.duration);
  const carrierParam = params.find((p) =>
    ["carrierfreq", "carrierfrequency"].includes(p.name.toLowerCase()),
  );
  return {
    name,
    description: String(meta.description ?? name),
    tags: (meta.tags as string[]) ?? [],
    kind: kind === "oscillator" ? "oscillator" : kind,
    category: String(meta.category ?? "UI"),
    duration: Number.isFinite(durationRaw) ? durationRaw : undefined,
    waveform: waveform ?? noiseColor ?? (fmIndex !== undefined ? "fmPattern" : undefined),
    parameters: params,
    contour,
    envelope,
    sourceKind: kind,
    noiseColor,
    filterType,
    filterQ,
    oscFrequency,
    filterFrequency,
    fmCarrierFrequency:
      fmCarrierFrequency ??
      (carrierParam && typeof carrierParam.default === "number" ? carrierParam.default : undefined),
    frequencyParam: params.find((p) => p.name === "frequency"),
  };
}

/** Representative default frequency in Hz, if the recipe declares one. */
export function defaultFrequencyHz(meta: RecipeMeta): number | undefined {
  const param = meta.frequencyParam;
  if (param && typeof param.default === "number") return param.default;
  if (meta.oscFrequency !== undefined) return meta.oscFrequency;
  if (meta.fmCarrierFrequency !== undefined) return meta.fmCarrierFrequency;
  if (meta.contour && meta.contour.length > 0) return meta.contour[0]!.value;
  if (meta.filterFrequency !== undefined) return meta.filterFrequency;
  return undefined;
}

/** Human-readable default frequency for a recipe, with its provenance. */
export function defaultFrequencyLabel(meta: RecipeMeta): string {
  const param = meta.frequencyParam;
  if (param && param.default !== undefined && typeof param.default !== "boolean") {
    return `${param.default}${param.unit ? " " + param.unit : ""}`;
  }
  if (meta.oscFrequency !== undefined) return `${meta.oscFrequency} Hz`;
  if (meta.fmCarrierFrequency !== undefined) return `${meta.fmCarrierFrequency} Hz (FM carrier)`;
  if (meta.contour && meta.contour.length > 0) return `${meta.contour[0]!.value} Hz (sweep start)`;
  if (meta.filterFrequency !== undefined) return `${meta.filterFrequency} Hz (filter)`;
  return "— (broadband noise)";
}

/** Format a duration in seconds for the metadata table. */
export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "—";
  const rounded = seconds < 1 ? Math.round(seconds * 1000) / 1000 : Math.round(seconds * 100) / 100;
  return `${rounded} s`;
}
