import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Spider extends BaseEnemy {
    static tier = 1
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Spider"
        this.movementPoints = 4
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 4,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 273
        this.weapon.name = "bite"

        dungeon.initializeEntity(this)
    }
}
