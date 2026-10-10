/**
 * Runtime Service Tests
 *
 * Behavioural tests for the long-running runtime service controller:
 * signal handling, clean shutdown delegation, idempotence, and shutdown
 * waiters.
 *
 * Work item: TF-0MUYBRRCQ00148QD
 */

import { describe, it, expect, vi } from "vitest";
import { createRuntimeService } from "./service.js";
import type { ServiceSignalSource, ShutdownSignal } from "./service.js";
import type { RuntimeSession } from "./session.js";

// ── Fakes ─────────────────────────────────────────────────────────

interface FakeSignals extends ServiceSignalSource {
  emit(signal: ShutdownSignal): void;
  listenerCount(signal: ShutdownSignal): number;
}

function makeSignals(): FakeSignals {
  const listeners = new Map<ShutdownSignal, Set<(s: ShutdownSignal) => void>>([
    ["SIGINT", new Set()],
    ["SIGTERM", new Set()],
  ]);
  return {
    on(signal, handler) {
      listeners.get(signal)!.add(handler);
    },
    removeListener(signal, handler) {
      listeners.get(signal)!.delete(handler);
    },
    emit(signal) {
      for (const handler of [...listeners.get(signal)!]) handler(signal);
    },
    listenerCount(signal) {
      return listeners.get(signal)!.size;
    },
  };
}

function makeSession(): { session: RuntimeSession; stop: ReturnType<typeof vi.fn> } {
  const stop = vi.fn();
  const session = { stop } as unknown as RuntimeSession;
  return { session, stop };
}

// ── Lifecycle ─────────────────────────────────────────────────────

describe("createRuntimeService — lifecycle", () => {
  it("arms the service and installs both shutdown handlers", () => {
    const signals = makeSignals();
    const { session } = makeSession();
    const service = createRuntimeService({ session, signals });

    expect(service.isRunning()).toBe(false);
    service.start();
    expect(service.isRunning()).toBe(true);
    expect(signals.listenerCount("SIGINT")).toBe(1);
    expect(signals.listenerCount("SIGTERM")).toBe(1);
  });

  it("start is idempotent (no duplicate handlers)", () => {
    const signals = makeSignals();
    const { session } = makeSession();
    const service = createRuntimeService({ session, signals });

    service.start();
    service.start();
    expect(signals.listenerCount("SIGINT")).toBe(1);
    expect(signals.listenerCount("SIGTERM")).toBe(1);
  });

  it("stop is a no-op before start", () => {
    const signals = makeSignals();
    const { session, stop } = makeSession();
    const service = createRuntimeService({ session, signals });

    service.stop("early");
    expect(stop).not.toHaveBeenCalled();
    expect(service.isRunning()).toBe(false);
  });
});

// ── Shutdown ──────────────────────────────────────────────────────

describe("createRuntimeService — clean shutdown", () => {
  it("stop cancels the session and records the reason", () => {
    const signals = makeSignals();
    const { session, stop } = makeSession();
    const service = createRuntimeService({ session, signals });

    service.start();
    service.stop("requested");

    expect(stop).toHaveBeenCalledTimes(1);
    expect(service.isRunning()).toBe(false);
    expect(service.shutdownReason()).toBe("requested");
    expect(signals.listenerCount("SIGINT")).toBe(0);
    expect(signals.listenerCount("SIGTERM")).toBe(0);
  });

  it("a SIGINT shuts the service down cleanly", () => {
    const signals = makeSignals();
    const { session, stop } = makeSession();
    const service = createRuntimeService({ session, signals });

    service.start();
    signals.emit("SIGINT");

    expect(stop).toHaveBeenCalledTimes(1);
    expect(service.shutdownReason()).toBe("signal:SIGINT");
  });

  it("a SIGTERM shuts the service down cleanly", () => {
    const signals = makeSignals();
    const { session, stop } = makeSession();
    const service = createRuntimeService({ session, signals });

    service.start();
    signals.emit("SIGTERM");

    expect(stop).toHaveBeenCalledTimes(1);
    expect(service.shutdownReason()).toBe("signal:SIGTERM");
  });

  it("repeated stops do not call the session twice", () => {
    const signals = makeSignals();
    const { session, stop } = makeSession();
    const service = createRuntimeService({ session, signals });

    service.start();
    service.stop("first");
    service.stop("second");

    expect(stop).toHaveBeenCalledTimes(1);
    expect(service.shutdownReason()).toBe("first");
  });

  it("invokes onShutdown exactly once", () => {
    const signals = makeSignals();
    const { session } = makeSession();
    const onShutdown = vi.fn();
    const service = createRuntimeService({ session, signals, onShutdown });

    service.start();
    service.stop("done");
    service.stop("again");

    expect(onShutdown).toHaveBeenCalledTimes(1);
    expect(onShutdown).toHaveBeenCalledWith("done");
  });
});

// ── Waiters ───────────────────────────────────────────────────────

describe("createRuntimeService — wait()", () => {
  it("resolves with the shutdown reason on stop", async () => {
    const signals = makeSignals();
    const { session } = makeSession();
    const service = createRuntimeService({ session, signals });

    service.start();
    const waiter = service.wait();
    service.stop("bye");
    await expect(waiter).resolves.toBe("bye");
  });

  it("resolves immediately when already stopped", async () => {
    const signals = makeSignals();
    const { session } = makeSession();
    const service = createRuntimeService({ session, signals });

    service.start();
    service.stop("done");
    await expect(service.wait()).resolves.toBe("done");
  });

  it("resolves on a signal while waiting", async () => {
    const signals = makeSignals();
    const { session } = makeSession();
    const service = createRuntimeService({ session, signals });

    service.start();
    const waiter = service.wait();
    signals.emit("SIGTERM");
    await expect(waiter).resolves.toBe("signal:SIGTERM");
  });
});
