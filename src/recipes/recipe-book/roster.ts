/**
 * Recipe Book Roster — 100 Casual Game Sound Recipes
 *
 * Canonical roster manifest for the Casual Game Recipe Book (TF-0MUY9H7QZ000UX5W).
 * Each entry declares a planned recipe with its tier, family prefix, and a
 * one-line sound-design intent.
 *
 * This roster is the source of truth recorded in the tier work items
 * (TF-0MUYBDMHM003TI3D … TF-0MUYBDONM008UGQW); the per-tier acceptance
 * criteria name each recipe explicitly.
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
  { name: "blip-sine-ping",          tier: 1, family: "blip",      intent: "Short sine blip for UI confirmations" },
  { name: "blip-square-short",       tier: 1, family: "blip",      intent: "Short square-wave blip for retro feedback" },
  { name: "blip-triangle-soft",      tier: 1, family: "blip",      intent: "Soft triangle-wave blip for gentle cues" },
  { name: "blip-saw-buzz",           tier: 1, family: "blip",      intent: "Buzzy sawtooth blip for crisp alerts" },
  { name: "tone-chime-single",       tier: 1, family: "tone",      intent: "Single-note chime for notifications" },
  { name: "tone-bell-tap",           tier: 1, family: "tone",      intent: "Bell-like tapped tone for rewards" },
  { name: "ui-click-crisp",          tier: 1, family: "ui",        intent: "Crisp click for button presses" },
  { name: "ui-tap-soft",             tier: 1, family: "ui",        intent: "Soft tap for light UI interactions" },
  { name: "ui-select-pop",           tier: 1, family: "ui",        intent: "Pop-like selection tone" },
  { name: "ui-cancel-blip",          tier: 1, family: "ui",        intent: "Downward-feeling cancel blip" },
  { name: "collect-pickup-coin",     tier: 1, family: "collect",   intent: "Bright coin pickup sparkle" },
  { name: "collect-gem-tick",        tier: 1, family: "collect",   intent: "Short gem collection tick" },
  { name: "ui-toggle-on",            tier: 1, family: "ui",        intent: "Toggle-on confirmation blip" },
  { name: "ui-toggle-off",           tier: 1, family: "ui",        intent: "Toggle-off confirmation blip" },

  // ─── Tier 2: Shaped events (envelope + pitch movement) ───
  { name: "jump-hop-blip",           tier: 2, family: "jump",      intent: "Rising hop blip for character jumps" },
  { name: "jump-double-boing",       tier: 2, family: "jump",      intent: "Double-bounce jump with a springy pitch hop" },
  { name: "sweep-rise-bright",       tier: 2, family: "sweep",     intent: "Bright rising pitch sweep for positive cues" },
  { name: "sweep-fall-soft",         tier: 2, family: "sweep",     intent: "Soft falling pitch sweep for wind-downs" },
  { name: "ui-pop-bubble",           tier: 2, family: "ui",        intent: "Bubbly pop for UI reveal" },
  { name: "ui-press-squish",         tier: 2, family: "ui",        intent: "Squishy press shape for button actuation" },
  { name: "impact-thud-dull",        tier: 2, family: "impact",    intent: "Dull thud for soft impacts" },
  { name: "impact-bonk-bouncy",      tier: 2, family: "impact",    intent: "Bouncy bonk for cartoon impacts" },
  { name: "ui-confirm-rise",         tier: 2, family: "ui",        intent: "Rising confirmation tone" },
  { name: "ui-cancel-fall",          tier: 2, family: "ui",        intent: "Falling cancellation tone" },
  { name: "collect-coin-arc",        tier: 2, family: "collect",   intent: "Arcing coin pickup contour" },
  { name: "collect-gem-arc",         tier: 2, family: "collect",   intent: "Arcing gem pickup contour" },
  { name: "weapon-pew-soft",         tier: 2, family: "weapon",    intent: "Soft laser pew with pitch drop" },
  { name: "ui-launch-tone-sweep",    tier: 2, family: "ui",        intent: "Launch tone with an upward sweep" },

  // ─── Tier 3: Textured & filtered (noise, filters, FM) ───
  { name: "impact-punch-flesh",      tier: 3, family: "impact",    intent: "Fleshy punch impact" },
  { name: "impact-crash-metal",      tier: 3, family: "impact",    intent: "Metal crash with resonant ring" },
  { name: "impact-crunch-gravel",    tier: 3, family: "impact",    intent: "Gravel crunch impact" },
  { name: "whoosh-air-swish",        tier: 3, family: "whoosh",    intent: "Air swish whoosh" },
  { name: "whoosh-cloth-flap",       tier: 3, family: "whoosh",    intent: "Cloth flap whoosh" },
  { name: "explosion-pop-bright",    tier: 3, family: "explosion", intent: "Bright explosion pop" },
  { name: "explosion-fizz-short",    tier: 3, family: "explosion", intent: "Short fizzing explosion tail" },
  { name: "sparkle-magic-shimmer",   tier: 3, family: "sparkle",   intent: "Magical shimmer sparkle" },
  { name: "texture-static-crackle",  tier: 3, family: "texture",   intent: "Static crackle texture" },
  { name: "ui-glitch-digital",       tier: 3, family: "ui",        intent: "Digital glitch UI effect" },
  { name: "ui-robot-beep",           tier: 3, family: "ui",        intent: "Robotic FM beep" },
  { name: "ui-alien-warble",         tier: 3, family: "ui",        intent: "Alien warbling tone" },
  { name: "weapon-zap-electric",     tier: 3, family: "weapon",    intent: "Electric weapon zap" },
  { name: "footstep-grass-rustle",   tier: 3, family: "footstep",  intent: "Grass rustle footstep" },
  { name: "footstep-sand-crunch",    tier: 3, family: "footstep",  intent: "Sand crunch footstep" },
  { name: "collect-rattle-drop",     tier: 3, family: "collect",   intent: "Rattle-drop collectible" },

  // ─── Tier 4: Melodic motifs (2–4 note figures) ───
  { name: "motif-win-two-note",      tier: 4, family: "motif",     intent: "Two-note victory motif" },
  { name: "motif-lose-two-note",     tier: 4, family: "motif",     intent: "Two-note losing motif" },
  { name: "motif-menu-select-arpeggio", tier: 4, family: "motif",  intent: "Menu-select arpeggio" },
  { name: "motif-start-game-fanfare-short", tier: 4, family: "motif", intent: "Short game-start fanfare" },
  { name: "jingle-level-up",         tier: 4, family: "jingle",    intent: "Level-up jingle" },
  { name: "jingle-achievement",      tier: 4, family: "jingle",    intent: "Achievement jingle" },
  { name: "jingle-coin-chain",       tier: 4, family: "jingle",    intent: "Coin-chain jingle" },
  { name: "jingle-star-collect",     tier: 4, family: "jingle",    intent: "Star-collect jingle" },
  { name: "ui-tab-switch-motif",     tier: 4, family: "ui",        intent: "Tab-switch motif" },
  { name: "ui-dialog-open-motif",    tier: 4, family: "ui",        intent: "Dialog-open motif" },
  { name: "ui-dialog-close-motif",   tier: 4, family: "ui",        intent: "Dialog-close motif" },
  { name: "collect-powerup-arpeggio", tier: 4, family: "collect",  intent: "Power-up arpeggio" },
  { name: "motif-quest-accept",      tier: 4, family: "motif",     intent: "Quest-accept motif" },
  { name: "motif-quest-complete",    tier: 4, family: "motif",     intent: "Quest-complete fanfare" },

  // ─── Tier 5: Character & critter voices ───
  { name: "character-jump-voice",    tier: 5, family: "character", intent: "Character jump voice" },
  { name: "character-hurt-voice",    tier: 5, family: "character", intent: "Character hurt voice" },
  { name: "character-happy-voice",   tier: 5, family: "character", intent: "Character happy voice" },
  { name: "character-effort-grunt",  tier: 5, family: "character", intent: "Character effort grunt" },
  { name: "character-sigh-voice",    tier: 5, family: "character", intent: "Character sigh" },
  { name: "creature-blob-squish",    tier: 5, family: "creature",  intent: "Blob squish" },
  { name: "creature-bat-squeak",     tier: 5, family: "creature",  intent: "Bat squeak" },
  { name: "creature-frog-croak",     tier: 5, family: "creature",  intent: "Frog croak" },
  { name: "creature-bird-chirp",     tier: 5, family: "creature",  intent: "Bird chirp" },
  { name: "creature-slime-bounce",   tier: 5, family: "creature",  intent: "Slime bounce" },
  { name: "critter-squeak-toy",      tier: 5, family: "critter",   intent: "Toy critter squeak" },
  { name: "critter-purr-soft",       tier: 5, family: "critter",   intent: "Soft critter purr" },
  { name: "creature-ghost-whisper",  tier: 5, family: "creature",  intent: "Ghost whisper" },
  { name: "creature-dragon-huff",    tier: 5, family: "creature",  intent: "Dragon huff" },

  // ─── Tier 6: Ambience & loops ───
  { name: "ambience-meadow-day",     tier: 6, family: "ambience",  intent: "Daytime meadow ambience" },
  { name: "ambience-cave-drip",      tier: 6, family: "ambience",  intent: "Cave drip ambience" },
  { name: "ambience-forest-breeze",  tier: 6, family: "ambience",  intent: "Forest breeze ambience" },
  { name: "ambience-waterfall-soft", tier: 6, family: "ambience",  intent: "Soft waterfall ambience" },
  { name: "ambience-campfire-crackle", tier: 6, family: "ambience", intent: "Campfire crackle ambience" },
  { name: "ambience-rain-light",     tier: 6, family: "ambience",  intent: "Light rain ambience" },
  { name: "ambience-ocean-waves",    tier: 6, family: "ambience",  intent: "Ocean waves ambience" },
  { name: "ambience-night-crickets", tier: 6, family: "ambience",  intent: "Night crickets ambience" },
  { name: "ambience-space-hum",      tier: 6, family: "ambience",  intent: "Space hum ambience" },
  { name: "ambience-machine-hum",    tier: 6, family: "ambience",  intent: "Machine hum ambience" },
  { name: "ambience-market-bustle",  tier: 6, family: "ambience",  intent: "Market bustle ambience" },
  { name: "ambience-magic-glow",     tier: 6, family: "ambience",  intent: "Magic glow ambience" },
  { name: "ambience-desert-wind",    tier: 6, family: "ambience",  intent: "Desert wind ambience" },
  { name: "ambience-snowfall-hush",  tier: 6, family: "ambience",  intent: "Snowfall hush ambience" },

  // ─── Tier 7: Multi-voice stings (self-contained 2–3 voices) ───
  { name: "sting-victory-bright",    tier: 7, family: "sting",     intent: "Bright multi-voice victory sting" },
  { name: "sting-defeat-soft",       tier: 7, family: "sting",     intent: "Soft multi-voice defeat sting" },
  { name: "sting-level-complete",    tier: 7, family: "sting",     intent: "Level-complete sting" },
  { name: "sting-boss-appear",       tier: 7, family: "sting",     intent: "Boss-appear dramatic sting" },
  { name: "sting-puzzle-solved",     tier: 7, family: "sting",     intent: "Puzzle-solved sting" },
  { name: "sting-game-over-gentle",  tier: 7, family: "sting",     intent: "Gentle game-over sting" },
  { name: "sting-treasure-found",    tier: 7, family: "sting",     intent: "Treasure-found sting" },
  { name: "sting-powerup-major",     tier: 7, family: "sting",     intent: "Major power-up sting" },
  { name: "sting-danger-warning",    tier: 7, family: "sting",     intent: "Danger-warning sting" },
  { name: "sting-mystery-reveal",    tier: 7, family: "sting",     intent: "Mystery-reveal sting" },
  { name: "sting-celebration-pop",   tier: 7, family: "sting",     intent: "Celebration pop sting" },
  { name: "sting-sad-trombone-soft", tier: 7, family: "sting",     intent: "Soft sad-trombone sting" },
  { name: "sting-adventure-call",    tier: 7, family: "sting",     intent: "Adventure-call sting" },
  { name: "sting-finale-short",      tier: 7, family: "sting",     intent: "Short finale sting" },
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
