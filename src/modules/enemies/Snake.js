import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Snake extends BaseEnemy {
    static tier = 1
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Snake"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 420
        this.weapon.name = "bite"

        dungeon.initializeEntity(this)
    }
}
