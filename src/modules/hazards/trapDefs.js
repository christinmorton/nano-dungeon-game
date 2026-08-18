// trapDefs.js — dungeon trap definitions (known-issues #47.2). Each entry maps
// the shipped trap art (art/traps via the 'traps' sheet) to an effect expressed
// in the shared hazard primitive's terms: an instant `detonate` (damage +
// status across aoeRadius) and/or a lingering `zone` (ZoneEffect). Trap.js reads
// these; placement weights drive the generator's random pick.
//
// Scope (slice 1): damage / status / zone traps — the behaviors the hazard
// primitive already supports. Special-effect traps in tileReference.traps.json
// (alarm glyph, teleport glyph, pit, collapsing ceiling, doom sigil) need
// bespoke logic and land in a later slice. Deployables (Bear Trap / Explosive
// Rune / Snare Kit) are player items, also later — they'll reuse this Trap.

const A = (file) => ({ sheet: "traps", file })

export const TRAP_DEFS = {
    spikeTrap: {
        name: "Spike Trap", art: A("spike_trap.png"), weight: 3,
        damage: { min: 2, max: 5 }, damageFlavor: "physical",
        repeat: true,                 // spikes stay out — re-arm after firing
        color: 0xcfd2d6,
    },
    dartTrap: {
        name: "Dart Trap", art: A("dart_trap.png"), weight: 3,
        damage: { min: 2, max: 4 }, damageFlavor: "physical",
        color: 0xcfd2d6,
    },
    flameJet: {
        name: "Flame Jet", art: A("flame_jet.png"), weight: 2,
        damage: { min: 3, max: 6 }, damageFlavor: "fire", status: "Burning",
        zone: { type: "fire", duration: 2, onEnter: "Burning", onTick: "Burning" },
        color: 0xff6b2b,
    },
    frostPlate: {
        name: "Frost Plate", art: A("frost_plate.png"), weight: 2,
        damage: { min: 1, max: 3 }, damageFlavor: "ice", status: "Slow",
        repeat: true,
        color: 0x6ab8ff,
    },
    poisonGasVent: {
        name: "Poison Gas Vent", art: A("poison_gas_vent.png"), weight: 2,
        zone: { type: "gas", duration: 4, onEnter: "Poison" },
        color: 0x7cb342,
    },
    snareTrap: {
        name: "Snare Trap", art: A("snare_trap.png"), weight: 2,
        status: "Rooted",
        color: 0xb0895a,
    },
    cursedGlyph: {
        name: "Cursed Glyph", art: A("cursed_glyph.png"), weight: 1,
        status: "Cursed", damage: { min: 1, max: 3 }, damageFlavor: "curse",
        color: 0x9b59d0,
    },
    runeTrap: {
        name: "Rune Trap", art: A("rune_trap.png"), weight: 1,
        damage: { min: 3, max: 5 }, damageFlavor: "magic", aoeRadius: 1,
        color: 0xb98bff,
    },
}

// Flattened weighted pool for the generator's random pick.
const WEIGHTED_KEYS = Object.entries(TRAP_DEFS)
    .flatMap(([key, def]) => Array(def.weight ?? 1).fill(key))

export function randomTrapKey() {
    return WEIGHTED_KEYS[Math.floor(Math.random() * WEIGHTED_KEYS.length)]
}
