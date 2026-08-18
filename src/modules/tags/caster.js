import { makeItem } from "../items/itemProfiles.js"

// Caster role tag — kites like an archer (reuses the archer archetype)
// but throws fireballs instead of arrows. The visual differentiation
// comes from the weapon's castType, which makes attackEntity fire a
// cast pulse before the projectile. When caster behavior diverges from
// archer (multi-target, different cooldown, AoE, etc.) split off into
// its own archetype file. See documents/v3_enemy_squad_design.md.
const caster = {
    name: "Caster",
    initialize: function () {
        this.archetype = "archer"
        // Reusing the player's ScrollOfFireball as the spell source —
        // it already exposes range/minRange/attackTile/castType in the
        // shape attackEntity expects. Built without coordinates so
        // GenericItem skips sprite creation; the scroll lives as a
        // logical handle on the enemy, not a floor pickup.
        this.weapon = makeItem('scrollOfFireball')
        this.name = `Caster ${this.name}`
    }
}

export default caster
