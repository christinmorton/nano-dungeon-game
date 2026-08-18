import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import VoidRift from "../components/VoidRift.js"
import voidEmpowered from "../tags/voidEmpowered.js"
import { createChannelAura } from "../Animations.js"

// Void captain channel → rift respawn loop. A void-settlement captain whose rift
// has been destroyed abandons command and channels a new one into being: it
// holds position for CHANNEL_ROUNDS while a void aura swells around it ("becoming
// the skull"). Completing it SACRIFICES the captain and erupts a new, stronger
// rift at its tile. Killing the captain mid-channel interrupts the loop (its turn
// simply stops ticking; the aura tears down on the sprite's destroy event).
//
// Called once per captain turn from archetypes/captain.js. Returns true when the
// captain is channeling (so it consumes the turn). The escalation budget lives on
// the room (darkRespawnsLeft / darkRespawnsInfinite / darkTier), seeded in
// spawnSettlement.spawnDarkEncampment. See documents/v3_darkness_settlements.md.

const CHANNEL_ROUNDS = 5
// Rounds after a rift respawns before it raises a fresh guardian captain — a
// window where the player can destroy the new rift before its protector arrives.
const GUARDIAN_DELAY = 3

function canRespawn(room) {
    return room.darkRespawnsInfinite || (room.darkRespawnsLeft || 0) > 0
}

export function updateVoidChannel(captain) {
    const room = captain.homeRoom
    const eligible = captain.voidChanneler && room && room.darkFaction
        && !room.darkSource && canRespawn(room)

    if (!captain._channeling) {
        if (!eligible) return false
        startChannel(captain)
    }

    // One round of channeling. The captain is committed: no moving, no commands.
    captain._channelRounds += 1
    const progress = Math.min(1, captain._channelRounds / CHANNEL_ROUNDS)
    if (captain._channelAura) captain._channelAura.setProgress(progress)
    captain.movementPoints = 0
    captain.actionPoints = 0

    if (captain._channelRounds >= CHANNEL_ROUNDS) completeChannel(captain)
    return true
}

function startChannel(captain) {
    captain._channeling = true
    captain._channelRounds = 0
    const scene = captain.sprite && captain.sprite.scene
    if (scene) {
        const ts = mapState.tileSize || 16
        const cx = captain.sprite.x + ts / 2
        const cy = captain.sprite.y + ts / 2
        captain._channelAura = createChannelAura(scene, cx, cy)
        // Interrupt: a captain killed mid-channel tears its aura down via the
        // sprite's destroy event (completeChannel/onDestroy never run).
        captain.sprite.once('destroy', () => {
            if (captain._channelAura) { captain._channelAura.destroy(); captain._channelAura = null }
        })
    }
    gameLog.log(`The ${captain.name} begins channeling the void!`)
}

function completeChannel(captain) {
    const room = captain.homeRoom
    if (captain._channelAura) { captain._channelAura.destroy(); captain._channelAura = null }
    captain._channeling = false

    const x = captain.x
    const y = captain.y

    // Consume a respawn + escalate the tier (read live by voidEmpowered).
    if (!room.darkRespawnsInfinite) room.darkRespawnsLeft = (room.darkRespawnsLeft || 0) - 1
    room.darkTier = (room.darkTier || 0) + 1

    gameLog.log(`The ${captain.name} sacrifices itself — a new void rift erupts!`)
    // Mark it a sacrifice so Captain.onDestroy skips the allies-flee/enrage
    // death outcome (the captain wasn't slain). Then remove it (frees the tile).
    captain._sacrificed = true
    dungeon.removeEntity(captain)

    const rift = new VoidRift(x, y, room.darkRadius || 3)
    tm.addEntity(rift)
    rift.claimRoom(room)
    // The new rift raises its own guardian captain a few rounds from now.
    rift.scheduleGuardian(GUARDIAN_DELAY)

    // Re-empower the surviving band — they dropped the tag when the old rift
    // died; re-adding it picks up the now-higher tier scaling automatically.
    for (const e of tm.entities) {
        if (e.type === "enemy" && e.homeRoom === room) e.addTag(voidEmpowered)
    }
}
