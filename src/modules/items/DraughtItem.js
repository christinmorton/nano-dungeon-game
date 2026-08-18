import GenericItem from "./GenericItem.js"
import gameLog from "../GameLog.js"
import { playCast } from "../Animations.js"
import { getStatusTemplate } from "../tags/Status.js"

// DraughtItem — utility flasks / draughts (§10b, known-issues #47 item 8). On
// use, applies a TIMED BUFF (profile.buff -> a status tag whose own hooks own
// the duration + effect + auto-expiry) or a CURE (profile.cure -> remove the
// listed negative statuses if present).
//
// The "timed-buff layer" is just the existing status system: Might / Haste /
// Invisible / Bulwark are already complete timed buffs (used by class abilities),
// so a draught is a self-cast of the same status — BaseHero.stat() already folds
// tag statContribution into the hero's stats, and each status auto-expires in its
// own refresh() hook. Stoneskin maps to Bulwark (working +block) rather than
// Shield, which is still a stub (no damage-absorption hook yet — see tags/shield.js).
//
// Unslotted (slot = null) -> HeroInventory.toggleAt fires equip(index, hero),
// the same path potions and scrolls use.

export default class DraughtItem extends GenericItem {
    constructor(x, y, profile) {
        super(x, y, profile.tile ?? 670, profile.tint, profile.art)
        this.profile = profile
        this.name = profile.name
        this.description = profile.description
        this.slot = null
        this.category = "Draught"
    }

    equip(itemNumber, player) {
        const profile = this.profile
        playCast(player, {
            type: "arcane",
            onComplete: () => {
                if (profile.buff) this._applyBuff(player, profile.buff)
                else if (profile.cure) this._cure(player, profile.cure)
                player.removeItem(itemNumber)
                player.hud?.refresh()
            },
        })
    }

    _applyBuff(player, buffName) {
        const template = getStatusTemplate(buffName)
        if (!template) {
            gameLog.log(`${this.name} fizzles — unknown effect "${buffName}".`)
            return
        }
        // The status's initialize() logs its own "gains X" line and owns its
        // duration. addTag dedupes by name, so re-drinking won't stack (it
        // simply has no extra effect while the buff is already active).
        player.addTag(template)
    }

    _cure(player, names) {
        const removed = []
        for (const name of names) {
            const template = getStatusTemplate(name)
            if (template && player._tags?.includes(name)) {
                player.removeTag(template)   // fires the status cleanup hook
                removed.push(name)
            }
        }
        gameLog.log(removed.length
            ? `${player.name} is cured of ${removed.join(", ")}.`
            : `${player.name} drinks the ${this.name}, but there's nothing to cure.`)
    }
}
