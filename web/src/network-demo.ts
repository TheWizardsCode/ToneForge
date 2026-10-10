/**
 * Two-window network demo entry.
 *
 * One browser window acts as the host and broadcasts behavioural events over
 * the existing web server's `/ws/network` relay; every window (host and
 * clients) resolves those events locally through the Demo 9 runtime via
 * {@link createRuntimeBridge}. No audio is streamed — only compact behavioural
 * intent — yet both windows derive identical, deterministic sound sequences.
 *
 * Open two windows:
 *   /network-demo.html?role=host   (host)
 *   /network-demo.html             (client)
 *
 * Work item: TF-0MUZYS3UD00657Q3 (Network→Runtime/State integration).
 */

import {
  createRuntimeBridge,
  measureStreamBandwidth,
  type ResolvedSoundEvent,
} from "@toneforge/network/runtime-bridge.js";
import type { BehaviouralEvent } from "@toneforge/network/index.js";
import { parseSequencePreset } from "@toneforge/sequence/schema.js";
import type { RuntimeScenario } from "@toneforge/runtime/scenario.js";

// ---------------------------------------------------------------------------
// Demo scenario (a compact Demo 9 movement scenario)
// ---------------------------------------------------------------------------

const SCENARIO: RuntimeScenario = {
  version: "1.0",
  name: "network-demo-footsteps",
  seed: 42,
  stateMachine: {
    name: "movement",
    initial: "idle",
    // Empty transition list = all transitions allowed, which keeps the demo
    // forgiving while still resolving through the real state machine.
    states: [
      { name: "idle" },
      { name: "walk", sequencer: "footsteps_walk" },
      { name: "run", sequencer: "footsteps_run" },
      { name: "sprint", sequencer: "footsteps_sprint" },
    ],
  },
  context: {
    dimensions: { surface: ["stone", "gravel", "grass"] },
    initial: { surface: "stone" },
  },
  sequences: {
    footsteps_walk: parseSequencePreset(
      {
        version: "1.0",
        name: "footsteps_walk",
        events: [{ time: 0, event: "footstep", gain: 0.7 }],
      },
      "network-demo#footsteps_walk",
    ),
    footsteps_run: parseSequencePreset(
      {
        version: "1.0",
        name: "footsteps_run",
        events: [{ time: 0, event: "footstep", gain: 0.85 }],
      },
      "network-demo#footsteps_run",
    ),
    footsteps_sprint: parseSequencePreset(
      {
        version: "1.0",
        name: "footsteps_sprint",
        events: [{ time: 0, event: "footstep", gain: 1.0 }],
      },
      "network-demo#footsteps_sprint",
    ),
  },
  recipeResolver: { footstep: "footstep-{surface}" },
  steps: [],
};

const STATES = ["walk", "run", "sprint"] as const;
const SURFACES = ["stone", "gravel", "grass"] as const;

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const roleEl = document.getElementById("role")!;
const peerIdEl = document.getElementById("peer-id")!;
const becomeHostButton = document.getElementById("become-host") as HTMLButtonElement;
const reconnectButton = document.getElementById("reconnect") as HTMLButtonElement;
const eventCountEl = document.getElementById("event-count")!;
const bandwidthEl = document.getElementById("bandwidth")!;
const peerCountEl = document.getElementById("peer-count")!;
const stateControls = document.getElementById("state-controls")!;
const contextControls = document.getElementById("context-controls")!;
const lastEventEl = document.getElementById("last-event")!;
const fingerprintEl = document.getElementById("fingerprint")!;
const resolvedEl = document.getElementById("resolved")!;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const bridge = createRuntimeBridge({ scenario: SCENARIO });
bridge.start();

const received: BehaviouralEvent[] = [];
let currentState = "idle";
let currentSurface: string = "stone";
let seedCounter = 0;
let timeCounter = 0;
let role: "host" | "client" = new URLSearchParams(location.search).get("role") === "host"
  ? "host"
  : "client";
let socket: WebSocket | null = null;

// ---------------------------------------------------------------------------
// Audio (simple deterministic ping per resolved sound)
// ---------------------------------------------------------------------------

let audioContext: AudioContext | null = null;

function ensureAudio(): AudioContext | null {
  if (!audioContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
  }
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

document.addEventListener("pointerdown", () => {
  ensureAudio();
});

function frequencyFor(sound: ResolvedSoundEvent): number {
  const key = `${sound.recipe}:${sound.eventSeed}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0xffff;
  }
  return 180 + (hash % 500);
}

function playSound(sound: ResolvedSoundEvent): void {
  const ctx = ensureAudio();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = frequencyFor(sound);
  gain.gain.value = 0.06 * sound.gain;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  oscillator.start(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  oscillator.stop(now + 0.13);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function shortFingerprint(sounds: ResolvedSoundEvent[]): string {
  const json = JSON.stringify(sounds);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function render(): void {
  const sounds = bridge.resolvedSequence();
  const report = measureStreamBandwidth(received);

  eventCountEl.textContent = String(received.length);
  bandwidthEl.textContent = `${report.kilobytesPerSecond.toFixed(2)} KB/s`;
  fingerprintEl.textContent = shortFingerprint(sounds);

  resolvedEl.textContent = sounds.length
    ? sounds
        .map(
          (sound, i) =>
            `${String(i).padStart(2, "0")}  ${sound.recipe.padEnd(18)} seed=${String(
              sound.eventSeed,
            ).padEnd(6)} state=${sound.state} seq=${sound.sequence}`,
        )
        .join("\n")
    : "(waiting for events…)";

  const isHost = role === "host";
  for (const button of stateControls.querySelectorAll("button")) {
    button.toggleAttribute("disabled", !isHost);
  }
  for (const button of contextControls.querySelectorAll("button")) {
    button.toggleAttribute("disabled", !isHost);
  }
  becomeHostButton.disabled = isHost;
}

function setRole(next: "host" | "client"): void {
  role = next;
  roleEl.textContent = next;
  roleEl.className = `badge ${next}`;
  render();
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

interface RelayMessage {
  type: string;
  event?: unknown;
  snapshot?: unknown;
  role?: string;
  peerId?: string;
  message?: string;
  stats?: { peers: number; events: number; bytesRelayed: number };
}

function isBehaviouralEvent(value: unknown): value is BehaviouralEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event["state"] === "string" &&
    typeof event["event"] === "string" &&
    typeof event["seed"] === "number" &&
    typeof event["time"] === "number" &&
    typeof event["context"] === "object" &&
    event["context"] !== null
  );
}

function applyEvent(event: BehaviouralEvent): void {
  received.push(event);
  const execution = bridge.apply(event);
  for (const sound of execution.resolved) playSound(sound);
  lastEventEl.textContent = JSON.stringify(event, null, 2);
  render();
}

function handleMessage(message: RelayMessage): void {
  switch (message.type) {
    case "welcome":
      peerIdEl.textContent = message.peerId ?? "—";
      setRole(message.role === "host" ? "host" : "client");
      if (isBehaviouralEvent(message.snapshot)) {
        applyEvent(message.snapshot);
      }
      return;
    case "peers":
      if (message.stats) peerCountEl.textContent = String(message.stats.peers);
      return;
    case "event":
      if (isBehaviouralEvent(message.event)) applyEvent(message.event);
      return;
    case "error":
      lastEventEl.textContent = `error: ${message.message ?? "unknown"}`;
      return;
    default:
      return;
  }
}

function connect(): void {
  if (socket) {
    socket.close();
    socket = null;
  }
  bridge.reset();
  received.length = 0;
  currentState = "idle";
  currentSurface = "stone";
  seedCounter = 0;
  timeCounter = 0;
  render();

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}/ws/network`);
  socket.addEventListener("open", () => {
    socket?.send(JSON.stringify({ type: "hello", role }));
  });
  socket.addEventListener("message", (event) => {
    try {
      handleMessage(JSON.parse(String(event.data)) as RelayMessage);
    } catch {
      // Ignore malformed frames.
    }
  });
  socket.addEventListener("close", () => {
    roleEl.textContent = "disconnected";
    roleEl.className = "badge";
  });
}

// ---------------------------------------------------------------------------
// Host controls
// ---------------------------------------------------------------------------

function emitEvent(event: BehaviouralEvent): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "event", event }));
}

function nextEvent(kind: string, state: string, context: Record<string, string>): BehaviouralEvent {
  return {
    version: 1,
    event: kind,
    seed: 42 + seedCounter++,
    time: timeCounter++,
    state,
    context,
  };
}

function buildControls(): void {
  for (const state of STATES) {
    const button = document.createElement("button");
    button.textContent = state;
    button.addEventListener("click", () => {
      currentState = state;
      emitEvent(nextEvent("state-transition", state, { surface: currentSurface }));
    });
    stateControls.appendChild(button);
  }

  for (const surface of SURFACES) {
    const button = document.createElement("button");
    button.textContent = surface;
    button.addEventListener("click", () => {
      currentSurface = surface;
      emitEvent(nextEvent("context-change", currentState, { surface: currentSurface }));
    });
    contextControls.appendChild(button);
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

becomeHostButton.addEventListener("click", () => {
  role = "host";
  connect();
});
reconnectButton.addEventListener("click", () => connect());

buildControls();
setRole(role);
connect();
