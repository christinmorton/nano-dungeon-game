import Phaser from "phaser"
import Bat from "./enemies/Bat.js"
import DarkSorcerer from "./enemies/DarkSorcerer.js"
import Ghost from "./enemies/Ghost.js"
import Goblin from "./enemies/Goblin.js"
import GoblinArcher from "./enemies/GoblinArcher.js"
import Ogre from "./enemies/Ogre.js"
import Orc from "./enemies/Orc.js"
import Scorpion from "./enemies/Scorpion.js"
import Skeleton from "./enemies/Skeleton.js"
import Slime from "./enemies/Slime.js"
import Spider from "./enemies/Spider.js"
import { applyDepth, rollTitle } from "./enemies/depth.js"

// The enemy roster. Ten, against v3's fifty.
//
// Picked for behavioural spread rather than theme: between them they cover all
// three AI archetypes the roster names (brute on Orc, skirmisher on Goblin,
// hunter/patrolling/goingSomewhere on the rest), plus a range of speeds and
// bulk — Bat is fast and frail, Slime slow and tanky, Ogre a tier-3 heavy.
//
// Eleven. Two of them attack at RANGE — Goblin Archer with a real bow and Dark
// Sorcerer with a wand — which closes the gap this comment used to record. v3 gets
// its ranged enemies by applying role tags through the recipe layer; with recipes
// cut, v5 bakes the role into the class instead. Both carry a real weapon object
// rather than the renamed virtual stub most humanoids hold, because the archer AI
// reads weapon.range() and minRange() to decide whether to shoot, close or kite.
const enemies = {
    Bat,
    DarkSorcerer,
    Ghost,
    Goblin,
    GoblinArcher,
    Ogre,
    Orc,
    Scorpion,
    Skeleton,
    Slime,
    Spider,
}

export default enemies

// Floor index (0-based) -> allowed tiers. v5's roster is nine tier-1 enemies plus
// one tier-3 (Ogre), so this is deliberately simpler than v3's five-band table:
// the first three floors are basics only, and the last two let the heavy start
// appearing. Using v3's bands verbatim would have made the deepest floors spawn
// NOTHING BUT Ogres, since v5 carries no tier-2 enemy at all — a good example of
// why a table has to be re-derived against the content it actually indexes.
const FLOOR_TIERS = [
    [1],
    [1],
    [1],
    [1, 3],
    [1, 3],
]

function allowedTiersForFloor(floor) {
    if (floor == null) return [1, 3]
    const i = Math.max(0, Math.min(FLOOR_TIERS.length - 1, floor))
    return FLOOR_TIERS[i]
}

// Construct and FINALIZE an enemy. finalizeSpawn is not optional: eight of the
// ten enemies declare a static `archetypePool` rather than a fixed `archetype`,
// and the pool is only rolled inside finalizeSpawn. Skip it and the enemy keeps
// `archetype = null`, BaseEnemy's guarded dispatch quietly does nothing, the
// enemy never spends its points, tm.over() never goes true — and the whole round
// stalls, taking the player's movement with it. It also applies the archetype's
// statTemplate and hpFormula, so a skipped call leaves default stats too.
//
// v3 has the same helper (buildEnemy); ours drops only applyRandomPersonalities,
// which belongs to the layered-enemy work v5 does not carry.
//
// DEPTH (scope doc §10.15) rides here too, AFTER finalizeSpawn so it scales the
// rolled stats rather than being overwritten by the roll: the floor index bumps
// stats and HP, then may hand out a title trait. `opts.plain` skips both — the
// stronghold leader asks for that, because it re-finalizes onto its own
// template a moment later and carries the elite package as its scaling.
function buildEnemy(EnemyClass, x, y, floor, opts = {}) {
    const enemy = new EnemyClass(x, y)
    enemy.finalizeSpawn()
    if (!opts.plain) {
        applyDepth(enemy, floor)
        rollTitle(enemy, floor)
    }
    return enemy
}

// Construct a random enemy appropriate to the floor. Returns an INSTANCE (the
// constructor registers it with dungeon); the caller still adds it to the turn
// manager.
export function getRandomEnemy(x, y, floor, opts) {
    const tiers = allowedTiersForFloor(floor)
    const pool = Object.values(enemies).filter(E => tiers.includes(E.tier ?? 1))
    const EnemyClass = Phaser.Utils.Array.GetRandom(pool.length ? pool : Object.values(enemies))
    return buildEnemy(EnemyClass, x, y, floor, opts)
}

// Construct from a named subset ("Skeleton", "Orc", ...), tier-filtered within
// that set and falling back to the whole set if the filter empties it.
export function getRandomEnemyOfTypes(names, x, y, floor, opts) {
    const named = (names || []).map(n => enemies[n]).filter(Boolean)
    if (!named.length) return getRandomEnemy(x, y, floor, opts)
    const tiers = allowedTiersForFloor(floor)
    const pool = named.filter(E => tiers.includes(E.tier ?? 1))
    const EnemyClass = Phaser.Utils.Array.GetRandom(pool.length ? pool : named)
    return buildEnemy(EnemyClass, x, y, floor, opts)
}
