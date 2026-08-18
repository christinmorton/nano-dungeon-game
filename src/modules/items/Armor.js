import GenericItem from "./GenericItem.js"

// Generic worn armor / off-hand defense. Shields and helmets are the
// two starting cases; future cuirasses, boots, gloves slot in here too.
// Same profile pattern as the weapon classes.
//
// Profile shape:
//   itemClass: 'Armor'
//   name, description, tile, tint?
//   slot                 — required; 'offhand' / 'head' / 'body' / etc.
//   protection           — flat damage-reduction value returned by
//                          protection(); routed to 'armor' via
//                          GenericItem.statContribution default.
//   statContribution     — additional per-stat contributions (e.g.
//                          a shield's +1 block on top of its +1 armor).

export default class Armor extends GenericItem {
    constructor(x, y, profile) {
        super(x, y, profile.tile, profile.tint, profile.art)
        this.profile = profile
        this.name = profile.name
        this.description = profile.description
        this.slot = profile.slot
    }

    protection() {
        return this.profile.protection ?? 0
    }

    statContribution(name) {
        const fromProfile = this.profile.statContribution?.[name] ?? 0
        // super.statContribution routes 'armor' -> this.protection(),
        // so we don't need to special-case it here.
        return fromProfile + super.statContribution(name)
    }
}
