import GenericItem from "../items/GenericItem.js"
import { resolveRegion as sharedResolveRegion, drawRegionExtras as sharedDrawRegionExtras } from "./regionArt.js"

// NOTE: deliberately no MapState import. MapState -> BSPLevel -> spawnFromTable
// -> components/decor.js -> Prop would close an import cycle, and this module
// sits in BaseEnemy's neighbourhood (Follower extends BaseEnemy, spawnFromTable
// pulls both). Everything the region renderer needs is already on the anchor
// sprite: its world position, and its display size — which IS one tile, because
// initializeEntity scales art to the world tile size.

// Prop — the reusable primitive behind the components/ factories.
//
// A Prop is a placeable, tile-rendered entity that is NOT loot and NOT an
// enemy: shopkeepers and other standing NPCs, room decoration (barrels,
// banners, bones), and quest objects all build on it. It generalizes the
// conventions that Shrine/Container settled on:
//   - renders a tile sprite like an item, so dungeon.initializeEntity wires
//     it into the world and WorldQueries.isWalkableTile blocks its tile
//     (the player stops adjacent and interacts — same feel as a chest),
//   - never rolls random material/effect tags (props aren't gear),
//   - is unequippable (slot = null),
//   - has no combat footprint (damage/protection inherited as 0).
//
// Interaction is opt-in: a Prop with no onInteract just sits there as decor.
// Subclasses (or factory functions in this directory) add interactPrompt /
// onInteract to make it talk, open a screen, or grant something.
//
// This is the foundation the story layer will reuse — decor sets the scene,
// quest props carry the narrative; both are Props at different settings.
// Resolve `{ sheet, name }` to the frames + size of a named tile region, or null.
//
// A MODULE function, not a method, because it has to run BEFORE super(): the
// GenericItem constructor calls dungeon.initializeEntity, so the anchor sprite is
// built during super() and needs the region's top-left frame already in `art`.
// Resolving afterwards drew whatever fallback tile was passed in and silently
// skipped the extra sprites.
//
// A region that can't be resolved (renamed in the Atlas, wrong sheet) returns
// null and the prop stays 1x1 on whatever tile/art it was given — a decoration
// is not worth crashing a floor over.
// Moved to components/regionArt.js so the themed mechanic props (chest, shrine,
// font) can render regions through the same code rather than a second copy.
// Wrapped only to keep Prop's warning prefix.
const resolveRegion = (region) => sharedResolveRegion(region, "Prop")

export default class Prop extends GenericItem {
    // `region: { sheet, name }` renders a NAMED TILE REGION — the multi-frame
    // rectangles labeled in the designer's Atlas (levels/tileRegions.js). Most of
    // that library is bigger than one tile (buildings, trees, rock formations,
    // furniture), which is why a Prop can now cover more than the tile its sprite
    // sits on. The region supplies both the art AND the footprint, so a caller
    // names a thing and gets its true size — no hand-entered w/h to drift.
    //
    // Everything else is unchanged: a plain `tile` or `art` prop is 1x1 and
    // behaves exactly as before.
    // `walkable: true` makes the prop pure ground dressing — flowers, pebbles,
    // scattered debris — that everything walks straight over. Props block by
    // default (that IS the point of a well or a column), so this is opt-in.
    constructor(x, y, tile, { name = "Prop", description = "", type = "prop", tint, art, region, walkable = false } = {}) {
        // Must happen before super() — see resolveRegion.
        const resolved = resolveRegion(region)
        super(x, y, tile, tint, resolved ? { sheet: resolved.sheet, frame: resolved.frames[0][0] } : art)
        this.type = type
        this.name = name
        this.description = description
        this.slot = null
        // Props aren't gear — no random material/effect tags.
        this.tagPolicy = { materials: false, effects: false }

        // Tiles covered, anchored top-left (see WorldQueries.footprintOf).
        this.footprint = resolved ? { w: resolved.w, h: resolved.h } : { w: 1, h: 1 }
        // The region this prop was built from, kept so it can be SERIALIZED.
        // A region-backed prop's identity is its region, not its class — most are
        // plain Props with no class of their own — so FloorMemory persists this
        // and rebuilds from it on revisit. Without it a scattered prop is
        // unreconstructable and silently disappears when you come back to a floor.
        this.region = resolved ? { sheet: region.sheet, name: region.name } : null
        // Sprites for every frame BUT the anchor one; the anchor is the entity's
        // own `sprite`, created by dungeon.initializeEntity during super().
        this._extraSprites = []
        this._regionFrames = resolved ? resolved.frames : null

        // Walk-over dressing: WorldQueries.isWalkableTile lets everything pass,
        // and the sprite drops below the entity layer so the hero, enemies and
        // dropped loot draw ON TOP of the flowers rather than under them. Depth 1
        // is above the tilemap (0) and below the fog overlay (5), so unexplored
        // debris stays hidden along with the ground it dresses.
        this.walkable = !!walkable
        if (this.walkable && this.sprite) this.sprite.setDepth(1)

        // super() already made the anchor sprite, so the rest can be drawn now.
        // (onSpriteCreated fires inside super(), too early to be useful here.)
        // AFTER the depth change, so the extra sprites inherit it.
        this.drawRegionExtras()
    }

    // Draw the rest of the region beside the anchor sprite. Safe to call when
    // there's no region, no sprite (an entity constructed off-map), or the
    // texture isn't loaded — each is a no-op, leaving the anchor as-is.
    drawRegionExtras() {
        sharedDrawRegionExtras(this)
    }

    // The extra sprites are plain scene objects with no entity of their own, so
    // nothing else will ever clean them up — a prop removed without this leaves
    // its body painted on the floor.
    destroyExtraSprites() {
        for (const s of this._extraSprites) s.destroy()
        this._extraSprites = []
    }

    // Most props vanish without ceremony; interactive subclasses override.
    // Subclasses that override MUST call super.onDestroy() or leak their body.
    onDestroy() {
        this.destroyExtraSprites()
    }
}
