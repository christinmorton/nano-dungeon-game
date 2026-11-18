import tm from "../TurnManager.js"
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import { resolveArt } from "../assetLoader.js"
import {
    registerHazardTile,
    unregisterHazardTile,
    detonate,
    footprintTiles,
    affectsEntity,
} from "./Hazards.js"
import ZoneEffect from "./ZoneEffect.js"
import { TRAP_DEFS } from "./trapDefs.js"

// Trap — a tile hazard placed by the dungeon generator (known-issues #47.2),
// hazardous to the player AND any wandering actor. Built on the shared hazard
// primitive: triggers on step via the Hazards tile registry (the same seam
// throwables use), detonating + optionally spawning a ZoneEffect.
//
// Like ZoneEffect, a Trap carries NO `.sprite` — only a `this.decal` floor
// graphic shown once revealed. That keeps it invisible to WorldQueries.entityAtTile
// so actors STEP ONTO the trap tile (and trigger it) instead of being blocked /
// treated as a bump target. It still lives in tm.entities so it receives the
// onHeroNear detection hook and is findable by the interact scan (both check
// tm.entities by tile, not by sprite) for the disarm prompt.
//
// Lifecycle:
//   - hidden + armed at spawn (registered in the Hazards tile registry)
//   - onHeroNear: a proximity roll may REVEAL it (decal appears) so an attentive
//     player can route around it
//   - onEnter (stepped on): TRIGGER — detonate + zone. A HERO trip also REVEALS
//     the decal and (if single-fire) spends it. An ENEMY trip fires the effect
//     but leaves the trap HIDDEN and ARMED — the player only learns a trap is
//     there by springing it (or spotting it via onHeroNear), and stays
//     susceptible to it even after enemies have set it off.
//   - onInteract (F, adjacent, once revealed): DISARM
//
// Slice 1 scope: damage/status/zone traps. No cross-revisit persistence (skipped
// in FloorMemory). Special traps (alarm/teleport/pit) + deployables are later.

// Detection is a partial safety net, not a guarantee — stepping onto an
// unspotted trap should be a real risk. Only roll when the hero ends a move
// ADJACENT to the trap (chebyshev 1, incl. diagonals), at a modest chance, so a
// careful player spots some but not all. (Future: gate/scale this on a
// perception stat — ties to the perception system, per known-issues #47.2.)
const DETECT_RADIUS = 1
const DETECT_CHANCE = 0.25

export default class Trap {
    constructor(x, y, defKey) {
        this.type = "trap"
        this.x = x
        this.y = y
        this.defKey = defKey
        this.def = TRAP_DEFS[defKey]
        this.name = this.def?.name ?? "Trap"
        this.art = this.def?.art ?? null
        this.repeat = !!this.def?.repeat
        this.armed = true
        this.revealed = false
        this.sprung = false
        this.decal = null
        // Detection range is read by moveEntityTo's onHeroNear loop as auraRadius.
        this.auraRadius = DETECT_RADIUS

        registerHazardTile(x, y, this)
        tm.addEntity(this)
    }

    // Show the trap art as a floor decal (NOT this.sprite — see class note).
    //
    // `revealed` is set LAST, only once a decal actually exists. It used to be
    // set on the first line, before the scene/art guards below — which meant a
    // trap whose art failed to resolve was permanently flagged revealed with
    // nothing drawn, and could never redraw. That state also made the disarm
    // prompt appear for a trap the player cannot see. Keeping the flag honest
    // ("revealed" means "there is a decal on the floor") costs nothing and makes
    // a future art failure degrade into a retry rather than a dead trap.
    _reveal() {
        if (this.revealed) return
        const scene = dungeon.scene
        if (!scene || this.decal) return
        const art = resolveArt(this.art)
        if (!art || !scene.textures.exists(art.key)) {
            // Loud on purpose: the whole trap roster was invisible for the entire
            // port because this path returned in silence. See data/assetSheets.js.
            console.warn(`Trap: no art for '${this.name}' (sheet '${this.art?.sheet}') — trap stays invisible`)
            return
        }
        const wx = mapState.map.tileToWorldX(this.x)
        const wy = mapState.map.tileToWorldY(this.y)
        this.decal = art.isImage
            ? scene.add.sprite(wx, wy, art.key)
            : scene.add.sprite(wx, wy, art.key, art.frame)
        this.decal.setOrigin(0).setDepth(7)   // on the floor, below actors (10)
        this.decal.setScale(mapState.tileSize / art.nativeSize)
        this.revealed = true
    }

    // Detection — the hero ended a move within auraRadius (moveEntityTo's loop).
    onHeroNear(hero) {
        if (this.revealed || !this.armed) return
        if (Math.random() < DETECT_CHANCE) {
            this._reveal()
            gameLog.log(`${hero.name} spots a hidden ${this.name}.`)
        }
    }

    // Stepped onto — fired by Hazards.triggerHazardsAt for any arriving entity.
    onEnter(entity) {
        if (!this.armed) return
        if (!affectsEntity(entity, "all")) return
        this._trigger(entity)
    }

    _trigger(entity) {
        const isHero = entity.type === "hero"
        // Only the hero springing the trap reveals it. An enemy trip fires the
        // effect but leaves the trap hidden, so the player can't read enemy
        // movement to map every trap — the dungeon stays dangerous to the hero.
        if (isHero) this._reveal()
        const def = this.def
        if (!def) return

        // Instant burst at the trap tile (radius 0 = just this tile).
        if (def.damage != null || def.status != null) {
            detonate(this.x, this.y, {
                radius: def.aoeRadius ?? 0,
                damage: def.damage ?? null,
                damageFlavor: def.damageFlavor ?? "physical",
                statuses: def.status ?? null,
                affects: "all",
                color: def.color,
            })
        }

        // Lingering ground effect (flame patch, gas cloud, …).
        if (def.zone) {
            const radius = def.zone.radius ?? def.aoeRadius ?? 1
            new ZoneEffect(footprintTiles(this.x, this.y, radius), {
                kind: def.zone.type,
                duration: def.zone.duration,
                onEnter: def.zone.onEnter,
                onTick: def.zone.onTick,
            })
        }

        if (isHero) {
            gameLog.log(`${entity.name} triggers a ${this.name}!`)
        } else {
            // Don't name/locate the trap on an enemy trip — the player sees the
            // enemy get hurt but the trap itself stays a mystery.
            gameLog.log(`The ${entity.name} sets off a hidden trap!`)
        }

        this.sprung = true
        // Only a HERO trip spends a single-fire trap. Enemy trips never consume
        // it, so the hero stays susceptible even after enemies set it off.
        // (Repeat-fire traps stay armed for everyone, as before.)
        if (isHero && !this.repeat) this._spend()
    }

    // Disarm prompt — only a revealed, still-armed trap can be disarmed.
    interactPrompt() {
        if (!this.revealed || !this.armed) return null
        return `[F] Disarm ${this.name}`
    }

    onInteract(hero) {
        if (!this.armed) return
        gameLog.log(`${hero.name} disarms the ${this.name}.`)
        if (this.decal) this.decal.setAlpha(0.4)   // visibly defused
        this._spend()
    }

    // Disarm the trap: unregister from the on-step registry and leave tm so it
    // stops receiving hooks. The decal (if any) stays as a spent/defused marker;
    // scene.restart tears it down on floor change.
    _spend() {
        this.armed = false
        unregisterHazardTile(this.x, this.y, this)
        tm.removeEntity(this)
    }

    // tm contract — all reactive work happens in the hooks above.
    refresh() {}
    turn() {}
    over() { return true }
    onDestroy() {}
}
