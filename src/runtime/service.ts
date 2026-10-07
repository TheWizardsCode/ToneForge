/**
 * Runtime Service
 *
 * A thin, signal-aware controller that keeps a {@link RuntimeSession} alive as
 * a long-running service and shuts it down cleanly. Unlike the interactive
 * session — which ends when stdin closes — the service keeps the runtime
 * running until an explicit `stop`/`quit` or a `SIGINT`/`SIGTERM`, so a host
 * can embed it and process state/context/parameter input over time.
 *
 * The controller owns no scheduling of its own: it delegates lifecycle to the
 * session (`stop()` cancels the transport and the runtime) and only manages
 * the armed/disarmed state and shutdown waiters. The signal source is
 * injectable so the behaviour is unit-testable without real process signals.
 *
 * Reference: docs/prd/RUNTIME_PRD.md §19.10
 */

import type { RuntimeSession } from "./session.js";

/** Process signals that request a clean service shutdown. */
export type ShutdownSignal = "SIGINT" | "SIGTERM";

/**
 * An injectable source of shutdown signals.
 *
 * Defaults to `process`; tests supply a fake to trigger shutdown
 * deterministically.
 */
export interface ServiceSignalSource {
  /** Subscribe to *signal*; *handler* receives the signal name. */
  on(signal: ShutdownSignal, handler: (signal: ShutdownSignal) => void): void;

  /** Remove a previously-registered *handler*. */
  removeListener(
    signal: ShutdownSignal,
    handler: (signal: ShutdownSignal) => void,
  ): void;
}

/** Options for {@link createRuntimeService}. */
export interface RuntimeServiceOptions {
  /** The session the service keeps alive. */
  session: RuntimeSession;

  /** Signal source (defaults to `process`). */
  signals?: ServiceSignalSource;

  /** Called exactly once when the service shuts down. */
  onShutdown?: (reason: string) => void;
}

/** A long-running runtime service controller. */
export interface RuntimeService {
  /** Arm the service and install shutdown handlers. Idempotent. */
  start(): void;

  /** Whether the service is currently armed. */
  isRunning(): boolean;

  /**
   * Request a clean shutdown. Idempotent; the first reason wins.
   *
   * Cancels the transport, stops the runtime, removes the signal handlers and
   * resolves {@link wait}.
   */
  stop(reason?: string): void;

  /** Resolve when the service shuts down (immediately if already stopped). */
  wait(): Promise<string>;

  /** The shutdown reason, or `null` while still running. */
  shutdownReason(): string | null;
}

const PROCESS_SIGNALS: ServiceSignalSource = {
  on: (signal, handler) => {
    process.on(signal, handler);
  },
  removeListener: (signal, handler) => {
    process.removeListener(signal, handler);
  },
};

/**
 * Create a long-running runtime service around *session*.
 *
 * @param options - Service configuration.
 * @returns A {@link RuntimeService}.
 */
export function createRuntimeService(
  options: RuntimeServiceOptions,
): RuntimeService {
  const { session, onShutdown } = options;
  const signals = options.signals ?? PROCESS_SIGNALS;

  let running = false;
  let reason: string | null = null;
  let resolveWait: ((value: string) => void) | null = null;
  let waitPromise: Promise<string> | null = null;

  const handleSignal = (signal: ShutdownSignal): void => {
    stop(`signal:${signal}`);
  };

  function install(): void {
    signals.on("SIGINT", handleSignal);
    signals.on("SIGTERM", handleSignal);
  }

  function uninstall(): void {
    signals.removeListener("SIGINT", handleSignal);
    signals.removeListener("SIGTERM", handleSignal);
  }

  function stop(shutdownReason = "stopped"): void {
    if (!running) return;
    running = false;
    reason = shutdownReason;
    uninstall();
    // Clean, cancellable shutdown: cancels the transport and the runtime.
    session.stop();
    resolveWait?.(shutdownReason);
    resolveWait = null;
    onShutdown?.(shutdownReason);
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      reason = null;
      install();
    },

    isRunning(): boolean {
      return running;
    },

    stop,

    wait(): Promise<string> {
      if (reason !== null) return Promise.resolve(reason);
      if (!waitPromise) {
        waitPromise = new Promise<string>((resolve) => {
          resolveWait = resolve;
        });
      }
      return waitPromise;
    },

    shutdownReason(): string | null {
      return reason;
    },
  };
}
