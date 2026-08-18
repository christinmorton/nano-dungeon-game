// Deployable traps (§11b) — place on a tile; trigger on enemy step. SYSTEM
// PENDING (trap/TileHazard primitive); see known-issues #47. Uses the original
// trap art (art/traps via the 'traps' sheet). Data only.
const T = (file) => ({ sheet: "traps", file })

export default {
    bearTrap: { itemClass: 'Deployable', name: "Bear Trap", description: "Set it on a tile; the next thing through loses a foot to it.", tile: 670, art: T("bear_trap.png"), droppable: false, place: "tile", trigger: "enemy step", damage: { min: 3, max: 6 }, status: "Root" },
    explosiveRune: { itemClass: 'Deployable', name: "Explosive Rune", description: "Chalk a rune that bursts into flame when crossed — or on command.", tile: 670, art: T("explosive_rune.png"), droppable: false, place: "tile", trigger: "enemy step / detonate", aoeRadius: 1, damageFlavor: "fire", status: "Burning" },
    snareKit: { itemClass: 'Deployable', name: "Snare Kit", description: "A quick tripline and noose for a chokepoint.", tile: 670, art: T("snare_kit.png"), droppable: false, place: "tile", trigger: "enemy step", status: "Root" },
}
