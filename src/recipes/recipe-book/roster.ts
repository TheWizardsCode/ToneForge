/**
 * Recipe Book Roster — 100 Casual Game Sound Recipes
 *
 * Canonical roster manifest for the Casual Game Recipe Book (TF-0MUY9H7QZ000UX5W).
 * Each entry declares a planned recipe with its tier, family prefix, a
 * one-line sound-design intent, and a comma-separated list of common uses
 * (surfaced in the `## At a glance` metadata section of each recipe page).
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
  /** Comma-separated list of common in-game uses for the recipe. */
  uses: string;
}

export const recipeRoster: RosterEntry[] = [
  // ─── Tier 1: Pure tones & blips (single oscillator, simple envelope) ───
  { name: "blip-sine-ping",          tier: 1, family: "blip",      intent: "Short sine blip for UI confirmations", uses: "UI confirmations, menu selection, coin pickup" },
  { name: "blip-square-short",       tier: 1, family: "blip",      intent: "Short square-wave blip for retro feedback", uses: "Retro UI feedback, arcade menus, button presses" },
  { name: "blip-triangle-soft",      tier: 1, family: "blip",      intent: "Soft triangle-wave blip for gentle cues", uses: "Gentle notifications, cosy menus, soft toggles" },
  { name: "blip-saw-buzz",           tier: 1, family: "blip",      intent: "Buzzy sawtooth blip for crisp alerts", uses: "Error alerts, warning cues, crisp notifications" },
  { name: "tone-chime-single",       tier: 1, family: "tone",      intent: "Single-note chime for notifications", uses: "Notifications, rewards, achievement chimes" },
  { name: "tone-bell-tap",           tier: 1, family: "tone",      intent: "Bell-like tapped tone for rewards", uses: "Reward collection, treasure pickup, bell cues" },
  { name: "ui-click-crisp",          tier: 1, family: "ui",        intent: "Crisp click for button presses", uses: "Button presses, menu clicks, pointer interactions" },
  { name: "ui-tap-soft",             tier: 1, family: "ui",        intent: "Soft tap for light UI interactions", uses: "Hover feedback, soft toggles, gentle taps" },
  { name: "ui-select-pop",           tier: 1, family: "ui",        intent: "Pop-like selection tone", uses: "Menu selection, option confirmation, list picks" },
  { name: "ui-cancel-blip",          tier: 1, family: "ui",        intent: "Downward-feeling cancel blip", uses: "Cancel actions, back buttons, dismissal cues" },
  { name: "collect-pickup-coin",     tier: 1, family: "collect",   intent: "Bright coin pickup sparkle", uses: "Coin collection, currency pickup, loot drops" },
  { name: "collect-gem-tick",        tier: 1, family: "collect",   intent: "Short gem collection tick", uses: "Gem collection, collectible pickup, score ticks" },
  { name: "ui-toggle-on",            tier: 1, family: "ui",        intent: "Toggle-on confirmation blip", uses: "Enabling settings, switching on, activating modes" },
  { name: "ui-toggle-off",           tier: 1, family: "ui",        intent: "Toggle-off confirmation blip", uses: "Disabling settings, switching off, deactivating modes" },

  // ─── Tier 2: Shaped events (envelope + pitch movement) ───
  { name: "jump-hop-blip",           tier: 2, family: "jump",      intent: "Rising hop blip for character jumps", uses: "Character jumps, hops, platforming movement" },
  { name: "jump-double-boing",       tier: 2, family: "jump",      intent: "Double-bounce jump with a springy pitch hop", uses: "Double jumps, springy hops, bounce pads" },
  { name: "sweep-rise-bright",       tier: 2, family: "sweep",     intent: "Bright rising pitch sweep for positive cues", uses: "Positive transitions, power-ups, reward reveals" },
  { name: "sweep-fall-soft",         tier: 2, family: "sweep",     intent: "Soft falling pitch sweep for wind-downs", uses: "Wind-downs, losing a life, closing menus" },
  { name: "ui-pop-bubble",           tier: 2, family: "ui",        intent: "Bubbly pop for UI reveal", uses: "UI reveals, popups, tooltip appearance" },
  { name: "ui-press-squish",         tier: 2, family: "ui",        intent: "Squishy press shape for button actuation", uses: "Button actuation, pressure feedback, press confirmations" },
  { name: "impact-thud-dull",        tier: 2, family: "impact",    intent: "Dull thud for soft impacts", uses: "Soft impacts, landing, low-energy collisions" },
  { name: "impact-bonk-bouncy",      tier: 2, family: "impact",    intent: "Bouncy bonk for cartoon impacts", uses: "Cartoon impacts, bumping into objects, comedic hits" },
  { name: "ui-confirm-rise",         tier: 2, family: "ui",        intent: "Rising confirmation tone", uses: "Confirmations, accepting prompts, positive acknowledgements" },
  { name: "ui-cancel-fall",          tier: 2, family: "ui",        intent: "Falling cancellation tone", uses: "Cancellations, declining prompts, negative acknowledgements" },
  { name: "collect-coin-arc",        tier: 2, family: "collect",   intent: "Arcing coin pickup contour", uses: "Coin pickups, reward arcs, combo collection" },
  { name: "collect-gem-arc",         tier: 2, family: "collect",   intent: "Arcing gem pickup contour", uses: "Gem pickups, collectible arcs, score rewards" },
  { name: "weapon-pew-soft",         tier: 2, family: "weapon",    intent: "Soft laser pew with pitch drop", uses: "Soft projectiles, laser fire, casual combat" },
  { name: "ui-launch-tone-sweep",    tier: 2, family: "ui",        intent: "Launch tone with an upward sweep", uses: "Game launch, level start, activation cues" },

  // ─── Tier 3: Textured & filtered (noise, filters, FM) ───
  { name: "impact-punch-flesh",      tier: 3, family: "impact",    intent: "Fleshy punch impact", uses: "Melee hits, punch impacts, combat feedback" },
  { name: "impact-crash-metal",      tier: 3, family: "impact",    intent: "Metal crash with resonant ring", uses: "Metal collisions, clangs, destructive impacts" },
  { name: "impact-crunch-gravel",    tier: 3, family: "impact",    intent: "Gravel crunch impact", uses: "Gravel impacts, debris, rough terrain landings" },
  { name: "whoosh-air-swish",        tier: 3, family: "whoosh",    intent: "Air swish whoosh", uses: "Movement transitions, jump arcs, air dashes" },
  { name: "whoosh-cloth-flap",       tier: 3, family: "whoosh",    intent: "Cloth flap whoosh", uses: "Cloth movement, cape flaps, soft transitions" },
  { name: "explosion-pop-bright",    tier: 3, family: "explosion", intent: "Bright explosion pop", uses: "Explosions, bomb blasts, bright impacts" },
  { name: "explosion-fizz-short",    tier: 3, family: "explosion", intent: "Short fizzing explosion tail", uses: "Fizzing explosions, spark tails, magic bursts" },
  { name: "sparkle-magic-shimmer",   tier: 3, family: "sparkle",   intent: "Magical shimmer sparkle", uses: "Magic effects, power-ups, sparkle rewards" },
  { name: "texture-static-crackle",  tier: 3, family: "texture",   intent: "Static crackle texture", uses: "Static textures, glitches, electrical ambience" },
  { name: "ui-glitch-digital",       tier: 3, family: "ui",        intent: "Digital glitch UI effect", uses: "Digital glitches, error states, sci-fi interfaces" },
  { name: "ui-robot-beep",           tier: 3, family: "ui",        intent: "Robotic FM beep", uses: "Robotic UI, droid speech, sci-fi confirmations" },
  { name: "ui-alien-warble",         tier: 3, family: "ui",        intent: "Alien warbling tone", uses: "Alien voices, sci-fi signals, creature tech" },
  { name: "weapon-zap-electric",     tier: 3, family: "weapon",    intent: "Electric weapon zap", uses: "Electric weapons, zaps, energy attacks" },
  { name: "footstep-grass-rustle",   tier: 3, family: "footstep",  intent: "Grass rustle footstep", uses: "Footsteps on grass, foliage movement, outdoor walking" },
  { name: "footstep-sand-crunch",    tier: 3, family: "footstep",  intent: "Sand crunch footstep", uses: "Footsteps on sand, beach walking, desert terrain" },
  { name: "collect-rattle-drop",     tier: 3, family: "collect",   intent: "Rattle-drop collectible", uses: "Collectible drops, item rattles, loot pickup" },

  // ─── Tier 4: Melodic motifs (2–4 note figures) ───
  { name: "motif-win-two-note",      tier: 4, family: "motif",     intent: "Two-note victory motif", uses: "Victory jingles, win screens, reward motifs" },
  { name: "motif-lose-two-note",     tier: 4, family: "motif",     intent: "Two-note losing motif", uses: "Losing jingles, fail states, gentle defeat" },
  { name: "motif-menu-select-arpeggio", tier: 4, family: "motif",  intent: "Menu-select arpeggio", uses: "Menu selection, option arpeggios, navigation" },
  { name: "motif-start-game-fanfare-short", tier: 4, family: "motif", intent: "Short game-start fanfare", uses: "Game start, level intro, begin prompts" },
  { name: "jingle-level-up",         tier: 4, family: "jingle",    intent: "Level-up jingle", uses: "Level-ups, rank increases, progression rewards" },
  { name: "jingle-achievement",      tier: 4, family: "jingle",    intent: "Achievement jingle", uses: "Achievements, badges, milestone unlocks" },
  { name: "jingle-coin-chain",       tier: 4, family: "jingle",    intent: "Coin-chain jingle", uses: "Coin combos, collection streaks, reward chains" },
  { name: "jingle-star-collect",     tier: 4, family: "jingle",    intent: "Star-collect jingle", uses: "Star collection, collect-a-thon rewards, completions" },
  { name: "ui-tab-switch-motif",     tier: 4, family: "ui",        intent: "Tab-switch motif", uses: "Tab switching, panel changes, navigation feedback" },
  { name: "ui-dialog-open-motif",    tier: 4, family: "ui",        intent: "Dialog-open motif", uses: "Dialog boxes, popups, story text" },
  { name: "ui-dialog-close-motif",   tier: 4, family: "ui",        intent: "Dialog-close motif", uses: "Dialog dismissal, closing popups, story advances" },
  { name: "collect-powerup-arpeggio", tier: 4, family: "collect",  intent: "Power-up arpeggio", uses: "Power-ups, ability unlocks, buff pickups" },
  { name: "motif-quest-accept",      tier: 4, family: "motif",     intent: "Quest-accept motif", uses: "Quest acceptance, mission start, objective pickup" },
  { name: "motif-quest-complete",    tier: 4, family: "motif",     intent: "Quest-complete fanfare", uses: "Quest completion, mission rewards, objectives done" },

  // ─── Tier 5: Character & critter voices ───
  { name: "character-jump-voice",    tier: 5, family: "character", intent: "Character jump voice", uses: "Character jumps, vocal effort, movement grunts" },
  { name: "character-hurt-voice",    tier: 5, family: "character", intent: "Character hurt voice", uses: "Taking damage, pain reactions, combat feedback" },
  { name: "character-happy-voice",   tier: 5, family: "character", intent: "Character happy voice", uses: "Celebrations, cheerful reactions, positive events" },
  { name: "character-effort-grunt",  tier: 5, family: "character", intent: "Character effort grunt", uses: "Physical effort, attacks, pushing and lifting" },
  { name: "character-sigh-voice",    tier: 5, family: "character", intent: "Character sigh", uses: "Exhaustion, relief, disappointment" },
  { name: "creature-blob-squish",    tier: 5, family: "creature",  intent: "Blob squish", uses: "Blob creatures, squishy impacts, gelatinous enemies" },
  { name: "creature-bat-squeak",     tier: 5, family: "creature",  intent: "Bat squeak", uses: "Bat creatures, small flyers, cave critters" },
  { name: "creature-frog-croak",     tier: 5, family: "creature",  intent: "Frog croak", uses: "Frog enemies, swamp critters, pond creatures" },
  { name: "creature-bird-chirp",     tier: 5, family: "creature",  intent: "Bird chirp", uses: "Birds, forest critters, cheerful wildlife" },
  { name: "creature-slime-bounce",   tier: 5, family: "creature",  intent: "Slime bounce", uses: "Slime enemies, bouncy creatures, gelatinous movement" },
  { name: "critter-squeak-toy",      tier: 5, family: "critter",   intent: "Toy critter squeak", uses: "Toy critters, pet creatures, playful squeaks" },
  { name: "critter-purr-soft",       tier: 5, family: "critter",   intent: "Soft critter purr", uses: "Pet creatures, friendly critters, cosy companions" },
  { name: "creature-ghost-whisper",  tier: 5, family: "creature",  intent: "Ghost whisper", uses: "Ghost enemies, haunted areas, spectral presences" },
  { name: "creature-dragon-huff",    tier: 5, family: "creature",  intent: "Dragon huff", uses: "Dragon enemies, boss creatures, large beast breathing" },

  // ─── Tier 6: Ambience & loops ───
  { name: "ambience-meadow-day",     tier: 6, family: "ambience",  intent: "Daytime meadow ambience", uses: "Outdoor daytime scenes, meadows, peaceful levels" },
  { name: "ambience-cave-drip",      tier: 6, family: "ambience",  intent: "Cave drip ambience", uses: "Caves, underground levels, damp environments" },
  { name: "ambience-forest-breeze",  tier: 6, family: "ambience",  intent: "Forest breeze ambience", uses: "Forests, wooded levels, nature scenes" },
  { name: "ambience-waterfall-soft", tier: 6, family: "ambience",  intent: "Soft waterfall ambience", uses: "Waterfalls, rivers, watery environments" },
  { name: "ambience-campfire-crackle", tier: 6, family: "ambience", intent: "Campfire crackle ambience", uses: "Campfires, camp scenes, rest areas" },
  { name: "ambience-rain-light",     tier: 6, family: "ambience",  intent: "Light rain ambience", uses: "Light rain, weather ambience, outdoor scenes" },
  { name: "ambience-ocean-waves",    tier: 6, family: "ambience",  intent: "Ocean waves ambience", uses: "Beaches, oceans, coastal levels" },
  { name: "ambience-night-crickets", tier: 6, family: "ambience",  intent: "Night crickets ambience", uses: "Night scenes, summer evenings, outdoor night" },
  { name: "ambience-space-hum",      tier: 6, family: "ambience",  intent: "Space hum ambience", uses: "Space stations, sci-fi scenes, cosmic settings" },
  { name: "ambience-machine-hum",    tier: 6, family: "ambience",  intent: "Machine hum ambience", uses: "Machine rooms, factories, industrial areas" },
  { name: "ambience-market-bustle",  tier: 6, family: "ambience",  intent: "Market bustle ambience", uses: "Towns, markets, busy public spaces" },
  { name: "ambience-magic-glow",     tier: 6, family: "ambience",  intent: "Magic glow ambience", uses: "Magical areas, enchanted scenes, mysterious rooms" },
  { name: "ambience-desert-wind",    tier: 6, family: "ambience",  intent: "Desert wind ambience", uses: "Deserts, arid levels, dusty winds" },
  { name: "ambience-snowfall-hush",  tier: 6, family: "ambience",  intent: "Snowfall hush ambience", uses: "Snowy scenes, quiet winter, calm environments" },

  // ─── Tier 7: Multi-voice stings (self-contained 2–3 voices) ───
  { name: "sting-victory-bright",    tier: 7, family: "sting",     intent: "Bright multi-voice victory sting", uses: "Victory screens, wins, triumph cues" },
  { name: "sting-defeat-soft",       tier: 7, family: "sting",     intent: "Soft multi-voice defeat sting", uses: "Defeat screens, losses, gentle failures" },
  { name: "sting-level-complete",    tier: 7, family: "sting",     intent: "Level-complete sting", uses: "Level completion, stage clear, progression" },
  { name: "sting-boss-appear",       tier: 7, family: "sting",     intent: "Boss-appear dramatic sting", uses: "Boss entrances, dramatic reveals, threats" },
  { name: "sting-puzzle-solved",     tier: 7, family: "sting",     intent: "Puzzle-solved sting", uses: "Puzzle solved, riddle completion, eureka moments" },
  { name: "sting-game-over-gentle",  tier: 7, family: "sting",     intent: "Gentle game-over sting", uses: "Game over, run ends, soft conclusions" },
  { name: "sting-treasure-found",    tier: 7, family: "sting",     intent: "Treasure-found sting", uses: "Treasure discovery, secret reveals, loot" },
  { name: "sting-powerup-major",     tier: 7, family: "sting",     intent: "Major power-up sting", uses: "Major power-ups, transformations, upgrades" },
  { name: "sting-danger-warning",    tier: 7, family: "sting",     intent: "Danger-warning sting", uses: "Danger alerts, warnings, low health" },
  { name: "sting-mystery-reveal",    tier: 7, family: "sting",     intent: "Mystery-reveal sting", uses: "Mystery reveals, plot twists, discoveries" },
  { name: "sting-celebration-pop",   tier: 7, family: "sting",     intent: "Celebration pop sting", uses: "Celebrations, party moments, confetti" },
  { name: "sting-sad-trombone-soft", tier: 7, family: "sting",     intent: "Soft sad-trombone sting", uses: "Sad moments, failures, comedic defeat" },
  { name: "sting-adventure-call",    tier: 7, family: "sting",     intent: "Adventure-call sting", uses: "Adventure starts, new journeys, exploration" },
  { name: "sting-finale-short",      tier: 7, family: "sting",     intent: "Short finale sting", uses: "Endings, finales, closing flourishes" },
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

    if (!entry.uses || entry.uses.trim().length === 0) {
      throw new Error(`Roster entry ${entry.name} is missing common uses`);
    }
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
