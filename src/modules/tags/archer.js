import { makeItem } from "../items/itemProfiles.js"

// Archer role tag — applied to a squad member at spawn (via the recipe
// applier, not Tags.js, so the bow factory import doesn't trigger the
// same Taggable circular-import warned about in Tags.js).
//
// Swaps the archetype to "archer" so BaseEnemy.turn() dispatches kiting
// AI instead of the host class's default (e.g. brute on Orc). Class
// identity is *role at spawn*, not *what the entity happens to hold* —
// disarming an archer would not revert it to a brute. See
// documents/v3_enemy_squad_design.md.
const archer = {
    name: "Archer",
    initialize: function () {
        this.archetype = "archer"
        // Bow constructed without coordinates — GenericItem skips sprite
        // creation when x/y are null, so the weapon is a logical handle
        // rather than a floor pickup.
        this.weapon = makeItem('bow')
        this.name = `Archer ${this.name}`
    }
}

export default archer
