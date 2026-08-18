import dungeon from "./Dungeon.js"
import fogOfWar from "./FogOfWar.js"
import mapState from "./MapState.js"
import tm from "./TurnManager.js"
import enemies from "./Enemies.js"
import items from "./Items.js"
import Door from "./items/Door.js"
import Container from "./items/Container.js"
import Shrine from "./items/Shrine.js"
import HiddenPassage from "./items/HiddenPassage.js"
import { Shopkeeper, Villager, VillageElder, OrcTrader } from "./components/npcs.js"
import { Campfire, Totem, Tree, Hut, WarHall, Watchtower, CastleStatue } from "./components/decor.js"
import Prop from "./components/Prop.js"
import FortressWall from "./components/FortressWall.js"
import FortressGate from "./components/FortressGate.js"
import Standard, { FortressStandard } from "./components/Standard.js"
import Tent from "./components/Tent.js"
import VoidRift from "./components/VoidRift.js"
import { serialize, deserialize } from "./ItemSerializer.js"
import tags from "./Tags.js"
import eliteEnrager from "./tags/eliteEnrager.js"
import eliteHealer from "./tags/eliteHealer.js"

// Per-session floor snapshots. Covers enemies, doors, and loose floor
// items. Player and player-inventory items are excluded (they travel
// with the run). Stairs are excluded because World.create re-adds them
// on every floor entry. Doors persist in any state ("closed", "open",
// "locked") since open() is now a state transition rather than a
// destroy — hydrate replays the persisted state.
//
// Lifecycle:
//   - Run.goDown / goUp call save(currentLevel, snapshot()) before
//     dungeon.cleanup() destroys entities.
//   - World.create calls hydrate(load(currentLevel)) instead of
//     level.populate() + quest hooks when has(currentLevel) is true.
//   - Run.start and Run.endRun call clear() so a fresh run starts
//     empty and a death/win tears down the run's persisted state.

// Lazy-built registries. Building at module-eval time hits a TDZ via
// Run.js -> FloorMemory -> Enemies -> BaseEnemy -> Run cycle, where
// the imports' bindings exist but the source modules' values are not
// yet initialized. Deferring to first call sidesteps it: hydrate()
// only fires during gameplay, long after all modules have loaded.
let _ctorRegistry = null
function ctorRegistry() {
    // Shopkeeper restores on revisit so the shop doesn't vanish. NOTE: its
    // stock re-rolls fresh on hydrate (snapshot doesn't persist npc stock) —
    // a follow-up should serialize stock + spent state to stop up/down farming.
    if (!_ctorRegistry) _ctorRegistry = { ...enemies, ...items, Door, Container, Shrine, HiddenPassage, Shopkeeper, Villager, VillageElder, OrcTrader, Campfire, Tent, Totem, Tree, Hut, CastleStatue, FortressWall, FortressGate, Standard, FortressStandard, WarHall, Watchtower, VoidRift }
    return _ctorRegistry
}

// _tags stores the human-readable tag .name (e.g. "Elite Healer"),
// not the camelCase template key. Build a name -> template map so
// hydrate can re-apply tags via addTag(template) directly.
let _tagsByName = null
function tagsByName() {
    if (!_tagsByName) {
        const all = { ...tags, eliteEnrager, eliteHealer }
        _tagsByName = Object.fromEntries(
            Object.values(all).map(t => [t.name, t])
        )
    }
    return _tagsByName
}

class FloorMemory {
    constructor() { this.snapshots = new Map() }

    has(i)        { return this.snapshots.has(i) }
    save(i, snap) { this.snapshots.set(i, snap) }
    load(i)       { return this.snapshots.get(i) }
    clear()       { this.snapshots.clear() }

    snapshot() {
        const player = dungeon.player
        const inventory = player ? new Set(player.items) : new Set()
        const out = []
        for (const e of tm.entities) {
            if (e === player) continue
            if (e.type === "stairs") continue
            // Transient hazards (thrown zones, future spreading traps) are
            // floor-local and short-lived — never persist them across revisits.
            if (e.type === "hazard") continue
            // Traps don't persist across revisits in slice 1 (the hidden/armed/
            // revealed state isn't snapshotted yet — a follow-up). populate()
            // only runs on fresh floors, so a revisited floor simply has none.
            if (e.type === "trap") continue
            if (inventory.has(e)) continue
            const snap = {
                ctor: e.constructor.name,
                kind: e.type,
                x: e.x, y: e.y,
                tags: e._tags ? [...e._tags] : []
            }
            if (e.type === "enemy") {
                snap.healthPoints = e.healthPoints
                if (e._hasHealed !== undefined) snap._hasHealed = e._hasHealed
                if (e._enraged   !== undefined) snap._enraged   = e._enraged
                // Group membership marker so squads keep opting out of arenas
                // on revisit. The captain reference can't survive teardown, so
                // we persist a boolean and restore it as a self-marker below.
                if (e.squad != null) snap.grouped = true
            }
            if (e.type === "door") {
                snap.state = e.state
            }
            if (e.type === "container") {
                snap.containerKind = e.kind
                snap.contents = e.contents.map(serialize).filter(Boolean)
            }
            if (e.type === "shrine") {
                snap.consumed = e.consumed
            }
            // Region-backed props (scenery scattered from the realm's theme) have
            // no class of their own — they're plain Props whose identity IS their
            // region. Persist enough to rebuild one, since `ctor` alone says only
            // "Prop" and would rebuild a blank 1x1.
            if (e.region && e.region.sheet && e.region.name) {
                snap.region = { sheet: e.region.sheet, name: e.region.name }
                snap.name = e.name
                snap.description = e.description
                if (e.blocksPath) snap.blocksPath = true
                if (e.blocksSight) snap.blocksSight = true
                if (e.walkable) snap.walkable = true
                if (e.tint != null) snap.tint = e.tint
            }
            out.push(snap)
        }
        // Fog memory rides along with the entity snapshot so a revisited floor
        // keeps the area the player had already explored (exportSeen downgrades
        // currently-visible tiles to "seen"). Captured here because snapshot()
        // runs at floor-leave (Run.goDown/goUp) while the grid is still live.
        return { entities: out, fog: fogOfWar.exportSeen() }
    }

    hydrate(snap) {
        const ctors = ctorRegistry()
        const byName = tagsByName()
        for (const e of snap.entities) {
            const EntityClass = ctors[e.ctor]
            // A registered class wins — it may carry behavior the region can't
            // (a shopkeeper's stock, a rift's darkness). Only when there is no
            // class do we rebuild from the region, which is the normal case for
            // theme scenery: those are plain Props and `ctor` is just "Prop".
            if (!EntityClass && e.region) {
                const prop = new Prop(e.x, e.y, null, {
                    name: e.name,
                    description: e.description,
                    type: e.kind,
                    tint: e.tint,
                    region: e.region,
                    walkable: !!e.walkable,
                })
                if (e.blocksPath) prop.blocksPath = true
                if (e.blocksSight) prop.blocksSight = true
                tm.addEntity(prop)
                continue
            }
            if (!EntityClass) {
                console.warn(`FloorMemory: unknown ctor '${e.ctor}', skipping`)
                continue
            }
            let inst
            if (e.kind === "door") {
                // HiddenPassage takes (x, y); Door takes (x, y, locked).
                // Distinguish via the persisted ctor name.
                inst = e.ctor === "HiddenPassage"
                    ? new EntityClass(e.x, e.y)
                    : new EntityClass(e.x, e.y, e.state === "locked")
            } else if (e.kind === "container") {
                const contents = (e.contents || []).map(deserialize).filter(Boolean)
                inst = new Container(e.x, e.y, e.containerKind, contents)
            } else {
                inst = new EntityClass(e.x, e.y)
            }
            // Mirror the spawn flow for enemies: finalizeSpawn rolls the
            // archetype (from pool) and applies stats + maxHP. Without it,
            // archetype stays null, this.stats is blank, and turn() can't
            // dispatch. Has to run before the tag loop because role tags
            // (warrior / tank / elite) bump stats and HP relative to the
            // procgen values.
            if (e.kind === "enemy" && typeof inst.finalizeSpawn === "function") {
                inst.finalizeSpawn()
            }
            // Apply tags before patching runtime mutables: the elite
            // initialize() hooks reset healthPoints (HP*4) and clear
            // _hasHealed / _enraged, so the persisted runtime values
            // must overwrite afterwards.
            for (const name of e.tags) {
                const template = byName[name]
                if (template) inst.addTag(template)
                else console.warn(`FloorMemory: unknown tag '${name}'`)
            }
            if (e.kind === "enemy") {
                // Lock the HP-bar denominator to the spawn-time max
                // (post-elite augmentation, if any) BEFORE the persisted
                // wounded HP overrides it. Otherwise syncWorldHpBar's
                // lazy _maxHp init reads the wounded value as the max
                // and renders the bar full. (Resolves issue #31.)
                inst._maxHp = inst.healthPoints
                if (e.healthPoints !== undefined) inst.healthPoints = e.healthPoints
                if (e._hasHealed   !== undefined) inst._hasHealed   = e._hasHealed
                if (e._enraged     !== undefined) inst._enraged     = e._enraged
                // Re-derive room affiliation from the restored position so a
                // revisited floor keeps the same-room arena behavior. Snapshots
                // don't persist spawnRoom (rooms aren't serialized); deriving
                // from the tile the enemy was left on is a faithful enough
                // stand-in — an enemy that hadn't wandered out is still home.
                inst.spawnRoom = mapState.rooms
                    ? (mapState.rooms.find(r => r.contains(inst.x, inst.y)) || null)
                    : null
                // Restore the group marker (self-reference — enough for
                // isGrouped; the live captain link isn't needed post-revisit).
                if (e.grouped) inst.squad = inst
            }
            tm.addEntity(inst)
            // Replay door states after the entity has a sprite. open()
            // is correct for vanilla revealed doors; HiddenPassage uses
            // reveal() so the post-reveal frame/tile is set correctly.
            if (e.kind === "door" && e.state === "open") {
                if (inst.reveal) inst.reveal()
                else inst.open()
            }
            if (e.kind === "door" && e.state === "sealed") inst.seal()
            // Replay consumed shrines after they have a sprite (tint).
            if (e.kind === "shrine" && e.consumed) inst.markConsumed()
        }
    }
}

export default new FloorMemory()
