import Bat from "./enemies/Bat.js"
import Beetle from "./enemies/Beetle.js"
import CaveBear from "./enemies/CaveBear.js"
import Crab from "./enemies/Crab.js"
import Cyclops from "./enemies/Cyclops.js"
import DarkKnight from "./enemies/DarkKnight.js"
import DarkSorcerer from "./enemies/DarkSorcerer.js"
import DarkSorcererHigher from "./enemies/DarkSorcererHigher.js"
import DungeonBoar from "./enemies/DungeonBoar.js"
import DungeonLizard from "./enemies/DungeonLizard.js"
import DungeonLynx from "./enemies/DungeonLynx.js"
import DungeonWolf from "./enemies/DungeonWolf.js"
import EvilFriar from "./enemies/EvilFriar.js"
import EvilMonk from "./enemies/EvilMonk.js"
import EvilPriest from "./enemies/EvilPriest.js"
import FlyWasp from "./enemies/FlyWasp.js"
import Ghast from "./enemies/Ghast.js"
import GhastHigher from "./enemies/GhastHigher.js"
import Ghost from "./enemies/Ghost.js"
import Ghoul from "./enemies/Ghoul.js"
import Goblin from "./enemies/Goblin.js"
import GoblinFiendish from "./enemies/GoblinFiendish.js"
import GoblinHigher from "./enemies/GoblinHigher.js"
import HumanoidMarauder from "./enemies/HumanoidMarauder.js"
import Imp from "./enemies/Imp.js"
import Leprechaun from "./enemies/Leprechaun.js"
import MarauderBrute from "./enemies/MarauderBrute.js"
import MarauderDualWield from "./enemies/MarauderDualWield.js"
import Mercenary from "./enemies/Mercenary.js"
import MilitantOgre from "./enemies/MilitantOgre.js"
import Ogre from "./enemies/Ogre.js"
import Orc from "./enemies/Orc.js"
import OrcHigher from "./enemies/OrcHigher.js"
import Pirate from "./enemies/Pirate.js"
import Scarab from "./enemies/Scarab.js"
import ScarabHigher from "./enemies/ScarabHigher.js"
import Scorpion from "./enemies/Scorpion.js"
import Shadow from "./enemies/Shadow.js"
import ShadowHigher from "./enemies/ShadowHigher.js"
import ShamanMonster from "./enemies/ShamanMonster.js"
import Skeleton from "./enemies/Skeleton.js"
import Slime from "./enemies/Slime.js"
import Snake from "./enemies/Snake.js"
import Spider from "./enemies/Spider.js"
import Troll from "./enemies/Troll.js"
import { applyRandomPersonalities } from "./enemies/personalities.js"

const enemies = {
    Bat,
    Beetle,
    CaveBear,
    Crab,
    Cyclops,
    DarkKnight,
    DarkSorcerer,
    DarkSorcererHigher,
    DungeonBoar,
    DungeonLizard,
    DungeonLynx,
    DungeonWolf,
    EvilFriar,
    EvilMonk,
    EvilPriest,
    FlyWasp,
    Ghast,
    GhastHigher,
    Ghost,
    Ghoul,
    Goblin,
    GoblinFiendish,
    GoblinHigher,
    HumanoidMarauder,
    Imp,
    Leprechaun,
    MarauderBrute,
    MarauderDualWield,
    Mercenary,
    MilitantOgre,
    Ogre,
    Orc,
    OrcHigher,
    Pirate,
    Scarab,
    ScarabHigher,
    Scorpion,
    Shadow,
    ShadowHigher,
    ShamanMonster,
    Skeleton,
    Slime,
    Snake,
    Spider,
    Troll
}

export default enemies


// Floor index (0-based) -> allowed tiers. Overlapping window: early
// floors stick to T1 basics, mid floors mix T1+T2, the deepest floor
// is T3-only. Out-of-range floors clamp to the nearest defined entry.
const FLOOR_TIERS = [
    [1],
    [1],
    [1, 2],
    [2, 3],
    [3]
]

const RARITY_WEIGHTS = {
    common: 4,
    uncommon: 2,
    rare: 1
}

function allowedTiersForFloor(floor) {
    if (floor == null) return [1, 2, 3]
    if (floor < 0) return FLOOR_TIERS[0]
    if (floor >= FLOOR_TIERS.length) return FLOOR_TIERS[FLOOR_TIERS.length - 1]
    return FLOOR_TIERS[floor]
}

function weightedPickKey(keys) {
    if (keys.length === 0) return null
    const weights = keys.map(k => RARITY_WEIGHTS[enemies[k].rarity] ?? RARITY_WEIGHTS.common)
    const total = weights.reduce((s, w) => s + w, 0)
    let r = Math.random() * total
    for (let i = 0; i < keys.length; i++) {
        r -= weights[i]
        if (r <= 0) return keys[i]
    }
    return keys[keys.length - 1]
}

function buildEnemy(EnemyClass, x, y, modifierCount) {
    const enemy = new EnemyClass(x, y)
    enemy.finalizeSpawn()
    // Layer 1 of the enemy-composition rebuild: roll 2-3 data-driven
    // PERSONALITIES (temperament + light stat flavor), eligibility-gated per
    // enemy. Replaces the old flat aggro/fast/royal/crafty modifier roll; royal
    // is no longer applied at random (it becomes a humanoid entity type later).
    // See enemies/personalities.js. modifierCount is retained for signature
    // compatibility but no longer used (the count is rolled inside).
    applyRandomPersonalities(enemy)
    return enemy
}

export function getRandomEnemy(x, y, floor, modifierCount = 1) {
    const allowed = allowedTiersForFloor(floor)
    const filtered = Object.keys(enemies).filter(k => allowed.includes(enemies[k].tier ?? 1))
    // Safety: if no class matches the floor's allowed tiers (e.g. someone
    // edits FLOOR_TIERS to an unreachable set), fall back to the full
    // pool rather than crashing the spawn.
    const pool = filtered.length > 0 ? filtered : Object.keys(enemies)
    const key = weightedPickKey(pool)
    return buildEnemy(enemies[key], x, y, modifierCount)
}

// Constrained pool — used by specific-enemy room kinds where the spawn
// table pins the enemy class (e.g. bats-only). The floor-tier filter is
// applied on top of the pin; if the pin has no entries for the current
// floor's tiers, the filter relaxes to the full pinned pool so a
// "bats-only" room on floor 5 still produces bats. Unknown type names
// are silently dropped; if nothing remains, falls back to getRandomEnemy
// so a typo'd table still produces a playable floor.
export function getRandomEnemyOfTypes(types, x, y, floor, modifierCount = 1) {
    const candidates = types.filter(t => enemies[t])
    if (candidates.length === 0) return getRandomEnemy(x, y, floor, modifierCount)
    const allowed = allowedTiersForFloor(floor)
    const tierFiltered = candidates.filter(k => allowed.includes(enemies[k].tier ?? 1))
    const pool = tierFiltered.length > 0 ? tierFiltered : candidates
    const key = weightedPickKey(pool)
    return buildEnemy(enemies[key], x, y, modifierCount)
}
