import { defineStatus } from "./Status.js"

// Void-Empowered — void band members draw strength from their rift: the closer
// they are to the darkness source, the more their attack and defense swell.
// Not a timed buff but a permanent membership trait that simply scales to ZERO
// when the bearer is far from the rift — or when the rift is destroyed/cleansed
// (homeRoom.darkSource clears), so cleansing the rift also de-powers its guards.
//
// Read LIVE in statContribution (BaseEnemy.stat resolves every read), so the
// bonus tracks the enemy's position tile-by-tile with no per-turn bookkeeping.
// Applied to the band in spawnSettlement.spawnDarkEncampment; relies on
// homeRoom.darkSource, set by VoidRift.claimRoom.
// See documents/v3_darkness_settlements.md.

const EMPOWER_RANGE = 6 // chebyshev tiles of the rift's influence
const ATTACK_MAX = 4    // bonus attackPower at the rift's foot
const BLOCK_MAX = 2     // bonus block at the rift's foot
const TIER_SCALE = 0.5  // +50% to the bonus per escalation tier (room.darkTier)

function empowerBonus(entity, max) {
    const room = entity.homeRoom
    const rift = room && room.darkSource
    if (!rift) return 0
    const dist = Math.max(Math.abs(rift.x - entity.x), Math.abs(rift.y - entity.y))
    if (dist >= EMPOWER_RANGE) return 0
    // Linear falloff (full at the rift, zero at the edge), scaled up by the
    // room's escalation tier — each respawn makes the band hit harder.
    const tierMult = 1 + (room.darkTier || 0) * TIER_SCALE
    return Math.round(max * (1 - dist / EMPOWER_RANGE) * tierMult)
}

const voidEmpowered = defineStatus({
    name: "Void-Empowered",
    category: "buff",
    valence: "positive",
    icon: null,
    refresh: function (baseResult) {
        // The rift is the source of this power. Once it's destroyed / cleansed
        // (homeRoom.darkSource clears), the empowerment is over — drop the tag so
        // the bonus AND its badge (the green dot) go away, not just the stat math.
        if (!(this.homeRoom && this.homeRoom.darkSource)) {
            this.removeTag(voidEmpowered)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'attackPower') return (running || 0) + empowerBonus(this, ATTACK_MAX)
        if (name === 'block') return (running || 0) + empowerBonus(this, BLOCK_MAX)
        return running
    }
})

export default voidEmpowered
