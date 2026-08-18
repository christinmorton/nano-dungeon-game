import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Ghost extends BaseEnemy {
    static tier = 1
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Ghost"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 320
        this.weapon.name = "chill"

        dungeon.initializeEntity(this)
    }
}
