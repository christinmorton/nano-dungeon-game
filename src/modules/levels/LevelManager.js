// LevelManager — owns the sequence of floors that make up a run.
//
// Generator-agnostic: each entry in the config's levels array is
//   { type: SomeLevelClass, config: <whatever-that-class-expects> }
// and LevelManager just instantiates them. Mixing level types is a
// config edit, not a code change.
//
// Public surface kept stable from the old BSPDungeon class so MapState /
// Run / Quest can rename the field without changing call shapes:
//   levels                  — the constructed level instances
//   currentLevel            — index into levels (number, not the instance)
//   goDown / goUp           — advance/retreat the index
//   getCurrentLevel()       — level data (number[][])
//   getRooms()              — Room[] for the current floor
//   getStairs()             — { down?, up? } edge-aware spawn points
//
// `getTree()` is a BSP-specific leak retained for World.js's default-
// spawn placement. PR 3 moves spawn into level.populate() and this can
// disappear.

export default class LevelManager {
    constructor(config) {
        this.levels = config.levels.map(entry => new entry.type(entry.config))
        this.currentLevel = 0
    }

    goDown() {
        if (this.currentLevel < this.levels.length - 1) {
            this.currentLevel++
        }
    }

    goUp() {
        if (this.currentLevel > 0) {
            this.currentLevel--
        }
    }

    // Absolute jump to any floor index (clamped). Used by authored cross-floor
    // portals (§15.9 slice 2b) — up/down stairs only move ±1, a portal can land
    // on an arbitrary floor.
    goTo(index) {
        this.currentLevel = Math.max(0, Math.min(index | 0, this.levels.length - 1))
    }

    getCurrent() {
        return this.levels[this.currentLevel]
    }

    getCurrentLevel() {
        return this.getCurrent().getLevelData()
    }

    getRooms() {
        return this.getCurrent().getRegions()
    }

    getStairs() {
        const stairs = {}
        const spawn = this.getCurrent().getSpawnPoints()
        if (this.currentLevel < this.levels.length - 1) {
            stairs.down = spawn.stairsDown
        }
        if (this.currentLevel > 0) {
            stairs.up = spawn.stairsUp
        }
        return stairs
    }

    getTree() {
        return this.getCurrent().tree
    }
}
