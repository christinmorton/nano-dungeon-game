import Phaser from 'phaser'
import GenericItem from "./GenericItem.js"
import dungeon from "../Dungeon.js"
import { playCast, spawnHealNumber } from "../Animations.js"
import gameLog from "../GameLog.js"
import { bestHealTarget } from "../companions/party.js"

export default class HealthPotion extends GenericItem {
	constructor(x, y) {
		super(x, y, 669, null, { sheet: "32rogues-items", name: "redPotion" })
		this.name = "Health Potion"
		this.description = "A potion that cures between 3 and 5 health points when consumed."
	}

    equip(itemNumber) {
    	const points = Phaser.Math.Between(3, 5)
        // Drink it yourself, or — if you're already full and a companion is hurt
        // — give it to your most-wounded party member instead of wasting it.
        const target = bestHealTarget(dungeon.player)
        gameLog.log(target === dungeon.player
            ? `A warm feeling is felt when drinking the potion as it restores ${points} health points.`
            : `${dungeon.player.name} feeds the potion to ${target.name}, restoring ${points} health points.`)
        playCast(target, {
            type: 'heal',
            onComplete: () => {
                target.healthPoints = Math.min(target.healthPoints + points, target.maxHealthPoints)
                spawnHealNumber(target, points)
                dungeon.player.removeItem(itemNumber)
            }
        })
    }
}