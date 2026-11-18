import brute from "./brute.js"
import skirmisher from "./skirmisher.js"
import archer from "./archer.js"
import hunter from "./hunter.js"
import patrolling from "./patrolling.js"
import goingSomewhere from "./goingSomewhere.js"
import leader from "./leader.js"

// Each archetype is an object: { turn(enemy), statTemplate, hpFormula(stats) }.
// BaseEnemy.turn() dispatches to archetypes[name].turn(this); spawn rolls the
// archetype (from a class's static archetypePool when present) and applies the
// archetype's statTemplate + hpFormula via applyArchetypeStats.
//
// SIX, derived from the roster rather than guessed — these are exactly the names
// v5's enemies declare in their `archetype` / `archetypePool` fields. v3 registers
// ten; the other four are cut by dependency, not preference:
//
//   ally      — drives Follower companions, and companions are cut (section 6).
//   sentinel  — assigned only to a summoned Follower. Same cut.
//   captain   — squad leader, and squads come from the recipe layer, also cut.
//   shambler  — no v5 enemy declares it.
//
// `archer` was in that list until the ranged gap was closed. It is the kiting AI
// for BOTH archers and casters — it reads weapon.range() / minRange() and treats a
// non-physical damageType as a magic projectile — so Goblin Archer (bow) and Dark
// Sorcerer (wand) share it and differ only in what comes out.
// `leader` is the seventh, added 2026-09-22 (scope doc §10.13). It is never
// rolled from an archetypePool — spawnLeader assigns it explicitly to the
// stronghold's mini-boss. It exists because the leader previously drew its
// behaviour from its SPECIES' pool (an Ogre rolls hunter / patrolling /
// goingSomewhere), which are ambient-monster AIs: the "Warchief" stood still or
// walked a patrol line. Those archetypes are correct for the ordinary roster and
// were left alone; the boss got its own.
const archetypes = {
    brute,
    skirmisher,
    archer,
    hunter,
    patrolling,
    goingSomewhere,
    leader,
}

export default archetypes
