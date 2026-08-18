import Phaser from 'phaser'
import PF from 'pathfinding'
import tm from './TurnManager.js'
import mapState from './MapState.js'

// Navigation + visibility queries against the current floor.
//
// Reads:
//   - mapState.level (2D passability grid, 0 floor / 1 wall — authoritative
//     for walkability), mapState.map (Phaser tilemap) — owned by MapState
//   - tm.entities — runtime entity list
//
// What's in here:
//   - Walkability:    isWalkableTile, randomWalkableTile,
//                     randomWalkableTileInRoom, getRandomFloorTile
//   - Entity lookups: entityAtTile, isDoorAt, isBlockingDoorAt,
//                     containerAtTile
//   - Pathfinding:    gridForEntity, findPathToRandomReachable,
//                     distanceBetweenEntities
//   - Visibility:     hasLineOfSight
//
// Callers (BaseHero, BaseEnemy, archetypes, behavior tags, level
// populate paths) currently reach these through mapState.X delegates so
// existing imports keep working. New code should import this module
// directly.

// An entity's FOOTPRINT — how many tiles it covers, anchored TOP-LEFT at
// (entity.x, entity.y) and extending right and down. Almost everything in the
// game is 1x1 and declares nothing; only multi-tile props (a cottage, a rock
// formation, a wagon) set one.
//
// Top-left anchoring is not arbitrary: named tile REGIONS are stored the same
// way (col/row + w/h, see levels/tileRegions.js), so a region maps onto a prop's
// footprint with no transformation, and the frame at grid[r][c] belongs to the
// tile at (x + c, y + r).
export function footprintOf(entity) {
    const f = entity && entity.footprint
    const w = (f && f.w > 0) ? Math.floor(f.w) : 1
    const h = (f && f.h > 0) ? Math.floor(f.h) : 1
    return { w, h }
}

// Does `entity` cover tile (x, y)? The single place the "an entity is one tile"
// assumption was replaced — every occupancy test routes through here, so a
// multi-tile prop blocks its whole body rather than just the tile its sprite
// is anchored to. Degenerate case (no footprint) is the old exact-match test.
export function occupiesTile(entity, x, y) {
    if (!entity || entity.x == null || entity.y == null) return false
    const { w, h } = footprintOf(entity)
    if (w === 1 && h === 1) return entity.x == x && entity.y == y
    return x >= entity.x && x < entity.x + w && y >= entity.y && y < entity.y + h
}

// Mark every tile an entity covers as blocked in a pathfinding matrix. Bounds
// are checked per row/cell because a prop placed at the map edge (or one whose
// authored footprint overruns the grid) would otherwise write outside it.
function stampFootprint(matrix, entity) {
    const { w, h } = footprintOf(entity)
    for (let dy = 0; dy < h; dy++) {
        const row = matrix[entity.y + dy]
        if (!row) continue
        for (let dx = 0; dx < w; dx++) {
            if (row[entity.x + dx] !== undefined) row[entity.x + dx] = 1
        }
    }
}

class WorldQueries {
    isWalkableTile(x, y) {
        // Bounds guard — getTileAt returns null for out-of-bounds tiles,
        // and the .index read below would throw. Tripped by arena edge
        // wanderers (orderBias.tryIdleWander) and earlier by Dash's
        // longer-range probe. Treating out-of-bounds as not-walkable is
        // the right answer for every caller.
        if (!mapState.level || !mapState.level[y] || mapState.level[y][x] === undefined) {
            return false
        }
        // Entity occupancy first — even on a floor tile, an entity blocks.
        // Exception: an open door is passable like floor.
        let allEntities = [...tm.entities]
        for (let e = 0; e < allEntities.length; e++) {
            let entity = allEntities[e]
            if (entity.sprite && occupiesTile(entity, x, y)) {
                if (entity.type === "door" && entity.state === "open") continue
                // Walk-over dressing (flowers, pebbles, debris) is scenery, not an
                // obstacle — everything passes through it. It stays a real entity
                // so it persists across floor revisits and can be looked at.
                if (entity.walkable) continue
                return false
            }
        }
        // Then terrain. The passability GRID is authoritative (0 = floor, 1 =
        // wall) and painted into the tilemap once at bind, never mutated at
        // runtime (doors/passages block via entity occupancy above, not grid
        // edits). Reading the grid rather than the painted frame lets a realm
        // sample walls from a LIST of frames (design §15.10) without a
        // non-primary wall frame reading as walkable — equivalent to the old
        // `index !== sprites.wall` test while the grid stays 0/1.
        return mapState.level[y][x] !== 1
    }

    randomWalkableTile() {
        // Doors block pathfinding by default, so skip them as AI destinations
        // even though they sit on floor tiles in the underlying level grid.
        let x = Phaser.Math.Between(0, mapState.level[0].length - 1)
        let y = Phaser.Math.Between(0, mapState.level.length - 1)
        while (mapState.level[y] === undefined || mapState.level[y][x] !== 0 || this.isDoorAt(x, y)) {
            x = Phaser.Math.Between(0, mapState.level[0].length - 1)
            y = Phaser.Math.Between(0, mapState.level.length - 1)
        }
        return { x, y }
    }

    randomWalkableTileInRoom(x, y, w, h) {
        let rx = Phaser.Math.Between(x, (x + w) - 1)
        let ry = Phaser.Math.Between(y, (y + h) - 1)
        while (mapState.level[ry] === undefined || mapState.level[ry][rx] !== 0 || this.isDoorAt(rx, ry)) {
            rx = Phaser.Math.Between(x, (x + w) - 1)
            ry = Phaser.Math.Between(y, (y + h) - 1)
        }
        return { x: rx, y: ry }
    }

    // Nearest walkable tile to (cx, cy), spiralling outward in Chebyshev rings —
    // preferring an UNOCCUPIED one, falling back to any walkable, then (cx, cy). Used
    // to re-place the hero's party beside them on a floor transition and to drop a
    // spawned companion next to its summoner.
    freeWalkableTileNear(cx, cy, maxRadius = 8) {
        let walkableFallback = null
        for (let r = 1; r <= maxRadius; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
                    const x = cx + dx, y = cy + dy
                    if (!this.isWalkableTile(x, y)) continue
                    if (!this.entityAtTile(x, y)) return { x, y }
                    if (!walkableFallback) walkableFallback = { x, y }
                }
            }
        }
        return walkableFallback || { x: cx, y: cy }
    }

    findPathToRandomReachable(entity, maxAttempts = 5) {
        for (let i = 0; i < maxAttempts; i++) {
            const dest = this.randomWalkableTile()
            const grid = this.gridForEntity(entity)
            const finder = new PF.AStarFinder()
            const path = finder.findPath(entity.x, entity.y, dest.x, dest.y, grid)
            if (path.length > 1) {
                return { path, destX: dest.x, destY: dest.y }
            }
        }
        return null
    }

    gridForEntity(entity) {
        // Doors live in the entity layer, not the level grid (so the grid
        // stays a pristine, reusable BSP snapshot). Stamp them onto a clone
        // here: closed/locked doors are walls by default; Crafty enemies get
        // to pathfind through closed (non-locked) doors. Open doors are
        // passable for everyone — no stamp.
        //
        // Other enemies are also stamped as blocked so pathfinding routes
        // around squad-mates rather than through them. The hero is
        // deliberately left walkable so enemies can still plan a path TO
        // the player; the final step onto the hero tile is rejected in
        // dungeon.stepEntityTo.
        const matrix = mapState.level.map(row => row.slice())
        const isCrafty = entity && entity._tags && entity._tags.includes("Crafty")
        for (const e of tm.entities) {
            if (e.type === "door") {
                if (e.state === "open") continue
                if (!isCrafty || e.state === "locked") {
                    matrix[e.y][e.x] = 1
                }
            } else if (e.type === "portal") {
                // Hidden portals read as a wall to pathfinding (only the hero
                // searches secrets, §15.9). Cross-floor portals are heroOnly, so
                // they're walls to enemies too. Same-floor ACTIVE portals stay
                // walkable so enemies/allies can path onto one and teleport — the
                // teleport itself is handled in dungeon.stepEntityTo.
                if (e.state !== "active" || e.heroOnly) matrix[e.y][e.x] = 1
            } else if ((e.type === "enemy" || e.type === "ally") && e !== entity) {
                // Enemies AND allies are solid bodies that pathing routes around
                // — so a follower body-blocks a corridor for the hero, and units
                // don't plan straight through one another. The hero is never
                // stamped (it doesn't pathfind, and enemies need a walkable goal
                // tile to plan a path toward it).
                matrix[e.y][e.x] = 1
            } else if (e.blocksPath) {
                // Settlement structures (palisade walls, war-hall, watchtower)
                // live in the entity layer like doors. Stamp them as blocked so
                // enemies route around the camp wall to the gate rather than
                // planning a path straight through a stake. LOS is intentionally
                // NOT blocked this pass (see documents/v3_enemy_settlements.md).
                // Whole footprint — a multi-tile prop must be routed around in
                // full, not just at the corner its sprite is anchored to.
                stampFootprint(matrix, e)
            }
        }
        // Safe room (active rest camp, or a permanently pacified room type like
        // a neutral village): enemies treat the whole room as blocked so they
        // route around it and never plan a path inside. Enemy pathing only —
        // the hero is never stamped out of its own camp.
        if (entity && entity.type === "enemy" && mapState.rooms) {
            for (const room of mapState.rooms) {
                if (!room.restSafe && !room.pacified) continue
                for (let yy = room.y; yy < room.y + room.h; yy++) {
                    for (let xx = room.x; xx < room.x + room.w; xx++) {
                        if (matrix[yy] && matrix[yy][xx] !== undefined) matrix[yy][xx] = 1
                    }
                }
            }
        }
        return new PF.Grid(matrix)
    }

    // A* path for `entity` to (tx,ty) as an array of {x,y} steps AFTER the start
    // tile (empty if unreachable). Reuses gridForEntity occupancy (walls + closed
    // doors + other bodies blocked) so the hero routes around obstacles exactly
    // like enemy pathing. `stopAdjacent`: treat the goal tile as walkable and drop
    // the final step, so travel halts NEXT TO a target entity (whose tile is
    // otherwise stamped blocked) rather than onto it.
    findPath(entity, tx, ty, { stopAdjacent = false } = {}) {
        const grid = this.gridForEntity(entity)
        if (stopAdjacent && grid.isInside(tx, ty)) grid.setWalkableAt(tx, ty, true)
        const finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true })
        const nodes = finder.findPath(entity.x, entity.y, tx, ty, grid)
        if (!nodes || nodes.length < 2) return []
        let tiles = nodes.slice(1).map(([x, y]) => ({ x, y }))
        if (stopAdjacent) tiles = tiles.slice(0, -1)
        return tiles
    }

    getRandomFloorTile() {
        let x, y
        do {
            x = Math.floor(Math.random() * mapState.level[0].length)
            y = Math.floor(Math.random() * mapState.level.length)
        } while (!this.isWalkableTile(x, y))
        return { x, y }
    }

    entityAtTile(x, y) {
        let allEntities = [...tm.entities]
        for (let e = 0; e < allEntities.length; e++) {
            let entity = allEntities[e]
            // Walk-over dressing is never "the thing at this tile" — anything
            // else can stand on it, and callers use this to find what to bump,
            // attack or route around. Returning a flower instead of the enemy
            // standing in it would be actively wrong.
            if (entity.walkable) continue
            if (entity.sprite && occupiesTile(entity, x, y)) {
                return entity
            }
        }
        return false
    }

    // A blocking structure (wall segment / palisade / war-hall — anything with
    // blocksPath) that stops `entity` from entering (x, y). Faction-aware: a
    // friendly barrier (friendly === entity.type) lets that side pass; structures
    // with no `friendly` marker block everyone. entityAtTile already catches
    // sprited blockers; this also catches the sprite-LESS faction walls so a
    // shoved or charging enemy collides with the wall instead of landing on it.
    blockingStructureAt(x, y, entity) {
        for (const e of tm.entities) {
            if (!occupiesTile(e, x, y)) continue
            if (!e.blocksPath) continue
            if (e.friendly && entity && entity.type === e.friendly) continue
            return e
        }
        return null
    }

    isDoorAt(x, y) {
        for (const e of tm.entities) {
            if (e.type === "door" && e.x === x && e.y === y) return true
        }
        return false
    }

    // A "sturdy" wall — an indestructible / story wall that the phasing abilities
    // (Breach, Dig) cannot pass through, unlike an ordinary shallow dungeon wall.
    // Stored as a Set of "x,y" keys on mapState, populated by the generator /
    // story; empty by default (no instances yet). The terrain counterpart to a
    // locked door for the phasing abilities.
    isSturdyWallAt(x, y) {
        return mapState.sturdyWalls instanceof Set && mapState.sturdyWalls.has(`${x},${y}`)
    }

    // True if (x, y) is a dungeon wall a phasing ability may pass THROUGH: a solid
    // level wall (=== 1) that is NOT marked sturdy. Player/faction wall segments
    // are sprite-less and handled separately via blockingStructureAt.
    isBreachableWallAt(x, y) {
        return mapState.level?.[y]?.[x] === 1 && !this.isSturdyWallAt(x, y)
    }

    isBlockingDoorAt(x, y) {
        for (const e of tm.entities) {
            if (e.type === "door" && e.x === x && e.y === y && e.state !== "open") return true
        }
        return false
    }

    // Whether a tile blocks line-of-sight. Opaque entities (palisade walls,
    // solid structures) block; so do shut solid doors. A see-through entity —
    // a barred gate — does NOT block even when closed, so you and the camp's
    // enemies can see each other through the bars but not through a wall.
    isSightBlockedAt(x, y) {
        for (const e of tm.entities) {
            if (!occupiesTile(e, x, y)) continue
            if (e.blocksSight) return true
            if (e.type === "door" && !e.seeThrough && e.state !== "open") return true
        }
        return false
    }

    containerAtTile(x, y) {
        // Scans specifically for containers so the caller can merge a drop
        // into an existing bag/chest. entityAtTile would return the first
        // match (often the player, on their own drop tile), missing the
        // container sitting underneath.
        for (const e of tm.entities) {
            if (e.type === "container" && e.x === x && e.y === y) return e
        }
        return null
    }

    hasLineOfSight(from, to) {
        let x0 = from.x, y0 = from.y
        const x1 = to.x, y1 = to.y
        const dx = Math.abs(x1 - x0)
        const dy = Math.abs(y1 - y0)
        const sx = x0 < x1 ? 1 : -1
        const sy = y0 < y1 ? 1 : -1
        let err = dx - dy

        while (x0 !== x1 || y0 !== y1) {
            const e2 = 2 * err
            if (e2 > -dy) { err -= dy; x0 += sx }
            if (e2 < dx) { err += dx; y0 += sy }
            if (x0 === x1 && y0 === y1) break
            if (!mapState.level[y0] || mapState.level[y0][x0] === undefined) return false
            if (mapState.level[y0][x0] === 1) return false
            if (this.isSightBlockedAt(x0, y0)) return false
        }
        return true
    }

    // A projectile-blocking entity sitting on (x, y) that stops `attacker`'s shot.
    // Faction-aware: a barrier friendly to the attacker's own side lets its shots
    // pass (the caster fires through their own force wall), like a body passing it.
    // School-aware: a wall that only stops physical shots lets a magic projectile
    // through unless it also blocksMagic (the arcane wall's niche).
    projectileBlockerAt(x, y, attacker, magic = false) {
        for (const e of tm.entities) {
            if (!occupiesTile(e, x, y)) continue
            if (!e.blocksProjectile) continue
            if (e.friendly && attacker && attacker.type === e.friendly) continue
            if (magic && !e.blocksMagic) continue
            return e
        }
        return null
    }

    // Whether a projectile from `from` to `to` has a clear flight path. Same
    // Bresenham walk as hasLineOfSight, but keyed to PROJECTILE occlusion: solid
    // terrain stops everything, and wall barriers stop shots per faction/school
    // (so a SEE-THROUGH ice/force wall halts an arrow without blocking vision).
    // `magic` true = a spell projectile, stopped only by walls that blocksMagic.
    hasProjectilePath(from, to, attacker = null, magic = false) {
        let x0 = from.x, y0 = from.y
        const x1 = to.x, y1 = to.y
        const dx = Math.abs(x1 - x0)
        const dy = Math.abs(y1 - y0)
        const sx = x0 < x1 ? 1 : -1
        const sy = y0 < y1 ? 1 : -1
        let err = dx - dy

        while (x0 !== x1 || y0 !== y1) {
            const e2 = 2 * err
            if (e2 > -dy) { err -= dy; x0 += sx }
            if (e2 < dx) { err += dx; y0 += sy }
            if (x0 === x1 && y0 === y1) break
            if (!mapState.level[y0] || mapState.level[y0][x0] === undefined) return false
            if (mapState.level[y0][x0] === 1) return false
            if (this.projectileBlockerAt(x0, y0, attacker, magic)) return false
        }
        return true
    }

    distanceBetweenEntities(e1, e2) {
        // Stamp closed/locked door tiles as walls so adjacency checks like
        // `<= 2` don't silently treat enemies on the other side of a closed
        // door as in melee range. Open doors stay passable — they no longer
        // separate adjacent tiles. (Mirrors gridForEntity, but symmetric —
        // Crafty isn't a factor here, every closed door blocks.)
        const matrix = mapState.level.map(row => row.slice())
        for (const e of tm.entities) {
            // Shut doors AND settlement walls/structures break adjacency, so an
            // enemy can't melee the player through a palisade or a closed gate.
            if (e.type === "door" && e.state !== "open") matrix[e.y][e.x] = 1
            else if (e.blocksPath) stampFootprint(matrix, e)
        }
        let grid = new PF.Grid(matrix)
        let finder = new PF.AStarFinder({
            allowDiagonal: true
        })
        let path = finder.findPath(e1.x, e1.y, e2.x, e2.y, grid)
        if (path.length >= 2) {
            return path.length
        } else {
            // No path. Returning Infinity (not false) so callers using `<=`
            // distance comparisons treat unreachable as "out of range" rather
            // than "in range" — false coerces to 0, which silently passed
            // adjacency checks like `<= 2` for enemies blocked by doors.
            return Infinity
        }
    }
}

export default new WorldQueries()
