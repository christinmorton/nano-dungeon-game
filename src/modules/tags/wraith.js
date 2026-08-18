import { makeItem } from "../items/itemProfiles.js"

// Wraith role — the void faction's ranged spirit, and the first enemy with a
// theme-specific identity (the broader goal: each faction's enemies behave
// distinctly, not as reskinned generics). Kites at range like a ghost (reuses
// the archer archetype) but hurls a spiritBolt — spectral curse-energy that
// deals magic damage and lays a Cursed debuff — instead of firing arrows.
//
// Built like the Caster role (archer archetype + a swapped weapon). When wraith
// behavior diverges from plain kiting (phasing through walls, draining, etc.),
// split it into its own archetype file. See documents/v3_darkness_settlements.md.
const wraith = {
    name: "Wraith",
    initialize: function () {
        this.archetype = "archer"
        this.weapon = makeItem('spiritBolt')
        this.name = "Wraith"
    }
}

export default wraith
