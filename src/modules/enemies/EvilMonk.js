import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class EvilMonk extends BaseEnemy {
    static tier = 2
    static rarity = "rare"
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Dark Monk"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 468
        this.weapon.name = "staff"

        dungeon.initializeEntity(this)
    }
}
