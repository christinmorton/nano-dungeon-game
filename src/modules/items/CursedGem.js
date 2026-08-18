import Phaser from "phaser"
import GenericItem from "./GenericItem";
import dungeon from "../Dungeon";
import gameLog from "../GameLog.js"
import { cursedGemWhispers } from "../dialog/environmentBarks.js"

// §18 curse synergy: a Cursed Gem can force the Curse affinity on pickup, and once a
// hero is curse-attuned the gem becomes a CONDUIT — it bleeds MORE HP/turn (the curse
// feeds), while the Curse's Deepening Corruption withers CON/SPD/DEX for extra power.
const CURSE_FORCE_CHANCE = 0.5   // chance a picked-up gem forces the Curse affinity
const CONDUIT_DRAIN = 3          // HP/turn the gem takes from a curse-attuned holder

export default class CursedGem extends GenericItem {
    constructor(x, y){
        super(x, y, 524)

        this.name = "Cursed Gem"
        this.description = "A cursed gem that is now stuck to your hand. Find a Cure Potion to cleanse it for coins."
        this.actionPoints = 1
        this.cursed = true
        // Marker the curse's Deepening Corruption checks to activate the conduit.
        this.isCursedGem = true
        // Tally route activates only after cleansing — see Potion.equip and
        // BaseHero pickup (which gates the tally branch on !cursed so this
        // gem still routes to inventory on pickup).
        this.tallyKey = "coins"
        this._cleanseValue = Phaser.Math.Between(7, 15)
        // Reserve no random tags — the curse is built-in, not a modifier.
        this.tagPolicy = { materials: false, effects: false }
    }

    value() {
        return this._cleanseValue
    }

    turn() {
        const player = dungeon.player
        if(player.items.includes(this)){
            this.active = true
            // Conduit: a curse-attuned holder bleeds harder — the curse feeds on the gem.
            const cursed = player.affinityAdvanced === 'curse'
            const drain = cursed ? CONDUIT_DRAIN : 1
            player.healthPoints -= drain
            gameLog.log(cursed
                ? `The cursed gem gorges on ${player.name} for ${drain} — the curse feeds.`
                : `Cursed gem gives ${drain} damage to player. Find potion to cure.`)
            this.actionPoints = 0
            // Occasionally whisper above the hero (it has no floor sprite once
            // held, so it borrows the hero's bubble with the gem's face).
            if (Math.random() < 0.25) cursedGemWhispers(player, this)
        }

        this.actionPoints = 0
    }

    // §18: picking up a cursed gem may FORCE the Curse affinity (suppressing the
    // hero's basic affinity). Rejected if a real pact already holds the advanced slot.
    onPickup() {
        const hero = dungeon.player
        if (hero?.forceCurse && Math.random() < CURSE_FORCE_CHANCE) {
            hero.forceCurse()
        }
    }

    refresh() {
        this.actionPoints = 1
    }

    over() {
        return this.actionPoints == 0
    }
}
