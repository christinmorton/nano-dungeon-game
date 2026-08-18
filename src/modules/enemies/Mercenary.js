import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Mercenary extends BaseEnemy {
    static tier = 2
    static rarity = "rare"
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Mercenary"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 471
        this.weapon.name = "sword"

        dungeon.initializeEntity(this)
    }
}
