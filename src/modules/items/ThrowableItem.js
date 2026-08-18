import GenericItem from "./GenericItem.js"
import gameLog from "../GameLog.js"
import { playProjectile } from "../Animations.js"
import { detonate, footprintTiles } from "../hazards/Hazards.js"
import ZoneEffect from "../hazards/ZoneEffect.js"

// ThrowableItem — thrown-at-a-tile AoE consumable (Alchemist's Fire, Frost
// Flask, Oil Flask, Smoke Bomb, …). Consumes the profile data shipped in
// items/profiles/throwables.js (throwRange / aoeRadius / damage / damageFlavor /
// status / zone). Replaces the generic Consumable placeholder for
// itemClass: 'Throwable'. See documents/v3_known_issues.md #47.
//
// Flow mirrors Scroll of Blink: an unslotted item, so HeroInventory.toggleAt
// fires equip(index, hero). equip() enters pickTile targeting at throwRange; the
// click resolves through HeroController.resolveTargetedClick -> callback({tile}),
// which throws (projectile), detonates the footprint (instant damage + status),
// and drops a lingering ZoneEffect if the profile declares a `zone`.

// Burst tint by damage flavor — purely cosmetic feedback on impact.
const FLAVOR_COLOR = {
    fire: 0xff6b2b,
    ice: 0x6ab8ff,
    holy: 0xffe08a,
    curse: 0x9b59d0,
    lightning: 0x7fdbff,
}

export default class ThrowableItem extends GenericItem {
    constructor(x, y, profile) {
        super(x, y, profile.tile ?? 670, profile.tint, profile.art)
        this.profile = profile
        this.name = profile.name
        this.description = profile.description
        this.slot = null            // unslotted -> toggleAt fires equip(index, hero)
        this.category = "Throwable"
    }

    equip(itemNumber, player) {
        const range = this.profile.throwRange ?? 4
        const radius = this.profile.aoeRadius ?? 1
        // aoeTile (shared skillshot mode) shows the blast footprint preview and
        // lets the player aim directly onto an enemy's tile. The detonate in
        // _impact still resolves the full footprint, so behavior is unchanged
        // apart from the preview + being able to click an occupied center.
        player.controller.targeting = {
            type: "aoeTile",
            range,
            radius,
            callback: ({ tile }) => this._throwAt(player, itemNumber, tile.x, tile.y),
        }
        // Drop the toggle's active state so re-pressing the digit re-enters
        // targeting cleanly (matches ScrollOfBlink).
        this.active = false
        gameLog.log(`Throw ${this.name}: click a target area within ${range} (blast ${radius}). Escape to cancel.`)
    }

    _throwAt(player, itemNumber, x, y) {
        // Use the flask's own potion frame as the flying projectile sprite.
        const projectile = { attackTile: this.profile.tile ?? 670, tint: this.profile.tint }
        playProjectile(player, { x, y }, projectile, {
            onComplete: () => this._impact(x, y),
        })
        gameLog.log(`${player.name} hurls ${this.name}.`)
        // Consume on throw (it's airborne; the click already committed it).
        if (typeof itemNumber === "number") player.removeItem(itemNumber)
    }

    _impact(x, y) {
        const profile = this.profile
        const radius = profile.aoeRadius ?? 1
        const color = FLAVOR_COLOR[profile.damageFlavor] ?? 0xffe6a8

        // Instant burst: damage + immediate statuses across the footprint.
        detonate(x, y, {
            radius,
            damage: profile.damage ?? null,
            damageFlavor: profile.damageFlavor ?? "physical",
            statuses: profile.status ?? null,
            color,
        })

        // Lingering ground effect, if the profile declares one. A fire patch
        // also burns over time, so fire zones inherit the impact status as
        // their onEnter/onTick rider; oil/smoke/gas/web/caltrops carry their own.
        const zone = profile.zone
        if (zone) {
            const fireRider = zone.type === "fire" ? profile.status : null
            new ZoneEffect(footprintTiles(x, y, radius), {
                kind: zone.type,
                duration: zone.duration,
                onEnter: zone.onEnter ?? zone.applies ?? fireRider,
                onTick: zone.onTick ?? fireRider,
            })
        }
    }
}
