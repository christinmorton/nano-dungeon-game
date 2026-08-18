import Prop from "./Prop.js"

// Standard — a planted banner that marks which faction holds a settlement, and
// the data seam (`faction`) the future faction system reads. Reusable across
// any post. The banner art differs by settlement tier:
//   - Standard         → camps/villages, redFlagTriangular (458)
//   - FortressStandard → fortresses/outposts, redBannerTwoPost (360)
// Distinct classes (rather than a tile param) so the right banner survives
// FloorMemory revisits, which reconstruct via `new Class(x, y)`.
//
// Confirm the banner tiles in test.html before relying on them.
const SETTLEMENT_BANNER = 458 // signsFlagsAndBells.redFlagTriangular
const FORTRESS_BANNER = 360   // signsFlagsAndBells.redBannerTwoPost

export default class Standard extends Prop {
    constructor(x, y, faction = "orc", tile = SETTLEMENT_BANNER) {
        super(x, y, tile, {
            name: "War-Standard",
            description: `A planted war-standard. This ground is held by the ${faction}.`,
            type: "standard",
        })
        this.faction = faction
        this.blocksPath = true
    }
}

export class FortressStandard extends Standard {
    constructor(x, y, faction = "orc") {
        super(x, y, faction, FORTRESS_BANNER)
    }
}
