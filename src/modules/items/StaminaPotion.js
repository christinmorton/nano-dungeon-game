import GenericItem from "./GenericItem.js"
import dungeon from "../Dungeon.js"
import { spawnBuffNumber, playCast } from "../Animations.js"
import gameLog from "../GameLog.js"
import audio from "../Audio.js"

export default class StaminaPotion extends GenericItem {
    constructor(x, y) {
        super(x, y, 669, null, { sheet: "32rogues-items", name: "bluePotion" })
        this.name = "Stamina Potion"
        this.description = "Drink for an immediate +2 movement points this turn."
        this.stackable = true
    }

    equip(itemNumber) {
        const bonus = 2
        const target = dungeon.player
        gameLog.log(`A rush of energy grants ${bonus} extra movement.`)
        audio.play('potion-stamina')
        // Effect resolves NOW; the cast pulse is cosmetic. See HealthPotion.
        target.movementPoints += bonus
        spawnBuffNumber(target, bonus)
        target.removeItem(itemNumber)
        playCast(target, { type: 'arcane' })
    }
}
