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

After `npm install`, the `tf` and `toneforge` CLI commands are available on your PATH (via automatic `npm link`). The web demo's embedded terminal uses these commands.

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

- **Origin restriction**: WebSocket connections are validated against the `ALLOWED_ORIGINS` environment variable. Non-matching origins receive HTTP 403.
- **Container isolation**: The PTY shell runs as a non-root user (`demouser`) inside the container.
- **Access logging**: All connection attempts are logged with timestamps and origin headers.

## Troubleshooting

### Terminal shows "[Disconnected]"
- Ensure the production server is running (`npm start` in `web/`)
- Check that the ToneForge CLI is built (`npm run build` in project root)
- Verify WebSocket connectivity (check browser console for errors)

### No audio playback
- Browser autoplay policies require a user gesture. Click the "Run" button to trigger audio.
- Check browser console for Web Audio API errors.

### Origin rejected (403)
- Set the `ALLOWED_ORIGINS` environment variable to include your domain.
- Default allows `localhost` and `127.0.0.1` on any port.
