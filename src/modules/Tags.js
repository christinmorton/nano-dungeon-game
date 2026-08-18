import Phaser from "phaser"
import aggro from "./tags/aggro.js"
import crafty from "./tags/crafty.js"
import fast from "./tags/fast.js"
import golden from "./tags/golden.js"
import iron from "./tags/iron.js"
import silver from "./tags/silver.js"
import poison from "./tags/poison.js"
import burning from "./tags/burning.js"
import royal from "./tags/royal.js"
import cursed from "./tags/cursed.js"

// Elite tags (eliteEnrager, eliteHealer) are intentionally NOT imported here.
// They import item classes for their drop pool, which transitively pull in
// GenericItem -> Taggable -> Tags, creating a circular import that errors with
// "Cannot access 'Taggable' before initialization" during the initial Classes
// -> BaseHero -> Taggable chain. Elite tags are applied directly from World.js
// via addTag(template), which loads them after Taggable is fully defined.
//
// hunter / patrolling / goingSomewhere were behavior tags up through
// 2026-05-25; they migrated to archetypes/ alongside brute / skirmisher /
// archer. AI lives in archetypes now; tags are modifiers, effects, and
// material/appearance.

const tags = {
    aggro,
    crafty,
    fast,
    golden,
    silver,
    iron,
    poison,
    burning,
    royal,
    cursed
}

export const materials = [
    "golden",
    "silver",
    "iron"
]

export const enemyModifiers = [
    "aggro",
    "crafty",
    "fast",
    "royal"
]

// Burning and Poison were removed from the spawn-roll pool when the
// magic/elements system landed. Burning is now applied as an on-hit
// consequence of fire-flavored weapons (see Combat.js step 6); poison
// is dormant pending its rework trigger source (envenomed weapon
// archetype, etc.). See documents/v3_magic_and_elements.md §"Status
// routing". The tag modules themselves still exist and are still
// imported above — only the random-roll path is gone.
export const effects = [
    "cursed"
]

export function getRandomTagsForItem(modifierCount = 1, effectCount = 0) {
    let res = new Set()

    while (modifierCount > 0) {
        res.add(Phaser.Utils.Array.GetRandom(materials))
        modifierCount--
    }

    while (effectCount > 0) {
        res.add(Phaser.Utils.Array.GetRandom(effects))
        effectCount--
    }

    return [...res]
}


export function getRandomTagsForEnemy(modifierCount = 1, excluded = []) {
    let res = new Set()
    // Excluded list lets callers gate tags that don't fit the enemy
    // class — e.g. crafty is for humanoid/intelligent-undead pickpockets,
    // not for beasts that can't grip a sword.
    const modifierPool = enemyModifiers.filter(m => !excluded.includes(m))

    while (modifierCount > 0) {
        res.add(Phaser.Utils.Array.GetRandom(modifierPool))
        modifierCount--
    }

    // Behavior tags no longer roll here — AI is the archetype's job. The
    // spawn flow rolls from EnemyClass.archetypePool when present.

    return [...res]
}


export default tags