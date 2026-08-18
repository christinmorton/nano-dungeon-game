import enemies from "../Enemies.js"
import mapState from "../MapState.js"
import Captain from "../enemies/Captain.js"
import archerTag from "../tags/archer.js"
import tankTag from "../tags/tank.js"
import warriorTag from "../tags/warrior.js"
import casterTag from "../tags/caster.js"
import healerTag from "../tags/healer.js"
import wraithTag from "../tags/wraith.js"
import shamblerTag from "../tags/shambler.js"

// Maps recipe role strings to the tag template that applies them.
// Keeping the import + dispatch local to the applier — as opposed to
// threading through Tags.js — sidesteps the circular-import landmine
// described in Tags.js.
const ROLE_TAGS = {
    archer: archerTag,
    tank: tankTag,
    warrior: warriorTag,
    caster: casterTag,
    healer: healerTag,
    wraith: wraithTag,
    shambler: shamblerTag
}

// Captain tile per recipe species. The Captain class itself stays
// generic; species presentation is achieved by swapping the rendered
// frame at spawn (see documents/v3_enemy_squad_design.md). Tiles
// reuse the same id the species' regular enemy class uses, so the
// captain reads visually as "one of the band" plus the gold star
// marker the Captain class draws above the sprite.
const SPECIES_CAPTAIN_TILE = {
    orc: 173
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

// Tile offsets used to fan squad members around the captain. Picks the
// first walkable slot in this order, so a recipe with up to 8 members
// fits cleanly in an 8-neighborhood. Larger squads need a ring expander
// (deferred — slice this in when a recipe actually demands it).
const MEMBER_OFFSETS = [
    [-1, 0], [0, -1], [1, 0], [0, 1],
    [-1, -1], [1, -1], [1, 1], [-1, 1]
]

function spawnCaptain(tm, recipe, x, y) {
    const captain = new Captain(x, y)
    captain.finalizeSpawn()
    captain.species = recipe.species
    captain.name = `${capitalize(recipe.species)} ${captain.name}`

    // Tile resolution: explicit recipe override wins, then the species
    // default, then whatever Captain.js set as its class default.
    const tile = recipe.captain.tile ?? SPECIES_CAPTAIN_TILE[recipe.species]
    if (tile != null) {
        captain.tile = tile
        // Captain.js created the sprite during construction with the old
        // tile id; setFrame swaps the rendered frame in place so the
        // species presentation lands without re-creating the entity.
        if (captain.sprite) captain.sprite.setFrame(tile)
    }

    // Activity override from the recipe. Wildcard support comes with
    // the broader wildcard-resolution slice; for now a literal name
    // wins and anything else (including "*") leaves the Captain.js
    // default in place.
    if (recipe.captain.activity && recipe.captain.activity !== "*") {
        captain.activity = recipe.captain.activity
    }

    // Bind the captain to the Room it spawned in. Activities key off
    // this to keep scout/patrol/claim targets bounded to the room so
    // dispatched members don't try to path through closed doors. Null
    // if no room contains the anchor (defensive — every BSP and arena
    // captain should spawn inside a registered Room).
    if (mapState.rooms) {
        captain.homeRoom = mapState.rooms.find(r => r.contains(x, y)) || null
    }

    tm.addEntity(captain)
    return captain
}

function pickMemberPosition(occupied, anchorX, anchorY) {
    for (const [dx, dy] of MEMBER_OFFSETS) {
        const x = anchorX + dx
        const y = anchorY + dy
        const key = `${x},${y}`
        if (occupied.has(key)) continue
        if (!mapState.isWalkableTile(x, y)) continue
        occupied.add(key)
        return { x, y }
    }
    return null
}

function spawnMember(tm, member, x, y) {
    const EnemyClass = enemies[member.class]
    const entity = new EnemyClass(x, y)
    entity.finalizeSpawn()
    if (member.role) {
        const tag = ROLE_TAGS[member.role]
        if (tag) entity.addTag(tag)
    }
    tm.addEntity(entity)
    return entity
}

const recipeApplier = {
    // Spawn a band from a recipe at the given anchor. Captain takes the
    // anchor tile; members fan into surrounding walkable tiles via the
    // MEMBER_OFFSETS order. Returns { captain, members } so callers can
    // wire follow-up state (group membership, formation slots, etc.).
    //
    // `occupied` is an optional shared tile set. Multi-band callers (the
    // settlement perimeter generator) pass ONE set across every apply call so
    // bands never overlap each other — or the walls / structures the caller
    // pre-seeds into it. This matters because the spatial queries are blind to
    // still-spriteless entities during the populate pass, so isWalkableTile
    // alone can't keep two freshly-spawned bands off the same tile.
    apply(tm, recipe, anchorX, anchorY, occupied = new Set()) {
        if (!recipe) {
            throw new Error("RecipeApplier.apply: recipe is null/undefined")
        }

        occupied.add(`${anchorX},${anchorY}`)
        const captain = spawnCaptain(tm, recipe, anchorX, anchorY)

        const members = []
        for (const member of recipe.members) {
            const pos = pickMemberPosition(occupied, anchorX, anchorY)
            if (!pos) break
            members.push(spawnMember(tm, member, pos.x, pos.y))
        }

        // Wire group membership: every band member (and the captain itself)
        // points at its captain. The encounter manager reads this (isGrouped)
        // to keep squads out of the arena system — they fight free-for-all.
        captain.squad = captain
        for (const m of members) m.squad = captain

        return { captain, members }
    }
}

export default recipeApplier
