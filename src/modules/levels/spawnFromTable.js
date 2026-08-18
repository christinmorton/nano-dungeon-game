import Phaser from "phaser"
import mapState from "../MapState.js"
import tm from "../TurnManager.js"
import { getRandomEnemy, getRandomEnemyOfTypes } from "../Enemies.js"
import { resetForcedHunter } from "../debugFlags.js"
import { getRandomItem } from "../Items.js"
import { themeArt } from "./themeRoles.js"
import Container from "../items/Container.js"
import Shrine from "../items/Shrine.js"
import { Shopkeeper } from "../components/npcs.js"
import { Campfire } from "../components/decor.js"
import Tent from "../components/Tent.js"
import eliteEnrager from "../tags/eliteEnrager.js"
import eliteHealer from "../tags/eliteHealer.js"
import spawnTables from "../../data/spawnTables.json"
import recipeLoader from "../recipes/RecipeLoader.js"
import recipeApplier from "../recipes/RecipeApplier.js"
import furnish from "./furnish.js"
import spawnSettlement from "../settlements/spawnSettlement.js"
import CosmicBeing from "../enemies/CosmicBeing.js"
import PactGiver from "../components/PactGiver.js"
import EssenceFont from "../components/EssenceFont.js"
import { DUNGEON_PACTABLE_KEYS, BEAST_KEYS } from "../../data/cosmicBeings.js"
import { BASIC_AFFINITY_KEYS } from "../abilities/affinities.js"

// Rooms with these kinds bypass the script-based per-tile spawn and
// instead drop a full squad recipe (captain + role-tagged members) at
// the room's center. New entries here are the lightest way to bring
// more themed bands into the floor rotation as more recipes land.
// See documents/v3_enemy_squad_design.md.
const KIND_TO_RECIPE = {
    "warband-orc": "scout-orc-band"
}

// Hand-maintained catalog of prop classes spawn-table scripts can reference
// via the `props` field. Unknown names are silently dropped so a JSON typo
// doesn't crash a floor — the room just renders without the prop.
const propsCatalog = {
    Shrine,
    Shopkeeper,
    Campfire,
    Tent
}

// Per-room spawn pass driven by data in spawnTables.json. Each room's
// kind selects a table; the table's "scripts" are weighted recipes
// (monsters/items) — one is rolled per room.
//
// Future tables can introduce explicit weighted pools for picking
// specific enemy/item types ("Gem" weight 5 vs "GoldenGem" weight 1).
// For PR 3 every spawn falls back to getRandomEnemy / getRandomItem,
// preserving the floor-wide uniform distribution that existed before.

const ELITE_RATE = 0.25
const ELITE_VARIANTS = [eliteEnrager, eliteHealer]

function pickScript(scripts) {
    if (!scripts || scripts.length === 0) return null
    const total = scripts.reduce((s, x) => s + x.weight, 0)
    let r = Math.random() * total
    for (const script of scripts) {
        r -= script.weight
        if (r <= 0) return script
    }
    return scripts[scripts.length - 1]
}

export default function spawnFromTable(regions) {
    resetForcedHunter()   // debug: allow one forced hunter per floor populate
    for (const room of regions) {
        if (room.kind === "duelist") {
            spawnDuelist(room)
            continue
        }
        if (room.kind === "secret") {
            spawnSecret(room)
            continue
        }
        // Settlement rooms carry { species, form } on room.settlement and
        // populate via the (species x form) generator (themed band + layout).
        // See documents/v3_enemy_settlements.md.
        if (room.kind === "settlement") {
            spawnSettlement(room)
            continue
        }
        // Pact room — a ritual chamber offering an advanced-affinity pact.
        if (room.kind === "pact") {
            spawnPactRoom(room)
            continue
        }
        // Essence room — a wellspring offering a BASIC-affinity attunement.
        if (room.kind === "essence") {
            spawnEssenceRoom(room)
            continue
        }
        // Grove room — a mythical beast bestows an EMPOWERED basic affinity.
        if (room.kind === "grove") {
            spawnGroveRoom(room)
            continue
        }

        // Captain-led squad/warband spawn. Dungeon-wide "no captains" suppression
        // (designer Enemy behavior) skips it, so the room falls through to the
        // ordinary per-tile table spawn instead of a captain band.
        const recipeName = KIND_TO_RECIPE[room.kind]
        if (recipeName && !mapState.noCaptains) {
            spawnRecipe(room, recipeName)
            continue
        }

        const table = spawnTables[room.kind] || spawnTables.random
        const script = pickScript(table.scripts)
        if (!script) continue

        // Props go first so they claim the room center before monster /
        // item placement looks for walkable tiles around them.
        if (script.props) {
            for (const propName of script.props) {
                const PropClass = propsCatalog[propName]
                if (!PropClass) continue
                const cx = Math.floor(room.x + room.w / 2)
                const cy = Math.floor(room.y + room.h / 2)
                const tile = mapState.isWalkableTile(cx, cy)
                    ? { x: cx, y: cy }
                    : mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
                tm.addEntity(new PropClass(tile.x, tile.y))
            }
        }

        let monsterCount = script.monsters || 0
        // Authored per-room count (§16 step 1 add-on) overrides the table default
        // when set (0 = an intentionally empty room). Only authored rooms carry it.
        if (typeof room.enemyCount === "number") monsterCount = room.enemyCount
        let itemCount = script.items || 0

        const floor = mapState.levelManager.currentLevel
        // Authored enemy population (§16 step 1): an area's `enemyMix` (a species
        // pool) and `enemyTheme` (one guaranteed species) win over the table's
        // `enemyTypes` / floor-random. getRandomEnemyOfTypes tier-filters WITHIN
        // the authored set and falls back gracefully, so an off-tier or unknown
        // pick still yields a playable room. Rooms with no authored mix (every BSP
        // room) hit the original enemyTypes/getRandomEnemy path unchanged.
        const authoredMix = (room.enemyMix && room.enemyMix.length) ? room.enemyMix : null
        const guaranteed = room.enemyTheme || null
        let spawnedGuaranteed = false
        while (monsterCount > 0) {
            const tile = mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
            let enemy
            if (guaranteed && !spawnedGuaranteed) {
                // The guaranteed species spawns once, regardless of floor tier.
                enemy = getRandomEnemyOfTypes([guaranteed], tile.x, tile.y, floor)
                spawnedGuaranteed = true
            } else if (authoredMix) {
                enemy = getRandomEnemyOfTypes(authoredMix, tile.x, tile.y, floor)
            } else if (room.authoredPool) {
                // Authored mode (§16): no guaranteed / mix / pool left to draw, so
                // spawn nothing more — never fall through to the random spawn table.
                break
            } else if (script.enemyTypes) {
                enemy = getRandomEnemyOfTypes(script.enemyTypes, tile.x, tile.y, floor)
            } else {
                enemy = getRandomEnemy(tile.x, tile.y, floor)
            }
            // Room affiliation: a basic enemy belongs to the room it spawned in.
            // The EncounterManager lets the same-room cohort join an active arena
            // (vs. a chance wanderer, which phases). Only basic spawns get this —
            // squad members (recipe path) keep their captain-driven grouping.
            // See documents/v3_objective_driven_encounters.md.
            enemy.spawnRoom = room
            // Authored disposition (§16 Stage 2): the area's stance rides onto
            // each spawned enemy. applyStance sets spawn-time effects (neutral
            // team / keener aggressive senses); territorial uses spawnRoom above.
            if (room.stance) { enemy.stance = room.stance; enemy.applyStance() }
            tm.addEntity(enemy)
            monsterCount--
        }
        while (itemCount > 0) {
            const tile = mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
            // Construct without x/y so the loot has no sprite — it lives
            // inside the chest's contents, only materialized when taken.
            const item = getRandomItem(undefined, undefined)
            tm.addEntity(new Container(tile.x, tile.y, "chest", [item]))
            itemCount--
        }

        // Furnisher stage (§14.5): dress the room into a scene AFTER its
        // functional feature + spawns are placed, so decor arranges around them
        // (occupancy-aware) instead of overlapping. No scene for this kind = no-op.
        // Special-kind rooms above (settlement/pact/…) do their own rich
        // placement and can opt into the furnisher later.
        furnish(room)
    }
}

export function rollElite() {
    if (mapState.noElites) return   // dungeon-wide suppression (designer Enemy behavior)
    if (Math.random() >= ELITE_RATE) return
    const candidates = [...tm.entities].filter(e => e.type === "enemy" && !e._elite)
    if (candidates.length === 0) return
    const variant = Phaser.Utils.Array.GetRandom(ELITE_VARIANTS)
    const target = Phaser.Utils.Array.GetRandom(candidates)
    target.addTag(variant)
}

// Spawn an elite gate enemy at the room center and attach an onEnter
// hook that seals the room's bordering doors. The hook scans for an
// alive elite in the room each time it fires, so it works across floor
// revisits — if the gate has been killed, no seal is applied.
function spawnDuelist(room) {
    const cx = Math.floor(room.x + room.w / 2)
    const cy = Math.floor(room.y + room.h / 2)
    const tile = mapState.isWalkableTile(cx, cy)
        ? { x: cx, y: cy }
        : mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
    const elite = getRandomEnemy(tile.x, tile.y, mapState.levelManager.currentLevel)
    elite.addTag(Phaser.Utils.Array.GetRandom(ELITE_VARIANTS))
    tm.addEntity(elite)

    room.onEnter = () => sealDuelistRoom(room)
}

function sealDuelistRoom(room) {
    let gate = null
    for (const e of tm.entities) {
        if (e.type !== "enemy") continue
        if (!room.contains(e.x, e.y)) continue
        if (!e._tags) continue
        if (!e._tags.includes("Elite Enrager") && !e._tags.includes("Elite Healer")) continue
        gate = e
        break
    }
    if (!gate) return

    const sealed = []
    for (const e of tm.entities) {
        if (e.type !== "door") continue
        if (!isOnRoomPerimeter(e, room)) continue
        if (e.state === "sealed" || e.state === "hidden" || e.state === "locked") continue
        e.seal()
        sealed.push(e)
    }
    gate._sealedDoors = sealed
}

function isOnRoomPerimeter(tile, room) {
    const onTop = tile.y === room.y - 1 && tile.x >= room.x && tile.x < room.x + room.w
    const onBottom = tile.y === room.y + room.h && tile.x >= room.x && tile.x < room.x + room.w
    const onLeft = tile.x === room.x - 1 && tile.y >= room.y && tile.y < room.y + room.h
    const onRight = tile.x === room.x + room.w && tile.y >= room.y && tile.y < room.y + room.h
    return onTop || onBottom || onLeft || onRight
}

// Drop a squad recipe (captain + role-tagged members) at the room's
// center. The captain anchor is the geometric center when that tile
// is walkable; otherwise the applier still receives a valid tile
// (room center is almost always free for BSP rooms, but the fallback
// handles edge cases like a prop placed exactly on center).
function spawnRecipe(room, recipeName) {
    const recipe = recipeLoader.byName(recipeName)
    if (!recipe) {
        // Bad mapping shouldn't crash the floor — log and skip the
        // room so the player still gets a playable level.
        console.warn(`spawnFromTable: recipe "${recipeName}" not found (room kind ${room.kind})`)
        return
    }
    const cx = Math.floor(room.x + room.w / 2)
    const cy = Math.floor(room.y + room.h / 2)
    const anchor = mapState.isWalkableTile(cx, cy)
        ? { x: cx, y: cy }
        : mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
    recipeApplier.apply(tm, recipe, anchor.x, anchor.y)
}

// Pact room (dungeon behavior): a ritual chamber that rolls between the two pact
// entry vectors — Model A (a cosmic being bargaining DIRECTLY, spawned neutral) or
// Model B (a neutral BROKER offering on its behalf). Only demi-god-and-lower beings
// are offered (DUNGEON_PACTABLE_KEYS excludes the Principles + facsimiles). Placed
// at the room center. See documents/v3_cosmic_hierarchy_and_entities.md §9.
function spawnPactRoom(room) {
    if (!DUNGEON_PACTABLE_KEYS.length) return
    const key = Phaser.Utils.Array.GetRandom(DUNGEON_PACTABLE_KEYS)
    const cx = Math.floor(room.x + room.w / 2)
    const cy = Math.floor(room.y + room.h / 2)
    const tile = mapState.isWalkableTile(cx, cy)
        ? { x: cx, y: cy }
        : mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)

    if (Math.random() < 0.5) {
        // Model A — the being bargains in person, standing neutral until dealt with.
        const being = new CosmicBeing(tile.x, tile.y, key)
        being.finalizeSpawn?.()
        being.team = "neutral"
        being.pactOfferer = true
        tm.addEntity(being)
    } else {
        // Model B — a neutral broker offers on the being's behalf.
        tm.addEntity(new PactGiver(tile.x, tile.y, { beingKey: key }))
    }
}

// Essence room (dungeon behavior): a wellspring chamber where the hero attunes a
// BASIC affinity at an Essence Font (components/EssenceFont) — the basic-tier sibling
// of the pact room. One random basic element, placed at the room center; the font
// names its element in its prompt (take-it-or-leave-it). Advanced affinities stay
// pact/curse-gated (spawnPactRoom). See documents/v3_cosmic_hierarchy_and_entities.md §9.
function spawnEssenceRoom(room) {
    if (!BASIC_AFFINITY_KEYS.length) return
    const key = Phaser.Utils.Array.GetRandom(BASIC_AFFINITY_KEYS)
    const cx = Math.floor(room.x + room.w / 2)
    const cy = Math.floor(room.y + room.h / 2)
    const tile = mapState.isWalkableTile(cx, cy)
        ? { x: cx, y: cy }
        : mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
    tm.addEntity(new EssenceFont(tile.x, tile.y, key, themeArt(mapState.theme, "font")))
}

// Grove room (dungeon behavior): a sacred grove where a SEMI-RARE, friendly mythical
// beast — a worshipped planetary guardian — bestows its element as an EMPOWERED basic
// affinity. A BOON, not a bind: spawned NEUTRAL (idles until dealt with, like the pact
// Model A), F to receive, Y to accept (empowered basic + the beast joins as a friendly
// guardian). Beasts only (BEAST_KEYS). See documents/v3_cosmic_hierarchy_and_entities.md §9.
function spawnGroveRoom(room) {
    if (!BEAST_KEYS.length) return
    const key = Phaser.Utils.Array.GetRandom(BEAST_KEYS)
    const cx = Math.floor(room.x + room.w / 2)
    const cy = Math.floor(room.y + room.h / 2)
    const tile = mapState.isWalkableTile(cx, cy)
        ? { x: cx, y: cy }
        : mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
    const beast = new CosmicBeing(tile.x, tile.y, key)
    beast.finalizeSpawn?.()
    beast.team = "neutral"
    beast.boonOfferer = true
    tm.addEntity(beast)
}

// Loot-heavy room reached only via a HiddenPassage (placed by BSPLevel
// during placeDoors). Population is roughly a treasure room dialed up —
// no monsters, more items so the payoff justifies the search.
function spawnSecret(room) {
    const itemCount = 4
    for (let i = 0; i < itemCount; i++) {
        const tile = mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
        const item = getRandomItem(undefined, undefined)
        tm.addEntity(new Container(tile.x, tile.y, "chest", [item]))
    }
}
