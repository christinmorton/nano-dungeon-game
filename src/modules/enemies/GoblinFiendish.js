import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class GoblinFiendish extends BaseEnemy {
    static tier = 3
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Fiendish Goblin"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 127
        this.weapon.name = "cursed shiv"

        dungeon.initializeEntity(this)
    }
}
