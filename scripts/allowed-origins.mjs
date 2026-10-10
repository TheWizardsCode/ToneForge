#!/usr/bin/env node
/**
 * Derive the backend `ALLOWED_ORIGINS` list for the local dev stack.
 *
 * The dev backend runs on the operator's machine, but the browser may connect
 * over that machine's LAN/Tailscale hostname or IP (for example when the demo
 * is opened from another device via `npm run dev:web -- --host`). Production
 * keeps the strict `localhost,127.0.0.1` default; this helper only widens the
 * dev-only allow-list to include hostnames and addresses that belong to the
 * current host, so unrelated websites are still rejected with 403.
 *
 * Detection is done entirely in Node (`os.networkInterfaces()` / `os.hostname()`)
 * so it works on Linux and macOS and is best-effort on Windows — no shell
 * parsing of `ifconfig`/`ip addr`.
 */

import os from "node:os";
import { pathToFileURL } from "node:url";

/** Always allowed: the local loopback hostnames. */
const LOOPBACK = ["localhost", "127.0.0.1"];

function addHostname(hosts, hostname) {
  if (!hostname) return;
  const name = String(hostname).trim().toLowerCase();
  if (!name) return;
  hosts.add(name);
  // Also allow the short form (before the first dot) so a browser opened at
  // `http://demo-host:5173` matches an FQDN `demo-host.tailnet.ts.net`.
  const short = name.split(".")[0];
  if (short) hosts.add(short);
}

/**
 * Build the list of allowed origin hostnames for the current host.
 *
 * @param {object} [options]
 * @param {NodeJS.Dict<os.NetworkInterfaceInfo[]>} [options.interfaces]
 *   Network interfaces to inspect (defaults to `os.networkInterfaces()`).
 * @param {string} [options.hostname] Host name (defaults to `os.hostname()`).
 * @returns {string[]} Lower-cased, de-duplicated hostnames/IPs.
 */
export function deriveAllowedOrigins({
  interfaces = os.networkInterfaces(),
  hostname = os.hostname(),
} = {}) {
  const hosts = new Set(LOOPBACK);

  addHostname(hosts, hostname);

  for (const addresses of Object.values(interfaces ?? {})) {
    for (const address of addresses ?? []) {
      if (!address || address.internal) continue;
      const value = String(address.address ?? "").trim().toLowerCase();
      if (!value) continue;
      hosts.add(value);
      // `URL.hostname` renders IPv6 hosts with surrounding brackets; keep both
      // forms so `[fd7a::1]` and `fd7a::1` in ALLOWED_ORIGINS both match.
      if (value.includes(":")) hosts.add(`[${value}]`);
    }
  }

  return [...hosts];
}

/** Format the derived origins as the comma-separated value the backend reads. */
export function formatAllowedOrigins(options) {
  return deriveAllowedOrigins(options).join(",");
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  process.stdout.write(`${formatAllowedOrigins()}\n`);
}
