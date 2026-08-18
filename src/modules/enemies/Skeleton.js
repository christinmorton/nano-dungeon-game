import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Skeleton extends BaseEnemy {
    static tier = 1
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = `Skeleton`
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        
        this.x = x
        this.y = y
        this.tile = 323
        this.type = "enemy"
        this.weapon.name = "pike"

        dungeon.initializeEntity(this)
    }

}