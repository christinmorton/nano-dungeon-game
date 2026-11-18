import GenericItem from "./GenericItem.js"
import dungeon from "../Dungeon.js"
import { spawnHealNumber, playCast } from "../Animations.js"
import gameLog from "../GameLog.js"

// Twice the lesser potion's fraction — the reason to carry the heavy one. See
// HealthPotion for why these are percentages of max health rather than flat.
const HEAL_FRACTION = 0.5

export default class GreaterHealthPotion extends GenericItem {
    constructor(x, y) {
        super(x, y, 669, null, { sheet: "32rogues-items", name: "largeDarkPotion" })
        this.name = "Greater Health Potion"
        this.description = "A potent potion that restores half of your maximum health when consumed."
        this.stackable = true
    }

    equip(itemNumber) {
        // v5 has no party, so a draught always heals the drinker.
        const target = dungeon.player
        const points = Math.max(1, Math.round(target.maxHealthPoints * HEAL_FRACTION))
        gameLog.log(`A surge of vitality restores ${points} health points.`)
        // Effect resolves NOW; the cast pulse is cosmetic. See HealthPotion.
        target.healthPoints = Math.min(target.healthPoints + points, target.maxHealthPoints)
        spawnHealNumber(target, points)
        target.removeItem(itemNumber)
        playCast(target, { type: 'heal' })
    }
}
