// Central registry of every spawnable enemy — auto-discovered via Vite glob
// import (same pattern as classes/abilities/abilityRegistry.js and
// settlementProfiles.js), so a newly added enemy class is enumerable with no
// manual registration to forget.
//
// Powers the training bench's spawn-a-specific-enemy helper
// (window.training.spawnEnemy) and any future "bestiary" tooling. Classifies by
// prototype chain: only real BaseEnemy subclasses are included; BaseEnemy itself
// and the inert TrainingDummy are excluded.

import tm from "../TurnManager.js"
import BaseEnemy from "./BaseEnemy.js"
import CosmicBeing from "./CosmicBeing.js"
import { COSMIC_KEYS, cosmicKeyByName } from "../../data/cosmicBeings.js"

const modules = import.meta.glob('./*.js', { eager: true })

// Subclasses that aren't spawnable foes. CosmicBeing is a data-driven base — its
// concrete beings are enumerated from the data table (see below), not the glob.
const EXCLUDED = new Set(['BaseEnemy', 'TrainingDummy', 'CosmicBeing'])

const BY_NAME = new Map()
for (const path in modules) {
    if (path.endsWith('/enemyRegistry.js')) continue
    const EnemyClass = modules[path]?.default
    if (typeof EnemyClass !== 'function') continue          // enemyKinds.js etc. have no default class
    if (EXCLUDED.has(EnemyClass.name)) continue
    if (!(EnemyClass.prototype instanceof BaseEnemy)) continue
    BY_NAME.set(EnemyClass.name, EnemyClass)
}

// Sorted list of every spawnable name — the glob'd enemy classes plus the
// data-driven cosmic beings (data/cosmicBeings.js). Used by menus / the spawn
// helper's "available" list.
export const ENEMY_NAMES = [...BY_NAME.keys(), ...COSMIC_KEYS].sort((a, b) => a.localeCompare(b))

// Resolve an enemy class by its name (case-insensitive). Returns null if unknown.
export function enemyClassByName(name) {
    if (!name) return null
    const exact = BY_NAME.get(name)
    if (exact) return exact
    const lower = String(name).toLowerCase()
    for (const [key, cls] of BY_NAME) {
        if (key.toLowerCase() === lower) return cls
    }
    return null
}

// Spawn a fully-initialized enemy by name at (x, y). The enemy class constructor
// registers + renders it (dungeon.initializeEntity); finalizeSpawn() then rolls
// its archetype + default stat profile so it behaves like a real foe. Returns
// the instance, or null if the name is unknown.
export function spawnEnemyByName(name, x, y) {
    // Cosmic beings are data-driven: resolve to a key and factory-spawn a
    // CosmicBeing carrying that profile (no per-being class).
    const cosmicKey = cosmicKeyByName(name)
    let enemy
    if (cosmicKey) {
        enemy = new CosmicBeing(x, y, cosmicKey)
    } else {
        const EnemyClass = enemyClassByName(name)
        if (!EnemyClass) return null
        enemy = new EnemyClass(x, y)
    }
    if (typeof enemy.finalizeSpawn === 'function') enemy.finalizeSpawn()
    // Constructors only call initializeEntity (sprite); addEntity is what puts
    // the enemy in the turn / collision / entityAtTile index. The normal
    // spawner does this — so the helper must too.
    tm.addEntity(enemy)
    enemy.noDrops = true   // training-arena spawns leave no loot on death
    return enemy
}
