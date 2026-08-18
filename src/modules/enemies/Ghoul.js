import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Ghoul extends BaseEnemy {
    static tier = 2
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Ghoul"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 172
        this.weapon.name = "claws"

        dungeon.initializeEntity(this)
    }
}
