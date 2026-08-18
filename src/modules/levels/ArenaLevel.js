import BaseLevel from "./BaseLevel.js"
import Room from "./Room.js"
import mapState from "../MapState.js"
import recipeLoader from "../recipes/RecipeLoader.js"
import recipeApplier from "../recipes/RecipeApplier.js"

// ArenaLevel — a fixed, single-room test floor for verifying AI behavior
// in isolation. No procedural generation, no stairs, no quest items.
// Enemies spawn as a cluster in one corner so the player can approach
// from a controlled distance and observe alert propagation, archetype
// behavior, and future captain coordination work.
//
// Toggled via window.ARENA_MODE in MapState.start.

const ARENA_WIDTH = 25
const ARENA_HEIGHT = 25
const ENEMY_ANCHOR = { x: 21, y: 20 }

// Chebyshev distance the player must spawn from ENEMY_ANCHOR. Picked
// above the captain's default detectionRadius (8) so the player has a
// turn or two of warning before the band notices them — keeps the
// "approach the band from across the room" framing the arena exists
// for.
const MIN_PLAYER_DISTANCE_FROM_ENEMIES = 10
const PLAYER_SPAWN_ATTEMPTS = 30

export default class ArenaLevel extends BaseLevel {
    constructor(config = {}) {
        super(config)
        this.width = config.width ?? ARENA_WIDTH
        this.height = config.height ?? ARENA_HEIGHT
        this.generate()
    }

    generate() {
        const w = this.width
        const h = this.height
        this.levelData = []
        for (let y = 0; y < h; y++) {
            const row = []
            for (let x = 0; x < w; x++) {
                const isBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1
                row.push(isBorder ? 1 : 0)
            }
            this.levelData.push(row)
        }

        const room = new Room(1, 1, w - 2, h - 2, "starting")
        this.regions = [room]
        this.spawnPoints = {}
        return this
    }

    populate(tm) {
        // Recipe-driven spawn — picks a band recipe and lets the applier
        // place a captain + squad members. The arena URL accepts a
        // ?recipe=<name> override so specific compositions can be
        // tested in isolation (e.g. ?recipe=all-archer-orcs); falls
        // back to small-orc-band when the param is absent. Throws if
        // the named recipe doesn't exist so a typo in the URL fails
        // loud rather than silently spawning the default.
        const params = new URLSearchParams(window.location.search)
        const recipeName = params.get("recipe") || "small-orc-band"
        const recipe = recipeLoader.byName(recipeName)
        if (!recipe) {
            throw new Error(
                `ArenaLevel: recipe "${recipeName}" not found. ` +
                `Available: ${recipeLoader.names().join(", ")}`
            )
        }
        recipeApplier.apply(tm, recipe, ENEMY_ANCHOR.x, ENEMY_ANCHOR.y)
    }

    // Optional hook honored by World.js — keep the player from spawning
    // on top of the enemy band. Picks any walkable tile in the room
    // whose Chebyshev distance from ENEMY_ANCHOR is at least
    // MIN_PLAYER_DISTANCE_FROM_ENEMIES (north / west / south edges
    // plus the south-west corner relative to the band). Falls back to
    // a plain random tile after PLAYER_SPAWN_ATTEMPTS misses so a
    // cluttered room can't lock the spawn.
    getPlayerSpawnTile(room) {
        for (let i = 0; i < PLAYER_SPAWN_ATTEMPTS; i++) {
            const tile = mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
            const dist = Math.max(
                Math.abs(tile.x - ENEMY_ANCHOR.x),
                Math.abs(tile.y - ENEMY_ANCHOR.y)
            )
            if (dist >= MIN_PLAYER_DISTANCE_FROM_ENEMIES) return tile
        }
        return mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
    }
}
