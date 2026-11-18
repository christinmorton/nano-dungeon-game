import Phaser from "phaser"
import mapState from "../MapState.js"
import tm from "../TurnManager.js"
import Container from "../items/Container.js"
import { makeItem, lootKeysForFloor } from "../items/itemProfiles.js"
import { LEGENDARY_KEYS } from "../items/profiles/legendaries.js"
import { getRandomEnemy, getRandomEnemyOfTypes } from "../Enemies.js"
import { strongholdByKey } from "./strongholds.js"
import eliteEnrager from "../tags/eliteEnrager.js"
import gameLog from "../GameLog.js"
import furnish from "./furnish.js"
import Shopkeeper from "../items/Shopkeeper.js"
import Campfire from "../items/Campfire.js"
import CorruptedSkull from "../items/CorruptedSkull.js"
import { resolveArt } from "../assetLoader.js"

// Floor population — what goes into a room once the geometry exists.
//
// v3's version is 347 lines with twenty-four imports, more than any other file in
// the port. It reaches settlements, recipe loaders, cosmic beings, pact givers,
// essence fonts, grove rooms, duelist gates that seal doors behind you, and the
// furnisher — nearly all of it cut by scope doc section 6. Pruning it would have
// meant unpicking those twenty-four threads; writing it small is a fraction of the
// work, and this is the file the "write the registries, don't prune them" rule was
// really about.
//
// Enemies now land through spawnEnemies() below, and rollElite() promotes one of
// them per floor (see the bottom of this file). An older comment here said elite
// promotion needed tags v5 had not carried — that stopped being true once
// `tags/eliteEnrager.js` came across for the stronghold leader.

// lootKeysForFloor, not every registered profile: enemy-only gear (the Dark
// Sorcerer's conduit) and the legendaries are in the registry so makeItem can
// build them, and must never arrive through an ordinary roll — and a deep-floor
// weapon (`minFloor`, §10.16) must not arrive early.

// Chest tiers by floor (scope doc §10.12). The sprite is the loot signal, so the
// rare chest has to stay rare — seeing one should be an event, not scenery.
//
// Index is the floor index (0-based), so floor 1 is index 0. The run is five
// floors: ordinary chests for the first two, the wooden chest appearing from the
// second, and the ornate chest only in the back half where a legendary is a
// reward for having got that deep rather than a lucky opening roll.
const CHEST_TIER_WEIGHTS = [
    { common: 1.00, uncommon: 0.00, rare: 0.00 },   // floor 1 — teach the shape
    { common: 0.70, uncommon: 0.30, rare: 0.00 },   // floor 2
    { common: 0.50, uncommon: 0.38, rare: 0.12 },   // floor 3 — first ornate
    { common: 0.35, uncommon: 0.45, rare: 0.20 },   // floor 4
    { common: 0.25, uncommon: 0.45, rare: 0.30 },   // floor 5 — the stronghold
]

// Chance an ORNATE chest holds a legendary instead of ordinary loot. Deliberately
// not 1.0: if every rare chest were guaranteed, the sprite would stop being a
// promise and start being a vending machine. At these rates a run sees roughly
// one legendary, which is what makes it the thing you remember.
const LEGENDARY_CHANCE_IN_RARE = 0.55

// Pick a chest tier for the current floor.
function rollChestTier(floor) {
    const w = CHEST_TIER_WEIGHTS[Math.min(floor, CHEST_TIER_WEIGHTS.length - 1)]
        || CHEST_TIER_WEIGHTS[0]
    const roll = Math.random()
    if (roll < w.rare) return "rare"
    if (roll < w.rare + w.uncommon) return "uncommon"
    return "common"
}

// Build the contents for a chest of `tier`. Only an ornate chest can yield a
// legendary, and only then on its own roll.
function chestContents(tier) {
    if (tier === "rare" && Math.random() < LEGENDARY_CHANCE_IN_RARE) {
        const key = Phaser.Utils.Array.GetRandom(LEGENDARY_KEYS)
        return [makeItem(key)]
    }
    // An uncommon chest is better by QUANTITY rather than by a rarity tier that
    // does not exist — v5 items are flat (§5). Two rolls beats one.
    const count = tier === "common" ? 1 : 2
    return Array.from({ length: count }, () => makeItem(randomItemKey()))
}

// Enemies per room by kind, as [min, max] inclusive. The camp is safe by
// definition; the starting room is skipped before this is reached; a secret room
// is a pure loot payoff and stays unguarded, which is what makes finding one feel
// like a reward rather than another fight.
const ENEMIES_BY_KIND = {
    treasure: [1, 3],   // guarded loot
    camp: [0, 0],
    secret: [0, 0],
}
const DEFAULT_ENEMIES = [1, 2]

// Chests per room by kind. A plain room usually holds nothing; treasure and
// secret rooms are the payoff, secret ones dialed up since they cost a search.
// The camp pays out through the shopkeeper, so it holds no free loot.
const CHESTS_BY_KIND = {
    treasure: 3,
    secret: 4,
    camp: 0,
    starting: 0,
}
const DEFAULT_CHESTS = 0

// Chance a plain room holds a chest, and (failing that) a loose floor item.
const PLAIN_ROOM_CHEST_CHANCE = 0.25
const LOOSE_ITEM_CHANCE = 0.35

// A stronghold floor is inhabited, so its rooms are fuller than an ordinary
// floor's. This is most of what makes it read as a place rather than a level.
const STRONGHOLD_ENEMIES = [2, 4]

// The Corrupted Skull (scope doc §10.18): chance a Dark Priest spawns with its
// power source beside it, and the first floor index it can. A Necromancer
// leader always has one.
const SKULL_CHANCE = 0.5
const SKULL_MIN_FLOOR = 1

// Elite promotion scales by floor index, so the roll is `chance * floor`. At 0.25
// that reads: floor 1 (the second floor) 25%, floor 2 50%, floor 3 75%, floor 4
// 100% — but floor 4 is the stronghold, which is excluded, so in practice the last
// ordinary floor is 75%.
const ELITE_CHANCE_PER_FLOOR = 0.25

function randomItemKey() {
    return Phaser.Utils.Array.GetRandom(lootKeysForFloor(mapState.levelManager.currentLevel))
}

export default function spawnFromTable(regions) {
    // A stronghold floor draws every enemy from one resident species set and puts
    // a leader in the deepest room. The flag rides the level's config, set once
    // per run in MapState.start. Null on an ordinary floor.
    const level = mapState.levelManager.getCurrent()
    const stronghold = strongholdByKey(level && level.config && level.config.stronghold)
    if (stronghold) {
        gameLog.log(`You have entered the ${stronghold.label}.`)
    }
    // The leader stands in the room furthest from the start — the same rule
    // Quest.goalRoom uses to place the Amulet, so on the last floor the leader is
    // guarding the win item rather than standing somewhere unrelated.
    const leaderRoom = stronghold ? furthestFromStart(regions) : null

    for (const room of regions) {
        // Dress the room BEFORE anything is placed in it, so chests and enemies
        // land on tiles the furniture left open — via freeTile/blockerTile below,
        // which check entity occupancy. (randomWalkableTileInRoom does NOT: it
        // reads only the passability grid, which is how chests ended up on crates
        // and enemies on chests.) Every room, the starting one included — the
        // first thing the player sees should look like the realm too.
        furnish(room)
        if (room.kind === "starting") continue

        // The camp (scope doc §10.11): a shopkeeper and a campfire in one safe
        // room. Placed BEFORE the loot/enemy passes below and returned from
        // early, so nothing else lands in it — a camp with a chest in the corner
        // stops reading as a sanctuary, and the kind tables above already zero
        // its enemies and chests.
        if (room.kind === "camp") {
            spawnCamp(room)
            continue
        }

        const chests = CHESTS_BY_KIND[room.kind] ?? DEFAULT_CHESTS
        const floor = mapState.levelManager.currentLevel
        for (let i = 0; i < chests; i++) {
            // A chest BLOCKS — bumping it is a wall hit, and it stays after it
            // is emptied — so it must never stand on a choke. A room with no
            // qualifying tile simply gets one chest fewer.
            const tile = blockerTile(room)
            if (!tile) continue
            // Contents are built with no position — the item lives inside the
            // chest until taken, and only then gets placed.
            const tier = rollChestTier(floor)
            tm.addEntity(new Container(tile.x, tile.y, "chest", chestContents(tier), tier))
        }

        // A plain room may hold a loose item or a chest, so exploring an ordinary
        // room is not always empty-handed. Without this, loot lives ONLY in
        // treasure and secret rooms — roughly one room per floor — and a run reads
        // as though nothing drops at all.
        if (chests === 0 && room.kind !== "camp") {
            if (Math.random() < PLAIN_ROOM_CHEST_CHANCE) {
                const tile = blockerTile(room)
                if (tile) {
                    const tier = rollChestTier(floor)
                    tm.addEntity(new Container(tile.x, tile.y, "chest", chestContents(tier), tier))
                }
            } else if (Math.random() < LOOSE_ITEM_CHANCE) {
                // A loose item is picked up by walking onto it, so it blocks
                // nothing — but under a crate it could never be reached, hence
                // a free tile rather than any floor tile.
                const tile = freeTile(room)
                if (tile) tm.addEntity(makeItem(randomItemKey(), tile.x, tile.y))
            }
        }

        spawnEnemies(room, stronghold)
        if (stronghold && room === leaderRoom) spawnLeader(room, stronghold)
    }
}

// The camp: a campfire near the middle of the room with the shopkeeper standing
// beside it (scope doc §10.11).
//
// Both entities BLOCK, so they are placed on separate tiles and each is checked
// for walkable neighbours: an interactable the hero cannot stand next to cannot
// be interacted with, because the adjacent-interact scan only looks at the four
// cardinals. The campfire takes the centre and the shopkeeper the best cardinal
// beside it, which also composes the room — the merchant reads as sheltering by
// the fire rather than as two props dropped in a box.
//
// `room.restSafe` is set by the Campfire itself, not here, so the flag always
// travels with the thing that justifies it.
function spawnCamp(room) {
    const cx = Math.floor(room.x + room.w / 2)
    const cy = Math.floor(room.y + room.h / 2)

    const fire = placeableTile(room, cx, cy)
    if (!fire) return
    tm.addEntity(new Campfire(fire.x, fire.y))

    // Prefer a tile beside the fire; fall back to anywhere free in the room so a
    // cramped or awkwardly furnished camp still gets its merchant.
    const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dy]) => ({ x: fire.x + dx, y: fire.y + dy }))
        .find(t => isFreeTile(t.x, t.y) && hasWalkableNeighbour(t.x, t.y) && !mapState.wouldSplitFloor(t.x, t.y))
    const spot = beside || placeableTile(room, cx, cy)
    if (!spot) return
    tm.addEntity(new Shopkeeper(spot.x, spot.y))
}

// A tile is free if it is walkable floor with nothing already standing on it.
// mapState.entityAtTile is what the generator's other passes use, so furniture
// placed by furnish(room) is respected here too.
function isFreeTile(x, y) {
    return mapState.isWalkableTile(x, y) && !mapState.entityAtTile(x, y)
}

// Does this tile have at least one open cardinal neighbour? A blocking prop with
// no free side is unreachable by the interact scan.
function hasWalkableNeighbour(x, y) {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dx, dy]) => isFreeTile(x + dx, y + dy))
}

// A random FREE floor tile in the room, or null when none turns up. The
// difference from randomWalkableTileInRoom is the occupancy check: that picker
// reads only the passability grid, so on its own it put chests on crates,
// enemies on chests, and either on the stairs (about a third of floors, in the
// 2026-10-03 simulation). Every spawn in this file goes through here.
function freeTile(room, tries = 20) {
    for (let i = 0; i < tries; i++) {
        const t = mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
        if (t && isFreeTile(t.x, t.y)) return t
    }
    return null
}

// A tile a BLOCKING entity may stand on: free, and not a choke whose loss would
// split the floor (mapState.wouldSplitFloor — the same test the furnisher runs
// for its crates and urns). Null when nothing qualifies; the caller then skips
// the piece rather than sealing a doorway for it.
function blockerTile(room, tries = 20) {
    for (let i = 0; i < tries; i++) {
        const t = freeTile(room, 1)
        if (t && !mapState.wouldSplitFloor(t.x, t.y)) return t
    }
    return null
}

// The preferred tile if it works, otherwise a random free one in the room. Both
// paths require an open neighbour, so whatever is placed can be walked up to,
// and neither may sit on a choke — the camp's two pieces block like a chest.
function placeableTile(room, preferX, preferY) {
    const fits = (x, y) => isFreeTile(x, y) && hasWalkableNeighbour(x, y) && !mapState.wouldSplitFloor(x, y)
    if (fits(preferX, preferY)) return { x: preferX, y: preferY }
    for (let i = 0; i < 20; i++) {
        const t = freeTile(room, 1)
        if (t && fits(t.x, t.y)) return t
    }
    return null
}

// The room furthest from the starting room, by centre-to-centre distance. Mirrors
// Quest.goalRoom so the leader and the Amulet end up in the same place.
function furthestFromStart(regions) {
    const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
    const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    const start = regions.find(r => r.kind === "starting")
    const others = regions.filter(r => r.kind !== "starting")
    if (!others.length) return null
    if (!start) return others[0]
    const sc = centre(start)
    return others.reduce(
        (best, r) => (dist2(centre(r), sc) > best.d ? { r, d: dist2(centre(r), sc) } : best),
        { r: others[0], d: -1 }
    ).r
}

// The stronghold's leader: one elite of the theme's leader species, standing in
// the deepest room. eliteEnrager carries v3's whole elite package — HP x4, +3 STR,
// an extra MP and AP, a 20% block against the hero, a rage below half health, and
// a better drop — so the fight is a real step up from the floor around it without
// needing a bespoke boss class.
function spawnLeader(room, stronghold) {
    const tile = freeTile(room)
    if (!tile) return
    const floor = mapState.levelManager.currentLevel
    // `plain`: no depth scaling and no title (scope doc §10.15). The leader is
    // re-finalized onto its own template just below, which would wipe a depth
    // bump anyway, and a title's initialize would have run against the wrong
    // stats; the elite package below is the leader's scaling.
    const leader = getRandomEnemyOfTypes([stronghold.leader], tile.x, tile.y, floor, { plain: true })
    if (!leader) return

    // THE BOSS AI (scope doc §10.13). Assigned explicitly, overriding whatever its
    // species' archetypePool rolled — an Ogre draws hunter / patrolling /
    // goingSomewhere, which are ambient-monster behaviours, and that is why the
    // leader used to stand on its tile or walk a patrol line instead of fighting.
    // Set BEFORE applyArchetypeStats so the leader archetype's own stat template
    // and hpFormula are the ones that apply.
    leader.archetype = "leader"
    leader._spawnFinalized = false
    leader.finalizeSpawn()

    // ASLEEP UNTIL STRUCK. `passive` is an existing stance: updatePerception
    // refuses to alert a passive enemy, and BaseEnemy.onDamaged already flips a
    // struck passive to aggressive and alerts it. So the whole wake-on-hit rule
    // is these two lines — no new mechanism, and the leader archetype only has to
    // describe what happens once it is awake.
    //
    // Deliberately skippable: the Amulet is in this room and taking it ends the
    // run, so a player who crosses a sleeping giant's chamber to grab it wins
    // without a fight. That is the risk-for-reward ending, and it is the user's
    // call (§10.13).
    leader.stance = "passive"
    leader.applyStance()

    leader.addTag(eliteEnrager)

    // AFTER eliteEnrager, which sets its own red elite tint and writes it onto the
    // sprite. A corrupted leader has authored void art, so the reskin has to win —
    // applied here it replaces the texture and (having been reskinned) takes no
    // tint, leaving the sprite the colour it was drawn. On a non-corrupted theme
    // this is a no-op and the elite red stands.
    applyStrongholdLook(leader, stronghold)
    if (stronghold.art && stronghold.art[leader.constructor.name]) {
        leader.tint = null
        if (leader.sprite) leader.sprite.clearTint()
    }

    // addTag prepended "Elite " to the species name; the title reads better alone
    // and tells the player what they have walked into.
    leader.name = stronghold.leaderTitle
    tm.addEntity(leader)
    gameLog.log(`The ${stronghold.leaderTitle} broods over this place.`)
    // A priest-leader (the Necromancer) always has its skull (§10.18).
    if (leader.constructor.name === "DarkSorcerer") spawnSkullBeside(leader, room, floor)
}

// Place a Corrupted Skull on a free, non-choke tile within two of `priest`,
// inside the room, and bind the two. Silently does nothing if no tile fits —
// a priest without a skull is still a priest.
function spawnSkullBeside(priest, room, floor) {
    for (let r = 1; r <= 2; r++) {
        const ring = []
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
                const x = priest.x + dx, y = priest.y + dy
                if (room && !room.contains(x, y)) continue
                if (!isFreeTile(x, y) || mapState.wouldSplitFloor(x, y)) continue
                ring.push({ x, y })
            }
        }
        if (!ring.length) continue
        const tile = Phaser.Utils.Array.GetRandom(ring)
        const skull = new CorruptedSkull(tile.x, tile.y, { priest, room, floor })
        tm.addEntity(skull)
        priest._skull = skull
        gameLog.log(`A corrupted skull pulses beside the ${priest.name}.`)
        return skull
    }
    return null
}

// Apply a stronghold theme's cosmetic overrides to one spawned enemy.
//
// A corrupted settlement is the ordinary roster wearing the void's face: `art`
// swaps the sprite for a void reskin keyed by CLASS NAME, and `tint` washes
// anything with no reskin toward the same palette so the floor stays coherent
// where the art runs out. Cosmetic only — no stats, no AI, no new enemy classes,
// so the ~10 enemy cap does not move (scope doc §10.13).
//
// Keyed on constructor.name for the same reason enemyArt.js is, and with the same
// caveat: a new enemy class is invisible to this map until named in it.
// The SPRITE ALREADY EXISTS by the time we get here: each enemy constructor ends
// in dungeon.initializeEntity(this), which reads entity.art and builds it. So
// setting `.art` alone changes nothing visible — the texture has to be swapped on
// the live sprite too. Both are set: `.art` so anything that re-resolves later
// (icons, tooltips) agrees with what is on screen, and setTexture so the floor
// does.
function applyStrongholdLook(enemy, stronghold) {
    if (!enemy || !stronghold) return
    const reskin = stronghold.art && stronghold.art[enemy.constructor.name]
    if (reskin) {
        const art = resolveArt(reskin)
        const scene = enemy.sprite && enemy.sprite.scene
        if (art && scene && scene.textures.exists(art.key)) {
            enemy.art = reskin
            enemy.sprite.setTexture(art.key)
            // Re-fit: the void art is 48px native and the enemy it replaces may
            // not be, so the inherited scale would be wrong.
            enemy.sprite.setScale(mapState.tileSize / art.nativeSize)
            return
        }
        // Art declared but not loaded — fall through to the tint so the enemy
        // still reads as corrupted rather than silently looking ordinary.
    }
    if (stronghold.tint) {
        // Only tint what was NOT reskinned — a void sprite is already the right
        // colour, and tinting it again muddies art that was authored for this.
        enemy.tint = stronghold.tint
        if (enemy.sprite) enemy.sprite.tint = stronghold.tint
    }
}

// Populate a room with enemies, count by room kind and species by floor depth
// (Enemies.getRandomEnemy tier-filters against the floor index).
//
// No room affiliation is recorded. v3 stamped `enemy.spawnRoom` so the encounter
// manager could let a room's cohort join one battle together while a wandering
// enemy phased through it — but encounters are cut, so every enemy here acts
// independently on its own turn.
function spawnEnemies(room, stronghold) {
    const byKind = ENEMIES_BY_KIND[room.kind]
    // A stronghold's residents fill the whole place — but a room the kind table
    // explicitly empties (shop, rest, secret) stays empty, so the safe rooms are
    // still safe and finding a secret room is still a reward rather than an ambush.
    const [min, max] = (stronghold && (byKind === undefined || byKind[1] > 0))
        ? STRONGHOLD_ENEMIES
        : (byKind ?? DEFAULT_ENEMIES)
    if (max <= 0) return
    const count = min + Math.floor(Math.random() * (max - min + 1))
    const floor = mapState.levelManager.currentLevel

    for (let i = 0; i < count; i++) {
        // Free, not merely floor: an enemy spawned on a chest or a crate is
        // invisible to the bump dispatch, which finds the chest first.
        const tile = freeTile(room)
        if (!tile) continue
        const enemy = stronghold
            ? getRandomEnemyOfTypes(stronghold.species, tile.x, tile.y, floor)
            : getRandomEnemy(tile.x, tile.y, floor)
        if (!enemy) continue
        // Corrupted themes reskin/tint the ordinary roster (§10.13).
        applyStrongholdLook(enemy, stronghold)
        tm.addEntity(enemy)
        // A priest may bring its skull (§10.18) — after tm.addEntity, so the
        // skull's free-tile scan sees the priest standing where it stands.
        if (enemy.constructor.name === "DarkSorcerer" && floor >= SKULL_MIN_FLOOR && Math.random() < SKULL_CHANCE) {
            spawnSkullBeside(enemy, room, floor)
        }
    }
}

// Elite promotion — picks one enemy already on the floor and upgrades it in place.
//
// Called by BSPLevel.populate AFTER spawnFromTable, so every enemy this floor will
// have is already in tm.entities and one of them can simply be tagged. eliteEnrager
// does the whole promotion (HP x4, +3 STR, an extra MP and AP, a 20% block against
// the hero, a rage below half health, a better drop) and renames the enemy to
// "Elite <species>", so the player can see which one it is before it reaches them.
//
// Deliberately at most ONE per floor. The elite is meant to be the fight you
// remember from a floor; two of them on the same floor makes neither special, and
// the HP x4 means a second one is a real difficulty spike rather than flavour.
export function rollElite() {
    // A stronghold floor already has its leader, promoted by spawnLeader with this
    // same tag. Adding another elite beside a boss that guards the Amulet would
    // stack the finale twice over.
    const level = mapState.levelManager.getCurrent()
    if (level && level.config && level.config.stronghold) return

    // Depth gate: the first floor teaches the game, so it stays ordinary. After
    // that the chance climbs with the descent — floor 2 is a coin-flip, and by the
    // last ordinary floor an elite is near-certain.
    const floor = mapState.levelManager.currentLevel
    if (floor < 1) return
    if (Math.random() > ELITE_CHANCE_PER_FLOOR * floor) return

    // Only plain enemies are eligible: no summons, nothing already elite, and
    // nothing that has died between spawning and now.
    const candidates = [...tm.entities].filter(
        e => e.type === "enemy" && e.healthPoints > 0 && !e._elite
    )
    if (!candidates.length) return

    const chosen = Phaser.Utils.Array.GetRandom(candidates)
    chosen.addTag(eliteEnrager)
    // No gameLog line on purpose. The elite's red tint and "Elite" name announce it
    // when the player actually sees it; a log entry on floor entry would announce it
    // through a wall, before they had any way to know where it was.
}
