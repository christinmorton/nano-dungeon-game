import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Scorpion extends BaseEnemy {
    static tier = 1
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Scorpion"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 269
        this.weapon.name = "sting"

        dungeon.initializeEntity(this)
    }
}
