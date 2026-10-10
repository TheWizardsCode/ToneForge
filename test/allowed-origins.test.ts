import { describe, it, expect } from "vitest";
import {
  deriveAllowedOrigins,
  formatAllowedOrigins,
} from "../scripts/allowed-origins.mjs";

/**
 * Unit tests for the dev-only ALLOWED_ORIGINS derivation used by
 * `npm run dev:web` (see scripts/dev-web.mjs and web/server/index.ts).
 */
describe("deriveAllowedOrigins", () => {
  it("always includes localhost and 127.0.0.1, even with no interfaces", () => {
    const origins = deriveAllowedOrigins({ interfaces: {}, hostname: "" });

    expect(origins).toContain("localhost");
    expect(origins).toContain("127.0.0.1");
  });

  it("includes both the full and short hostname", () => {
    const origins = deriveAllowedOrigins({
      interfaces: {},
      hostname: "demo-host.tailnet.ts.net",
    });

    expect(origins).toContain("demo-host.tailnet.ts.net");
    expect(origins).toContain("demo-host");
  });

  it("includes non-internal IPv4/IPv6 addresses and skips internal ones", () => {
    const origins = deriveAllowedOrigins({
      hostname: "demo-host",
      interfaces: {
        lo: [
          { address: "127.0.0.1", internal: true },
          { address: "::1", internal: true },
        ],
        eth0: [{ address: "192.168.1.50", internal: false }],
        tailscale0: [{ address: "100.106.5.111", internal: false }],
        tun: [{ address: "fd7a:115c:a1e0::1", internal: false }],
      },
    });

    expect(origins).toContain("192.168.1.50");
    expect(origins).toContain("100.106.5.111");
    expect(origins).toContain("fd7a:115c:a1e0::1");
    // URL.hostname renders IPv6 hosts with brackets, so both forms are kept.
    expect(origins).toContain("[fd7a:115c:a1e0::1]");
    expect(origins).not.toContain("::1");
  });

  it("lower-cases and de-duplicates entries", () => {
    const origins = deriveAllowedOrigins({
      hostname: "Demo-Host",
      interfaces: { eth0: [{ address: "192.168.1.50", internal: false }] },
    });

    expect(origins).toContain("demo-host");
    expect(origins.filter((host) => host === "localhost")).toHaveLength(1);
    expect(origins.filter((host) => host === "127.0.0.1")).toHaveLength(1);
  });

  it("formats the derived list as a comma-separated ALLOWED_ORIGINS value", () => {
    const formatted = formatAllowedOrigins({
      interfaces: {},
      hostname: "demo-host",
    });

    const parts = formatted.split(",");
    expect(parts).toContain("localhost");
    expect(parts).toContain("127.0.0.1");
    expect(parts).toContain("demo-host");
  });
});
