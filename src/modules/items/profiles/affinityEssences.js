// Affinity essences (§14) — the basic in-run acquisition path for affinities. Use
// one (digit key) to ATTUNE to its affinity via hero.grantAffinity; consumed on a
// successful, first-time attunement (you can hold only one affinity per run).
//
// itemClass 'Affinity' routes through Consumable._attune. `affinity` is a key in
// abilities/affinities.js — BASIC tier only; advanced affinities (curse + the
// cosmic types light/void/holy/seraphic/demonic) are pact/hidden-gated and have
// no essence.
//
// droppable:false keeps them OUT of the common loot pool — they're meant to come
// from a rare mob / rare condition / quest (that gating is defined later; for now
// the World debug drop seeds a couple for testing). tile 670 = placeholder art.

const ESSENCE = (name, affinity, description) => ({
    itemClass: 'Affinity', name, affinity, description,
    tile: 670, droppable: false,
})

// Rare "Pure" essence (§18): same attunement, but lets the player PICK a pool passive
// from a draft of a few random options (passiveSelect) instead of a single random roll.
// Rarer than the common essence; still accessible.
const PURE_ESSENCE = (name, affinity, description) => ({
    itemClass: 'Affinity', name, affinity, description,
    tile: 670, droppable: false, passiveSelect: true,
})

export default {
    essencePhysical:  ESSENCE("Essence of Might",    'physical',  "Raw martial force given form. Absorb it to attune to the Physical affinity."),
    essenceFire:      ESSENCE("Essence of Flame",    'fire',      "A mote of living fire. Absorb it to attune to the Fire affinity."),
    essenceFrost:     ESSENCE("Essence of Frost",    'frost',     "A shard of endless cold. Absorb it to attune to the Frost affinity."),
    essencePoison:    ESSENCE("Essence of Venom",    'poison',    "Distilled toxin. Absorb it to attune to the Poison affinity."),
    essenceAcid:      ESSENCE("Essence of Acid",     'acid',      "A blob of caustic hunger. Absorb it to attune to the Acid affinity."),
    essenceLightning: ESSENCE("Essence of Storm",    'lightning', "Caged lightning. Absorb it to attune to the Lightning affinity."),
    essenceEarth:     ESSENCE("Essence of Stone",    'earth',     "The weight of the deep earth. Absorb it to attune to the Earth affinity."),
    essenceWind:      ESSENCE("Essence of Wind",     'wind',      "A captured gale. Absorb it to attune to the Wind affinity."),
    essenceArcane:    ESSENCE("Essence of the Arcane", 'arcane',  "Pure unshaped magic. Absorb it to attune to the Arcane affinity."),

    // Rare draft-tier variants (pick a passive from a few options). Arcane shipped
    // with the first pool; the rest follow as their pools land.
    essencePureArcane: PURE_ESSENCE("Pure Essence of the Arcane", 'arcane', "Crystallized magic of rare clarity. Absorb it to attune to Arcane and CHOOSE its gift."),
}
