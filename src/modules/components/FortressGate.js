import Door from "../items/Door.js"

// FortressGate — the gate between fortress compartments. Mechanically a Door,
// so it reuses the whole lock/key/unlock flow (HeroController consumes a key
// and opens a locked door), the pathfinding stamp (closed/locked doors block
// enemy routing in WorldQueries.gridForEntity), the melee block
// (distanceBetweenEntities), and FloorMemory persistence — no parallel system.
//
// Two differences from a plain door:
//   - re-skinned with gate art (keyhole 592 / closed 199 / open 200),
//   - seeThrough = true, so line-of-sight passes the bars (you and the enemies
//     can see through a gate, but not a solid palisade wall).
//
// Internal compartment gates spawn LOCKED (a key from the compartment opens
// them); the outer gate spawns CLOSED-unlocked (the player breaches it freely,
// but it still blocks the camp's enemies from wandering out the front).
// Confirm the tiles in test.html before relying on them.
const GATE_CLOSED = 199
const GATE_OPEN = 200
const GATE_KEYHOLE = 592

export default class FortressGate extends Door {
    constructor(x, y, locked = false) {
        super(x, y, locked)
        this.frameClosed = GATE_CLOSED
        this.frameOpen = GATE_OPEN
        this.frameLocked = GATE_KEYHOLE
        this.seeThrough = true
        this.name = locked ? "Barred Gate" : "Gate"
        this.description = locked
            ? "A heavy gate, barred and locked. A key would open it."
            : "A heavy timber gate."
        // Door's constructor set the vanilla door tile. Re-point both the tile
        // (used when the sprite is created later during populate) and the live
        // frame (if the sprite already exists) at the gate art.
        this.tile = locked ? GATE_KEYHOLE : GATE_CLOSED
        if (this.sprite) this.sprite.setFrame(this.tile)
    }
}
