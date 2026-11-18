import Phaser from 'phaser'
import Amulet from "./items/Amulet.js"
import mapState from "./MapState.js"
import tm from "./TurnManager.js"

// The dungeon win condition. On the last floor, spawn the Amulet in the goal room
// and win when it is collected.
//
// v3 generalized this: an authored run could carry a `goal` config on
// mapState.authoredGoal, letting the Dungeon Designer pick any Atlas sprite or any
// real item as the win object, with the Amulet as fallback. v5 cuts the designer,
// and with it the block in MapState.start that ever SET authoredGoal - so every
// branch of that resolver landed on the Amulet anyway. The branching and GoalItem
// are dropped rather than left as unreachable code.
//
// Note on goalRoom's first check: v3 carried a real bug here, where it looked for
// a room of kind "goal" that AuthoredLevel never assigned, so the designer's Goal
// marking never reached the game. v5 has no authored levels and BSPLevel does not
// stamp that kind either, so the lookup simply misses and the furthest-from-start
// rule below - which is the behaviour you actually want - always applies.

const centerOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

// The room the goal item spawns in: the room furthest from the start (so the win
// isn't underfoot), else any non-start room.
function goalRoom() {
    const rooms = mapState.rooms || []
    if (!rooms.length) return null
    const explicit = rooms.find(r => r.kind === "goal")
    if (explicit) return explicit

    const start = rooms.find(r => r.kind === "starting")
    const nonStart = rooms.filter(r => r.kind !== "starting")
    if (start && nonStart.length) {
        const sc = centerOf(start)
        return nonStart.reduce((best, r) =>
            dist2(centerOf(r), sc) > best.d ? { r, d: dist2(centerOf(r), sc) } : best,
            { r: nonStart[0], d: -1 }).r
    }
    return Phaser.Utils.Array.GetRandom(nonStart.length ? nonStart : rooms)
}

function addGoal() {
    const lm = mapState.levelManager
    if (lm.currentLevel !== lm.levels.length - 1) return   // goal lives on the last floor
    const room = goalRoom()
    if (!room) return
    // A FREE tile, not merely floor: this runs after populate, and the room
    // picker reads only the passability grid, so the Amulet could land under a
    // crate or a chest — where the bump dispatch finds the crate first and the
    // win item can never be touched. Twenty free picks, then the old any-floor
    // fallback, because a run without its win item is worse than an awkward one.
    let pos = null
    for (let i = 0; i < 20 && !pos; i++) {
        const t = mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
        if (t && !mapState.entityAtTile(t.x, t.y)) pos = t
    }
    if (!pos) pos = mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
    if (!pos) return
    const goalEntity = new Amulet(pos.x, pos.y)
    // The win item is a collect-on-touch trigger, not a stored item: flag it so
    // pickup bypasses the inventory (a full 10-slot bag must never soft-lock the
    // win — walking into it would otherwise just log "inventory full").
    goalEntity.bypassInventory = true
    tm.addEntity(goalEntity)
}

const quest = [
    addGoal
]

export default quest
