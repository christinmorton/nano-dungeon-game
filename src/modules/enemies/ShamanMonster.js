import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class ShamanMonster extends BaseEnemy {
    static tier = 1
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Dark Shaman"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 125
        this.weapon.name = "curse"

        dungeon.initializeEntity(this)
    }
}
