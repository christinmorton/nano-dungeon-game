import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Beetle extends BaseEnemy {
    static tier = 1
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Beetle"
        this.movementPoints = 1
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 1,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 272
        this.weapon.name = "bite"

        dungeon.initializeEntity(this)
    }
}
