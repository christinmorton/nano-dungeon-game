import BaseLevel from "./BaseLevel.js"
import Room from "./Room.js"
import mapState from "../MapState.js"
import dungeon from "../Dungeon.js"
import gameLog from "../GameLog.js"
import recipeLoader from "../recipes/RecipeLoader.js"
import recipeApplier from "../recipes/RecipeApplier.js"
import Follower from "../companions/Follower.js"

// PartyTestLevel — a fixed single-room arena for testing the player PARTY in
// isolation. The hero spawns on the west side surrounded by a party of
// followers; an enemy band spawns on the east. Walk east and watch the party
// move and fight as a group.
//
// Selected via the existing arena harness: arena.html?party=<N>
//   ?party=3            — 3 party members (default if no number)
//   ?recipe=<name>      — override the enemy band (default small-orc-band)
//
// (Like ArenaLevel, this is a debug bench — no procedural generation, stairs,
// or quest items. Enemies don't yet retarget onto allies, so the band focuses
// the hero while the party chews through it — fine for testing follow + fight.)

const WIDTH = 30
const HEIGHT = 20
const PLAYER_SPAWN = { x: 4, y: 10 }
const ENEMY_ANCHOR = { x: 25, y: 10 }
const DEFAULT_PARTY_SIZE = 3

// Spawn ring around the hero, nearest-first, so a small party tucks in close.
const PARTY_OFFSETS = [
    [-1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, 0], [1, -1], [1, 1]
]

export default class PartyTestLevel extends BaseLevel {
    constructor(config = {}) {
        super(config)
        this.width = config.width ?? WIDTH
        this.height = config.height ?? HEIGHT
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
        this.regions = [new Room(1, 1, w - 2, h - 2, "starting")]
        this.spawnPoints = {}
        return this
    }

    populate(tm) {
        const params = new URLSearchParams(window.location.search)

        // Enemy band on the east side (recipe-driven, like ArenaLevel).
        const recipeName = params.get("recipe") || "small-orc-band"
        const recipe = recipeLoader.byName(recipeName)
        if (!recipe) {
            throw new Error(
                `PartyTestLevel: recipe "${recipeName}" not found. ` +
                `Available: ${recipeLoader.names().join(", ")}`
            )
        }
        recipeApplier.apply(tm, recipe, ENEMY_ANCHOR.x, ENEMY_ANCHOR.y)

        // The hero's party near its spawn (placePlayer already ran — see
        // World.create, so dungeon.player exists here).
        const size = parseInt(params.get("party"), 10) || DEFAULT_PARTY_SIZE
        this._spawnParty(size)
    }

    _spawnParty(size) {
        const hero = dungeon.player
        if (!hero) return
        let placed = 0
        for (const [dx, dy] of PARTY_OFFSETS) {
            if (placed >= size) break
            const x = hero.x + dx
            const y = hero.y + dy
            if (!mapState.isWalkableTile(x, y)) continue
            new Follower(x, y, { leader: hero, owner: hero, name: `Ally ${placed + 1}` })
            placed += 1
        }
        gameLog.log(`Party test: ${hero.name} fields a party of ${placed}.`)
    }

    getPlayerSpawnTile(room) {
        return { ...PLAYER_SPAWN }
    }
}
