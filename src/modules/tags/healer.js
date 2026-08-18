import { makeItem } from "../items/itemProfiles.js"

// Placeholder healer role tag. For now this is functionally identical
// to the caster — kites with the archer archetype and throws fireballs
// — and exists mainly so recipes can declare a "healer" slot. The real
// cleric class behavior (target wounded allies, cast a heal pulse,
// position in the back) lands with the abilities/skills system per
// documents/v3_enemy_squad_design.md. Until then, the role just gives
// the recipe vocabulary something to attach to.
const healer = {
    name: "Healer",
    initialize: function () {
        this.archetype = "archer"
        this.weapon = makeItem('scrollOfFireball')
        this.name = `Healer ${this.name}`
    }
}

export default healer
