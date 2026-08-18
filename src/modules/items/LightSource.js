import GenericItem from "./GenericItem.js"
import gameLog from "../GameLog.js"

// A held light source (torch / lantern / beacon). Occupies the OFFHAND slot —
// light OR a shield, not both (the roguelike tradeoff). While equipped and
// burning it raises the hero's effective sight radius (FogOfWar._radiusFor),
// pushing back a dark room's shrunk light cone.
//
// Profile shape (items/profiles/torch.js):
//   itemClass: 'LightSource'
//   name, description, tile, tint?, art?
//   slot          — defaults to 'offhand'
//   lightBonus    — tiles added to the effective sight radius while lit
//   duration      — turns it burns; null = steady (no burn-down, e.g. a lantern)
//   consumable    — true → removed from the slot when it burns out
//
// Burn-down: BaseHero.refresh() calls burn(turnsGranted, hero) each hero turn.

export default class LightSource extends GenericItem {
    constructor(x, y, profile) {
        super(x, y, profile.tile, profile.tint, profile.art)
        this.profile = profile
        this.name = profile.name
        this.description = profile.description
        this.slot = profile.slot ?? 'offhand'
        this.isLightSource = true
        this.lightBonus = profile.lightBonus ?? 0
        this.consumable = profile.consumable ?? false
        this.duration = profile.duration ?? null
        // null duration = steady light (lantern); otherwise it burns down.
        this.burnsLeft = this.duration ?? Infinity
    }

    // Light contributed right now — zero once burned out.
    currentLight() {
        return this.burnsLeft > 0 ? this.lightBonus : 0
    }

    // Burn down by `turns` (the hero turns granted this refresh). Extinguishes
    // at zero; a consumable light is removed from the offhand slot when spent.
    burn(turns, hero) {
        if (this.burnsLeft === Infinity || this.burnsLeft <= 0) return
        this.burnsLeft -= (turns || 1)
        if (this.burnsLeft <= 0) {
            this.burnsLeft = 0
            gameLog.log(`${hero?.name ?? 'The hero'}'s ${this.name} goes out.`)
            if (this.consumable && hero?.inventory?.equippedSlots) {
                hero.inventory.equippedSlots.offhand = null
                hero.hud?.refresh()
            }
        }
    }
}
