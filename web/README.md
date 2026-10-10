# ToneForge Web Demo

A browser-based interactive demo that mirrors the ToneForge CLI demo walkthrough. Features an embedded terminal emulator, a stepped wizard UI, and browser-side audio playback.

## Prerequisites

- Node.js >= 22
- npm >= 10
- Podman or Docker (for container deployment)

## Local Development

### 1. Build the ToneForge CLI (from project root)

```bash
npm install
npm run build
```

After `npm install` on local machines, the `tf` and `toneforge` CLI commands are usually available on your PATH (via a safe postinstall `npm link` attempt). In CI/restricted environments, use `./bin/dev-cli.js` directly. The web demo's embedded terminal uses these commands when available.

### 2. Install web dependencies

```bash
cd web
npm install
```

### 3. Run the dev server (Vite)

```bash
npm run dev
```

Opens a Vite dev server at `http://localhost:5173` (configurable via `VITE_PORT` env var). Hot module replacement is enabled.

### 4. Run the production server

```bash
npm run build
npm start
```

Starts the Express server at `http://localhost:3000` (configurable via `PORT` env var). Serves the Vite-built frontend and provides the WebSocket terminal backend.

### 5. Run the full dev stack (backend + Vite)

From the **project root** (not `web/`), start the backend and Vite together:

```bash
npm run dev:web
```

### 6. Remote access from another device

To open the demo from another device on the same LAN or Tailscale network,
start the dev stack from the **project root** with:

```bash
npm run dev:web -- --host
```

The dev launcher (`scripts/dev-web.mjs`) detects this machine's hostname and
its non-internal IPv4/IPv6 addresses (LAN/Tailscale) via
`scripts/allowed-origins.mjs` and passes them to the backend as
`ALLOWED_ORIGINS` — no manual configuration is needed. Vite already binds all
interfaces (`--host`), and its WebSocket proxy forwards the browser `Origin`
header to the backend, which authorises it against that derived list. Open
`http://<host>:5173/` on the remote device.

This widening is **dev-only**: the production server (`npm start` / the
container image) keeps the strict `localhost,127.0.0.1` default unless
`ALLOWED_ORIGINS` is set explicitly.

## Container Build & Run

### Build the image

From the **project root** (not `web/`):

```bash
podman build -f web/Containerfile -t toneforge-web-demo .
```

### Run the container

```bash
podman run -p 3000:3000 toneforge-web-demo
```

Then open `http://localhost:3000` in your browser.

### Custom port

```bash
podman run -p 8080:8080 -e PORT=8080 toneforge-web-demo
```

### Custom allowed origins

```bash
podman run -p 3000:3000 -e ALLOWED_ORIGINS="mydomain.com,localhost" toneforge-web-demo
```

## Environment Variables

| Variable          | Default                | Description                                              |
| ----------------- | ---------------------- | -------------------------------------------------------- |
| `PORT`            | `3000`                 | Server listen port                                       |
| `ALLOWED_ORIGINS` | `localhost,127.0.0.1`  | Comma-separated list of allowed Origin hostnames         |
| `VITE_PORT`       | `5173`                 | Vite dev server port (development only)                  |

> In development, `npm run dev:web` sets `ALLOWED_ORIGINS` to `localhost`,
> `127.0.0.1`, the machine hostname (full and short forms) and every
> non-internal network address (IPv4/IPv6, bracketed and unbracketed). The
> `npm start` default and the container image remain `localhost,127.0.0.1`
> unless `ALLOWED_ORIGINS` is provided explicitly.

## Testing

Web tests run with Vitest (`npm test --prefix web`). The default environment is
Node, which is what the existing server/wizard/audio tests expect. SoundEditor
component tests live under `src/components/SoundEditor/**` and opt into a DOM
environment per file with the directive:

```ts
// @vitest-environment happy-dom
```

Shared SoundEditor scaffolding lives under `test/`:

- `test/fixtures/editor-fixtures.ts` — representative `{ recipe, seed, overrides,
  descriptors }` cases (oscillator, noise/filter and file-backed ToneGraph),
  with parameter descriptors read from the shared recipe registry.
- `test/helpers/determinism.ts` — renders a preset-shaped input twice through
  the existing offline render path and reports/asserts byte-identical
  `Float32Array` output (`assertDeterministic`, `renderPresetTwice`,
  `compareSamples`).

> The offline render path does not yet accept parameter overrides (tracked by
> TF-0MUV11RXS003Y6JI); the determinism helper threads `overrides` through a
> forward-compatible seam that becomes effective when that work lands.

Because the server tests serve the built SPA, run `npm run build --prefix web`
once in a fresh checkout/worktree before `npm test --prefix web`.

## Architecture

```
web/
  src/                  # Vite frontend source
    index.html          # Main page with wizard + terminal layout
    main.ts             # Entry point (initializes terminal + wizard)
    terminal.ts         # xterm.js terminal component + WebSocket client
    wizard.ts           # Stepped wizard UI component
    demo-content.ts     # Demo narrative content (parsed from demos/*.md)
    audio.ts            # Browser-side Tone.js audio rendering
  server/               # Express backend source
    index.ts            # HTTP server, WebSocket/PTY relay, origin restriction
  dist/                 # Vite build output (gitignored)
  dist-server/          # Server build output (gitignored)
  Containerfile         # Podman/Docker container definition
```

## Security

- **Origin restriction**: WebSocket connections are validated against the `ALLOWED_ORIGINS` environment variable. Non-matching origins receive HTTP 403. During development (`npm run dev:web`) the list is derived from the host's own hostnames/IPs (see `scripts/allowed-origins.mjs`); production/container defaults stay `localhost,127.0.0.1`.
- **Container isolation**: The PTY shell runs as a non-root user (`demouser`) inside the container.
- **Access logging**: All connection attempts are logged with timestamps and origin headers.

## Troubleshooting

### Terminal shows "[Backend not available]"
- Start the dev stack from the project root: `npm run dev:web -- --host`
- Or run the production server (`npm run build && npm start` in `web/`)
- Check that the ToneForge CLI is built (`npm run build` in project root)
- Verify WebSocket connectivity (check browser console for errors)

### Remote device cannot connect (403 / "[Backend not available]")
- Start the dev stack with `npm run dev:web -- --host` from the project root so
  the backend receives the host-derived `ALLOWED_ORIGINS` list.
- Access the demo through Vite (`http://<host>:5173/`) so its WebSocket proxy
  forwards the browser's `Origin` header; hitting the backend port directly
  from a remote browser will be rejected unless that origin was added.
- If the host has an unusual interface, set `ALLOWED_ORIGINS` explicitly (see
  the Environment Variables table).

### No audio playback
- Browser autoplay policies require a user gesture. Click the "Run" button to trigger audio.
- Check browser console for Web Audio API errors.

### Origin rejected (403)
- Set the `ALLOWED_ORIGINS` environment variable to include your domain.
- Default allows `localhost` and `127.0.0.1` on any port.
