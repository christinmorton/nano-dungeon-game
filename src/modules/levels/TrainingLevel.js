import BaseLevel from "./BaseLevel.js"
import Room from "./Room.js"
import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import gameLog from "../GameLog.js"
import TrainingDummy from "../enemies/TrainingDummy.js"
import { makeItem } from "../items/itemProfiles.js"
import { loadAbilities, pageAbilities, randomBar } from "../trainingHelpers.js"

// Throwing-style empower items dropped on the bench floor so they can be walked
// over and picked up (then CARRIED to empower Throw Knives). Placed off the
// hero->dummy firing lane (y=8). Bench-only convenience.
const FLOOR_PICKUPS = [
    { name: "balancedSteelKnives", x: 8, y: 10 },
    { name: "venomfangKnives", x: 9, y: 10 },
    { name: "beardedHatchets", x: 8, y: 11 },
    { name: "reaverTomahawks", x: 9, y: 11 },
]

// TrainingLevel — a fixed single-room bench for the A->Z ability pass. The hero
// spawns on the west side facing a Training Dummy (inert, ~unkillable) on the
// east; the bench loads a set of abilities onto the 5-slot bar so each can be
// fired at the dummy. Drive the rest from the console via window.training
// (see trainingHelpers.js): pageAbilities / randomBar / spawnEnemy / resetDummy.
//
// Selected via the arena harness: arena.html?training[=<spec>]
//   ?training                — first 5 abilities alphabetically (page 0)
//   ?training=random         — 5 random abilities
//   ?training=Cleave,Smite   — an explicit comma-separated set (max 5)
//
// (Like ArenaLevel/PartyTestLevel this is a debug bench — no procgen, stairs, or
// quest items.)

const WIDTH = 24
const HEIGHT = 17
// Hero and dummy start close (3 tiles apart) so ranged abilities reach the dummy
// immediately and melee is one step away — distance was hiding every hit before.
const PLAYER_SPAWN = { x: 8, y: 8 }
const DUMMY_SPAWN = { x: 11, y: 8 }

export default class TrainingLevel extends BaseLevel {
    // Opt out of the encounter/Battle "arena" system (banner + dim overlay +
    // enemy clamp + turn throttle) — World.update reads this so spawned enemies
    // don't trigger combat staging that interrupts ability testing.
    disableEncounters = true

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

    populate() {
        // Let any ability be fired on this hero regardless of class/stat gates
        // (Ability.canActivate reads this). Training bench only.
        if (typeof window !== "undefined") window.TRAINING_GATES_OFF = true

        // The dummy target (placePlayer already ran in World.create, so
        // dungeon.player exists here — same ordering PartyTestLevel relies on).
        new TrainingDummy(DUMMY_SPAWN.x, DUMMY_SPAWN.y)

        // Floor pickups for testing the throwing style's empower-on-pickup:
        // makeItem builds + sprites the entity (GenericItem ctor → initializeEntity)
        // but does NOT register it for collision/pickup, so tm.addEntity is needed.
        for (const { name, x, y } of FLOOR_PICKUPS) {
            try {
                tm.addEntity(makeItem(name, x, y))
            } catch {
                gameLog.log(`Training: item "${name}" unavailable (restart the dev server?).`)
            }
        }

        // Load the starting ability set from the ?training spec.
        const params = new URLSearchParams(window.location.search)
        const spec = params.get("training")
        if (!spec || spec === "true" || spec === "") {
            pageAbilities(0)
        } else if (spec === "random") {
            randomBar(5)
        } else {
            loadAbilities(spec.split(",").map(s => s.trim()).filter(Boolean))
        }

        gameLog.log("Training bench ready. Console: window.training — load: loadAbilities('Name')/listAbilities/pageAbilities/randomBar; progression: levelAbility/augmentAbility/traitAbility/abilityInfo; world: spawnEnemy/resetDummy/giveWeapon. (URL form: arena.html?training=BullRush — use the no-space key.)")
    }

    getPlayerSpawnTile() {
        return { ...PLAYER_SPAWN }
    }
}
