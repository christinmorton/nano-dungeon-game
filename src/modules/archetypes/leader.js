import PF from "pathfinding"
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import { combatTargetFor } from "../Targeting.js"
import { approachGoal } from "./orderBias.js"

// leader — the stronghold mini-boss AI (scope doc §10.13).
//
// WHY THIS EXISTS. The stronghold leader used to roll its behaviour from its
// species' archetypePool — an Ogre draws from hunter / patrolling /
// goingSomewhere. Two of those are wander AIs written for ambient floor monsters
// that happen to fight if you get close, and none of them is a boss. The result
// was a "Warchief" that stood on its tile or drifted along a patrol line, which
// is what the player reported. Tuning those archetypes was not an option: they
// are shared by the ordinary roster and are correct for it. A boss needs its own
// behaviour, so it gets one.
//
// THE RULE IT IMPLEMENTS (user's call): it does not stir until it is STRUCK.
// Proximity alone does nothing — you can walk right up to it. That is deliberately
// skippable: the Amulet sits in this room and taking it ends the run, so a player
// who dares to cross a sleeping giant's chamber and grab the prize has earned the
// quiet ending. The fight is the loud one.
//
// The sleeping half needs NO code here. BaseEnemy already carries a `passive`
// stance that suppresses alerting, and `onDamaged` already flips a struck passive
// to aggressive and alerts it. spawnLeader sets the stance; this file is only
// what happens once it is awake.

// Once roused it does not lose interest. An ordinary enemy drops from alerted to
// searching to idle when it loses sight — right for a wandering monster, wrong
// for the thing guarding the end of the run, which would otherwise forget the
// fight the moment you stepped behind a pillar.
const RELENTLESS = true

// It hits on contact like a brute (chebyshev 2 covers a large sprite's reach),
// but it also refuses to be kited: if the target is close but not yet in reach it
// spends its whole movement closing rather than drifting one tile a turn.
const STRIKE_RANGE = 2

function turn(enemy) {
    if (enemy.moving) return

    const player = dungeon.player
    enemy.updatePerception(player)

    // RELENTLESS, and this MUST come before the isEngaged() gate below.
    //
    // updatePerception ends with `alerted = sighted`, unconditionally. So a boss
    // that has been woken goes straight back to sleep the moment the player steps
    // behind a pillar — hit it once, break line of sight, and it forgets the
    // fight. (Found by simulating the wake chain, not by reading it; the bug is
    // invisible until you step through the turn order.)
    //
    // Re-asserting the flag here restores it after perception clears it. Gated on
    // _leaderRoused so it only applies to a boss that has ACTUALLY been struck —
    // an untouched leader still sleeps through anything, which is the whole rule.
    if (RELENTLESS && enemy._leaderRoused) enemy.alerted = true

    // ASLEEP. Not merely unalerted — a leader holds its post rather than doing
    // the idle wander every other archetype does, because a boss shuffling around
    // its throne room reads as a wandering monster that happens to be large.
    // Points are zeroed so tm.over() can end the round; without that the whole
    // game stalls on an enemy that never spends its turn.
    if (!enemy.isEngaged()) {
        enemy.movementPoints = 0
        enemy.actionPoints = 0
        return
    }

    // Woken, once. The log line is the moment the fight starts and is worth
    // marking — the player struck something that was not moving, and needs to
    // know the room just changed.
    if (!enemy._leaderRoused) {
        enemy._leaderRoused = true
        gameLog.log(`The ${enemy.name} rises to its full height!`)
    }

    const target = combatTargetFor(enemy) || player
    const distance = Math.max(Math.abs(target.x - enemy.x), Math.abs(target.y - enemy.y))

    // Attack FIRST, then move. A boss that is already in reach should swing this
    // turn rather than reposition and swing next turn — the ordinary archetypes
    // move-then-attack, which on a slow heavy enemy loses a whole round of
    // pressure every time the player steps in and out of reach.
    if (enemy.actionPoints > 0) {
        if (distance <= STRIKE_RANGE) {
            dungeon.attackEntity(enemy, target, enemy.weapon)
        }
        enemy.actionPoints -= 1
    }

    // Close the gap. Spends EVERY movement point rather than one per turn, so a
    // 1-MP heavy still advances each round and a faster leader really closes —
    // this is what stops it being kited around its own chamber.
    while (enemy.movementPoints > 0) {
        const goal = approachGoal(enemy, target)
        const dist = Math.max(Math.abs(target.x - enemy.x), Math.abs(target.y - enemy.y))
        if (dist <= STRIKE_RANGE) break          // in reach; hold the line
        const grid = mapState.gridForEntity(enemy)
        const path = new PF.AStarFinder().findPath(enemy.x, enemy.y, goal.x, goal.y, grid)
        if (path.length <= 2) break              // adjacent or no route
        dungeon.stepEntityTo(enemy, path[1][0], path[1][1])
        enemy.movementPoints -= 1
        // stepEntityTo tweens; bail out of the loop while it animates and pick up
        // the remaining points next turn rather than teleporting across the room.
        if (enemy.moving) break
    }
    enemy.movementPoints = 0
}

export default {
    turn,
    // NO fleeThreshold. Every other melee archetype can break and run; a boss that
    // flees at low health turns its own death into a chase around the room. It
    // fights to the end.
    //
    // Stats are a floor above brute's (13-15 STR/CON) because this sits at the end
    // of the run — but the real step up is eliteEnrager, which spawnLeader applies
    // on top: HP x4, +3 STR, an extra MP and AP, a 20% block, and a rage below half
    // health. These numbers are the base that multiplies from.
    statTemplate: {
        STR: [15, 18],
        DEX: [6, 9],
        CON: [15, 18],
        SPD: [5, 8],
        INT: [5, 8],
        Magic: [3, 6],
    },
    hpFormula: (s) => 50 + s.CON * 9,
}
