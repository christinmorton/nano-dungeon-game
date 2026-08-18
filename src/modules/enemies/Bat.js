import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Bat extends BaseEnemy {
    static tier = 1
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = `Bat`
        this.movementPoints = 5
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 5,
            actionPoints: 1,
            healthPoints: 0
        }

        
        this.x = x
        this.y = y
        this.tile = 418
        this.type = "enemy"
        this.weapon.name = "bite"

        dungeon.initializeEntity(this)
    }

}