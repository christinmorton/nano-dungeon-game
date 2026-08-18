import tm from '../TurnManager.js'
import { makeObjective } from './objectives.js'

// A single combat encounter — the "arena" the player is fighting inside.
// Owns its own spatial bound (an anchor point + radius, NOT a room), the
// roster of enemy combatants, a lifecycle state, and a lightweight record.
// See documents/v3_combat_infrastructure.md.
//
// Presentation slice (2026-05-29): the arena now has a visual (ArenaView's
// dim + boundary ring) and an intro beat (the UI banner), and the boundary is
// enforced on the ENEMY side — roster members are clamped inside it by
// Dungeon.stepEntityTo. It is still not a wall for the HERO: a player who
// leaves the radius ends the battle 'fled' (interim, see encounters/index.js).
// The rolled Retreat ability, the Emboldened buff, and hard barrier tiles
// still layer on a later slice; for now a battle resolves 'won' (roster
// cleared) or 'fled' (hero left the arena).

let nextId = 1

// How many combatants a battle admits before it's sealed. A soft default —
// passed per-battle so a future war-band / siege can run larger. Keeping it a
// field (not a magic constant) is the point: the number is expected to change.
const DEFAULT_CAPACITY = 7

export default class Battle {
    constructor(anchorX, anchorY, radius, startTick, capacity = DEFAULT_CAPACITY) {
        this.id = nextId++
        this.anchorX = anchorX
        this.anchorY = anchorY
        this.radius = radius
        this.capacity = capacity

        // The kind of conflict this encounter is — drives the intro banner
        // label and, later, conflict-specific rules. Default 'battle' (a plain
        // fight, banner reads "Battle"). Future kinds (ambush / trapped / siege
        // …) are data set by whatever authors the encounter, same kind-over-
        // hierarchy grain as the objective. See documents/v3_objective_driven_encounters.md.
        this.kind = 'battle'

        // The room this encounter formed in (the hero's room at contact), or
        // null for an open/corridor-edge fight. The manager admits the room's
        // own spawned cohort here — see EncounterManager.canReinforce.
        this.room = null

        this.roster = new Set()
        this.active = true
        this.outcome = null            // 'won' | 'failed' | 'fled' | 'lost'

        // The win condition the manager evaluates each tick. Default 'eliminate'
        // (clear the roster) reproduces the original behavior; a quest can swap
        // this for catch / survive / protect etc. Also the source the
        // ObjectiveMeter reads for progress + label.
        // See documents/v3_objective_driven_encounters.md.
        this.objective = makeObjective('eliminate')

        // Lightweight record — captured but not surfaced (scoring payoff is
        // deferred, see the doc's "Slices"). Just enough that a future stats
        // pass has real data to read.
        this.record = {
            startTick,
            endTick: null,
            rosterPeak: 0,
            kills: 0
        }
    }

    // Circular arena: Euclidean distance from the anchor within radius. A
    // circle reads better than the square Chebyshev box and rounds off the
    // corners the dim used to leave. Compared squared to avoid the sqrt.
    contains(x, y) {
        const dx = x - this.anchorX
        const dy = y - this.anchorY
        return (dx * dx + dy * dy) <= this.radius * this.radius
    }

    // True while the battle can still admit a combatant. Once the roster hits
    // capacity the arena is sealed — late arrivals (even eligible reinforcers)
    // are turned away until a slot frees. See documents/v3_objective_driven_encounters.md.
    get hasRoom() {
        return this.roster.size < this.capacity
    }

    // Admit an enemy. No-op if it's already in the roster or the arena is
    // sealed at capacity — returns whether it actually joined so the manager
    // can tell a successful admission from a turned-away one.
    add(enemy) {
        if (this.roster.has(enemy)) return false
        if (!this.hasRoom) return false
        this.roster.add(enemy)
        enemy.battle = this
        if (this.roster.size > this.record.rosterPeak) {
            this.record.rosterPeak = this.roster.size
        }
        return true
    }

    // Drop roster members that have left the turn manager (killed / removed),
    // clearing their back-reference. Returns the count pruned so the manager
    // can tally kills. In slice 1 the only removal path is death, so
    // pruned === kills.
    pruneDead() {
        let removed = 0
        for (const enemy of this.roster) {
            if (!tm.entities.has(enemy)) {
                this.roster.delete(enemy)
                if (enemy.battle === this) enemy.battle = null
                removed += 1
            }
        }
        this.record.kills += removed
        return removed
    }

    end(outcome, endTick) {
        this.active = false
        this.outcome = outcome
        this.record.endTick = endTick
        for (const enemy of this.roster) {
            if (enemy.battle === this) enemy.battle = null
        }
        this.roster.clear()
    }
}
