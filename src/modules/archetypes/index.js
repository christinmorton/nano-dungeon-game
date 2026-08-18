import brute from "./brute.js"
import shambler from "./shambler.js"
import skirmisher from "./skirmisher.js"
import captain from "./captain.js"
import archer from "./archer.js"
import hunter from "./hunter.js"
import patrolling from "./patrolling.js"
import goingSomewhere from "./goingSomewhere.js"
import ally from "./ally.js"
import sentinel from "./sentinel.js"

// Each archetype is an object: { turn(enemy), statTemplate, hpFormula(stats) }.
// BaseEnemy.turn() dispatches to archetypes[name].turn(this); spawn rolls
// the archetype (from a class's static archetypePool when present) and
// applies the archetype's statTemplate + hpFormula via applyArchetypeStats.
//
// hunter / patrolling / goingSomewhere migrated from tags/ on 2026-05-25.
// AI behavior belongs here; tags/ now holds only modifiers, effects,
// and material/appearance tags.

const archetypes = {
    brute,
    shambler,
    skirmisher,
    captain,
    archer,
    hunter,
    patrolling,
    goingSomewhere,
    // Ally archetype — drives Follower companions (companions/Follower.js).
    // Not rolled by any enemy spawn; assigned explicitly on the Follower.
    ally,
    // Sentinel — a STATIONARY turret construct (Stone Sentinel + future element
    // golems). Assigned explicitly on a summoned Follower (opts.archetype).
    sentinel
}

export default archetypes
