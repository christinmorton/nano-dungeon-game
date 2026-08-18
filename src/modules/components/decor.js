import Prop from "./Prop.js"

// Decor — purely cosmetic props that dress a room. They render a tile and
// block their own tile (so the player walks around them), but have no
// interaction (no onInteract) and no gameplay effect. This is the room-
// dressing half of the components foundation; quest props and interactive
// furniture live in their own files.
//
// makeDecor is the reusable factory: hand it a tile + name and get a Prop.
// Named decor that needs to survive floor revisits (FloorMemory keys on the
// constructor name) are exported as small classes instead — Campfire is the
// first, used by the rest room.

export function makeDecor(x, y, { tile, name = "Decoration", description = "", type = "decor" } = {}) {
    return new Prop(x, y, tile, { name, description, type })
}

// tileReference.json regions.elements.campfire (504). Single constant so it's
// easy to confirm in test.html and swap if it doesn't read as a campfire.
const TILE_CAMPFIRE = 504

export class Campfire extends Prop {
    constructor(x, y) {
        super(x, y, TILE_CAMPFIRE, {
            name: "Campfire",
            description: "A crackling campfire. Warm, and somehow safe.",
            type: "decor",
        })
    }
}

// tileReference.json regions.woodenColumns.pillarTop (408 — top of a wooden
// pillar composite). Stands in as a tribal totem / camp standard for enemy
// settlements. Single constant so it's easy to confirm in test.html and swap
// if it doesn't read as a totem. Used by the settlement scatter pass.
const TILE_TOTEM = 408

export class Totem extends Prop {
    constructor(x, y) {
        super(x, y, TILE_TOTEM, {
            name: "Totem",
            description: "A carved wooden totem, daubed with old war-paint.",
            type: "decor",
        })
    }
}

// naturalTerrain.tree2 (50) — a tree for the outdoor war-camp. Blocks its tile
// (and pathing) so it reads as real cover, not a floor decal. Single constant
// so it's easy to confirm in test.html and swap.
const TILE_TREE = 50

export class Tree extends Prop {
    constructor(x, y) {
        super(x, y, TILE_TREE, {
            name: "Tree",
            description: "A gnarled tree, roots cracking the trampled earth.",
            type: "decor",
        })
        this.blocksPath = true
    }
}

// worldBuildings.tentRed (980) — a small hide tent dotting the camp. A plain
// decor structure (NOT the rest-room Tent, which makes its room a safe camp).
// Single constant so it's easy to confirm in test.html and swap.
const TILE_HUT = 980

export class Hut extends Prop {
    constructor(x, y) {
        super(x, y, TILE_HUT, {
            name: "Hide Tent",
            description: "A rough hide tent. Someone bunks here between raids.",
            type: "decor",
        })
        this.blocksPath = true
    }
}

// The first MULTI-TILE prop: a winged statue on a pedestal, 2 wide x 3 tall,
// rendered from the named region `interior-castle-statue-1` on the
// fantasyrpg-dungeon sheet. Unlike every decor class above it names a REGION
// instead of a frame constant, so its art and its 2x3 footprint both come from
// the tile-label store — the size can't drift from the picture.
//
// That sheet is the default recipe's tileset, so it is already loaded in an
// ordinary run; a prop whose sheet isn't loaded falls back to its 1x1 tile.
//
// CAVEAT worth knowing before adding more: a region is a labeled RECTANGLE OF
// RELATED ART, not necessarily one object. `barrels-wooden` (3x3) is six
// separate barrels and `boulders-grey` (3x2) is two boulders on an opaque dirt
// strip — either would look wrong as a single prop. Look at the block before
// promoting a region to a prop.
export class CastleStatue extends Prop {
    constructor(x, y) {
        super(x, y, null, {
            name: "Winged Statue",
            description: "A winged figure carved in pale stone, wings folded, gaze lowered.",
            type: "decor",
            region: { sheet: "fantasyrpg-dungeon", name: "interior-castle-statue-1" },
        })
        this.blocksPath = true
    }
}

// Settlement centerpieces — landmark structures dropped at the heart of a
// perimeter settlement (see modules/settlements/spawnSettlement.js). Unlike
// scatter decor these are single-tile "whole building" sprites that read as
// a fortified structure; they block their tile AND opt into the pathfinding
// stamp (blocksPath) so the war-camp's enemies route around them. Both are
// FloorMemory-persisted classes (registered in ctorRegistry) so they survive
// floor revisits like the walls around them.

// worldBuildings.redBuildingHome (981) — the warlord's hall at the core of a
// fortress. Single constant so it's easy to confirm in test.html and swap.
const TILE_WARHALL = 981

export class WarHall extends Prop {
    constructor(x, y) {
        super(x, y, TILE_WARHALL, {
            name: "War-Hall",
            description: "A great wooden hall. The warlord holds court within.",
            type: "structure",
        })
        this.blocksPath = true
        this.blocksSight = true
    }
}

// worldBuildings.watchTower2 (983) — the anchor of an orc outpost (no
// warlord; a defensive perimeter holds the line). Single constant so it's
// easy to confirm in test.html and swap.
const TILE_WATCHTOWER = 983

export class Watchtower extends Prop {
    constructor(x, y) {
        super(x, y, TILE_WATCHTOWER, {
            name: "Watchtower",
            description: "A rough timber watchtower. Lookouts scan the approach.",
            type: "structure",
        })
        this.blocksPath = true
        this.blocksSight = true
    }
}
