// Ability Tomes (§13c) — study one to LEARN the named ability onto your bar.
// Wired by the learn-grant consumer (§14 B2): Consumable.equip routes the 'Tome'
// category through hero.learnAbility(teaches). `classGate` is descriptive flavor
// only — learning is ungated (soft-gating model §7.3); the ability's own
// stat/`requires` thresholds decide whether an off-role class can cast it.
const R = (name) => ({ sheet: "32rogues-items", name })

export default {
    tomeCleave: { itemClass: 'Tome', name: "Tome: Cleave", description: "A battle-manual. Study it and learn to carry a swing through two foes.", tile: 670, art: R("book"), droppable: true, teaches: "Cleave", classGate: "warrior" },
    tomeRimeLance: { itemClass: 'Tome', name: "Tome: Rime Lance", description: "Spell-notes on binding cold to a thrown will.", tile: 670, art: R("darkTome"), droppable: true, teaches: "Rime Lance", classGate: "wizard" },
    tomeRiftstep: { itemClass: 'Tome', name: "Tome: Riftstep", description: "The trick of being briefly, suddenly, elsewhere.", tile: 670, art: R("tome2"), droppable: true, teaches: "Riftstep", classGate: "any caster" },
}
