import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Orc extends BaseEnemy {
    static tier = 1
    static archetype = "brute"

    constructor(x, y) {
        super(x, y)
        this.name = `Orc`
        this.movementPoints = 1
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 1,
            actionPoints: 1,
            healthPoints: 0
        }

        
        this.x = x
        this.y = y
        this.tile = 173
        this.type = "enemy"
        this.weapon.name = "club"

        dungeon.initializeEntity(this)
    }

}