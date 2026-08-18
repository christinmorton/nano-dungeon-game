import GenericItem from "./GenericItem.js"
import dungeon from "../Dungeon.js"
import { spawnBuffNumber, playCast } from "../Animations.js"
import gameLog from "../GameLog.js"

export default class StaminaPotion extends GenericItem {
    constructor(x, y) {
        super(x, y, 669, null, { sheet: "32rogues-items", name: "bluePotion" })
        this.name = "Stamina Potion"
        this.description = "Drink for an immediate +2 movement points this turn."
    }

    equip(itemNumber) {
        const bonus = 2
        gameLog.log(`A rush of energy grants ${bonus} extra movement.`)
        playCast(dungeon.player, {
            type: 'arcane',
            onComplete: () => {
                dungeon.player.movementPoints += bonus
                spawnBuffNumber(dungeon.player, bonus)
                dungeon.player.removeItem(itemNumber)
            }
        })
    }
}
