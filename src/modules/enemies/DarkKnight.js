import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class DarkKnight extends BaseEnemy {
    static tier = 3
    static rarity = "rare"
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Dark Knight"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 325
        this.weapon.name = "sword"

        dungeon.initializeEntity(this)
    }
}
