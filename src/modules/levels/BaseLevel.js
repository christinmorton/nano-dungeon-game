// BaseLevel — abstract parent for all level types (BSP, maze, cave, static).
//
// A Level owns its geometry (the 2D 0/1 grid) plus the metadata downstream
// systems need to spawn into it: the regions inside it (rooms / segments /
// nothing) and the spawn points for stairs. Subclasses fill these fields in
// their override of `generate()`.
//
// Subclass when the *generation algorithm* differs (BSP carves rectangles,
// maze carves passages). Do NOT subclass for room kinds, themes, or quest
// flavor — those are data on the Level/Room instances, not new classes.
// See feedback memory "Kind field over hierarchy".
//
// Contract:
//   getLevelData()   -> number[][]  0 = floor, 1 = wall
//   getRegions()     -> Room[]
//   getSpawnPoints() -> { stairsUp?: {x,y}, stairsDown?: {x,y} }
//   populate(tm)     -> void  (PR 3 will move World.js's spawn loop here)

export default class BaseLevel {
    constructor(config) {
        this.config = config
        this.levelData = null
        this.regions = []
        this.spawnPoints = {}
        // Mirrors Room.tags. Carries level-identity flags ("holdsAmulet",
        // "haunted", "flooded"). Read by Quest hooks and the future theme
        // system (#19); unused for PR 3.
        this.tags = []
    }

    generate() {
        throw new Error(`${this.constructor.name} must implement generate()`)
    }

    getLevelData()   { return this.levelData }
    getRegions()     { return this.regions }
    getSpawnPoints() { return this.spawnPoints }

    populate(tm) {}
}
