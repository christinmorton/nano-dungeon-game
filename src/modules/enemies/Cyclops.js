import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Cyclops extends BaseEnemy {
    static tier = 3
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Cyclops"
        this.movementPoints = 1
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 1,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 465
        this.weapon.name = "great club"

        dungeon.initializeEntity(this)
    }
}
