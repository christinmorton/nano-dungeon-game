import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Pirate extends BaseEnemy {
    static tier = 2
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Pirate"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 223
        this.weapon.name = "cutlass"

        dungeon.initializeEntity(this)
    }
}
