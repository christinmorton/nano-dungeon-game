import GenericItem from "./GenericItem.js"
import mapState from "../MapState.js"

// Generic worn armor / off-hand defense. Shields and helmets are the
// two starting cases; cuirasses, crowns and the legendary accessories ride
// here too. Same profile pattern as the weapon classes.
//
// Profile shape:
//   itemClass: 'Armor'
//   name, description, tile, tint?
//   slot                 — required; 'offhand' / 'head' / 'body' / 'accessory'
//   protection           — flat damage-reduction value returned by
//                          protection(); routed to 'armor' via
//                          GenericItem.statContribution default.
//   statContribution     — additional per-stat contributions (e.g. a shield's
//                          +1 block on top of its +1 armor). Any stat key the
//                          hero's reducer reads, including the §10.17 ones it
//                          defaults to 0: thorns, fortune, sight, lastBreath.
//   statPerFloor         — DYNAMIC (§10.17): per-stat bonus × the current floor
//                          index (the Descent Pendant grows with the descent).
//   statWhenBloodied     — DYNAMIC (§10.17): per-stat bonus while the OWNER is
//                          under half HP (the Berserker's Charm). `owner` is set
//                          by HeroInventory on equip and cleared on unequip.
//
// mapState is read at CALL time only — this file is reached from the item
// registry inside the Dungeon/MapState cycle, and a module-scope read would be
// the TDZ trap this codebase keeps hitting.

export default class Armor extends GenericItem {
    constructor(x, y, profile) {
        super(x, y, profile.tile, profile.tint, profile.art)
        this.profile = profile
        this.name = profile.name
        this.description = profile.description
        this.slot = profile.slot
        if (profile.legendary) this.legendary = true
        if (profile.special) this.special = profile.special
    }

    protection() {
        return this.profile.protection ?? 0
    }

    statContribution(name) {
        const p = this.profile
        let total = p.statContribution?.[name] ?? 0
        if (p.statPerFloor?.[name]) {
            const floor = mapState.levelManager?.currentLevel ?? 0
            total += p.statPerFloor[name] * floor
        }
        if (p.statWhenBloodied?.[name] && this.owner) {
            const hp = this.owner.healthPoints ?? 0
            const max = this.owner.maxHealthPoints ?? 1
            if (hp > 0 && hp / max < 0.5) total += p.statWhenBloodied[name]
        }
        // super.statContribution routes 'armor' -> this.protection(),
        // so we don't need to special-case it here.
        return total + super.statContribution(name)
    }
}
