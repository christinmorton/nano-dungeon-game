import Prop from "./Prop.js"
import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import audio from "../Audio.js"
import { playBurst } from "../Animations.js"
import { getRandomEnemyOfTypes } from "../Enemies.js"

// The Corrupted Skull — the Dark Priest's power source (scope doc §10.18).
//
// A destructible prop that spawns beside a priest. While it stands:
//   - the priest's move cooldowns tick twice a round and it re-raises a barrier
//     on itself (tags/darkPriestCaster.js reads `priest._skull`);
//   - every RAISE_EVERY rounds it raises a THRALL — a Skeleton from the roster,
//     depth-scaled like any spawn, leashed to this room (Dungeon.stepEntityTo
//     refuses a step outside `leashRoom`) — up to MAX_THRALLS alive at once.
// Destroy it and the boosts stop; the thralls already raised stay. Kill the
// priest and the skull crumbles on its own.
//
// It rides Prop (type "decor", blocksPath) so bump-to-move stops at it and
// enemies path around it, and declares `destructible`, which is the flag
// HeroController's click and bump paths already route to dungeon.attackEntity.
// Combat then treats it as any victim: it needs healthPoints, protection(),
// and survives having dodge/block/stat asked of it. removeEntity on death takes
// the non-enemy branch (plain teardown, then onDestroy).
//
// Art: the owned 32rogues skull-mosaic tile, tinted the corrupted violet the
// stronghold themes use, so it reads as the same family of thing.

const RAISE_EVERY = 4
const MAX_THRALLS = 3
const THRALL_SPECIES = ["Skeleton"]
const VOID_TINT = 0x9b6bd0

export default class CorruptedSkull extends Prop {
    constructor(x, y, { priest = null, room = null, floor = 0 } = {}) {
        super(x, y, {
            name: "Corrupted Skull",
            art: { sheet: "32rogues-tiles", name: "catacombsSkullWallTop" },
            walkable: false,
        })
        this.tint = VOID_TINT
        if (this.sprite) { this.sprite.tint = VOID_TINT; this.sprite.tintFill = false }
        this.priest = priest
        this.room = room
        this.floor = floor
        this.destructible = true
        // Scales with depth like the things around it. Max first, current derived.
        this.maxHealthPoints = 40 + 20 * floor
        this.healthPoints = this.maxHealthPoints
        this._roundsToRaise = RAISE_EVERY
        this._thralls = []
        this._describe()
    }

    // --- what Combat asks of a victim ---------------------------------------
    protection() { return 0 }
    dodgeChance() { return 0 }
    blockChance() { return 0 }
    stat() { return 0 }
    onDamaged() { this._describe() }

    _describe() {
        this.description = `A skull pulsing with void-light. It feeds the Dark Priest. HP ${Math.max(0, this.healthPoints)}/${this.maxHealthPoints}.`
    }

    // --- the round tick ----------------------------------------------------
    // TurnManager.refresh() calls refresh() on every entity at the start of a
    // round, props included — the Prop base inherits GenericItem's no-op.
    refresh() {
        if (!this.sprite) return
        const priest = this.priest
        if (!priest || !priest.sprite || priest.healthPoints <= 0) {
            this._crumble("The corrupted skull crumbles to dust with its master.")
            return
        }
        // Only while the priest is actually fighting — a skull in a room the
        // player has not reached must not fill it with thralls in the meantime.
        if (typeof priest.isEngaged === "function" && !priest.isEngaged()) return

        this._thralls = this._thralls.filter(t => t.sprite && t.healthPoints > 0)
        if (this._thralls.length >= MAX_THRALLS) return
        this._roundsToRaise -= 1
        if (this._roundsToRaise > 0) return
        this._roundsToRaise = RAISE_EVERY
        this._raiseThrall()
    }

    _raiseThrall() {
        const tile = this._freeTileNear(2)
        if (!tile) return
        const thrall = getRandomEnemyOfTypes(THRALL_SPECIES, tile.x, tile.y, this.floor)
        if (!thrall) return
        thrall.name = `Thrall ${thrall.name}`
        thrall.leashRoom = this.room
        thrall._thrall = true
        thrall.tint = VOID_TINT
        if (thrall.sprite) { thrall.sprite.tint = VOID_TINT; thrall.sprite.tintFill = false }
        // Raised INTO a fight: awake and hostile from the first round rather than
        // waiting for its perception to trip on something it was born next to.
        thrall.stance = "aggressive"
        thrall.applyStance?.()
        thrall.alerted = true
        tm.addEntity(thrall)
        this._thralls.push(thrall)
        playBurst(tile.x, tile.y, { radius: 1, color: VOID_TINT })
        audio.play('ui-skill')
        gameLog.log(`The corrupted skull drags a ${thrall.name.toLowerCase()} up through the floor!`)
    }

    // A free floor tile within `radius` of the skull, inside its room when it
    // has one. Rings outward so a thrall rises beside the skull, not across it.
    _freeTileNear(radius) {
        for (let r = 1; r <= radius; r++) {
            const ring = []
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
                    const x = this.x + dx, y = this.y + dy
                    if (!mapState.isWalkableTile(x, y) || mapState.entityAtTile(x, y)) continue
                    if (this.room && !this.room.contains(x, y)) continue
                    ring.push({ x, y })
                }
            }
            if (ring.length) return ring[Math.floor(Math.random() * ring.length)]
        }
        return null
    }

    _crumble(message) {
        gameLog.log(message)
        dungeon.removeEntity(this)
    }

    // Destroyed by the player (Combat → removeEntity → here), or crumbled.
    onDestroy() {
        if (this.priest) {
            if (this.priest._skull === this) this.priest._skull = null
            if (this.priest.sprite && this.priest.healthPoints > 0) {
                gameLog.log(`The corrupted skull shatters — the ${this.priest.name}'s power gutters.`)
            }
        }
        audio.play('ui-error')
        playBurst(this.x, this.y, { radius: 1.5, color: VOID_TINT })
    }
}
