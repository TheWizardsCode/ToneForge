/**
 * Cross-Platform Web Audio API Abstraction
 *
 * Provides `OfflineAudioContext`, `AudioContext`, and `isNodeRuntime()`
 * usable in both Node.js (via `node-web-audio-api`) and browser
 * (via native Web Audio API).
 *
 * In Node.js, `node-web-audio-api` is loaded lazily (via a runtime-guarded
 * `require`) so that browser bundlers never include the package — it is an
 * optional peer dependency for Node.js users who need offline rendering.
 *
 * In browsers, the classes are available as globals on `globalThis`.
 *
 * Usage:
 *   import {
 *     OfflineAudioContext,
 *     isNodeRuntime,
 *     getAudioContext,
 *   } from "./audio/web-audio.js";
 *
 *   // Offline rendering (Node.js or browser)
 *   const ctx = new OfflineAudioContext(1, length, sampleRate);
 *
 *   // Real-time playback (browser only, or Node.js with node-web-audio-api)
 *   const realtime = getAudioContext();
 *
 * References:
 * - docs/prd/CORE_PRD.md Section 5
 */

import type {
  AudioBuffer,
  OfflineAudioContext as OfflineAudioContextType,
  AudioContext as AudioContextType,
} from "node-web-audio-api";

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------

/**
 * Detect whether the current code is executing under Node.js.
 *
 * This is a more robust check than `require.main` because it works even
 * when the code is bundled (the `process` object is typically shimmed or
 * polyfilled by bundlers, but a proper Node shim will retain `process.versions.node`).
 */
export function isNodeRuntime(): boolean {
  return typeof process !== "undefined"
    && process.versions !== undefined
    && typeof process.versions.node === "string";
}

// ---------------------------------------------------------------------------
// Type re-exports (structural match across runtimes)
// ---------------------------------------------------------------------------

/**
 * Re-exported `AudioBuffer` type.
 *
 * The type is structurally identical between `node-web-audio-api` and the
 * browser's standard Web Audio API (lib.dom.d.ts), so this re-export is
 * safe in both runtimes.
 */
export type { AudioBuffer };

/**
 * The `OfflineAudioContext` instance type.
 *
 * Structurally identical between `node-web-audio-api` and the browser's
 * standard Web Audio API. Merged with the {@link OfflineAudioContext}
 * constructor value below (declaration merging: interface + const).
 */
export interface OfflineAudioContext extends OfflineAudioContextType {}

/**
 * The `AudioContext` instance type.
 *
 * Structurally identical between `node-web-audio-api` and the browser's
 * standard Web Audio API. Merged with the {@link AudioContext} constructor
 * value below (declaration merging: interface + const).
 */
export interface AudioContext extends AudioContextType {}

// ---------------------------------------------------------------------------
// Node.js module resolution (lazy, browser-safe)
// ---------------------------------------------------------------------------

/** Cached `node-web-audio-api` module (Node.js only). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _nodeWebAudioModule: any;

/**
 * Build a CommonJS `require` for the current module in Node.js.
 *
 * `node:module` is resolved lazily through `process.getBuiltinModule` rather
 * than a static `import { createRequire } from "node:module"`. A static import
 * of a Node builtin makes this module un-bundleable for the browser (Rollup
 * cannot resolve `node:module`), which breaks the web build as soon as a
 * browser entry point imports the abstraction. `process.getBuiltinModule`
 * exists only in Node.js, so the browser never reaches this code path.
 *
 * @throws If called outside a Node.js runtime that supports
 *   `process.getBuiltinModule`.
 */
function getNodeRequire(): (id: string) => unknown {
  const proc = (globalThis as {
    process?: { getBuiltinModule?: (id: string) => unknown };
  }).process;
  const getBuiltinModule = proc?.getBuiltinModule;
  if (typeof getBuiltinModule !== "function") {
    throw new Error(
      "Cannot load node-web-audio-api: process.getBuiltinModule is "
      + "unavailable (requires Node.js >= 22.3). Use a browser runtime or "
      + "upgrade Node.js.",
    );
  }
  const nodeModule = getBuiltinModule("node:module") as {
    createRequire: (url: string | URL) => (id: string) => unknown;
  };
  return nodeModule.createRequire(import.meta.url);
}

/**
 * Resolve the `node-web-audio-api` module in Node.js.
 *
 * Loaded lazily at runtime so the package is never statically imported and
 * never appears in browser bundles. The module specifier is held in a
 * variable so bundlers cannot statically resolve it.
 *
 * @throws If called outside Node.js or when the package is not installed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveNodeWebAudio(): any {
  if (_nodeWebAudioModule) return _nodeWebAudioModule;

  if (!isNodeRuntime()) {
    throw new Error("node-web-audio-api is only available in Node.js");
  }

  const nodeRequire = getNodeRequire();
  const moduleName = "node-web-audio-api";
  try {
    _nodeWebAudioModule = nodeRequire(moduleName);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      "node-web-audio-api is required for offline rendering in Node.js "
      + `but could not be loaded: ${message}. Install it with `
      + "`npm install node-web-audio-api`.",
    );
  }
  return _nodeWebAudioModule;
}

// ---------------------------------------------------------------------------
// OfflineAudioContext — class (runtime)
// ---------------------------------------------------------------------------

let _OfflineAudioContextCtor: typeof globalThis.OfflineAudioContext | undefined;

/**
 * Get the `OfflineAudioContext` constructor.
 *
 * In Node.js, this loads `node-web-audio-api` lazily.
 * In browsers, it returns the global constructor.
 *
 * @returns The `OfflineAudioContext` constructor.
 */
export function getOfflineAudioContextCtor(): typeof globalThis.OfflineAudioContext {
  if (_OfflineAudioContextCtor) return _OfflineAudioContextCtor;

  if (isNodeRuntime()) {
    _OfflineAudioContextCtor = resolveNodeWebAudio()
      .OfflineAudioContext as typeof globalThis.OfflineAudioContext;
  } else {
    _OfflineAudioContextCtor = globalThis.OfflineAudioContext;
  }
  return _OfflineAudioContextCtor;
}

/**
 * The cross-platform `OfflineAudioContext` constructor.
 *
 * In Node.js this is backed by `node-web-audio-api`; in browsers it is the
 * native global constructor. Construction delegates to
 * {@link getOfflineAudioContextCtor} so the Node-only package is never
 * imported at module load time.
 */
export const OfflineAudioContext: {
  new (
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): OfflineAudioContext;
} = new Proxy(class {} as unknown as {
  new (
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): OfflineAudioContext;
}, {
  construct(_target, args) {
    const Ctor = getOfflineAudioContextCtor();
    return Reflect.construct(Ctor, args) as OfflineAudioContext;
  },
});

// ---------------------------------------------------------------------------
// AudioContext — real-time playback
// ---------------------------------------------------------------------------

/**
 * Create a real-time `AudioContext` instance.
 *
 * In browsers this creates a native `AudioContext`.
 * In Node.js this loads `node-web-audio-api` and returns an
 * `AudioContext` instance.
 *
 * @returns A real-time audio context.
 *
 * @throws If called in Node.js without `node-web-audio-api` installed.
 */
/**
 * The cross-platform `AudioContext` constructor for real-time playback.
 *
 * In Node.js this is backed by `node-web-audio-api`; in browsers it is the
 * native global constructor.
 */
export const AudioContext: { new (): AudioContext } = new Proxy(
  class {} as unknown as { new (): AudioContext },
  {
    construct(_target, args) {
      if (isNodeRuntime()) {
        const Ctor = resolveNodeWebAudio().AudioContext as new () => AudioContext;
        return Reflect.construct(Ctor, args) as AudioContext;
      }
      return Reflect.construct(globalThis.AudioContext, args) as AudioContext;
    },
  },
);

/**
 * Create a real-time `AudioContext` instance.
 *
 * Convenience factory wrapper around {@link AudioContext}.
 *
 * @returns A real-time audio context.
 *
 * @throws If called in Node.js without `node-web-audio-api` installed.
 */
export function getAudioContext(): AudioContext {
  return new AudioContext();
}
