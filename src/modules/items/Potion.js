import GenericItem from "./GenericItem";
import dungeon from "../Dungeon";
import { playCast } from "../Animations.js"
import gameLog from "../GameLog.js"

export default class Potion extends GenericItem {
    constructor(x, y) {
        super(x, y, 670, null, { sheet: "32rogues-items", name: "greenPotion" })
        this.name = "Cure Potion"
        this.description = "Drink to remove all cursed items stuck to you. Cleansed cursed gems convert to coins."
    }

    equip(itemNumber) {
        const player = dungeon.player
        gameLog.log(`A healing wave passes through your body and removes all cursed items.`)
        playCast(player, {
            type: 'arcane',
            onComplete: () => {
                // Convert any cursed tally items (e.g. CursedGem) to currency
                // before they get removed — cleansing turns the curse into a
                // payout.
                const cursedItems = player.items.filter(i => i.cursed)
                for (const it of cursedItems) {
                    if (it.tallyKey) {
                        const v = it.value?.() ?? 1
                        player.tallies[it.tallyKey] = (player.tallies[it.tallyKey] || 0) + v
                        gameLog.log(`Cleansed ${it.name} converts to ${v} ${it.tallyKey}.`)
                    }
                }
                player.removeItem(itemNumber)
                player.removeItemByProperty("cursed", true)
            }
        })
    }
}
