import GenericItem from "./GenericItem.js"
import dungeon from "../Dungeon.js"
import { playCast, spawnHealNumber } from "../Animations.js"
import gameLog from "../GameLog.js"
import audio from "../Audio.js"

// Fraction of MAX health restored. Was a flat 3-5, set before the stats work and
// never revisited — by mid-run that is a rounding error against the hero's health
// pool and the potion reads as not working. A percentage scales with the hero for
// the whole run and stays legible ("a quarter of your health").
const HEAL_FRACTION = 0.25

export default class HealthPotion extends GenericItem {
	constructor(x, y) {
		super(x, y, 669, null, { sheet: "32rogues-items", name: "redPotion" })
		this.name = "Health Potion"
		this.description = "A potion that restores a quarter of your maximum health when consumed."
		this.stackable = true
	}

    equip(itemNumber) {
        // v5 has no party, so a potion always heals the drinker.
        const target = dungeon.player
        const points = Math.max(1, Math.round(target.maxHealthPoints * HEAL_FRACTION))
        gameLog.log(`A warm feeling is felt when drinking the potion as it restores ${points} health points.`)
        audio.play('potion-health')

        // THE HEAL AND THE REMOVAL HAPPEN NOW, not in playCast's onComplete.
        //
        // That callback is a tween on the World scene, so it never fires while
        // that scene is paused — which made a potion unusable from the Pause
        // menu (it would log, heal nothing, and only resolve on resume). It also
        // left a ~400ms window in normal play where the potion was still in the
        // carry list, so two fast presses drank one potion twice.
        //
        // The cast pulse is now purely cosmetic and may be dropped entirely
        // without costing the player anything.
        target.healthPoints = Math.min(target.healthPoints + points, target.maxHealthPoints)
        spawnHealNumber(target, points)
        target.removeItem(itemNumber)
        playCast(target, { type: 'heal' })
    }
}
