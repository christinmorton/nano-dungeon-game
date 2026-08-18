import BaseLevel from "./BaseLevel.js"
import Room from "./Room.js"
import spawnSettlement from "../settlements/spawnSettlement.js"
import profilesBySpecies from "../settlements/settlementProfiles.js"

// FortressTestLevel — a fixed, single-room test floor that always contains a
// settlement perimeter war-camp, so the fortress/outpost feature can be
// verified in isolation. The BSP generator's large-room requirement makes
// real-run forts rare; this guarantees one every time.
//
// Toggled via window.ARENA_MODE + a ?settlement=<form> URL param in
// MapState.start (e.g. arena.html?settlement=fortress |
// arena.html?settlement=outpost). One generous bordered room, no corridors,
// no stairs — the camp is the whole floor. The player spawns just outside the
// gate (bottom-centre margin) so every test starts with an approach to the
// entrance.

// Perimeter forms (fortress/outpost) need a large room; the encampment is a
// small camp that should sit in a typical-sized dungeon room.
const PERIMETER_SIZE = { width: 34, height: 26 }
const CAMP_SIZE = { width: 15, height: 11 }
const VALID_FORMS = ["fortress", "outpost", "encampment", "village"]
const PERIMETER_FORMS = ["fortress", "outpost"]

export default class FortressTestLevel extends BaseLevel {
    constructor(config = {}) {
        super(config)
        // Bad ?settlement= value falls back to fortress rather than spawning a
        // broken floor.
        this.form = VALID_FORMS.includes(config.form) ? config.form : "fortress"
        // Which faction profile to populate (orc, void, ...). Unknown names are
        // handled by spawnSettlement (it warns and no-ops).
        this.species = config.species || "orc"
        const size = PERIMETER_FORMS.includes(this.form) ? PERIMETER_SIZE : CAMP_SIZE
        this.width = config.width ?? size.width
        this.height = config.height ?? size.height
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

        // kind "starting" so Dungeon.placePlayer resolves a start room; the
        // settlement + floorTheme metadata drive the war-camp generation and
        // the outdoor floor (MapState.bind reads floorTheme).
        const room = new Room(1, 1, w - 2, h - 2, "starting")
        room.settlement = { species: this.species, form: this.form, faction: this.species }
        // Orc war-camps theme the floor outdoors (dirt/grass); dark themes (void)
        // keep the corrupted-dungeon floor. Keyed off the profile's `darkness`
        // field so any future dark faction follows suit. floorTheme must be set
        // here — MapState.bind reads it before populate runs.
        const profile = profilesBySpecies[this.species]
        if (!(profile && profile.darkness)) room.floorTheme = "outdoor"
        this.regions = [room]
        this.spawnPoints = {}
        return this
    }

    populate(tm) {
        spawnSettlement(this.regions[0])
    }

    // Spawn the player just outside the gate. With no corridors, findGate
    // defaults the gate to the bottom-centre of the ring, so the bottom-centre
    // margin tile lines up directly below it for a straight walk in.
    getPlayerSpawnTile(room) {
        const x0 = room.x + 1
        const x1 = room.x + room.w - 2
        return { x: Math.floor((x0 + x1) / 2), y: room.y + room.h - 1 }
    }
}
