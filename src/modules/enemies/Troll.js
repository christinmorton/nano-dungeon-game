import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Troll extends BaseEnemy {
    static tier = 3
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = `Troll`
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        
        this.x = x
        this.y = y
        this.tile = 171
        this.type = "enemy"
        this.weapon.name = "club"

        dungeon.initializeEntity(this)
    }

}