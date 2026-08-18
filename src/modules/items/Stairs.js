import GenericItem from "./GenericItem.js"
import mapState from "../MapState.js"
import { themeArt } from "../levels/themeRoles.js"

// Kenney fallback frames — what every floor used before themes could supply
// stair art, and what a theme with no stairs role still gets.
const TILE_DOWN = 297
const TILE_UP = 296

export default class Stairs extends GenericItem {
    constructor(x, y, direction = "down") {
        // The floor's theme may name per-realm stair art (levels/themeRoles.js),
        // so a snowfield and a candlelit hall no longer share one grey staircase.
        // Read at construction because stairs are placed once per floor, after
        // MapState.bind has normalized the theme.
        const role = direction === "down" ? "stairsDown" : "stairsUp"
        const art = themeArt(mapState.theme, role)
        super(x, y, direction === "down" ? TILE_DOWN : TILE_UP, null, art)
        this.name = "Stairs"
        this.type = "stairs"
        this.direction = direction
    }
}
