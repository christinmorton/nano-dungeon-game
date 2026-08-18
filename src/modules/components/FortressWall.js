import Prop from "./Prop.js"

// FortressWall — a single segment of a settlement's defensive perimeter.
//
// Built on Prop, so it renders a tile and blocks its own tile the same way
// a tent or a chest does (WorldQueries.isWalkableTile rejects any sprited
// entity's tile). The extra `blocksPath = true` flag opts it into the
// pathfinding stamp in WorldQueries.gridForEntity so enemies route AROUND
// the wall to the gate rather than planning a path straight through it.
//
// Representing walls as entities (not grid/tilemap edits) matches the
// engine convention — the tilemap is immutable per floor; everything
// dynamic is an entity — and gives revisit persistence for free once the
// class is registered in FloorMemory's ctorRegistry.
//
// Wooden-stake palisade (tile 197, fencesAndGates.tallFencePointy) for the
// orc war-camp's outdoor identity. Single constant so it's easy to confirm
// in test.html and swap if it doesn't read as a stockade.
// LOS-blocking is deliberately NOT modelled this pass (see the deferred
// seam in documents/v3_enemy_settlements.md) — walls are cosmetic +
// collision only for now.
const TILE_PALISADE = 197

export default class FortressWall extends Prop {
    constructor(x, y, tile = TILE_PALISADE) {
        super(x, y, tile, {
            name: "Palisade",
            description: "A wall of sharpened wooden stakes.",
            type: "wall",
        })
        this.blocksPath = true
        // A solid wall of stakes — blocks line-of-sight (WorldQueries) so
        // enemies can't see (or be seen) through it. Gates are see-through;
        // walls are not.
        this.blocksSight = true
    }
}
