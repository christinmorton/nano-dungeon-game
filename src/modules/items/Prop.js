import GenericItem from "./GenericItem.js"

// Prop — a placeable, tile-rendered entity that is NOT loot and NOT an enemy:
// room decoration (a crate, an urn, a brazier) and the walk-over litter around
// it. The v5 cut of v3's components/Prop.js: no multi-tile regions, no
// interaction hooks, no serialisation — nothing here survives a floor, and v5
// never revisits one.
//
// It rides GenericItem because that is what dungeon.initializeEntity knows how
// to put on the map, but it is deliberately NOT an item:
//   - type "decor", so HeroController's bump dispatch (which keys on
//     type == "item") never picks it up — a bump just stops, like a wall;
//   - slot null and tag rolling off, so it never reads as gear;
//   - `walkable` opt-in, so debris is ground dressing everything passes over,
//     while furniture blocks by default (that IS the point of an urn).
// `blocksPath` is what the pathfinding grid reads (WorldQueries.gridForEntity),
// so enemies route around furniture rather than planning through it.
export default class Prop extends GenericItem {
    constructor(x, y, { name = "Prop", art = null, walkable = false } = {}) {
        super(x, y, null, null, art)
        this.type = "decor"
        this.name = name
        this.description = ""
        this.slot = null
        this.tagPolicy = { materials: false, effects: false }
        this.walkable = walkable
        this.blocksPath = !walkable
    }
}
