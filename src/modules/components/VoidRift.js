import Prop from "./Prop.js"
import mapState from "../MapState.js"
import tm from "../TurnManager.js"
import dungeon from "../Dungeon.js"
import fogOfWar from "../FogOfWar.js"
import gameLog from "../GameLog.js"
import { createVoidRiftAura, createCorruptionField, playBurst } from "../Animations.js"
import cursed from "../tags/cursed.js"

// VoidRift — the visible darkness-source at the heart of a void/corrupted
// settlement. A landmark structure (like WarHall / Watchtower) that ALSO
// shrinks its room's fog-of-war light radius, so the hero is half-blind among
// the void band until enemies close. The reusable engine half of the darkness
// theme; the layout that places it lives in spawnSettlement (spawnDarkEncampment).
//
// Three cosmetic + one gameplay behavior dress the rift (all asset-free):
//   - it FLOATS: a gentle bob tween on its sprite,
//   - it crackles: a purple "void aura" (dark ring + flickering bolts) built
//     from Phaser primitives in Animations.createVoidRiftAura,
//   - it CORRUPTS: a hero who steps onto the ring (within auraRadius) takes a
//     temporary Cursed debuff — the same self-expiring curse a cursed weapon
//     applies (5 turns, ~1 dmg/turn), so it wears off once you step away.
//
// claimRoom(room) sets room.lightRadius (the way Tent sets room.restSafe) and
// keeps the room ref so a future light/holy "cleanse" (destroying the rift)
// lifts the dark — onDestroy already restores the room. The radius is a
// constructor param so the SAME component serves both variants: the encampment
// passes a mild value (3) and the void temple / fortress a near-black one (~1).
//
// Reusable for any dark faction (demonic, …), not void-only. See
// documents/v3_darkness_settlements.md.

// tileReference.json regions.dungeonAtmosphere.monsterSkullLarge (736) — a huge
// corruption-totem skull, on-theme with the undead/spirit roster. One constant
// so it's easy to confirm in test.html and swap (cursedGem 524 is an alt).
const TILE_VOID_RIFT = 736

const DEFAULT_DARK_RADIUS = 3

export default class VoidRift extends Prop {
    constructor(x, y, radius = DEFAULT_DARK_RADIUS) {
        super(x, y, TILE_VOID_RIFT, {
            name: "Void Rift",
            description: "A tear of pure dark. The light around it dies.",
            type: "structure",
        })
        this.blocksPath = true
        this.blocksSight = true
        this.radius = radius
        this._room = null
        // Chebyshev distance (in tiles) at which a hero "touches the ring" and
        // is corrupted — the 8 tiles around the rift. The visual aura reaches
        // about one tile out to match.
        this.auraRadius = 1
        this._aura = null
        this._patches = null
        // Phase 4: a respawned rift raises a fresh guardian captain after a few
        // rounds. _guardianTick is the tm.tickCount to spawn at (null = never,
        // e.g. the original rift, which already came with a captain).
        this._guardianTick = null
        this._guardianDone = false
        // Beacon: FogOfWar keeps the rift sprite + aura visible whenever the
        // hero is in its room, so the glowing skull pierces the dark even when
        // it's outside the tiny light cone.
        this.isBeacon = true
        // Destructible: the player can SMASH the rift (a random dungeon skull).
        // HeroController lets attacks land on `destructible` non-enemies; at 0 HP
        // it's removed and onDestroy cleanses the room. A quest/story rift can set
        // destructible = false and require a special interaction instead — the
        // cleanse EFFECT (onDestroy) is the same whatever the trigger.
        this.destructible = true
        this.maxHealthPoints = 40
        this.healthPoints = this.maxHealthPoints
    }

    // No armor — Combat reads victim.protection(damageType) on every hit.
    protection() { return 0 }

    // Darken the room this rift anchors. Called by the settlement layout with
    // the room it already has in hand (no lookup needed at populate time).
    claimRoom(room) {
        if (!room) return
        this._room = room
        room.lightRadius = this.radius
        // Remembered for respawns (survives the rift's destruction, unlike
        // lightRadius/darkSource which clear on cleanse).
        room.darkRadius = this.radius
        // FogOfWar reads this to absorb the hero's light near the rift and to
        // anchor the beacon / cleanse.
        room.darkSource = this
    }

    // The rift is visible whenever the hero is inside its room (a landmark in
    // the gloom), not gated by the moment-to-moment light cone.
    beaconVisible() {
        return !!(dungeon.player && dungeon.player.currentRoom === this._room)
    }

    // Per-frame hook from World.update (mirrors syncStatusFX): lazily build the
    // float + aura once the sprite exists, then fog-gate the aura's visibility.
    syncVoidFX(visible) {
        if (!this.sprite) return
        const scene = this.sprite.scene
        if (!scene) return
        if (!this._aura) {
            const tileSize = mapState.tileSize || 16
            // Anchor the aura at the tile center BEFORE the bob tween moves the
            // sprite (sprites use origin 0, so center is +half a tile).
            const baseY = this.sprite.y
            const cx = this.sprite.x + tileSize / 2
            const cy = baseY + tileSize / 2
            this._aura = createVoidRiftAura(scene, cx, cy)
            // Float: a slow vertical bob around the sprite's resting position.
            // Static props are never repositioned per frame, so nothing fights it.
            scene.tweens.add({
                targets: this.sprite,
                y: baseY - 5,
                duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            })
            // Corruption stains scattered across the room's floor (revealed only
            // by the hero's light, since they sit below the fog overlay).
            this._patches = this._buildCorruptionPatches(scene)
            // Floor teardown destroys the sprite (tm.cleanup) WITHOUT calling
            // onDestroy, so tear the standalone FX graphics down on the sprite's
            // own destroy event too — covers both cleanse and floor-change.
            this.sprite.once('destroy', () => this._teardownFX())
        }
        // The aura is the beacon glow — show it whenever the hero is in the
        // room (matches the sprite), not just inside the light cone.
        if (this._aura) this._aura.setVisible(this.beaconVisible())

        // Phase 4: once the scheduled round arrives, raise the guardian captain.
        // Checked here (per frame) against tm.tickCount; fires once.
        if (this._guardianTick != null && !this._guardianDone && tm.tickCount >= this._guardianTick) {
            this._guardianDone = true
            this._raiseGuardian()
        }
    }

    // A respawned rift calls this to raise a fresh captain `delayRounds` rounds
    // after it erupts (the room owns the spawner closure — see spawnSettlement).
    scheduleGuardian(delayRounds) {
        this._guardianTick = tm.tickCount + delayRounds
        this._guardianDone = false
    }

    _raiseGuardian() {
        const room = this._room
        if (!room || typeof room.spawnGuardianCaptain !== "function") return
        const spot = this._freeTileNear() || { x: this.x, y: this.y }
        room.spawnGuardianCaptain(spot.x, spot.y)
    }

    // First walkable, unoccupied tile around the rift (the rift blocks its own).
    _freeTileNear() {
        const offsets = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]
        for (const [dx, dy] of offsets) {
            const nx = this.x + dx
            const ny = this.y + dy
            if (mapState.isWalkableTile(nx, ny)) return { x: nx, y: ny }
        }
        return null
    }

    // Scatter corruption stains over floor tiles in the rift's room. World-space
    // tile centers, ~10% of the room's tiles, skipping non-floor and the rift's
    // own tile. Built once when the FX initialize.
    _buildCorruptionPatches(scene) {
        const room = this._room
        const map = mapState.map
        const level = mapState.level
        if (!room || !map || !level) return null
        const ts = mapState.tileSize || 16
        const count = Math.max(4, Math.min(16, Math.round(room.w * room.h * 0.10)))
        const points = []
        for (let i = 0; i < count; i++) {
            const tx = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2))
            const ty = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2))
            if (!(level[ty] && level[ty][tx] === 0)) continue // floor tiles only
            if (tx === this.x && ty === this.y) continue       // not under the rift
            points.push({ x: map.tileToWorldX(tx) + ts / 2, y: map.tileToWorldY(ty) + ts / 2 })
        }
        return createCorruptionField(scene, points)
    }

    // Interact path: stand adjacent and press F to shatter the rift. Gives a
    // visible affordance (World draws the prompt over the current interact
    // target) and a reliable, weapon-independent trigger — the player doesn't
    // have to melee-bump through the guarding band. removeEntity fires onDestroy,
    // the shared cleanse. (Quest/story rifts can swap this for an item-gated
    // interaction; the cleanse effect is the same.)
    interactPrompt() {
        return "[F] Shatter the void rift"
    }

    onInteract() {
        dungeon.removeEntity(this)
    }

    // A hero who steps onto the ring is corrupted. addTag is a no-op if the
    // hero is already Cursed, so standing in the ring re-curses only after the
    // previous curse wears off — a few turns of chip damage, then it lifts.
    onHeroNear(hero) {
        if (!hero) return
        if (hero._tags && hero._tags.includes("Cursed")) return
        hero.addTag(cursed)
        gameLog.log(`The void rift's corruption seeps into ${hero.name}.`)
    }

    // Cleanse / destruction lifts the dark. Only fires via dungeon.removeEntity
    // (the rift being smashed), NOT on floor teardown (tm.cleanup skips
    // onDestroy), so the re-light + payoff here are safe to run.
    onDestroy() {
        if (this._room) {
            if (this._room.lightRadius === this.radius) this._room.lightRadius = null
            if (this._room.darkSource === this) this._room.darkSource = null
        }
        this._room = null
        // Drop the room's darkness mask and re-light from the hero's tile so the
        // cleansed room floods back to normal sight immediately. The void band is
        // also de-powered now that darkSource is gone (voidEmpowered reads it).
        fogOfWar.invalidateDarkMask()
        if (dungeon.player) fogOfWar.update(dungeon.player)
        gameLog.log("The void rift shatters — the darkness lifts.")
        playBurst(this.x, this.y, { radius: 2, color: 0xa855f7 })
        this._teardownFX()
    }

    _teardownFX() {
        if (this._aura) { this._aura.destroy(); this._aura = null }
        if (this._patches) { this._patches.destroy(); this._patches = null }
    }
}
