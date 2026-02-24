# Sample Asset Provenance

This file documents the source, license, and format of all audio sample files
committed under `assets/samples/`.

## License

All samples in this directory are **CC0 / Public Domain**. They were procedurally
generated using ToneForge's seeded RNG (`scripts/generate-samples.ts`) and are
original works with no external copyright claims.

## Samples

### `footstep-gravel/impact.wav`

| Property    | Value                                          |
| ----------- | ---------------------------------------------- |
| Description | Short percussive transient simulating a gravel impact (noise burst + low thump) |
| Duration    | 0.150s                                         |
| Format      | 16-bit PCM WAV, mono, 44100 Hz                 |
| Size        | 13,274 bytes                                   |
| Source      | Procedurally generated (`scripts/generate-samples.ts`, seed 1001) |
| License     | CC0 / Public Domain                            |

### `creature-vocal/growl.wav`

| Property    | Value                                          |
| ----------- | ---------------------------------------------- |
| Description | Short guttural vocalization (FM synthesis at 120Hz carrier with noise texture) |
| Duration    | 0.400s                                         |
| Format      | 16-bit PCM WAV, mono, 44100 Hz                 |
| Size        | 35,324 bytes                                   |
| Source      | Procedurally generated (`scripts/generate-samples.ts`, seed 2002) |
| License     | CC0 / Public Domain                            |

### `vehicle-engine/loop.wav`

| Property    | Value                                          |
| ----------- | ---------------------------------------------- |
| Description | Short engine rumble loop (sawtooth harmonics at 55Hz with LFO modulation) |
| Duration    | 0.300s                                         |
| Format      | 16-bit PCM WAV, mono, 44100 Hz                 |
| Size        | 26,504 bytes                                   |
| Source      | Procedurally generated (`scripts/generate-samples.ts`, seed 3003) |
| License     | CC0 / Public Domain                            |

### `coin-collect/token.wav`

| Property    | Value                                          |
| ----------- | ---------------------------------------------- |
| Description | 8-bit coin/token collection sound (ascending square-wave arpeggio B5→E6) |
| Duration    | 0.200s                                         |
| Format      | 16-bit PCM WAV, mono, 44100 Hz                 |
| Size        | 17,684 bytes                                   |
| Source      | Procedurally generated (`scripts/generate-samples.ts`) |
| License     | CC0 / Public Domain                            |

## Budget

Total committed sample size: **92,786 bytes (90.6 KB)** — well under the 1 MB budget.

## Regeneration

Samples can be regenerated deterministically:

```bash
npx tsx scripts/generate-samples.ts
```

Output is byte-identical across runs (uses ToneForge's seeded xorshift RNG).
