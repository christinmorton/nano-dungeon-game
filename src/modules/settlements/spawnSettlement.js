import mapState from "../MapState.js"
import tm from "../TurnManager.js"
import recipeApplier from "../recipes/RecipeApplier.js"
import profilesBySpecies from "./settlementProfiles.js"
import forms from "../../data/settlements/forms.json"
import { Campfire, Totem, Tree, Hut, WarHall, Watchtower } from "../components/decor.js"
import FortressWall from "../components/FortressWall.js"
import FortressGate from "../components/FortressGate.js"
import Standard, { FortressStandard } from "../components/Standard.js"
import VoidRift from "../components/VoidRift.js"
import { Villager, VillageElder, OrcTrader } from "../components/npcs.js"
import DungeonKey from "../items/DungeonKey.js"
import Container from "../items/Container.js"
import { getRandomItem } from "../Items.js"
import eliteEnrager from "../tags/eliteEnrager.js"
import voidEmpowered from "../tags/voidEmpowered.js"
import gameLog from "../GameLog.js"

// Settlement populate pass — drops a themed enemy group (the species' theme)
// scaled by a form into a room, then dresses it with a structure pass.
//
// Two layout strategies:
//   - "encampment" — a small open orc camp in a typical dungeon room.
//   - "scatter"    — generic small-band fallback for any other species/form.
//   - "perimeter" (fortress / outpost) — a self-contained outdoor war-camp.
//     The interior is split into a SEQUENCE OF COMPARTMENTS divided by internal
//     palisade walls, each connected by ONE locked keyhole gate. Each
//     compartment holds the key to the next gate, so the player must clear and
//     unlock their way inward; the deepest compartment holds the warlord (an
//     elite, for a fortress), the war-hall, and a treasure chest. Gates block
//     enemy pathing too, so the camp fights you compartment by compartment.
//     Rooms too small to compartmentalize fall back to one open courtyard.
//
// TODO (feature incomplete): the placement below is hardcoded procedural logic.
// To COMPLETE the settlement feature we still need the authored LAYOUT SYSTEM —
// hand-drawn ASCII/JSON maps parsed into the layout, swappable per settlement,
// with the procedural path as the fallback. The current generators just work as
// an interim. Spec: documents/v3_fortress_authored_layouts.md.
//
// See documents/v3_enemy_settlements.md.

const SETTLEMENT_PROPS = { Campfire, Totem, Tree, Hut }
const CENTERPIECES = { warhall: WarHall, watchtower: Watchtower }

const SCATTER_PLACEMENT_ATTEMPTS = 16
const ANCHOR_PLACEMENT_ATTEMPTS = 40
const MIN_ANCHOR_SPACING = 4

// Target rows/cols per compartment along the depth axis, and the cap on how
// many compartments a camp is carved into.
const COMPARTMENT_DEPTH = 6
const MAX_COMPARTMENTS = 4

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value))
}

function isFloor(x, y) {
    return mapState.level[y] && mapState.level[y][x] === 0
}

// First free, unoccupied floor tile inside a rect.
function freeTileInRect(rect, occupied) {
    for (let i = 0; i < ANCHOR_PLACEMENT_ATTEMPTS; i++) {
        const x = randInt(rect.x0, rect.x1)
        const y = randInt(rect.y0, rect.y1)
        if (occupied.has(`${x},${y}`) || !isFloor(x, y)) continue
        return { x, y }
    }
    return null
}

// Weighted draw of `count` members from the profile's role palette.
function drawMembers(roles, count) {
    const total = roles.reduce((sum, r) => sum + (r.weight || 1), 0)
    const members = []
    for (let i = 0; i < count; i++) {
        let r = Math.random() * total
        let pick = roles[roles.length - 1]
        for (const role of roles) {
            r -= (role.weight || 1)
            if (r <= 0) { pick = role; break }
        }
        members.push({ class: pick.class, role: pick.role })
    }
    return members
}

// Scatter decor onto unoccupied floor tiles within `bounds`, avoiding
// `occupied`. Explicit occupancy tracking (not the spatial queries) because
// entities are still spriteless during populate — see the desync gotcha.
function scatterDecor(names, bounds, occupied) {
    for (const name of names || []) {
        const PropClass = SETTLEMENT_PROPS[name]
        if (!PropClass) continue
        for (let attempt = 0; attempt < SCATTER_PLACEMENT_ATTEMPTS; attempt++) {
            const x = randInt(bounds.x0, bounds.x1)
            const y = randInt(bounds.y0, bounds.y1)
            const key = `${x},${y}`
            if (occupied.has(key)) continue
            if (!isFloor(x, y)) continue
            tm.addEntity(new PropClass(x, y))
            occupied.add(key)
            break
        }
    }
}

function buildRecipe(profile, leaderKey, count) {
    return {
        species: profile.species,
        captain: { ...(profile.leaders[leaderKey] || {}) },
        members: drawMembers(profile.roles, count)
    }
}

// Bind a band to its room so idle behavior stays put (captains patrol within
// homeRoom; room affiliation groups the cohort).
function bindBand(room, captain, members) {
    if (captain) { captain.homeRoom = room; captain.spawnRoom = room }
    for (const m of members) { m.homeRoom = room; m.spawnRoom = room }
}

// First free floor tile near (x, y) — seats a band beside a structure.
function findFreeNear(x, y, occupied) {
    const offsets = [[0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0], [0, -1], [0, 2], [2, 0], [-2, 0]]
    for (const [dx, dy] of offsets) {
        const nx = x + dx, ny = y + dy
        if (occupied.has(`${nx},${ny}`)) continue
        if (!isFloor(nx, ny)) continue
        return { x: nx, y: ny }
    }
    return null
}

// === scatter layout (encampment) — unchanged from the shipped slice.
function spawnScatter(room, profile, form) {
    const [lo, hi] = form.members
    const recipe = buildRecipe(profile, form.leader, randInt(lo, hi))

    const cx = Math.floor(room.x + room.w / 2)
    const cy = Math.floor(room.y + room.h / 2)
    const anchor = mapState.isWalkableTile(cx, cy)
        ? { x: cx, y: cy }
        : mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
    const { captain, members } = recipeApplier.apply(tm, recipe, anchor.x, anchor.y)
    bindBand(room, captain, members)

    const occupied = new Set()
    for (const entity of [captain, ...members]) {
        if (entity) occupied.add(`${entity.x},${entity.y}`)
    }
    const bounds = { x0: room.x, y0: room.y, x1: room.x + room.w - 1, y1: room.y + room.h - 1 }
    scatterDecor(profile.props, bounds, occupied)
}

// === encampment layout ===
// A small, open orc camp in a TYPICAL dungeon room — NOT a fortress. Just the
// outdoor floor theming (set via room.floorTheme), a small band (<=8), scattered
// trees/huts, and one faction standard. No building, fences, or perimeter.

// Plant the faction standard near the camp centre — the ownership marker.
function placeStandard(room, profile, occupied) {
    const faction = profile.faction || profile.species
    const cx = Math.floor(room.x + room.w / 2)
    const cy = Math.floor(room.y + room.h / 2)
    const spot = freeTileInRect({ x0: cx - 2, y0: cy - 2, x1: cx + 2, y1: cy + 2 }, occupied)
        || freeTileInRect({ x0: room.x + 1, y0: room.y + 1, x1: room.x + room.w - 2, y1: room.y + room.h - 2 }, occupied)
    if (spot) {
        tm.addEntity(new Standard(spot.x, spot.y, faction))
        occupied.add(`${spot.x},${spot.y}`)
    }
}

function spawnEncampment(room, profile, form) {
    const [lo, hi] = form.members
    const recipe = buildRecipe(profile, form.leader, randInt(lo, hi))
    const cx = Math.floor(room.x + room.w / 2)
    const cy = Math.floor(room.y + room.h / 2)
    const anchor = mapState.isWalkableTile(cx, cy)
        ? { x: cx, y: cy }
        : mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)

    const occupied = new Set()
    const { captain, members } = recipeApplier.apply(tm, recipe, anchor.x, anchor.y, occupied)
    bindBand(room, captain, members)

    placeStandard(room, profile, occupied)

    const bounds = { x0: room.x + 1, y0: room.y + 1, x1: room.x + room.w - 2, y1: room.y + room.h - 2 }
    scatterDecor(form.decor || profile.props, bounds, occupied)
}

// === dark encampment layout (void / corrupted theme) ===
// The darkness variant of an encampment: a void band shrouded in gloom. Like
// spawnEncampment, but the centerpiece is a VoidRift (the darkness source that
// shrinks the room's light radius) instead of a faction Standard, and there is
// NO orc camp decor (trees/huts) — the corrupted-dungeon floor + the dark + the
// spectral roster carry the theme. darkRadius comes from profile.darkness[form].
// Reusable for any dark faction (demonic, …), not void-only.
// See documents/v3_darkness_settlements.md.
// Escalation budget for the captain channel → rift respawn loop. DEFAULT: a
// destroyed rift can be channeled back ONCE. Bump DARK_RESPAWNS for more cycles
// (each tier stronger), or set DARK_RESPAWNS_INFINITE = true for an endless
// race-the-channel threat. See documents/v3_darkness_settlements.md.
const DARK_RESPAWNS = 1
const DARK_RESPAWNS_INFINITE = false

// Spawn a lone void captain (no band) at (x, y) — the guardian a respawned rift
// raises to protect itself. Reuses the recipe machinery so it gets the species
// leader tile + playbook; bound to the room + empowered + flagged as a channeler
// so destroying THIS rift (while budget remains) starts the loop again.
function spawnVoidCaptain(room, profile, form, x, y) {
    const recipe = buildRecipe(profile, form.leader, 0) // captain only, no members
    const { captain, members } = recipeApplier.apply(tm, recipe, x, y)
    bindBand(room, captain, members)
    if (captain) {
        captain.voidChanneler = true
        captain.addTag(voidEmpowered)
        gameLog.log(`A new void captain rises to guard the rift.`)
    }
}

function spawnDarkEncampment(room, profile, form, darkRadius) {
    const [lo, hi] = form.members
    const occupied = new Set()

    // Mark the room a void settlement + seed the escalation budget. darkFaction
    // persists after the rift dies (so a captain knows to channel a new one);
    // darkRadius is remembered for the respawn.
    room.darkFaction = true
    room.darkRadius = darkRadius
    room.darkTier = 0
    room.darkRespawnsLeft = DARK_RESPAWNS
    room.darkRespawnsInfinite = DARK_RESPAWNS_INFINITE

    // The rift sits at the heart of the room: the darkness source, the
    // centerpiece, and the (future) light/holy cleanse target.
    const cx = Math.floor(room.x + room.w / 2)
    const cy = Math.floor(room.y + room.h / 2)
    const centerTile = isFloor(cx, cy)
        ? { x: cx, y: cy }
        : freeTileInRect({ x0: room.x + 1, y0: room.y + 1, x1: room.x + room.w - 2, y1: room.y + room.h - 2 }, occupied)
    if (centerTile) {
        const rift = new VoidRift(centerTile.x, centerTile.y, darkRadius)
        tm.addEntity(rift)
        rift.claimRoom(room)
        occupied.add(`${centerTile.x},${centerTile.y}`)
    } else {
        // Cramped layout with no free centre tile — still darken the room so the
        // theme holds even without a visible rift sprite.
        room.lightRadius = darkRadius
    }

    // The void band rings the rift.
    const anchor = (centerTile && findFreeNear(centerTile.x, centerTile.y, occupied))
        || (mapState.isWalkableTile(cx, cy)
            ? { x: cx, y: cy }
            : mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h))
    const recipe = buildRecipe(profile, form.leader, randInt(lo, hi))
    const { captain, members } = recipeApplier.apply(tm, recipe, anchor.x, anchor.y, occupied)
    bindBand(room, captain, members)

    // The captain can channel a destroyed rift back into being (see
    // voidChannel.js). Marked here so only void-settlement captains do it.
    if (captain) captain.voidChanneler = true

    // Phase 4: a respawned rift spawns a fresh GUARDIAN captain after a few
    // rounds (the channeling captain sacrificed itself). The room carries the
    // spawner as a closure — capturing this profile/form — so the rift can call
    // it on a timer without importing the recipe machinery (avoids a cycle).
    room.spawnGuardianCaptain = (gx, gy) => spawnVoidCaptain(room, profile, form, gx, gy)

    // Draw strength from the rift: the band is empowered by proximity to the
    // darkness source (scales to zero when far / when the rift is cleansed).
    // bindBand set homeRoom = room, and the rift set room.darkSource above.
    for (const member of [captain, ...members]) {
        if (member) member.addTag(voidEmpowered)
    }
}

// === village layout (neutral) ===
// A peaceful orc village: NPC townsfolk + a clan elder (quest-giver stub), a
// clan standard, and homes/trees — NO enemies, NO combat. The settlement's
// disposition is "neutral" (the faction seam). Same simple open layout as the
// camp, but populated with people you talk to instead of a band you fight.
function spawnVillage(room, profile, form) {
    // Pacified room: dungeon enemies can't path into or through the village, so
    // they never wander in to fight. A DISTINCT flag from the rest-camp/tent —
    // there is NO player make-camp or heal here; it's an orc village.
    room.pacified = true

    const occupied = new Set()
    const interior = { x0: room.x + 1, y0: room.y + 1, x1: room.x + room.w - 2, y1: room.y + room.h - 2 }

    placeStandard(room, profile, occupied)

    // The elder sits near the centre of the village; the trader nearby.
    const cx = Math.floor(room.x + room.w / 2)
    const cy = Math.floor(room.y + room.h / 2)
    const elderSpot = freeTileInRect({ x0: cx - 2, y0: cy - 2, x1: cx + 2, y1: cy + 2 }, occupied)
        || freeTileInRect(interior, occupied)
    if (elderSpot) {
        tm.addEntity(new VillageElder(elderSpot.x, elderSpot.y))
        occupied.add(`${elderSpot.x},${elderSpot.y}`)
    }

    const traderSpot = freeTileInRect(interior, occupied)
    if (traderSpot) {
        tm.addEntity(new OrcTrader(traderSpot.x, traderSpot.y))
        occupied.add(`${traderSpot.x},${traderSpot.y}`)
    }

    const [lo, hi] = form.villagers || [4, 6]
    const count = randInt(lo, hi)
    for (let i = 0; i < count; i++) {
        const spot = freeTileInRect(interior, occupied)
        if (!spot) break
        tm.addEntity(new Villager(spot.x, spot.y))
        occupied.add(`${spot.x},${spot.y}`)
    }

    scatterDecor(form.decor || ["Hut", "Hut", "Hut", "Tree", "Tree"], interior, occupied)
}

// === perimeter layout (fortress / outpost) ===

// Ring rectangle (one tile inside the room edge). The room's outer edge stays a
// walkable margin that loops the palisade.
function ringBounds(room) {
    return {
        x0: room.x + 1, y0: room.y + 1,
        x1: room.x + room.w - 2, y1: room.y + room.h - 2
    }
}

// Pick the outer gate's tile on the palisade ring, plus the inward direction
// (used both to clear its lane and to orient the compartments along the axis
// the player advances). Detects the corridor opening from the level grid;
// defaults to bottom-centre when the room has no opening (the test level).
function findGate(room, ring) {
    const { x0, y0, x1, y1 } = ring
    const spanX = x => clamp(x, x0 + 1, x1 - 1)
    const spanY = y => clamp(y, y0 + 1, y1 - 1)

    for (let x = room.x; x < room.x + room.w; x++) {
        if (isFloor(x, room.y - 1)) return { x: spanX(x), y: y0, inX: 0, inY: 1 }
        if (isFloor(x, room.y + room.h)) return { x: spanX(x), y: y1, inX: 0, inY: -1 }
    }
    for (let y = room.y; y < room.y + room.h; y++) {
        if (isFloor(room.x - 1, y)) return { x: x0, y: spanY(y), inX: 1, inY: 0 }
        if (isFloor(room.x + room.w, y)) return { x: x1, y: spanY(y), inX: -1, inY: 0 }
    }
    return { x: Math.floor((x0 + x1) / 2), y: y1, inX: 0, inY: -1 }
}

// The gate tile + two tiles inward — reserved so nothing blocks the entrance.
function gateLane(gate) {
    const lane = new Set([`${gate.x},${gate.y}`])
    for (let k = 1; k <= 2; k++) {
        lane.add(`${gate.x + gate.inX * k},${gate.y + gate.inY * k}`)
    }
    return lane
}

// Stamp the palisade ring, skipping any tile in `skip` (the gate). Walls are
// entities; blocksPath routes enemies to the gate, blocksSight makes them solid.
function buildPerimeter(ring, skip, walls) {
    const { x0, y0, x1, y1 } = ring
    const place = (x, y) => {
        const key = `${x},${y}`
        if (skip.has(key) || walls.has(key)) return
        tm.addEntity(new FortressWall(x, y))
        walls.add(key)
    }
    for (let x = x0; x <= x1; x++) { place(x, y0); place(x, y1) }
    for (let y = y0 + 1; y < y1; y++) { place(x0, y); place(x1, y) }
}

// Convert a compartment (a depth range + the shared cross range) to an XY rect
// of its open interior, via the orientation mapper toXY(depth, cross).
function bandRectXY(toXY, band, crossLo, crossHi) {
    const a = toXY(band.lo, crossLo + 1)
    const b = toXY(band.hi, crossHi - 1)
    return {
        x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y),
        x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y)
    }
}

// Fill one compartment: a captain-led sub-band, plus — in the deepest one —
// the centerpiece (war-hall / watchtower), a treasure chest, and (for a
// fortress) the elite warlord.
function populateCompartment(room, profile, form, rect, occupied, deepest) {
    const [bandLo, bandHi] = form.bandSize || [4, 6]
    const leaderKey = deepest ? form.leader : form.bandLeader

    let centerTile = null
    if (deepest) {
        const StructureClass = CENTERPIECES[form.centerpiece]
        if (StructureClass) {
            centerTile = freeTileInRect(rect, occupied)
            if (centerTile) {
                tm.addEntity(new StructureClass(centerTile.x, centerTile.y))
                occupied.add(`${centerTile.x},${centerTile.y}`)
            }
        }
        const t = freeTileInRect(rect, occupied)
        if (t) {
            const loot = [getRandomItem(undefined, undefined), getRandomItem(undefined, undefined)]
            tm.addEntity(new Container(t.x, t.y, "chest", loot))
            occupied.add(`${t.x},${t.y}`)
        }
        const s = freeTileInRect(rect, occupied)
        if (s) {
            tm.addEntity(new FortressStandard(s.x, s.y, profile.faction || profile.species))
            occupied.add(`${s.x},${s.y}`)
        }
    }

    const anchor = centerTile
        ? (findFreeNear(centerTile.x, centerTile.y, occupied) || freeTileInRect(rect, occupied))
        : freeTileInRect(rect, occupied)
    if (anchor) {
        const recipe = buildRecipe(profile, leaderKey, randInt(bandLo, bandHi))
        const { captain, members } = recipeApplier.apply(tm, recipe, anchor.x, anchor.y, occupied)
        const leaderEntry = profile.leaders[leaderKey] || {}
        if (deepest && leaderEntry.elite && captain) captain.addTag(eliteEnrager)
        bindBand(room, captain, members)
    }

    scatterDecor(deepest ? (form.decor || profile.props) : ["Tree", "Totem"], rect, occupied)
}

// Carve the interior into a sequence of gated compartments along the axis the
// player advances (perpendicular to the entrance), warlord deepest. Returns
// false if the room is too small to compartmentalize (caller falls back).
function spawnCompartments(room, profile, form, ring, gate, occupied) {
    const vertical = gate.inY !== 0
    const toXY = (depth, cross) => (vertical ? { x: cross, y: depth } : { x: depth, y: cross })

    // Open interior (inside the ring walls).
    const ax0 = ring.x0 + 1, ay0 = ring.y0 + 1, ax1 = ring.x1 - 1, ay1 = ring.y1 - 1
    const depthLo = vertical ? ay0 : ax0
    const depthHi = vertical ? ay1 : ax1
    const crossLo = vertical ? ax0 : ay0
    const crossHi = vertical ? ax1 : ay1
    const depthSize = depthHi - depthLo + 1
    if (depthSize < 2 * COMPARTMENT_DEPTH || crossHi - crossLo < 4) return false

    const N = clamp(Math.floor(depthSize / COMPARTMENT_DEPTH), 2, MAX_COMPARTMENTS)

    // Geometric bands (low->high depth), split by internal dividing walls.
    const wallDepths = []
    for (let i = 1; i < N; i++) wallDepths.push(Math.round(depthLo - 1 + i * (depthSize / N)))
    const edges = [depthLo - 1, ...wallDepths, depthHi + 1]
    const bandsGeo = []
    for (let i = 0; i < N; i++) bandsGeo.push({ lo: edges[i] + 1, hi: edges[i + 1] - 1 })

    // Order entrance -> deep. inward<0 means the entrance is at the high-depth
    // end, so reverse the geometric (low..high) order.
    const inward = vertical ? gate.inY : gate.inX
    const ordered = inward < 0 ? [...bandsGeo].reverse() : bandsGeo

    // Dividing walls + a locked gate in each (staggered side to side), with the
    // key on the entrance side of that gate.
    for (let oi = 0; oi < N - 1; oi++) {
        const entranceBand = ordered[oi]
        const wallDepth = inward < 0 ? entranceBand.lo - 1 : entranceBand.hi + 1
        const gateCross = (oi % 2 === 0) ? crossLo + 1 : crossHi - 1

        for (let c = crossLo; c <= crossHi; c++) {
            if (c === gateCross) continue
            const p = toXY(wallDepth, c)
            const key = `${p.x},${p.y}`
            if (occupied.has(key)) continue
            tm.addEntity(new FortressWall(p.x, p.y))
            occupied.add(key)
        }

        const gp = toXY(wallDepth, gateCross)
        tm.addEntity(new FortressGate(gp.x, gp.y, true))
        occupied.add(`${gp.x},${gp.y}`)
        for (const dd of [-1, 1]) {
            const lp = toXY(wallDepth + dd, gateCross)
            occupied.add(`${lp.x},${lp.y}`)
        }

        const keyTile = freeTileInRect(bandRectXY(toXY, entranceBand, crossLo, crossHi), occupied)
        if (keyTile) {
            tm.addEntity(new DungeonKey(keyTile.x, keyTile.y))
            occupied.add(`${keyTile.x},${keyTile.y}`)
        }
    }

    for (let oi = 0; oi < N; oi++) {
        const rect = bandRectXY(toXY, ordered[oi], crossLo, crossHi)
        populateCompartment(room, profile, form, rect, occupied, oi === N - 1)
    }
    return true
}

// Open-courtyard fallback for rooms too small to compartmentalize: a few
// distributed bands plus loose decor (the pre-compartment behavior).
function spawnOpenCamp(room, profile, form, occupied) {
    const total = randInt(form.members[0], form.members[1])
    const [bandLo, bandHi] = form.bandSize || [4, 6]
    const anchors = []
    let placed = 0

    const StructureClass = CENTERPIECES[form.centerpiece]
    let centerTile = null
    if (StructureClass) {
        const x = Math.floor(room.x + room.w / 2)
        for (let y = room.y + 2; y < room.y + room.h - 2; y++) {
            if (occupied.has(`${x},${y}`) || !isFloor(x, y)) continue
            tm.addEntity(new StructureClass(x, y))
            occupied.add(`${x},${y}`)
            centerTile = { x, y }
            break
        }
    }

    const standardSpot = freeTileInRect(
        { x0: room.x + 2, y0: room.y + 2, x1: room.x + room.w - 3, y1: room.y + room.h - 3 }, occupied)
    if (standardSpot) {
        tm.addEntity(new FortressStandard(standardSpot.x, standardSpot.y, profile.faction || profile.species))
        occupied.add(`${standardSpot.x},${standardSpot.y}`)
    }

    const interiorAnchor = () => {
        const rect = { x0: room.x + 2, y0: room.y + 2, x1: room.x + room.w - 3, y1: room.y + room.h - 3 }
        for (let i = 0; i < ANCHOR_PLACEMENT_ATTEMPTS; i++) {
            const t = freeTileInRect(rect, occupied)
            if (!t) return null
            if (anchors.some(a => Math.abs(a.x - t.x) + Math.abs(a.y - t.y) < MIN_ANCHOR_SPACING)) continue
            return t
        }
        return null
    }

    const leadAnchor = centerTile ? findFreeNear(centerTile.x, centerTile.y, occupied) : interiorAnchor()
    if (leadAnchor) {
        const recipe = buildRecipe(profile, form.leader, randInt(bandLo, bandHi))
        const { captain, members } = recipeApplier.apply(tm, recipe, leadAnchor.x, leadAnchor.y, occupied)
        const leaderEntry = profile.leaders[form.leader] || {}
        if (leaderEntry.elite && captain) captain.addTag(eliteEnrager)
        bindBand(room, captain, members)
        anchors.push(leadAnchor)
        placed += 1 + members.length
    }

    let safety = 40
    while (placed < total && safety-- > 0) {
        const anchor = interiorAnchor()
        if (!anchor) break
        const size = Math.max(1, Math.min(randInt(bandLo, bandHi), total - placed - 1))
        const recipe = buildRecipe(profile, form.bandLeader, size)
        const { captain, members } = recipeApplier.apply(tm, recipe, anchor.x, anchor.y, occupied)
        bindBand(room, captain, members)
        anchors.push(anchor)
        placed += 1 + members.length
    }

    const interior = { x0: room.x + 2, y0: room.y + 2, x1: room.x + room.w - 3, y1: room.y + room.h - 3 }
    scatterDecor(form.decor || profile.props, interior, occupied)
}

function spawnPerimeter(room, profile, form) {
    const ring = ringBounds(room)
    const gate = findGate(room, ring)
    const lane = gateLane(gate)

    const walls = new Set()
    buildPerimeter(ring, lane, walls)

    // Outer gate: closed but unlocked — the player breaches it freely, but it
    // still blocks the camp's enemies from wandering out the front.
    tm.addEntity(new FortressGate(gate.x, gate.y, false))

    const occupied = new Set([...walls, ...lane])

    if (!spawnCompartments(room, profile, form, ring, gate, occupied)) {
        spawnOpenCamp(room, profile, form, occupied)
    }
}

export default function spawnSettlement(room) {
    const spec = room.settlement
    if (!spec) return
    const profile = profilesBySpecies[spec.species]
    const form = forms[spec.form]
    if (!profile || !form) {
        console.warn(`spawnSettlement: no profile/form for "${spec.species}"/"${spec.form}"`)
        return
    }

    // Disposition is the faction seam: neutral settlements are non-hostile
    // (villages), everything else ships hostile as before. Carried on the spec
    // so the future faction system has it.
    spec.disposition = form.disposition || "hostile"

    // Darkness themes (the void faction) override the encampment layout with a
    // gloom-shrouded variant centered on a VoidRift. Resolved from profile data
    // (profile.darkness[form]) so it stays in the (species x form) system, not a
    // species branch. Only the encampment darkness variant is built so far — the
    // fortress / void-temple variant is next. See
    // documents/v3_darkness_settlements.md.
    const darkRadius = profile.darkness ? profile.darkness[spec.form] : null

    if (form.structure === "perimeter") {
        spawnPerimeter(room, profile, form)
    } else if (form.structure === "village") {
        spawnVillage(room, profile, form)
    } else if (form.structure === "encampment") {
        if (darkRadius != null) spawnDarkEncampment(room, profile, form, darkRadius)
        else spawnEncampment(room, profile, form)
    } else {
        spawnScatter(room, profile, form)
    }
}
