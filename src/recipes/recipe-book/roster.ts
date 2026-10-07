/**
 * Recipe Book Roster — 100 Casual Game Sound Recipes
 *
 * Canonical roster manifest for the Casual Game Recipe Book (TF-0MUY9H7QZ000UX5W).
 * Each entry declares a planned recipe with its tier, family prefix, and a
 * one-line sound-design intent.
 *
 * Tier counts: 14/14/16/14/14/14/14 = 100
 *
 * Tag policy: every recipe carries `casual` plus at least one of `fun`/`joy`,
 * plus family-specific tags (e.g. `ui`, `impact`, `collect`).
 */

export interface RosterEntry {
  /** Unique recipe name (kebab-case, no spaces). */
  name: string;
  /** Tier 1–7 (ascending complexity). */
  tier: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Family prefix used for category classification (e.g. ui, impact, collect). */
  family: string;
  /** One-line sound-design intent describing the target sound. */
  intent: string;
}

export const recipeRoster: RosterEntry[] = [
  // ─── Tier 1: Pure tones & blips (single oscillator, simple envelope) ───
  // 1.1–1.4  Sine tones
  { name: "blip-sine-ping",         tier: 1, family: "ui",        intent: "Short sine blip for UI confirmations" },
  { name: "tone-sine-low-drone",    tier: 1, family: "ambient",   intent: "Low sustained sine drone for background presence" },
  { name: "tone-sine-high-bell",    tier: 1, family: "ui",        intent: "High-pitched sine bell for collectibles" },
  { name: "tone-sine-mid-click",    tier: 1, family: "ui",        intent: "Mid-range sine click for button presses" },
  // 1.5–1.8  Square waves
  { name: "blip-square-walk",       tier: 1, family: "ui",        intent: "Retro square-wave walk step" },
  { name: "tone-square-menu-tick",  tier: 1, family: "ui",        intent: "Menu navigation tick using square wave" },
  { name: "blip-square-select",     tier: 1, family: "ui",        intent: "Squarer, buzzy select tone" },
  { name: "tone-square-chime",      tier: 1, family: "ui",        intent: "Chime-like square wave with quick fade" },
  // 1.9–1.12  Triangle waves
  { name: "blip-triangle-boop",     tier: 1, family: "ui",        intent: "Friendly triangle wave boop" },
  { name: "tone-triangle-soft-tap", tier: 1, family: "ui",        intent: "Soft triangle tap for gentle feedback" },
  { name: "blip-triangle-pop",      tier: 1, family: "ui",        intent: "Pop-like triangle pulse" },
  { name: "tone-triangle-warm-tone",tier: 1, family: "ui",        intent: "Warm mid-level triangle tone" },
  // 1.13–1.14  Sawtooth waves
  { name: "blip-saw-zap",           tier: 1, family: "impact",    intent: "Sharp sawtooth zap for impacts" },
  { name: "tone-saw-bright-ring",   tier: 1, family: "ui",        intent: "Bright sawtooth ring for notifications" },

  // ─── Tier 2: Shaped events (envelope + pitch movement) ───
  // 2.1–2.4  Envelope sweeps
  { name: "sweep-pitch-rise",       tier: 2, family: "ui",        intent: "Pitch rising sweep for ascending UI cues" },
  { name: "sweep-pitch-fall",       tier: 2, family: "ui",        intent: "Pitch falling sweep for descending UI cues" },
  { name: "sweep-pitch-whoosh",     tier: 2, family: "impact",    intent: "Wide pitch sweep whoosh for transitions" },
  { name: "sweep-pitch-bloop",      tier: 2, family: "ui",        intent: "Playful pitch-bending bloop" },
  // 2.5–2.8  ADSR shapes
  { name: "shape-adsr-pluck",       tier: 2, family: "ui",        intent: "Pluck-like ADSR with fast attack" },
  { name: "shape-adsr-pad",         tier: 2, family: "ambient",   intent: "Soft pad with slow attack and long sustain" },
  { name: "shape-adsr-kick",        tier: 2, family: "impact",    intent: "Kick-like envelope with punchy decay" },
  { name: "shape-adsr-snare",       tier: 2, family: "impact",    intent: "Snare-like envelope with quick decay" },
  // 2.9–2.12  Pitch curves
  { name: "curve-pitch-slide",      tier: 2, family: "ui",        intent: "Smooth pitch slide between two notes" },
  { name: "curve-pitch-hop",        tier: 2, family: "ui",        intent: "Discrete two-step pitch hop" },
  { name: "curve-pitch-gliss",      tier: 2, family: "ui",        intent: "Fast glissando for sliding effects" },
  { name: "curve-pitch-wobble",     tier: 2, family: "ui",        intent: "Wobbly pitch curve for quirkiness" },
  // 2.13–2.14  Combined shapes
  { name: "shape-env-pitch-burst",  tier: 2, family: "impact",    intent: "Envelope burst with pitch drop" },
  { name: "shape-env-pitch-lift",   tier: 2, family: "ui",        intent: "Envelope lift with pitch rise on attack" },

  // ─── Tier 3: Textured & filtered (noise, filters, FM) ───
  // 3.1–3.4  Noise-based
  { name: "texture-noise-scratch",  tier: 3, family: "impact",    intent: "Filtered noise scratch for surface interaction" },
  { name: "texture-noise-hiss",     tier: 3, family: "ambient",   intent: "Breathy noise hiss for wind/air" },
  { name: "texture-noise-crackle",  tier: 3, family: "impact",    intent: "Crackling noise for fire/spark effects" },
  { name: "texture-noise-rumble",   tier: 3, family: "impact",    intent: "Low-passed noise rumble for distant thunder" },
  // 3.5–3.8  Filter sweeps
  { name: "filter-sweep-open",      tier: 3, family: "ui",        intent: "Lowpass filter opening up for reveal" },
  { name: "filter-sweep-close",     tier: 3, family: "ui",        intent: "Lowpass filter closing down for conceal" },
  { name: "filter-resonant-bass",   tier: 3, family: "impact",    intent: "Resonant filter sweep on bass tone" },
  { name: "filter-bandwidth-wipe",  tier: 3, family: "ui",        intent: "Bandpass sweep for scanning effects" },
  // 3.9–3.12  FM synthesis
  { name: "fm-metallic-chime",      tier: 3, family: "ui",        intent: "Metallic FM chime with harmonic richness" },
  { name: "fm-bell-tone",           tier: 3, family: "ui",        intent: "Bell-like FM tone with complex harmonics" },
  { name: "fm-bass-bounce",         tier: 3, family: "impact",    intent: "Bouncy FM bass with modulation" },
  { name: "fm-zip-electric",        tier: 3, family: "ui",        intent: "Electric zip sound via FM modulation" },
  // 3.13–3.16  Combined textures
  { name: "texture-noise-filter-burst", tier: 3, family: "impact", intent: "Noise burst through sweeping filter" },
  { name: "texture-fm-noise-grit",  tier: 3, family: "impact",    intent: "FM tone layered with filtered noise grit" },
  { name: "texture-filter-fm-wash", tier: 3, family: "ambient",   intent: "Washed-out FM through resonant filter" },
  { name: "texture-noise-fm-shimmer", tier: 3, family: "ambient", intent: "Shimmering texture combining noise and FM" },

  // ─── Tier 4: Melodic motifs (2–4 note figures) ───
  // 4.1–4.4  Two-note motifs
  { name: "melody-two-note-rise",   tier: 4, family: "ui",        intent: "Simple two-note rising motif" },
  { name: "melody-two-note-fall",   tier: 4, family: "ui",        intent: "Simple two-note falling motif" },
  { name: "melody-two-note-bounce", tier: 4, family: "ui",        intent: "Bouncy two-note motif with rhythm" },
  { name: "melody-two-note-answer", tier: 4, family: "ui",        intent: "Call-and-response two-note phrase" },
  // 4.5–4.8  Three-note motifs
  { name: "melody-three-note-arpeggio", tier: 4, family: "ui",    intent: "Quick three-note ascending arpeggio" },
  { name: "melody-three-note-descending", tier: 4, family: "ui",  intent: "Descending three-note melodic figure" },
  { name: "melody-three-note-jingle",   tier: 4, family: "ui",    intent: "Three-note jingle for collectibles" },
  { name: "melody-three-note-alert",    tier: 4, family: "ui",    intent: "Attention-grabbing three-note alert" },
  // 4.9–4.12  Four-note motifs
  { name: "melody-four-note-blast", tier: 4, family: "ui",        intent: "Four-note ascending melodic blast" },
  { name: "melody-four-note-fanfare", tier: 4, family: "ui",      intent: "Short fanfare-style four-note figure" },
  { name: "melody-four-note-trill",   tier: 4, family: "ui",      intent: "Trilling four-note motif" },
  { name: "melody-four-note-cadence", tier: 4, family: "ui",      intent: "Cadential four-note resolution phrase" },
  // 4.13–4.14  Variations
  { name: "melody-rhythmic-hop",    tier: 4, family: "ui",        intent: "Rhythmically staggered two-note hop" },
  { name: "melody-syncopated-clap", tier: 4, family: "ui",        intent: "Syncopated short motif mimicking a clap" },

  // ─── Tier 5: Character & critter voices ───
  // 5.1–5.4  Simple critter sounds
  { name: "character-squeak-mouse",     tier: 5, family: "character", intent: "High-pitched mouse squeak" },
  { name: "character-peep-bird",        tier: 5, family: "character", intent: "Short bird peep" },
  { name: "character-grunt-troll",      tier: 5, family: "character", intent: "Low grunting troll voice" },
  { name: "character-chirp-cicada",     tier: 5, family: "character", intent: "Rhythmic cicada-like chirp" },
  // 5.5–5.8  Expressive voices
  { name: "character-laugh-joy",        tier: 5, family: "character", intent: "Joyful character laugh" },
  { name: "character-growl-angry",      tier: 5, family: "character", intent: "Angry low growl" },
  { name: "character-sing-happy",       tier: 5, family: "character", intent: "Happy whistled singing fragment" },
  { name: "character-cry-sad",          tier: 5, family: "character", intent: "Descending sad character cry" },
  // 5.9–5.12  Complex critters
  { name: "character-roar-big",         tier: 5, family: "character", intent: "Big creature roar with harmonics" },
  { name: "character-hoot-owl",         tier: 5, family: "character", intent: "Owl-like hoot sequence" },
  { name: "character-croak-frog",       tier: 5, family: "character", intent: "Frog-like croak with pitch bend" },
  { name: "character-warble-birdsong",  tier: 5, family: "character", intent: "Complex warbling birdsong" },
  // 5.13–5.14  Special
  { name: "character-bubble-pop",       tier: 5, family: "character", intent: "Bubble-pop creature interaction" },
  { name: "character-spider-scuttle",   tier: 5, family: "character", intent: "Multi-click scuttling spider sound" },

  // ─── Tier 6: Ambience & loops ───
  // 6.1–6.4  Wind & weather
  { name: "ambience-wind-gentle",       tier: 6, family: "ambient", intent: "Gentle wind ambience loop" },
  { name: "ambience-wind-storm",        tier: 6, family: "ambient", intent: "Stormy wind with gusts" },
  { name: "ambience-rain-light",        tier: 6, family: "ambient", intent: "Light rain ambience" },
  { name: "ambience-thunder-roll",      tier: 6, family: "ambient", intent: "Distant thunder roll" },
  // 6.5–6.8  Nature
  { name: "ambience-forest-birds",      tier: 6, family: "ambient", intent: "Forest bird ambience loop" },
  { name: "ambience-stream-flow",       tier: 6, family: "ambient", intent: "Gentle stream flow ambience" },
  { name: "ambience-cave-echo",         tier: 6, family: "ambient", intent: "Cave reverb ambience with drip" },
  { name: "ambience-fire-crackle",      tier: 6, family: "ambient", intent: "Crackling campfire ambience" },
  // 6.9–6.12  Urban/industrial
  { name: "ambience-city-distant",      tier: 6, family: "ambient", intent: "Distant city ambience hum" },
  { name: "ambience-machine-hum",       tier: 6, family: "ambient", intent: "Continuous machine hum" },
  { name: "ambience-pipe-hiss",         tier: 6, family: "ambient", intent: "Steam pipe hiss loop" },
  { name: "ambience-metal-clank",       tier: 6, family: "ambient", intent: "Repeating metal clank loop" },
  // 6.13–6.14  Abstract
  { name: "ambience-pads-drone",        tier: 6, family: "ambient", intent: "Soft evolving pad drone" },
  { name: "ambience-texture-swell",     tier: 6, family: "ambient", intent: "Slow textural swell with filter movement" },

  // ─── Tier 7: Multi-voice stings (self-contained 2–3 voices) ───
  // 7.1–7.4  Two-voice stings
  { name: "sting-two-voice-triumph",    tier: 7, family: "ui",        intent: "Two-voice triumphant melodic sting" },
  { name: "sting-two-voice-alert",      tier: 7, family: "ui",        intent: "Two-voice alert with harmonic tension" },
  { name: "sting-two-voice-mystery",    tier: 7, family: "ui",        intent: "Two-voice mysterious suspended sting" },
  { name: "sting-two-voice-resolution", tier: 7, family: "ui",        intent: "Two-voice resolving cadence sting" },
  // 7.5–7.8  Three-voice stings
  { name: "sting-three-voice-fanfare",  tier: 7, family: "ui",        intent: "Three-voice bright fanfare sting" },
  { name: "sting-three-voice-dark",     tier: 7, family: "ui",        intent: "Three-voice dark dramatic sting" },
  { name: "sting-three-voice-joyful",   tier: 7, family: "ui",        intent: "Three-voice joyful celebratory sting" },
  { name: "sting-three-voice-melancholy", tier: 7, family: "ui",      intent: "Three-voice melancholic descending sting" },
  // 7.9–7.12  Hybrid stings
  { name: "sting-hybrid-melody-bass",   tier: 7, family: "ui",        intent: "Melody plus bass two-voice interplay" },
  { name: "sting-hybrid-lead-pad",      tier: 7, family: "ui",        intent: "Lead line over sustained pad" },
  { name: "sting-hybrid-arp-chord",     tier: 7, family: "ui",        intent: "Arpeggiated lead with chord stabs" },
  { name: "sting-hybrid-duet-call",     tier: 7, family: "ui",        intent: "Call-and-response duet sting" },
  // 7.13–7.14  Extended
  { name: "sting-extended-crescendo",   tier: 7, family: "ui",        intent: "Three-voice crescendo to climax" },
  { name: "sting-extended-decay",       tier: 7, family: "ui",        intent: "Three-voice fading into silence" },
];

/** Assert that the roster is internally consistent. */
export function validateRoster(roster: RosterEntry[]): void {
  const names = new Set<string>();
  const tierCounts: Record<number, number> = {};

  for (const entry of roster) {
    if (names.has(entry.name)) {
      throw new Error(`Duplicate roster entry: ${entry.name}`);
    }
    names.add(entry.name);

    if (!entry.tier || entry.tier < 1 || entry.tier > 7) {
      throw new Error(`Invalid tier ${entry.tier} for ${entry.name}`);
    }
    tierCounts[entry.tier] = (tierCounts[entry.tier] || 0) + 1;
  }

  const expected: Record<number, number> = { 1: 14, 2: 14, 3: 16, 4: 14, 5: 14, 6: 14, 7: 14 };
  for (const [tier, count] of Object.entries(expected)) {
    if ((tierCounts[Number(tier)] ?? 0) !== count) {
      throw new Error(
        `Tier ${tier}: expected ${count} entries, got ${tierCounts[Number(tier)] ?? 0}`,
      );
    }
  }

  if (roster.length !== 100) {
    throw new Error(`Roster has ${roster.length} entries, expected 100`);
  }
}

validateRoster(recipeRoster);
