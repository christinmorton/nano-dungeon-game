import Phaser from 'phaser'
import Amulet from "./items/Amulet.js"
import GoalItem from "./items/GoalItem.js"
import { makeItem } from "./items/itemProfiles.js"
import mapState from "./MapState.js"
import run from "./Run.js"
import tm from "./TurnManager.js"

// The dungeon win condition (design §15.8). On the last floor, spawn the goal
// item in the goal room and win when it's collected. An authored run may carry a
// `goal` config (mapState.authoredGoal) that generalizes the classic Amulet:
//   - { win: "collect", item: { source: "atlas", name, sheet, frame } }
//       → a GoalItem with the designer-picked Atlas sprite.
//   - { win: "collect", item: { source: "item", key, name? } }
//       → a real makeItem(key) with its pickup swapped for the win.
// No config (or a normal BSP run) → the classic Amulet, unchanged.

const centerOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

// The room the goal item spawns in: an authored "goal" room, else the room
// furthest from the start (so the win isn't underfoot), else any non-start room.
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

// Build the goal entity from the config (falls back to the Amulet on any gap so
// the run always has a win condition).
function makeGoalEntity(goal, x, y) {
    const item = goal && goal.win === "collect" && goal.item
    if (!item) return new Amulet(x, y)

    if (item.source === "item" && item.key) {
        let entity = null
        try { entity = makeItem(item.key, x, y) } catch (e) { entity = null }   // unknown key
        if (entity) {
            if (item.name) entity.name = item.name
            entity.onPickup = () => run.endRun("win")   // this pickup wins the run
            return entity
        }
        return new Amulet(x, y)   // unknown key → default win item
    }
    if (item.source === "atlas" && item.sheet) {
        return new GoalItem(x, y, { name: item.name, art: { sheet: item.sheet, frame: item.frame } })
    }
    return new Amulet(x, y)
}

function addGoal() {
    const lm = mapState.levelManager
    if (lm.currentLevel !== lm.levels.length - 1) return   // goal lives on the last floor
    const room = goalRoom()
    if (!room) return
    const pos = mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
    const goalEntity = makeGoalEntity(mapState.authoredGoal, pos.x, pos.y)
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
