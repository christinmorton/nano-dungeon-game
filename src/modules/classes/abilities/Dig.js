import Ability from './Ability.js'
import underground, { surface } from '../../tags/underground.js'

// Dwarf A — burrow underground for up to 3 turns. While Underground the dwarf is:
//   - UNSEEN — enemies can't perceive it (Perception.canSee returns false), and
//   - UNTOUCHABLE — immune to everything but AoE MAGIC (the burrow gate in
//     resolveDamage / Combat.attack: weapons, single-target spells, and physical
//     AoE all miss; only an area-magic blast filling the ground reaches it), and
//   - a TUNNELER — it can move through shallow dungeon walls (HeroController
//     _canTunnelInto), but not sturdy/story walls or doors.
// The tag tints the sprite + drops alpha to telegraph the state.
//
// Re-pressing A while burrowed calls surface() — early exit costs the AP again
// (you spent the action to surface). surface() refuses to pop while standing in a
// wall, so a mid-tunnel dwarf must reach open ground first (no stranding).
//
// Prototype note: does NOT yet prevent the hero from ATTACKING / interacting with
// surface entities while underground (a separate HeroController input gate, still
// unwired) — deferred.

export default class Dig extends Ability {
    name = 'Dig'
    icon = 31
    description = 'Burrow underground for 3 turns: unseen, immune to all but AoE magic, and able to tunnel through shallow walls. Re-press to surface (on open ground). 1 AP, cd 10.'
    cost = { ap: 1, mp: 0 }
    cooldown = 10
    range = 0
    target = 'self'

    // Combat-usable: its purpose is to AVOID damage mid-fight (the burrow
    // immunity), so it's no longer the combat=false example (Stealth/Sense remain
    // the non-combat utilities).
    combat = true

    canActivate() {
        // Surfacing early should be allowed even while the original Dig
        // cooldown ticks down — it's the exit action, not a new Dig.
        if (this.hero._tags?.includes("Underground")) return true
        return super.canActivate()
    }

    activate(hero, target) {
        if (hero._tags?.includes("Underground")) {
            surface(hero)
            // Return false so the dispatcher doesn't re-debit cost or
            // reset the cooldown — the original Dig already paid both.
            return false
        }
        hero.addTag(underground)
    }
}
