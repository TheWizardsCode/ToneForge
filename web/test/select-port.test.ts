/**
 * Unit tests for the Playwright e2e free-port selector.
 *
 * The selector keeps local e2e runs working when the default port (3000) is
 * occupied: Playwright aborts with "port is already used" before running any
 * test, which is the flakiness this guards against.
 *
 * Work item: TF-0MOKJJI7N005LT61.
 */
import { describe, it, expect } from "vitest";
import { createServer, type AddressInfo } from "node:net";
import {
  isPortFree,
  findFreePort,
  findFreePortSync,
} from "../scripts/select-port.js";

/** Bind an ephemeral port and return the server plus its port. */
async function occupyPort(): Promise<{ close: () => Promise<void>; port: number }> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("select-port", () => {
  it("reports a bound port as not free and a released port as free", async () => {
    const occupied = await occupyPort();
    try {
      expect(await isPortFree(occupied.port)).toBe(false);
    } finally {
      await occupied.close();
    }
    expect(await isPortFree(occupied.port)).toBe(true);
  });

  it("skips an occupied candidate and returns the next free port", async () => {
    const occupied = await occupyPort();
    try {
      const selected = await findFreePort(occupied.port, 20);
      expect(selected).toBeGreaterThan(occupied.port);
      expect(await isPortFree(selected)).toBe(true);
    } finally {
      await occupied.close();
    }
  });

  it("returns the requested port when it is already free", async () => {
    const probe = await occupyPort();
    const freePort = probe.port;
    await probe.close();

    await expect(findFreePort(freePort, 1)).resolves.toBe(freePort);
  });

  it("findFreePortSync returns a free port at or after the requested start", async () => {
    const selected = findFreePortSync(3000, 20);

    expect(Number.isInteger(selected)).toBe(true);
    expect(selected).toBeGreaterThanOrEqual(3000);
    expect(await isPortFree(selected)).toBe(true);
  });
});
