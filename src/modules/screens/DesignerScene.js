import Phaser from "phaser"
import { COSMIC_PROFILES, COSMIC_KEYS } from "../../data/cosmicBeings.js"
import { generateLayout } from "../levels/authoredLayout.js"
import { describeAssetRef } from "../../data/assetRef.js"
import { loadItemArchive, saveItemArchive } from "./itemArchiveClient.js"
import { emptyArchive, ITEM_CATEGORIES, ITEM_SLOTS } from "../../data/itemArchive.js"
import { MAZE_ALGORITHM_KEYS } from "../levels/mazes.js"
import { THEME_CONTENT_FIELDS } from "../levels/recipes.js"
import { autotileReadyTerrains } from "../levels/autotile.js"
import { readyDungeonTypes, getDungeonType, themeForDungeonType } from "../levels/dungeonTypes.js"
import { ROOM_KIND_RULES, resolveRule, normalizeRoomKindMix } from "../levels/roomKinds.js"
import { LIGHTING, LIGHTING_KEYS, TIME_OF_DAY_KEYS, TIME_OF_DAY_LABELS } from "../levels/lighting.js"

// The Dungeon Designer's map canvas (design doc §15).
//
// STEP 1: dark void grid + editor camera (pan/zoom).
// STEP 2: draw / select / move / resize rectangular Areas, edit in the inspector.
// STEP 2b (this): area REFINEMENTS —
//   • walled ROOM vs open AREA (a `walled` flag; walls are added at generation).
//   • freeform PIXELATED shapes (a per-area cell mask painted with the Brush);
//     a rectangle is the implicit "fill the box" case, a freeform is an explicit
//     set of grid cells. The grid resolution (void W×H) is the shape resolution.
//
// A Room is just a small Area (§15.1). Its own Phaser.Game (designerMain.js),
// separate from the gameplay Game.js — reuses game *modules*, not the loop. DOM
// chrome (tools, inspector, info bar) lives in designer.html; this scene drives it.

const TILE = 16                          // world grid cell, matches MapState.tileSize
const DEFAULT_VOID = { w: 48, h: 32 }    // authorable floor bounds, in tiles (== Medium preset)
const MIN_AREA = 3                       // smallest rect room, in tiles (design §15.5)
const HANDLE_PX = 9                       // resize-handle size, in SCREEN px
const MAX_FLOORS = 100                   // editor sanity bound (endless mode is a RUNTIME concept)

// Per-floor size presets (grid dims in tiles). A floor's size IS its grid; the
// presets are quick-sets and a custom W×H just doesn't match one (§15.7).
const SIZE_PRESETS = [
    { key: "xs", label: "Extra small", w: 24, h: 16 },
    { key: "s",  label: "Small",       w: 34, h: 22 },
    { key: "m",  label: "Medium",      w: 48, h: 32 },
    { key: "l",  label: "Large",       w: 64, h: 42 },
]
const sizePresetFor = (w, h) => (SIZE_PRESETS.find(p => p.w === w && p.h === h) || {}).key || "custom"

const key = (x, y) => `${x},${y}`
const parseCell = (k) => { const i = k.indexOf(","); return [+k.slice(0, i), +k.slice(i + 1)] }

// An opening is a perimeter edge: a boundary cell + the side facing outward.
const openKey = (x, y, side) => `${x},${y},${side}`
const parseOpen = (k) => { const p = k.split(","); return { x: +p[0], y: +p[1], side: p[2] } }
const SIDE_STEP = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }

const LS_KEY = "dungeonDesigner.autosave.v1"   // localStorage autosave slot
const FORMAT = "dungeon-designer"

// Room kinds — the SAME strings the game keys off (BSPLevel assigns them,
// spawnFromTable/scenes.js read them). "starting"/"ending" are the structural
// start/end rooms: the game puts the spawn + up-stairs in "starting" and the
// down-stairs in "ending". The rest resolve to furnished scenes / spawn tables.
// Grouped for the dropdown; keep values exact so authored rooms map 1:1.
// ("settlement" also needs a {species, form} — orc village etc. — a follow-up.)
const KIND_GROUPS = [
    { group: null, items: [{ value: "", label: "— none —" }] },
    { group: "Structure", items: [
        { value: "starting", label: "Start (spawn / up-stairs)" },
        { value: "ending",   label: "End (down-stairs)" },
        { value: "goal",     label: "Goal (win item)" },
    ] },
    { group: "Content", items: [
        { value: "combat",   label: "Combat" },
        { value: "treasure", label: "Treasure" },
        { value: "rest",     label: "Rest (campfire)" },
        { value: "shop",     label: "Shop (shopkeeper)" },
        { value: "shrine",   label: "Shrine" },
        { value: "secret",   label: "Secret" },
    ] },
    { group: "Affinity / Pact", items: [
        { value: "pact",    label: "Pact" },
        { value: "essence", label: "Essence" },
        { value: "grove",   label: "Grove" },
    ] },
]
const SINGLETON_KINDS = new Set(["starting", "ending", "goal"])   // at most one of each per floor
const KIND_COLORS = { starting: "#7ce87c", ending: "#ffcf6a", goal: "#ff8adf" }
// Canvas labels stay short.
const kindLabel = (k) => ({ starting: "start", ending: "end", goal: "goal" }[k]) || k

// Enemy theme + encounter are their own per-room axes (separate from kind).
// The enemy roster is derived from the enemies folder via a LAZY glob — we read
// the file NAMES only; the enemy runtime is never loaded into the designer.
// Cosmic-tier beings come from their data table (data/cosmicBeings.js).
const ENEMY_FILES = import.meta.glob("../enemies/*.js")
const NON_ENEMY = new Set(["BaseEnemy", "TrainingDummy", "CosmicBeing", "enemyKinds", "enemyRegistry"])
const ENEMY_NAMES = Object.keys(ENEMY_FILES)
    .map(p => p.slice(p.lastIndexOf("/") + 1).replace(/\.js$/, ""))
    .filter(n => !NON_ENEMY.has(n))
    .sort((a, b) => a.localeCompare(b))
const COSMIC_OPTIONS = COSMIC_KEYS.map(k => ({ value: k, label: COSMIC_PROFILES[k].name }))

const ENCOUNTERS = [
    { value: "",           label: "— none —" },
    { value: "duelist",    label: "Duelist" },
    { value: "settlement", label: "Settlement (orc village…)" },
]

// Enemy disposition per area (§16.3). Blank = the default cone-gated hostile.
const STANCES = [
    { value: "",            label: "— default —" },
    { value: "passive",     label: "Passive (ignores you unless hit)" },
    { value: "neutral",     label: "Neutral (truce until provoked)" },
    { value: "aggressive",  label: "Aggressive (keen, hunts on sight)" },
    { value: "territorial", label: "Territorial (fights only in its zone)" },
]

// Maze-floor generation params (§17 slice 2), stored on a maze floor as
// `floor.maze`. Friendly labels for the MAZE_ALGORITHM_KEYS carver registry
// (unknown keys fall back to the raw key so the dropdown never drifts). braid is
// stored 0..1 (UI slider 0..100 ÷ 100); roomDensity is 0..100.
const MAZE_ALGO_LABELS = {
    recursiveBacktracker: "Recursive Backtracker",
    prims: "Prim's",
    huntAndKill: "Hunt & Kill",
    growingTreeMix: "Growing Tree",
    kruskals: "Kruskal's",
    truePrims: "True Prim's",
}
const DEFAULT_MAZE = { algorithm: "recursiveBacktracker", braid: 0.15, roomDensity: 0 }

// Validate/normalize a serialized maze-params object into the editor model.
function mazeFromData(m) {
    m = (m && typeof m === "object") ? m : {}
    const algorithm = MAZE_ALGORITHM_KEYS.includes(m.algorithm) ? m.algorithm : DEFAULT_MAZE.algorithm
    const braid = Number.isFinite(m.braid) ? Math.max(0, Math.min(1, m.braid)) : DEFAULT_MAZE.braid
    const rd = Number(m.roomDensity)
    const roomDensity = Number.isFinite(rd) ? Math.max(0, Math.min(100, Math.round(rd))) : DEFAULT_MAZE.roomDensity
    return { algorithm, braid, roomDensity }
}

// Dungeon-wide enemy-generation suppression toggles (Dungeon tab → Enemy
// behavior). Each is a boolean the engine reads via MapState; `key` is the
// state/serialize field, `id` the checkbox element id. Driven as a list so the
// init / ui / serialize / hydrate / refresh wiring isn't duplicated five ways.
const ENEMY_TOGGLES = [
    { key: "noHunters",  id: "dNoHunters" },
    { key: "noElites",   id: "dNoElites" },
    { key: "noCaptains", id: "dNoCaptains" },
    { key: "noCursed",   id: "dNoCursed" },
    { key: "noRoyals",   id: "dNoRoyals" },
]

// Migrate old single-field kinds (pre-split) into the new axes when loading.
const KIND_MIGRATE = {
    "bats-only":      { enemyTheme: "Bat" },
    "skeletons-only": { enemyTheme: "Skeleton" },
    "orcs-only":      { enemyTheme: "Orc" },
    "trolls-only":    { enemyTheme: "Troll" },
    "duelist":        { encounter: "duelist" },
    "settlement":     { encounter: "settlement" },
}

const COLORS = {
    pageBg:    0x101010,
    voidFill:  0x141414,
    gridLine:  0x2a2a2a,
    border:    0x4a4436,
    fill:      0x263041,   // area body
    fillSel:   0x33405a,   // selected body
    wall:      0xd08a4a,   // walled-room outline (warm)
    open:      0x5fb3b3,   // open-area outline (cool)
    sel:       0xffe089,   // selected outline + handles
    handleEdge:0x1a1a1a,
    preview:   0x9fd7a0,   // room being drawn
    opening:   0x74e67a,   // placed doorway
    openHover: 0x74e67a,   // hovered doorway (drawn translucent)
    fillCorridor: 0x3b5168, // procedural corridor preview
    routeLink:    0xc79be0, // authored route link (violet, dashed intent line)
    routePoint:   0xb08cff, // route point glyph
    routePointSel:0xffe089, // selected route point
    routeJunction:0xffb050, // route point with 3+ links (a junction)
    procRoom:     0x2e3a44, // procedural (auto-generated) room, ghosted
    procRoomLine: 0x7a90a0, // its outline
    procRoomOpen: 0x74e67a, // its auto-opening
    portalLink:   0x66e0c0, // authored portal link (teal, dashed, distinct from route violet)
    portal:       0x33d6b0, // same-floor portal source marker (square)
    portalCross:  0xe8a13a, // cross-floor portal source marker (amber = "secret stair")
    portalSel:    0xffe089, // selected portal marker
}

const ZOOM = { min: 0.35, max: 4, step: 1.1 }
const FIT_MARGIN = 0.9

export default class DesignerScene extends Phaser.Scene {
    constructor() { super("Designer") }

    create() {
        this.voidSize = { ...DEFAULT_VOID }
        this.userAdjusted = false

        this.areas = []
        this.nextId = 1
        // Multi-floor run (§15.7): the Dungeon tab owns the floor ROSTER; the
        // Layout canvas edits ONE floor at a time. this.areas / this.routePoints /
        // this.voidSize are the LIVE buffers for the currently-selected floor;
        // this.floors[i] holds each floor's snapshot (JSON-shaped areas/routePoints
        // + its grid). snapshotCurrentFloor() writes live→snapshot; loadFloor()
        // hydrates snapshot→live.
        this.floors = []          // [{ id, name, grid:{w,h}, areas:[…], routePoints:[…] }]
        this.currentFloor = 0
        this.selected = null
        this.selectedPoint = null // the selected route point (mutually exclusive with `selected`)
        this.routePoints = []     // authored corridor waypoints/junctions: {id, x, y, links:[]}
        this.selectedConn = null  // the selected portal/connection (mutually exclusive with the above)
        this.connections = []     // authored portals (§15.9): {id, source:{x,y}, dest:{floor,room,tile}, hidden}
        this.procRooms = []       // ephemeral procedural rooms from the fill (not authored)
        this.fillSeed = 0         // last corridor-generation seed (shown / lockable)
        this.tool = "select"
        this.action = null
        this.presets = {}         // named enemy mixes (project-level): name -> [enemyName]
        this.dungeonPool = []     // dungeon-wide default enemy pool (applies to any room)
        // Enemy-source mode for the whole dungeon (§16). "authored" = the dungeon
        // pool + per-room mixes are the ONLY source (no random fill; empty pool =
        // empty room). "random" = legacy behavior — authored data wins, then falls
        // through to the spawn-table / getRandomEnemy. Selected on the Dungeon tab.
        this.poolMode = "authored"
        // Dungeon-wide SPECIAL-ROOM mix (Generate tab → Room types), keyed by the
        // rule keys in levels/roomKinds.js: { [key]: { count, chance } }. Sparse
        // by design — only the rules the author actually changed are stored, and
        // an empty object means "use the table's defaults everywhere". The same
        // mix rolls on authored, maze and random floors alike.
        this.roomKinds = {}
        // Dungeon-wide enemy-generation suppression toggles (Enemy behavior
        // section). Default all off; the engine reads each via MapState.<key>.
        ENEMY_TOGGLES.forEach(t => { this[t.key] = false })
        // Dungeon-wide enemy perception scale (Dungeon tab). 1 = the (already
        // reduced) baseline; lower = tighter sight (enemies notice later).
        // rangeScale scales sight distance (cones AND circles); coneScale scales
        // the forward cone width. Read by BaseEnemy.effective* via mapState.
        this.perception = { rangeScale: 1, coneScale: 1 }
        // The Dungeon container (run-level identity + global settings; edited on
        // the Dungeon tab). Floors are still single (this scene = the one floor)
        // until the multi-floor step; name/description live here now.
        this.dungeon = { name: "", description: "" }
        // Floor theme (dungeon-global for now; per-floor arrives with the Dungeon
        // config tab). null = the game's default tileset. When set, the widened
        // palette shape { sheet, tileSize, spacing, margin, floorTiles[], wallTiles[] }
        // where each list entry is { frame, weight } — the engine samples the lists
        // per cell for variety (§15.10; normalizeTheme in recipes.js). Floor and wall
        // share ONE sheet because the engine paints one tileset per floor.
        this.theme = null
        // Dungeon win condition (§15.8): null = default Amulet. When set:
        // { win: "collect", item: { source: "atlas", name, sheet, frame } | { source: "item", key, name? } }
        this.goal = null
        // The "held" asset reference (asset-reference primitive): a single asset
        // picked from the Atlas, ready to be reused (props / items later). null =
        // nothing held. Shape = data/assetRef.js. Rides the one dungeon JSON.
        this.heldAsset = null
        // Item archive (Items tab) — the game-item + lore data store, loaded from
        // / saved to src/data/itemArchive.json via the dev endpoint. Its OWN file
        // (separate from the dungeon JSON) with explicit Save, not autosaved.
        this.itemArchive = emptyArchive()
        this.selectedItemKey = null

        this.cameras.main.setBackgroundColor(COLORS.pageBg)
        this.input.mouse.disableContextMenu()   // right-drag erases; no context menu

        this.gridGfx = this.add.graphics()
        this.fillGfx = this.add.graphics()   // procedural fill preview (beneath the areas)
        this.dynGfx = this.add.graphics()
        this.labels = []          // pooled kind labels (Text objects), reused across areas
        this.fill = null          // Set of "x,y" corridor tiles (a generated preview)
        this.drawGrid()

        this.bindDom()
        this.setupInput()

        // Restore the last session from localStorage so a refresh doesn't wipe
        // work, then keep autosaving (cheap — a few areas of JSON).
        this.loadLocal()
        // First run (empty autosave) opens on a general default, not blank: one
        // floor with a start + end room pre-placed so it's immediately playable.
        if (!this.floors.length) {
            this.floors = [this._makeDefaultFloor("Floor 1")]
            this.currentFloor = 0
            this.loadFloor(0)
        }
        this.refreshGoalUI()   // deserialize also does this on a loaded run; safe to repeat
        this.refreshThemeUI()  // render the (possibly empty → "default") tile lists on a fresh boot too
        this.refreshHeldAssetUI()
        this.loadArchiveFromDisk()   // async; Items tab data (separate file via the dev endpoint)
        this.time.addEvent({ delay: 2000, loop: true, callback: () => this.saveLocal() })
        window.addEventListener("beforeunload", () => this.saveLocal())

        this.time.delayedCall(0, () => this.fitView())
        this.scale.on("resize", () => { if (!this.userAdjusted) this.fitView() })

        // Theme picks come back from the Atlas tab on the game bus (see AtlasScene
        // + the theme pickers in bindDom). Registered once; fires even while this
        // scene sleeps on the Atlas tab, so this.theme is ready on return.
        this.game.events.on("atlas:pick", (data) => {
            if (!data) return
            if (data.target === "asset") this.setHeldAsset(data.ref)
            else if (data.target === "goal") this.applyGoalPick(data)
            else this.applyThemePick(data)
        })

        // Edit an item clicked on the Atlas "authored items" page (it also switches
        // to the Items tab). Fires even while this scene sleeps on the Atlas tab.
        this.game.events.on("designer:editItem", (key) => this.selectItem(key))

        window.designerScene = this

        this.populateInspector()
        this.refreshDungeonUI()
        this.renderInfo(null)
    }

    update() { this.render(); this.updateLabels() }

    // Kind labels drawn at each room's center. Text objects live in world space
    // (the camera pans/zooms them), scaled by 1/zoom so they stay a constant
    // on-screen size. Pooled + reused so we don't churn objects each frame.
    updateLabels() {
        const cam = this.cameras.main
        let li = 0
        for (const a of this.areas) {
            if (!a.kind) continue
            let t = this.labels[li]
            if (!t) {
                t = this.add.text(0, 0, "", { fontFamily: "monospace", fontSize: "11px", color: "#fff" })
                    .setOrigin(0.5).setDepth(10)
                t.setStroke("#000", 3)
                this.labels.push(t)
            }
            t.setText(kindLabel(a.kind))
            t.setColor(KIND_COLORS[a.kind] || "#e8e0d0")
            t.setPosition((a.x + a.w / 2) * TILE, (a.y + a.h / 2) * TILE)
            t.setScale(1 / cam.zoom)
            t.setVisible(true)
            li++
        }
        for (let i = li; i < this.labels.length; i++) this.labels[i].setVisible(false)
    }

    // ---- DOM chrome --------------------------------------------------------

    bindDom() {
        this.infobar = document.getElementById("infobar")
        this.ui = {
            btnSelect: document.getElementById("btnSelect"),
            btnMove:   document.getElementById("btnMove"),
            btnRotate: document.getElementById("btnRotate"),
            btnRoom:   document.getElementById("btnRoom"),
            btnBrush:  document.getElementById("btnBrush"),
            btnOpening: document.getElementById("btnOpening"),
            btnRoute:  document.getElementById("btnRoute"),
            gridW:     document.getElementById("gridW"),
            gridH:     document.getElementById("gridH"),
            gridApply: document.getElementById("gridApply"),
            themeFloorAdd:  document.getElementById("themeFloorAdd"),
            themeWallAdd:   document.getElementById("themeWallAdd"),
            themeClear:     document.getElementById("themeClear"),
            themeAutotile:  document.getElementById("themeAutotile"),
            themeWallAutotile: document.getElementById("themeWallAutotile"),
            themeLighting:     document.getElementById("themeLighting"),
            themeTimeOfDay:    document.getElementById("themeTimeOfDay"),
            dungType:       document.getElementById("dungType"),
            dungTypeDesc:   document.getElementById("dungTypeDesc"),
            themeFloorList: document.getElementById("themeFloorList"),
            themeWallList:  document.getElementById("themeWallList"),
            themeSheetVal:  document.getElementById("themeSheetVal"),
            btnExport: document.getElementById("btnExport"),
            btnImport: document.getElementById("btnImport"),
            btnNew:    document.getElementById("btnNew"),
            btnPlay:   document.getElementById("btnPlay"),
            importInput: document.getElementById("importFile"),
            dungName:    document.getElementById("dungName"),
            dungDesc:    document.getElementById("dungDesc"),
            dungFloorCount: document.getElementById("dungFloorCount"),
            dungFloorAdd:   document.getElementById("dungFloorAdd"),
            dungFloorList:  document.getElementById("dungFloorList"),
            dungFloorName:  document.getElementById("dungFloorName"),
            dungFloorMode:  document.getElementById("dungFloorMode"),
            dungFloorMazeHint: document.getElementById("dungFloorMazeHint"),
            dungMazeParams: document.getElementById("dungMazeParams"),
            dungMazeAlgo:   document.getElementById("dungMazeAlgo"),
            dungMazeBraid:  document.getElementById("dungMazeBraid"),
            dungMazeBraidVal: document.getElementById("dungMazeBraidVal"),
            dungMazeRooms:  document.getElementById("dungMazeRooms"),
            dungMazeRoomsVal: document.getElementById("dungMazeRoomsVal"),
            dungFloorStance: document.getElementById("dungFloorStance"),
            dungFloorSize:  document.getElementById("dungFloorSize"),
            dungFloorW:     document.getElementById("dungFloorW"),
            dungFloorH:     document.getElementById("dungFloorH"),
            dungFloorApplySize: document.getElementById("dungFloorApplySize"),
            dungGoalSource:   document.getElementById("dungGoalSource"),
            dungGoalAtlasRow: document.getElementById("dungGoalAtlasRow"),
            dungGoalAtlas:    document.getElementById("dungGoalAtlas"),
            dungGoalPick:     document.getElementById("dungGoalPick"),
            dungGoalItemRow:  document.getElementById("dungGoalItemRow"),
            dungGoalKey:      document.getElementById("dungGoalKey"),
            dungGoalName:     document.getElementById("dungGoalName"),
            dungGoalSummary:  document.getElementById("dungGoalSummary"),
            dpoolPick:   document.getElementById("dpoolPick"),
            dpoolAdd:    document.getElementById("dpoolAdd"),
            dpoolList:   document.getElementById("dpoolList"),
            dpoolPreset: document.getElementById("dpoolPreset"),
            dpoolSave:   document.getElementById("dpoolSave"),
            dpoolClear:  document.getElementById("dpoolClear"),
            dpoolMode:   document.getElementById("dpoolMode"),
            dNoHunters:  document.getElementById("dNoHunters"),
            dNoElites:   document.getElementById("dNoElites"),
            dNoCaptains: document.getElementById("dNoCaptains"),
            dNoCursed:   document.getElementById("dNoCursed"),
            dNoRoyals:   document.getElementById("dNoRoyals"),
            percRange:   document.getElementById("percRange"),
            percCone:    document.getElementById("percCone"),
            btnGenerate: document.getElementById("btnGenerate"),
            btnClearFill: document.getElementById("btnClearFill"),
            fillStatus:  document.getElementById("fillStatus"),
            fillSeed:    document.getElementById("fillSeed"),
            fillLock:    document.getElementById("fillLock"),
            fillStraight:document.getElementById("fillStraight"),
            fillWander:  document.getElementById("fillWander"),
            fillWidth:   document.getElementById("fillWidth"),
            fillRooms:   document.getElementById("fillRooms"),
            fillRoomCount:document.getElementById("fillRoomCount"),
            roomKindList:     document.getElementById("roomKindList"),
            roomKindDefaults: document.getElementById("roomKindDefaults"),
            roomKindNone:     document.getElementById("roomKindNone"),
            empty:     document.getElementById("insEmpty"),
            fields:    document.getElementById("insFields"),
            name:      document.getElementById("insName"),
            kind:      document.getElementById("insKind"),
            x:         document.getElementById("insX"),
            y:         document.getElementById("insY"),
            w:         document.getElementById("insW"),
            h:         document.getElementById("insH"),
            walls:     document.getElementById("insWalls"),
            shape:     document.getElementById("insShape"),
            rect:      document.getElementById("insRect"),
            rotL:      document.getElementById("insRotL"),
            rotR:      document.getElementById("insRotR"),
            openCount: document.getElementById("insOpenCount"),
            clearOpen: document.getElementById("insClearOpen"),
            enemyCount: document.getElementById("insEnemyCount"),
            enemyTheme: document.getElementById("insEnemyTheme"),
            mixPick:    document.getElementById("insMixPick"),
            mixAdd:     document.getElementById("insMixAdd"),
            mixList:    document.getElementById("insMixList"),
            preset:     document.getElementById("insPreset"),
            presetSave: document.getElementById("insPresetSave"),
            mixClear:   document.getElementById("insMixClear"),
            encounter: document.getElementById("insEncounter"),
            stance:    document.getElementById("insStance"),
            del:       document.getElementById("insDelete"),
            route:     document.getElementById("insRoute"),
            rx:        document.getElementById("insRX"),
            ry:        document.getElementById("insRY"),
            rLinkCount:document.getElementById("insRLinkCount"),
            rLinks:    document.getElementById("insRLinks"),
            rDelete:   document.getElementById("insRDelete"),
            btnPortal: document.getElementById("btnPortal"),
            portal:    document.getElementById("insPortal"),
            px:        document.getElementById("insPX"),
            py:        document.getElementById("insPY"),
            pFloor:    document.getElementById("insPFloor"),
            pDest:     document.getElementById("insPDest"),
            pHidden:   document.getElementById("insPHidden"),
            pDelete:   document.getElementById("insPDelete"),
            heldAssetVal:  document.getElementById("heldAssetVal"),
            btnPickAsset:  document.getElementById("btnPickAsset"),
            btnCopyAsset:  document.getElementById("btnCopyAsset"),
            btnClearAsset: document.getElementById("btnClearAsset"),
            itemAdd:       document.getElementById("itemAdd"),
            itemReload:    document.getElementById("itemReload"),
            itemNone:      document.getElementById("itemNone"),
            itemFields:    document.getElementById("itemFields"),
            itemKey:       document.getElementById("itemKey"),
            itemName:      document.getElementById("itemName"),
            itemCategory:  document.getElementById("itemCategory"),
            itemSlot:      document.getElementById("itemSlot"),
            itemQuest:     document.getElementById("itemQuest"),
            itemLore:      document.getElementById("itemLore"),
            itemArtVal:    document.getElementById("itemArtVal"),
            itemArtUseHeld:document.getElementById("itemArtUseHeld"),
            itemArtClear:  document.getElementById("itemArtClear"),
            itemDelete:    document.getElementById("itemDelete"),
            itemSave:      document.getElementById("itemSave"),
            itemsStatus:   document.getElementById("itemsStatus"),
        }

        this.ui.btnSelect.onclick = () => this.setTool("select")
        this.ui.btnMove.onclick = () => this.setTool("move")
        this.ui.btnRotate.onclick = () => this.setTool("rotate")
        this.ui.btnRoom.onclick = () => this.setTool("room")
        this.ui.btnBrush.onclick = () => this.setTool("brush")
        this.ui.btnOpening.onclick = () => this.setTool("opening")
        this.ui.btnRoute.onclick = () => this.setTool("route")
        this.ui.btnPortal.onclick = () => this.setTool("portal")
        this.ui.del.onclick = () => this.deleteSelected()
        this.ui.rDelete.onclick = () => this.deleteSelectedPoint()
        for (const k of ["rx", "ry"]) this.ui[k].addEventListener("input", () => this.applyRouteInspector())
        this.ui.pDelete.onclick = () => this.deleteSelectedConn()
        for (const k of ["px", "py"]) this.ui[k].addEventListener("input", () => this.applyPortalInspector())
        this.ui.pFloor.addEventListener("change", () => this.applyPortalFloor())
        this.ui.pDest.addEventListener("change", () => this.applyPortalInspector())
        this.ui.pHidden.addEventListener("change", () => { if (this.selectedConn) this.selectedConn.hidden = this.ui.pHidden.checked })
        this.ui.rect.onclick = () => this.makeRect()
        this.ui.clearOpen.onclick = () => this.clearOpenings()
        this.ui.rotL.onclick = () => { if (this.selected) this.rotateArea(this.selected, false) }
        this.ui.rotR.onclick = () => { if (this.selected) this.rotateArea(this.selected, true) }
        this.ui.walls.onchange = () => { if (this.selected) this.selected.walled = this.ui.walls.checked }

        this.ui.gridW.value = this.voidSize.w
        this.ui.gridH.value = this.voidSize.h
        // Grid = the CURRENT floor's size; route through setFloorSize so the floor
        // record + the Dungeon-tab size fields stay in sync.
        this.ui.gridApply.onclick = () => this.setFloorSize(parseInt(this.ui.gridW.value, 10), parseInt(this.ui.gridH.value, 10))

        // Floor theme: the Add buttons jump to the Atlas tab in pick mode; the
        // chosen tile returns via the 'atlas:pick' bus event (see create()) and
        // is APPENDED to the floor/wall LIST the engine samples per cell (§15.10).
        this.ui.themeFloorAdd.onclick = () => this.beginThemePick("floor")
        this.ui.themeWallAdd.onclick = () => this.beginThemePick("wall")
        this.ui.themeClear.onclick = () => { this.theme = null; this.refreshThemeUI(); this.saveLocal() }
        // Autotile ground/walls: paint cells with a labeled terrain from the theme
        // sheet (neighbor-aware) instead of sampling the flat tile lists. Both need
        // a theme sheet. Changing either by hand drops the dungeon TYPE — the theme
        // is no longer that preset, and the Dungeon-tab select should say so rather
        // than keep claiming a look the theme has diverged from.
        this.ui.themeAutotile.onchange = () => {
            if (!this.theme) { this.ui.themeAutotile.value = ""; return }
            this.theme.autotile = this.ui.themeAutotile.value || null
            this.theme.type = null
            this.refreshDungeonTypeUI()
            this.saveLocal()
        }
        this.ui.themeWallAutotile.onchange = () => {
            if (!this.theme) { this.ui.themeWallAutotile.value = ""; return }
            this.theme.wallAutotile = this.ui.themeWallAutotile.value || null
            this.theme.type = null
            this.refreshDungeonTypeUI()
            this.saveLocal()
        }

        // Held asset (asset-reference primitive): Pick jumps to the Atlas in
        // general "asset" pick mode; the chosen asset returns via 'atlas:pick'
        // (target "asset"). Copy data puts its reference JSON on the clipboard.
        this.ui.btnPickAsset.onclick = () => this.beginAssetPick()
        this.ui.btnCopyAsset.onclick = () => this.copyHeldAssetData()
        this.ui.btnClearAsset.onclick = () => this.setHeldAsset(null)

        // Items tab (item/lore archive editor). Its own file via the dev endpoint;
        // these DOM handlers keep working while this scene sleeps on the Items tab
        // (plain listeners), same as the Dungeon tab.
        this._populateItemSelects()
        this.ui.itemAdd.onclick = () => this.addItem()
        this.ui.itemReload.onclick = () => this.loadArchiveFromDisk()
        this.ui.itemSave.onclick = () => this.saveArchive()
        this.ui.itemDelete.onclick = () => this.deleteSelectedItem()
        this.ui.itemArtUseHeld.onclick = () => this.useHeldAssetAsArt()
        this.ui.itemArtClear.onclick = () => this.setItemArt(null)
        this.ui.itemName.addEventListener("input", () => this.editItemField("name", this.ui.itemName.value))
        this.ui.itemCategory.addEventListener("change", () => this.editItemField("category", this.ui.itemCategory.value))
        this.ui.itemSlot.addEventListener("change", () => this.editItemField("slot", this.ui.itemSlot.value || null))
        this.ui.itemQuest.addEventListener("change", () => this.editItemField("questItem", this.ui.itemQuest.checked))
        this.ui.itemLore.addEventListener("input", () => this.editItemField("lore", this.ui.itemLore.value))
        this.ui.itemKey.addEventListener("change", () => this.editItemKey(this.ui.itemKey.value))

        // Dungeon identity (Dungeon tab). The 2s autosave persists these; update
        // the model on input so an export/Play right after typing is current.
        this.ui.dungName.addEventListener("input", () => { this.dungeon.name = this.ui.dungName.value })
        this.ui.dungDesc.addEventListener("input", () => { this.dungeon.description = this.ui.dungDesc.value })

        this.ui.btnGenerate.onclick = () => this.generateFill()
        this.ui.btnClearFill.onclick = () => { this.fill = null; this.procRooms = []; this.drawFill(); this.setFillStatus("") }

        this.ui.btnExport.onclick = () => this.exportJSON()
        this.ui.btnImport.onclick = () => this.ui.importInput.click()
        this.ui.btnNew.onclick = () => this.newDungeon()
        this.ui.btnPlay.onclick = () => this.playAuthored()
        this.ui.importInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0]
            if (file) this.importFromFile(file)
            e.target.value = ""            // allow re-importing the same file
        })

        const addOption = (parent, k) => {
            const opt = document.createElement("option")
            opt.value = k.value; opt.textContent = k.label
            parent.appendChild(opt)
        }
        for (const g of KIND_GROUPS) {
            if (!g.group) { g.items.forEach(k => addOption(this.ui.kind, k)); continue }
            const og = document.createElement("optgroup")
            og.label = g.group
            g.items.forEach(k => addOption(og, k))
            this.ui.kind.appendChild(og)
        }
        this.ui.kind.onchange = () => { if (this.selected) this.setKind(this.selected, this.ui.kind.value) }

        // Enemy theme + mix-picker share the same option list (none + enemies + cosmic).
        this.populateEnemyOptions(this.ui.enemyTheme)
        this.populateEnemyOptions(this.ui.mixPick)
        this.ui.enemyTheme.onchange = () => { if (this.selected) this.selected.enemyTheme = this.ui.enemyTheme.value }
        // Per-room enemy count (§16 step 1 add-on): blank = the room kind's table
        // default; a number overrides it (0 = an intentionally empty room).
        this.ui.enemyCount.addEventListener("input", () => {
            if (!this.selected) return
            const v = parseInt(this.ui.enemyCount.value, 10)
            this.selected.enemyCount = Number.isFinite(v) ? Phaser.Math.Clamp(v, 0, 20) : null
        })

        // Enemy mix: add the picked enemy to the room's list (shown as chips).
        this.ui.mixAdd.onclick = () => {
            const v = this.ui.mixPick.value
            if (!v || !this.selected) return
            const mix = this.selected.enemyMix || (this.selected.enemyMix = [])
            if (!mix.includes(v)) { mix.push(v); this.renderMixChips() }
        }

        // Room-mix presets: load a saved mix into the room, or save the room's mix.
        this.refreshPresetSelects()
        this.ui.preset.onchange = () => {
            const name = this.ui.preset.value
            this.ui.preset.value = ""                 // a load action, not a stored value
            if (!name || !this.selected || !this.presets[name]) return
            this.selected.enemyMix = this.presets[name].slice()
            this.renderMixChips()
        }
        this.ui.presetSave.onclick = () => {
            if (!this.selected || !this.selected.enemyMix || !this.selected.enemyMix.length) return
            const name = (window.prompt("Save enemy mix as preset — name:") || "").trim()
            if (!name) return
            this.presets[name] = this.selected.enemyMix.slice()
            this.refreshPresetSelects()
        }
        this.ui.mixClear.onclick = () => {
            if (!this.selected) return
            this.selected.enemyMix = []
            this.renderMixChips()
        }

        // Dungeon-wide enemy pool (project-level; the default pool for any room).
        // Same controls as the room mix, but targeting this.dungeonPool.
        this.populateEnemyOptions(this.ui.dpoolPick)
        this.ui.dpoolAdd.onclick = () => {
            const v = this.ui.dpoolPick.value
            if (v && !this.dungeonPool.includes(v)) { this.dungeonPool.push(v); this.renderDungeonChips() }
        }
        this.ui.dpoolClear.onclick = () => { this.dungeonPool = []; this.renderDungeonChips() }
        this.ui.dpoolPreset.onchange = () => {
            const name = this.ui.dpoolPreset.value
            this.ui.dpoolPreset.value = ""
            if (!name || !this.presets[name]) return
            this.dungeonPool = this.presets[name].slice()
            this.renderDungeonChips()
        }
        this.ui.dpoolSave.onclick = () => {
            if (!this.dungeonPool.length) return
            const name = (window.prompt("Save dungeon pool as preset — name:") || "").trim()
            if (!name) return
            this.presets[name] = this.dungeonPool.slice()
            this.refreshPresetSelects()
        }
        // Enemy-source mode (authored vs random) — dungeon-wide.
        if (this.ui.dpoolMode) {
            this.ui.dpoolMode.value = this.poolMode
            this.ui.dpoolMode.onchange = () => {
                this.poolMode = this.ui.dpoolMode.value === "random" ? "random" : "authored"
            }
        }
        // Enemy-behavior suppression toggles — dungeon-wide. Each drops a
        // category from generation (hunters/elites/captains/cursed/royals); the
        // engine reads MapState.<key>. Wired from the shared ENEMY_TOGGLES list.
        ENEMY_TOGGLES.forEach(t => {
            const el = this.ui[t.id]
            if (!el) return
            el.checked = this[t.key]
            el.onchange = () => { this[t.key] = !!el.checked; this.saveLocal() }
        })
        // Enemy perception scale (dungeon-wide). Clamp 0.25–2.0; blank/NaN -> 1.
        const clampScale = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(2, Math.max(0.25, n)) : 1 }
        if (this.ui.percRange) {
            this.ui.percRange.value = this.perception.rangeScale
            this.ui.percRange.onchange = () => {
                this.perception.rangeScale = clampScale(this.ui.percRange.value)
                this.ui.percRange.value = this.perception.rangeScale
            }
        }
        if (this.ui.percCone) {
            this.ui.percCone.value = this.perception.coneScale
            this.ui.percCone.onchange = () => {
                this.perception.coneScale = clampScale(this.ui.percCone.value)
                this.ui.percCone.value = this.perception.coneScale
            }
        }
        this.renderDungeonChips()

        // Lighting (Decorate tab): the fog-of-war feel. Deliberately does NOT
        // clear theme.type the way the autotile pickers do — those change what
        // the floor IS, this only changes how it's lit, and a Castle Town lit
        // like a cellar is still a Castle Town. Re-picking the type resets it.
        if (this.ui.themeLighting) {
            for (const key of LIGHTING_KEYS) {
                addOption(this.ui.themeLighting, { value: key, label: LIGHTING[key].label })
            }
            this.ui.themeLighting.onchange = () => {
                if (!this.theme) { this.ui.themeLighting.value = "torchlit"; return }
                this.theme.lighting = this.ui.themeLighting.value || "torchlit"
                this.saveLocal()
            }
        }
        if (this.ui.themeTimeOfDay) {
            for (const key of TIME_OF_DAY_KEYS) {
                addOption(this.ui.themeTimeOfDay, { value: key, label: TIME_OF_DAY_LABELS[key] || key })
            }
            this.ui.themeTimeOfDay.onchange = () => {
                if (!this.theme) { this.ui.themeTimeOfDay.value = "cycle"; return }
                this.theme.timeOfDay = this.ui.themeTimeOfDay.value || "cycle"
                this.saveLocal()
            }
        }

        // Room types (Generate tab): the dungeon's special-room mix. Rows are
        // built from the rule table; these two buttons are the bulk actions.
        // "Defaults" clears every override rather than writing the defaults in,
        // so the export goes back to carrying no roomKinds at all.
        if (this.ui.roomKindDefaults) {
            this.ui.roomKindDefaults.onclick = () => {
                this.roomKinds = {}
                this.renderRoomKinds()
                this.saveLocal()
            }
        }
        if (this.ui.roomKindNone) {
            this.ui.roomKindNone.onclick = () => {
                for (const rule of ROOM_KIND_RULES) this.setRoomKind(rule, 0, 0)
                this.renderRoomKinds()
                this.saveLocal()
            }
        }
        this.renderRoomKinds()

        // Encounter select: none / duelist / settlement.
        ENCOUNTERS.forEach(e => addOption(this.ui.encounter, e))
        this.ui.encounter.onchange = () => { if (this.selected) this.selected.encounter = this.ui.encounter.value }

        // Stance select: (default) / passive / neutral / aggressive / territorial.
        STANCES.forEach(s => addOption(this.ui.stance, s))
        this.ui.stance.onchange = () => { if (this.selected) this.selected.stance = this.ui.stance.value }

        // Dungeon type (Dungeon tab): the one-pick look. Only types whose terrains
        // still resolve against the current labels are offered, so a renamed
        // terrain drops its type from the list instead of failing on apply.
        addOption(this.ui.dungType, { value: "", label: "— custom / default tileset —" })
        for (const t of readyDungeonTypes()) addOption(this.ui.dungType, { value: t.key, label: t.name })
        this.ui.dungType.onchange = () => this.applyDungeonType(this.ui.dungType.value)

        // Floors (Dungeon tab): the run roster. Size select = quick-set presets +
        // Custom; the W×H inputs set an arbitrary size that overrides the preset.
        for (const p of SIZE_PRESETS) addOption(this.ui.dungFloorSize, { value: p.key, label: `${p.label} (${p.w}×${p.h})` })
        addOption(this.ui.dungFloorSize, { value: "custom", label: "Custom (W×H)" })
        this.ui.dungFloorAdd.onclick = () => this.addFloor()
        this.ui.dungFloorCount.addEventListener("change", () => this.setFloorCount(parseInt(this.ui.dungFloorCount.value, 10)))
        this.ui.dungFloorName.addEventListener("input", () => {
            const f = this.floors[this.currentFloor]; if (!f) return
            f.name = this.ui.dungFloorName.value
            this._refreshFloorList()   // update the list label only (don't disturb the name input)
        })
        // Per-floor default stance (§16 Stage 2 ergonomics): rooms without their
        // own stance inherit this, so a whole floor can be set to one disposition
        // without touching every room. Blank = no floor default (rooms decide).
        STANCES.forEach(s => addOption(this.ui.dungFloorStance,
            s.value === "" ? { value: "", label: "— none (per-room) —" } : s))
        // Per-floor generation mode (§17): 'authored' (draw rooms — default) or
        // 'maze' (a procedural labyrinth built by BSPLevel's maze pipeline; the
        // floor is configured, not drawn — its drawn areas stay dormant). Slice 1
        // routes the mode in-game with default maze knobs; the params panel is a
        // later slice.
        this.ui.dungFloorMode.onchange = () => {
            const f = this.floors[this.currentFloor]; if (!f) return
            f.mode = this.ui.dungFloorMode.value === "maze" ? "maze" : "authored"
            this.refreshFloorsUI()   // toggle the hint/params + refresh the list tag
            this.saveLocal()
        }
        // Maze params (§17 slice 2). algorithm dropdown driven off the carver
        // registry; braid slider stored 0..1; rooms slider = roomDensity 0..100.
        for (const key of MAZE_ALGORITHM_KEYS) {
            addOption(this.ui.dungMazeAlgo, { value: key, label: MAZE_ALGO_LABELS[key] || key })
        }
        this.ui.dungMazeAlgo.onchange = () => {
            const f = this.floors[this.currentFloor]; if (!f || !f.maze) return
            f.maze.algorithm = this.ui.dungMazeAlgo.value
            this.saveLocal()
        }
        this.ui.dungMazeBraid.oninput = () => {
            const f = this.floors[this.currentFloor]; if (!f || !f.maze) return
            const pct = parseInt(this.ui.dungMazeBraid.value, 10) || 0
            f.maze.braid = pct / 100
            if (this.ui.dungMazeBraidVal) this.ui.dungMazeBraidVal.textContent = `${pct}%`
            this.saveLocal()
        }
        this.ui.dungMazeRooms.oninput = () => {
            const f = this.floors[this.currentFloor]; if (!f || !f.maze) return
            const v = parseInt(this.ui.dungMazeRooms.value, 10) || 0
            f.maze.roomDensity = v
            if (this.ui.dungMazeRoomsVal) this.ui.dungMazeRoomsVal.textContent = `${v}`
            this.saveLocal()
        }
        this.ui.dungFloorStance.onchange = () => {
            const f = this.floors[this.currentFloor]; if (!f) return
            f.defaultStance = this.ui.dungFloorStance.value
            this.saveLocal()
        }
        this.ui.dungFloorSize.onchange = () => {
            const p = SIZE_PRESETS.find(s => s.key === this.ui.dungFloorSize.value)
            if (p) this.setFloorSize(p.w, p.h)   // "custom" = no-op; edit W×H instead
        }
        this.ui.dungFloorApplySize.onclick = () =>
            this.setFloorSize(parseInt(this.ui.dungFloorW.value, 10), parseInt(this.ui.dungFloorH.value, 10))

        // Goal / win condition (Dungeon tab). Source = default Amulet, an Atlas
        // asset from the collection, or a game-item key.
        this.ui.dungGoalSource.onchange = () => this.setGoalSource(this.ui.dungGoalSource.value)
        this.ui.dungGoalAtlas.onchange = () => this.applyGoalAtlas()
        this.ui.dungGoalPick.onclick = () => this.beginGoalPick()
        this.ui.dungGoalKey.addEventListener("input", () => this.applyGoalItem())
        this.ui.dungGoalName.addEventListener("input", () => this.applyGoalItem())
        // Keep the Atlas-asset dropdown fresh as the collection changes.
        this.registry.events.on("changedata-assetCollection", () => {
            if (this.goal && this.goal.item && this.goal.item.source === "atlas") this.refreshGoalAtlasOptions()
        })

        this.ui.name.addEventListener("input", () => {
            if (this._populating || !this.selected) return
            this.selected.name = this.ui.name.value
        })
        const apply = () => this.applyInspector()
        for (const k of ["x", "y", "w", "h"]) this.ui[k].addEventListener("input", apply)
    }

    // Fill a <select> with: none + an "Enemies" optgroup + a "Cosmic tier" group.
    // Shared by the theme picker and the mix picker.
    populateEnemyOptions(sel) {
        const opt = (parent, value, label) => {
            const o = document.createElement("option"); o.value = value; o.textContent = label; parent.appendChild(o)
        }
        opt(sel, "", "— none —")
        const eg = document.createElement("optgroup"); eg.label = "Enemies"
        ENEMY_NAMES.forEach(n => opt(eg, n, n))
        sel.appendChild(eg)
        const cg = document.createElement("optgroup"); cg.label = "Cosmic tier"
        COSMIC_OPTIONS.forEach(o => opt(cg, o.value, o.label))
        sel.appendChild(cg)
    }

    displayEnemyName(v) { return (COSMIC_PROFILES[v] && COSMIC_PROFILES[v].name) || v }

    // Render an enemy list (array of names) as removable chips into a box. The ×
    // splices the array in place, so it works for a room mix or the dungeon pool.
    renderChips(box, arr) {
        box.innerHTML = ""
        for (const v of arr) {
            const chip = document.createElement("span")
            chip.className = "chip"
            chip.append(this.displayEnemyName(v))
            const x = document.createElement("button"); x.textContent = "×"
            x.onclick = () => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); this.renderChips(box, arr) }
            chip.appendChild(x)
            box.appendChild(chip)
        }
    }
    renderMixChips() { this.renderChips(this.ui.mixList, (this.selected && this.selected.enemyMix) || []) }
    renderDungeonChips() { this.renderChips(this.ui.dpoolList, this.dungeonPool) }

    // ---- Room types (Generate tab) -----------------------------------------
    // One row per rule in levels/roomKinds.js: name, a count, and a percentage.
    // Built from the table rather than from markup, so a new special room is one
    // entry in that file and shows up here for free.
    //
    // this.roomKinds stays SPARSE: a row only writes an entry when its value
    // differs from the rule's default, and reverting clears it again. That keeps
    // an untouched dungeon exporting no roomKinds at all, which is what makes
    // "absent = historical defaults" hold for every dungeon authored before this.
    renderRoomKinds() {
        const box = this.ui.roomKindList
        if (!box) return
        box.innerHTML = ""
        for (const rule of ROOM_KIND_RULES) {
            const { count, chance } = resolveRule(rule, this.roomKinds)

            const row = document.createElement("div")
            row.className = "roomkind" + (count === 0 ? " off" : "")
            row.title = `${rule.label} — ${rule.hint}`

            const name = document.createElement("span")
            name.className = "rkname"
            name.textContent = rule.label
            row.appendChild(name)

            const countInput = document.createElement("input")
            countInput.type = "number"; countInput.min = "0"; countInput.max = "9"
            countInput.value = String(count)
            countInput.title = "how many rooms of this kind a floor may get (0 = never)"

            const pctInput = document.createElement("input")
            pctInput.type = "number"; pctInput.min = "0"; pctInput.max = "100"
            pctInput.className = "rkpct"
            pctInput.value = String(Math.round(chance * 100))
            pctInput.title = "chance each one appears"

            const commit = () => {
                const c = Math.max(0, Math.min(9, parseInt(countInput.value, 10) || 0))
                const p = Math.max(0, Math.min(100, parseInt(pctInput.value, 10) || 0)) / 100
                this.setRoomKind(rule, c, p)
                this.renderRoomKinds()
                this.saveLocal()
            }
            countInput.onchange = commit
            pctInput.onchange = commit

            row.appendChild(countInput)
            row.appendChild(pctInput)
            box.appendChild(row)
        }
    }

    // Store one rule's overrides, dropping the entry entirely when it matches the
    // rule's own defaults — see renderRoomKinds for why sparseness matters.
    setRoomKind(rule, count, chance) {
        const isDefault = count === 1 && Math.abs(chance - rule.rate) < 0.005
        if (isDefault) delete this.roomKinds[rule.key]
        else this.roomKinds[rule.key] = { count, chance }
    }

    // Rebuild both preset dropdowns (room + dungeon) from the saved presets.
    refreshPresetSelects() {
        for (const sel of [this.ui.preset, this.ui.dpoolPreset]) {
            sel.innerHTML = ""
            const ph = document.createElement("option"); ph.value = ""; ph.textContent = "— load preset… —"
            sel.appendChild(ph)
            for (const name of Object.keys(this.presets)) {
                const o = document.createElement("option"); o.value = name; o.textContent = name; sel.appendChild(o)
            }
        }
    }

    setTool(name) {
        this.tool = name
        this.ui.btnSelect.classList.toggle("active", name === "select")
        this.ui.btnMove.classList.toggle("active", name === "move")
        this.ui.btnRotate.classList.toggle("active", name === "rotate")
        this.ui.btnRoom.classList.toggle("active", name === "room")
        this.ui.btnBrush.classList.toggle("active", name === "brush")
        this.ui.btnOpening.classList.toggle("active", name === "opening")
        this.ui.btnRoute.classList.toggle("active", name === "route")
        this.ui.btnPortal.classList.toggle("active", name === "portal")
        this.hoverOpening = null    // drop any stale opening hover from another tool
        if (this.game.canvas) {
            this.game.canvas.style.cursor =
                name === "move" ? "move"
                : name === "rotate" ? "pointer"
                : (name === "room" || name === "brush" || name === "opening" || name === "route" || name === "portal") ? "crosshair" : "default"
        }
        this.renderInfo(null)
    }

    populateInspector() {
        const ui = this.ui, s = this.selected, pt = this.selectedPoint, conn = this.selectedConn
        this._populating = true
        // Default every panel off; the active branch turns exactly one on.
        ui.empty.style.display = "none"
        ui.fields.style.display = "none"
        ui.route.style.display = "none"
        ui.portal.style.display = "none"
        if (conn) {
            ui.portal.style.display = ""
            ui.px.value = conn.source.x; ui.py.value = conn.source.y
            this.populatePortalFloor(conn)
            this.populatePortalDest(conn)
            ui.pHidden.checked = conn.hidden !== false
        } else if (pt) {
            ui.route.style.display = ""
            ui.rx.value = pt.x; ui.ry.value = pt.y
            ui.rLinkCount.textContent = pt.links ? pt.links.length : 0
            this.renderRouteLinks()
        } else if (!s) {
            ui.empty.style.display = ""
        } else {
            ui.fields.style.display = ""
            ui.name.value = s.name
            ui.kind.value = s.kind || ""
            ui.enemyCount.value = (s.enemyCount != null) ? s.enemyCount : ""
            ui.enemyTheme.value = s.enemyTheme || ""
            ui.encounter.value = s.encounter || ""
            ui.stance.value = s.stance || ""
            ui.preset.value = ""
            ui.x.value = s.x; ui.y.value = s.y; ui.w.value = s.w; ui.h.value = s.h
            ui.walls.checked = !!s.walled
            ui.shape.textContent = s.shape
            ui.openCount.textContent = s.openings ? s.openings.size : 0
            const free = s.shape === "free"
            ui.w.readOnly = free; ui.h.readOnly = free       // w/h are derived for freeform
            ui.rect.style.display = free ? "" : "none"       // offer "make rectangle" only when freeform
        }
        this._populating = false
    }

    applyInspector() {
        if (this._populating || !this.selected) return
        const s = this.selected, V = this.voidSize, ui = this.ui
        const num = (el, fallback) => { const n = parseInt(el.value, 10); return Number.isFinite(n) ? n : fallback }
        if (s.shape === "free") {
            // Only x/y matter (a move); w/h are derived from the mask.
            const nx = Phaser.Math.Clamp(num(ui.x, s.x), 0, V.w - s.w)
            const ny = Phaser.Math.Clamp(num(ui.y, s.y), 0, V.h - s.h)
            this.translateArea(s, nx - s.x, ny - s.y)
        } else {
            s.w = Phaser.Math.Clamp(num(ui.w, s.w), MIN_AREA, V.w)
            s.h = Phaser.Math.Clamp(num(ui.h, s.h), MIN_AREA, V.h)
            s.x = Phaser.Math.Clamp(num(ui.x, s.x), 0, V.w - s.w)
            s.y = Phaser.Math.Clamp(num(ui.y, s.y), 0, V.h - s.h)
        }
    }

    // ---- area model helpers ------------------------------------------------

    areaHasTile(a, tx, ty) {
        if (a.shape === "free") return a.cells.has(key(tx, ty))
        return tx >= a.x && tx < a.x + a.w && ty >= a.y && ty < a.y + a.h
    }
    // Turn a rect area into a freeform one seeded with its box (idempotent).
    ensureFree(a) {
        if (a.shape === "free") return
        const cells = new Set()
        for (let yy = a.y; yy < a.y + a.h; yy++)
            for (let xx = a.x; xx < a.x + a.w; xx++) cells.add(key(xx, yy))
        a.shape = "free"; a.cells = cells
    }
    makeRect() {
        const a = this.selected
        if (!a || a.shape !== "free") return
        a.shape = "rect"; delete a.cells      // bbox (x/y/w/h) already tracks the extent
        this.validateOpenings(a)              // filling in to a box can bury boundary openings
        this.populateInspector()
    }
    recomputeBBox(a) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const c of a.cells) {
            const [cx, cy] = parseCell(c)
            if (cx < minX) minX = cx; if (cy < minY) minY = cy
            if (cx > maxX) maxX = cx; if (cy > maxY) maxY = cy
        }
        a.x = minX; a.y = minY; a.w = maxX - minX + 1; a.h = maxY - minY + 1
    }
    translateArea(a, dx, dy) {
        if (!dx && !dy) return
        if (a.shape === "free") {
            a.cells = new Set([...a.cells].map(c => { const [cx, cy] = parseCell(c); return key(cx + dx, cy + dy) }))
            this.recomputeBBox(a)
        } else {
            a.x += dx; a.y += dy
        }
        if (a.openings && a.openings.size) {
            a.openings = new Set([...a.openings].map(k => { const o = parseOpen(k); return openKey(o.x + dx, o.y + dy, o.side) }))
        }
    }
    // Rotate an area 90° about its bbox center, snapped back to the grid.
    // A rect just swaps w/h; a freeform turns each cell in local space. cw=true
    // is clockwise. No-op if the turned footprint can't fit the void.
    rotateArea(a, cw) {
        const V = this.voidSize
        const w = a.w, h = a.h
        const ox = a.x, oy = a.y                 // old origin (openings/cells map from here)
        const nw = h, nh = w
        if (nw > V.w || nh > V.h) return
        const cx = ox + w / 2, cy = oy + h / 2
        const nx = Phaser.Math.Clamp(Math.round(cx - nw / 2), 0, V.w - nw)
        const ny = Phaser.Math.Clamp(Math.round(cy - nh / 2), 0, V.h - nh)
        // 90° CW: local (lx,ly) -> (h-1-ly, lx);  CCW: -> (ly, w-1-lx)
        const rotLocal = (lx, ly) => (cw ? [h - 1 - ly, lx] : [ly, w - 1 - lx])
        if (a.shape === "free") {
            const turned = []
            for (const c of a.cells) {
                const [ax, ay] = parseCell(c)
                const [tlx, tly] = rotLocal(ax - ox, ay - oy)
                turned.push(key(nx + tlx, ny + tly))
            }
            a.cells = new Set(turned)
            this.recomputeBBox(a)
        } else {
            a.x = nx; a.y = ny; a.w = nw; a.h = nh
        }
        if (a.openings && a.openings.size) {
            const smap = cw ? { n: "e", e: "s", s: "w", w: "n" } : { n: "w", w: "s", s: "e", e: "n" }
            a.openings = new Set([...a.openings].map(k => {
                const o = parseOpen(k)
                const [tlx, tly] = rotLocal(o.x - ox, o.y - oy)
                return openKey(nx + tlx, ny + tly, smap[o.side] || o.side)
            }))
        }
        if (a === this.selected) this.populateInspector()
    }

    paintCell(a, tx, ty, erase) {
        this.ensureFree(a)
        const k = key(tx, ty)
        if (erase) {
            if (a.cells.size <= 1) return       // keep at least one cell
            if (!a.cells.delete(k)) return
        } else {
            a.cells.add(k)
        }
        this.recomputeBBox(a)
        this.validateOpenings(a)          // brushing can remove the wall an opening sat on
        if (a === this.selected) this.populateInspector()
    }

    // ---- openings (doorways = perimeter edges) ------------------------------

    // Every outward-facing boundary edge of an area: a cell whose neighbour on
    // that side is NOT part of the area. Works for rect and freeform alike.
    perimeterEdges(a) {
        const out = []
        const cells = a.shape === "free" ? [...a.cells].map(parseCell) : this.rectCells(a)
        for (const [cx, cy] of cells) {
            for (const side in SIDE_STEP) {
                const [dx, dy] = SIDE_STEP[side]
                if (!this.areaHasTile(a, cx + dx, cy + dy)) out.push({ x: cx, y: cy, side })
            }
        }
        return out
    }
    rectCells(a) {
        const out = []
        for (let y = a.y; y < a.y + a.h; y++)
            for (let x = a.x; x < a.x + a.w; x++) out.push([x, y])
        return out
    }
    // Distance from a world point to a perimeter edge segment (axis-aligned).
    edgeDist(world, e) {
        const X = e.x * TILE, Y = e.y * TILE
        if (e.side === "n" || e.side === "s") {
            const ey = e.side === "n" ? Y : Y + TILE
            const cx = Phaser.Math.Clamp(world.x, X, X + TILE)
            return Math.hypot(world.x - cx, world.y - ey)
        }
        const ex = e.side === "w" ? X : X + TILE
        const cy = Phaser.Math.Clamp(world.y, Y, Y + TILE)
        return Math.hypot(world.x - ex, world.y - cy)
    }
    // The room edge closest to a world point, within a grab threshold.
    nearestOpeningEdge(world) {
        let best = null, bestD = TILE * 0.55
        for (const a of this.areas) {
            for (const e of this.perimeterEdges(a)) {
                const d = this.edgeDist(world, e)
                if (d < bestD) { bestD = d; best = { area: a, key: openKey(e.x, e.y, e.side) } }
            }
        }
        return best
    }
    setOpening(area, k, erase) {
        if (erase) { if (area.openings) area.openings.delete(k) }
        else { (area.openings || (area.openings = new Set())).add(k) }
        if (area === this.selected) this.populateInspector()
    }
    clearOpenings() {
        if (this.selected && this.selected.openings) { this.selected.openings.clear(); this.populateInspector() }
    }
    // Drop openings that are no longer valid boundary edges (after a resize,
    // brush, or shape change moved/removed the wall they sat on).
    validateOpenings(a) {
        if (!a.openings || !a.openings.size) return
        const kept = new Set()
        for (const k of a.openings) {
            const o = parseOpen(k)
            const [dx, dy] = SIDE_STEP[o.side] || []
            if (dx === undefined) continue
            if (this.areaHasTile(a, o.x, o.y) && !this.areaHasTile(a, o.x + dx, o.y + dy)) kept.add(k)
        }
        a.openings = kept
    }

    // ---- selection ---------------------------------------------------------

    select(area) { this.selected = area; this.selectedPoint = null; this.selectedConn = null; this.populateInspector(); this.renderMixChips() }
    selectPoint(pt) { this.selectedPoint = pt; this.selected = null; this.selectedConn = null; this.populateInspector(); this.renderMixChips() }
    selectConn(c) { this.selectedConn = c; this.selected = null; this.selectedPoint = null; this.populateInspector(); this.renderMixChips() }

    // Set a room's kind. "starting"/"ending" are singletons — assigning one
    // clears it from any other room so a floor has a single start/end.
    setKind(area, kind) {
        if (SINGLETON_KINDS.has(kind)) {
            for (const a of this.areas) if (a !== area && a.kind === kind) a.kind = ""
        }
        area.kind = kind
        this.populateInspector()
    }

    deleteSelected() {
        if (this.selectedConn) { this.deleteSelectedConn(); return }
        if (this.selectedPoint) { this.deleteSelectedPoint(); return }
        if (!this.selected) return
        const removedId = this.selected.id
        this.areas = this.areas.filter(a => a !== this.selected)
        // drop any route links that pointed at this room's doors.
        for (const r of this.routePoints) r.links = r.links.filter(l => l.area !== removedId)
        // drop any portal destinations that pointed at this room.
        for (const c of this.connections) if (c.dest.room === removedId) c.dest.room = null
        this.select(null)
    }

    // ---- route points (authored corridor waypoints / junctions) ------------
    //
    // A route point is a placeable node in the void. Corridors will be able to
    // route THROUGH it (Slice 2); for now it just captures authored topology.
    // Its `links` are undirected edges to a door ({area, opening}) or another
    // route point ({point}). Degree ≥3 makes it a junction. These are additive:
    // door-to-door auto-routing is unchanged, and links are inert until Slice 2.

    // The route point under a world point, within a grab radius (or null).
    routePointAt(world) {
        const grab = Math.max(TILE * 0.5, HANDLE_PX / this.cameras.main.zoom)
        let best = null, bestD = grab
        for (const pt of this.routePoints) {
            const d = Math.hypot(world.x - (pt.x + 0.5) * TILE, world.y - (pt.y + 0.5) * TILE)
            if (d < bestD) { bestD = d; best = pt }
        }
        return best
    }
    // The nearest EXISTING opening (door) to a world point, within a grab radius.
    nearestDoor(world) {
        let best = null, bestD = TILE * 0.75
        for (const a of this.areas) {
            if (!a.openings) continue
            for (const k of a.openings) {
                const d = this.edgeDist(world, parseOpen(k))
                if (d < bestD) { bestD = d; best = { area: a, key: k } }
            }
        }
        return best
    }

    handleRouteDown(p) {
        const world = this.worldAt(p)
        const erase = p.rightButtonDown() || !!(p.event && p.event.altKey)
        const shift = !!(p.event && p.event.shiftKey)
        const hitPt = this.routePointAt(world)

        if (erase) {
            if (hitPt) this.deleteRoutePoint(hitPt)
            else if (this.selectedPoint) {
                const near = this.nearestDoor(world)      // right-click a linked door to unlink it
                if (near) this.toggleDoorLink(this.selectedPoint, near.area.id, near.key, true)
            }
            return
        }

        if (shift && this.selectedPoint) {                // shift = the LINK gesture
            if (hitPt && hitPt !== this.selectedPoint) { this.togglePointLink(this.selectedPoint, hitPt); return }
            const near = this.nearestDoor(world)
            if (near) this.toggleDoorLink(this.selectedPoint, near.area.id, near.key, false)
            return
        }

        if (hitPt) { this.selectPoint(hitPt); return }    // plain click = select / place
        const tile = this.clampTile(this.tileAt(p))
        const np = { id: this.nextId++, x: tile.x, y: tile.y, links: [] }
        this.routePoints.push(np)
        this.selectPoint(np)
    }

    // Toggle an undirected link between two route points (stored once, on whichever
    // side already holds it, else added to `a`).
    togglePointLink(a, b) {
        const ia = a.links.findIndex(l => l.point === b.id)
        const ib = b.links.findIndex(l => l.point === a.id)
        if (ia >= 0) a.links.splice(ia, 1)
        else if (ib >= 0) b.links.splice(ib, 1)
        else a.links.push({ point: b.id })
        this.populateInspector()
    }
    // Toggle a link from a route point to a door. `remove` only ever removes.
    toggleDoorLink(pt, areaId, openStr, remove) {
        const i = pt.links.findIndex(l => l.area === areaId && l.opening === openStr)
        if (i >= 0) pt.links.splice(i, 1)
        else if (!remove) pt.links.push({ area: areaId, opening: openStr })
        this.populateInspector()
    }
    deleteRoutePoint(pt) {
        this.routePoints = this.routePoints.filter(r => r !== pt)
        for (const r of this.routePoints) r.links = r.links.filter(l => l.point !== pt.id)   // drop links to it
        if (this.selectedPoint === pt) this.selectPoint(null)
        else this.populateInspector()
    }
    deleteSelectedPoint() { if (this.selectedPoint) this.deleteRoutePoint(this.selectedPoint) }

    applyRouteInspector() {
        if (this._populating || !this.selectedPoint) return
        const V = this.voidSize, pt = this.selectedPoint
        const num = (el, f) => { const n = parseInt(el.value, 10); return Number.isFinite(n) ? n : f }
        pt.x = Phaser.Math.Clamp(num(this.ui.rx, pt.x), 0, V.w - 1)
        pt.y = Phaser.Math.Clamp(num(this.ui.ry, pt.y), 0, V.h - 1)
    }

    // ---- portals / connections (§15.9) -------------------------------------
    //
    // A connection = an authored portal: a source tile the player steps into, a
    // destination (a room on this floor for slice 2a — cross-floor is 2b), and a
    // `hidden` flag (default true = secret, revealed with [E] in-game). Authoring
    // mirrors the route-point tool: click to place/select, right-click to delete,
    // pick the destination room in the inspector.

    // The nearest portal source to a world point, within a grab radius.
    connectionAt(world) {
        const grab = Math.max(TILE * 0.5, HANDLE_PX / this.cameras.main.zoom)
        let best = null, bestD = grab
        for (const c of this.connections) {
            const d = Math.hypot(world.x - (c.source.x + 0.5) * TILE, world.y - (c.source.y + 0.5) * TILE)
            if (d < bestD) { bestD = d; best = c }
        }
        return best
    }

    handlePortalDown(p) {
        const world = this.worldAt(p)
        const erase = p.rightButtonDown() || !!(p.event && p.event.altKey)
        const hit = this.connectionAt(world)
        if (erase) { if (hit) this.deleteConn(hit); return }
        if (hit) { this.selectConn(hit); return }
        const tile = this.clampTile(this.tileAt(p))
        const c = { id: this.nextId++, source: { x: tile.x, y: tile.y }, dest: { floor: "same", room: null, tile: null }, hidden: true }
        // Default the destination to some OTHER room than the one the portal sits
        // in, so a fresh portal is immediately usable; the author can re-pick.
        const host = this.areas.find(a => this.areaHasTile(a, tile.x, tile.y))
        const target = this.areas.find(a => a !== host)
        if (target) c.dest.room = target.id
        this.connections.push(c)
        this.selectConn(c)
    }

    applyPortalInspector() {
        if (this._populating || !this.selectedConn) return
        const c = this.selectedConn, V = this.voidSize
        const num = (el, f) => { const n = parseInt(el.value, 10); return Number.isFinite(n) ? n : f }
        c.source.x = Phaser.Math.Clamp(num(this.ui.px, c.source.x), 0, V.w - 1)
        c.source.y = Phaser.Math.Clamp(num(this.ui.py, c.source.y), 0, V.h - 1)
        const destVal = this.ui.pDest.value
        c.dest.room = destVal === "" ? null : (parseInt(destVal, 10) | 0)
    }

    // Change the destination FLOOR — "same" (this floor) or a roster index. A new
    // floor invalidates the current room, so reset it and repopulate the room
    // dropdown for the chosen floor.
    applyPortalFloor() {
        if (this._populating || !this.selectedConn) return
        const c = this.selectedConn
        const v = this.ui.pFloor.value
        const nextFloor = (v === "same") ? "same" : (parseInt(v, 10) | 0)
        if (nextFloor !== c.dest.floor) { c.dest.floor = nextFloor; c.dest.room = null; c.dest.tile = null }
        this.populatePortalDest(c)
    }

    // The floor dropdown: "This floor" (the `same` option) + every OTHER roster
    // floor by index (cross-floor secret stairs).
    populatePortalFloor(c) {
        const sel = this.ui.pFloor
        sel.innerHTML = ""
        const same = document.createElement("option")
        same.value = "same"; same.textContent = "This floor"
        sel.append(same)
        for (let i = 0; i < this.floors.length; i++) {
            if (i === this.currentFloor) continue
            const o = document.createElement("option")
            o.value = String(i)
            o.textContent = this.floors[i].name || `Floor ${i + 1}`
            sel.append(o)
        }
        sel.value = c.dest.floor === "same" ? "same" : String(c.dest.floor)
    }

    // Rooms (id + name) on a destination floor: the LIVE buffer for the current
    // floor, else that floor's last-snapshotted areas.
    roomsForFloor(floorSpec) {
        if (floorSpec === "same") return this.areas.map(a => ({ id: a.id, name: a.name }))
        const f = this.floors[floorSpec]
        return (f && Array.isArray(f.areas)) ? f.areas.map(a => ({ id: a.id | 0, name: a.name })) : []
    }

    // Fill the destination-room dropdown with the chosen dest floor's rooms.
    populatePortalDest(c) {
        const sel = this.ui.pDest
        sel.innerHTML = ""
        const none = document.createElement("option")
        none.value = ""; none.textContent = "— pick room —"
        sel.append(none)
        for (const a of this.roomsForFloor(c.dest.floor)) {
            const o = document.createElement("option")
            o.value = String(a.id)
            o.textContent = a.name || `Area ${a.id}`
            sel.append(o)
        }
        sel.value = c.dest.room != null ? String(c.dest.room) : ""
    }

    deleteConn(c) {
        this.connections = this.connections.filter(x => x !== c)
        if (this.selectedConn === c) this.selectConn(null)
        else this.populateInspector()
    }
    deleteSelectedConn() { if (this.selectedConn) this.deleteConn(this.selectedConn) }

    // World position a same-floor portal's dest draws to (dest room center, or an
    // explicit dest tile). Null for a cross-floor portal (its dest is on another
    // floor — nothing to draw a line to here) or a dangling dest room.
    connDestPos(c) {
        if (c.dest.floor !== "same") return null
        if (c.dest.tile) return { x: (c.dest.tile.x + 0.5) * TILE, y: (c.dest.tile.y + 0.5) * TILE }
        if (c.dest.room != null) {
            const a = this.areas.find(ar => ar.id === c.dest.room)
            if (a) return { x: (a.x + a.w / 2) * TILE, y: (a.y + a.h / 2) * TILE }
        }
        return null
    }

    // Total number of edges touching a point (its own links + links aimed at it).
    pointDegree(pt) {
        let d = pt.links.length
        for (const r of this.routePoints) if (r !== pt) for (const l of r.links) if (l.point === pt.id) d++
        return d
    }
    linkLabel(l) {
        if (l.point != null) {
            const p = this.routePoints.find(r => r.id === l.point)
            return `↔ point ${p ? p.id : l.point}`
        }
        const a = this.areas.find(ar => ar.id === l.area)
        const o = l.opening ? parseOpen(l.opening) : null
        return `↔ ${a ? a.name : "door"}${o ? ` (${o.side})` : ""}`
    }
    // World position a link should draw to (door outside-tile center, or point
    // center). Null when the target no longer exists (a dangling link).
    linkTargetPos(l) {
        if (l.point != null) {
            const p = this.routePoints.find(r => r.id === l.point)
            return p ? { x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE } : null
        }
        const a = this.areas.find(ar => ar.id === l.area)
        if (!a || !a.openings || !a.openings.has(l.opening)) return null
        const o = parseOpen(l.opening), [dx, dy] = SIDE_STEP[o.side]
        return { x: (o.x + dx + 0.5) * TILE, y: (o.y + dy + 0.5) * TILE }
    }
    renderRouteLinks() {
        const box = this.ui.rLinks, pt = this.selectedPoint
        box.innerHTML = ""
        if (!pt || !pt.links) return
        pt.links.forEach((l) => {
            const chip = document.createElement("span")
            chip.className = "chip"
            chip.append(this.linkLabel(l))
            const x = document.createElement("button"); x.textContent = "×"
            x.onclick = () => {
                const i = pt.links.indexOf(l)
                if (i >= 0) pt.links.splice(i, 1)
                this.renderRouteLinks()
                this.ui.rLinkCount.textContent = pt.links.length
            }
            chip.appendChild(x)
            box.appendChild(chip)
        })
    }

    // ---- input -------------------------------------------------------------

    typingInField() {
        const el = document.activeElement
        return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")
    }

    setupInput() {
        this.space = this.input.keyboard.addKey("SPACE", false)
        this.panning = null
        window.addEventListener("pointerup", () => this.onPointerUp())

        this.input.on("pointerdown", (p) => {
            const wantPan = p.middleButtonDown() || (p.leftButtonDown() && this.space.isDown)
            if (wantPan) {
                const cam = this.cameras.main
                this.userAdjusted = true
                this.panning = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY }
                return
            }
            if (!p.leftButtonDown() && !p.rightButtonDown()) return
            this.onToolDown(p)
        })

        this.input.on("pointerup", () => this.onPointerUp())

        this.input.on("pointermove", (p) => {
            if (this.panning) {
                const cam = this.cameras.main
                cam.scrollX = this.panning.sx - (p.x - this.panning.x) / cam.zoom
                cam.scrollY = this.panning.sy - (p.y - this.panning.y) / cam.zoom
            } else if (this.action) {
                this.onToolMove(p)
            } else if (this.tool === "opening") {
                this.hoverOpening = this.nearestOpeningEdge(this.worldAt(p))   // live doorway preview
            }
            this.renderInfo(p)
        })

        this.input.on("wheel", (p, _o, _dx, dy) => {
            this.zoomBy(dy > 0 ? 1 / ZOOM.step : ZOOM.step)
            this.renderInfo(p)
        })

        const kb = this.input.keyboard
        const hotkey = (fn) => () => { if (!this.typingInField()) fn() }
        kb.on("keydown-V", hotkey(() => this.setTool("select")))
        kb.on("keydown-M", hotkey(() => this.setTool("move")))
        kb.on("keydown-T", hotkey(() => this.setTool("rotate")))
        kb.on("keydown-R", hotkey(() => this.setTool("room")))
        kb.on("keydown-B", hotkey(() => this.setTool("brush")))
        kb.on("keydown-O", hotkey(() => this.setTool("opening")))
        kb.on("keydown-U", hotkey(() => this.setTool("route")))
        kb.on("keydown-P", hotkey(() => this.setTool("portal")))
        kb.on("keydown-ZERO", hotkey(() => { this.userAdjusted = false; this.fitView() }))
        kb.on("keydown-DELETE", hotkey(() => this.deleteSelected()))
        kb.on("keydown-BACKSPACE", hotkey(() => this.deleteSelected()))
        kb.on("keydown-ESC", hotkey(() => { this.action = null; this.select(null) }))
    }

    onToolDown(p) {
        const tile = this.clampTile(this.tileAt(p))
        const erase = p.rightButtonDown() || !!(p.event && p.event.altKey)

        if (this.tool === "brush") {
            let target = this.selected
            if (!target && !erase) {
                target = { id: this.nextId++, name: `Area ${this.areas.length + 1}`, kind: "", enemyTheme: "", enemyMix: [], enemyCount: null, stance: "", encounter: "", walled: true, shape: "free", cells: new Set(), x: tile.x, y: tile.y, w: 1, h: 1 }
                this.areas.push(target)
                this.select(target)
            }
            if (!target) return
            this.action = { type: "paint", erase, area: target }
            this.paintCell(target, tile.x, tile.y, erase)
            return
        }

        if (this.tool === "room") {
            this.action = { type: "create", start: tile, rect: null }
            return
        }

        // Move tool: drag whatever's under the cursor, never a resize handle.
        if (this.tool === "move") {
            const hit = this.areaAt(tile)
            if (hit) this.startMove(hit, tile)
            else this.select(null)
            return
        }

        // Rotate tool: an instant 90° turn (left = CW, right/Alt = CCW).
        if (this.tool === "rotate") {
            const hit = this.areaAt(tile)
            if (hit) {
                this.select(hit)
                const ccw = p.rightButtonDown() || !!(p.event && p.event.altKey)
                this.rotateArea(hit, !ccw)
            } else {
                this.select(null)
            }
            return
        }

        // Opening tool: place/remove a doorway on the nearest room edge; drag
        // along an edge to widen it (left = add, right/Alt = remove).
        if (this.tool === "opening") {
            const near = this.nearestOpeningEdge(this.worldAt(p))
            if (near) {
                this.select(near.area)
                this.action = { type: "opening", erase, area: near.area }
                this.setOpening(near.area, near.key, erase)
            } else {
                this.select(this.areaAt(tile))   // clicked away from any edge → just (de)select
            }
            return
        }

        // Route tool: place/select/link route points (see handleRouteDown).
        if (this.tool === "route") { this.handleRouteDown(p); return }

        // Portal tool: place/select/delete portals (see handlePortalDown).
        if (this.tool === "portal") { this.handlePortalDown(p); return }

        // Select tool: a resize handle on the selected rect, then body-drag, then empty.
        if (this.selected && this.selected.shape === "rect") {
            const handle = this.handleAt(this.worldAt(p))
            if (handle) { this.action = { type: "resize", handle, orig: { ...this.selected } }; return }
        }
        const hit = this.areaAt(tile)
        if (hit) this.startMove(hit, tile)
        else this.select(null)
    }

    startMove(area, tile) {
        this.select(area)
        this.action = {
            type: "move",
            orig: { x: area.x, y: area.y, w: area.w, h: area.h },
            startTile: tile,
            origCells: area.shape === "free" ? [...area.cells] : null,
            origOpenings: area.openings ? [...area.openings] : null,
        }
    }

    onToolMove(p) {
        const a = this.action
        const tile = this.clampTile(this.tileAt(p))
        if (a.type === "create") {
            a.rect = this.rectFrom(a.start, tile)
        } else if (a.type === "paint") {
            this.paintCell(a.area, tile.x, tile.y, a.erase)
        } else if (a.type === "move") {
            const s = this.selected, V = this.voidSize
            let dx = Phaser.Math.Clamp(a.orig.x + (tile.x - a.startTile.x), 0, V.w - a.orig.w) - a.orig.x
            let dy = Phaser.Math.Clamp(a.orig.y + (tile.y - a.startTile.y), 0, V.h - a.orig.h) - a.orig.y
            if (s.shape === "free" && a.origCells) {
                s.cells = new Set(a.origCells.map(c => { const [cx, cy] = parseCell(c); return key(cx + dx, cy + dy) }))
                this.recomputeBBox(s)
            } else {
                s.x = a.orig.x + dx; s.y = a.orig.y + dy
            }
            if (a.origOpenings) {
                s.openings = new Set(a.origOpenings.map(k => { const o = parseOpen(k); return openKey(o.x + dx, o.y + dy, o.side) }))
            }
            this.populateInspector()
        } else if (a.type === "resize") {
            this.applyResize(a, tile)
            this.populateInspector()
        } else if (a.type === "opening") {
            const near = this.nearestOpeningEdge(this.worldAt(p))
            if (near && near.area === a.area) this.setOpening(a.area, near.key, a.erase)   // stay on the same room
        }
    }

    onPointerUp() {
        const a = this.action
        if (a && a.type === "create" && a.rect && a.rect.w >= MIN_AREA && a.rect.h >= MIN_AREA) {
            const r = a.rect
            const area = { id: this.nextId++, name: `Area ${this.areas.length + 1}`, kind: "", enemyTheme: "", enemyMix: [], enemyCount: null, stance: "", encounter: "", walled: true, shape: "rect", x: r.x, y: r.y, w: r.w, h: r.h }
            this.areas.push(area)
            this.select(area)
        }
        this.panning = null
        this.action = null
    }

    applyResize(action, tile) {
        const o = action.orig, h = action.handle, V = this.voidSize
        let left = o.x, right = o.x + o.w, top = o.y, bottom = o.y + o.h
        if (h.includes("e")) right = Phaser.Math.Clamp(tile.x + 1, o.x + MIN_AREA, V.w)
        if (h.includes("w")) left = Phaser.Math.Clamp(tile.x, 0, o.x + o.w - MIN_AREA)
        if (h.includes("s")) bottom = Phaser.Math.Clamp(tile.y + 1, o.y + MIN_AREA, V.h)
        if (h.includes("n")) top = Phaser.Math.Clamp(tile.y, 0, o.y + o.h - MIN_AREA)
        const s = this.selected
        s.x = left; s.w = right - left; s.y = top; s.h = bottom - top
        this.validateOpenings(s)      // an edge that moved past an opening drops it
    }

    // ---- geometry helpers --------------------------------------------------

    worldAt(p) { return this.cameras.main.getWorldPoint(p.x, p.y) }
    tileAt(p) { const w = this.worldAt(p); return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) } }
    clampTile(t) {
        return {
            x: Phaser.Math.Clamp(t.x, 0, this.voidSize.w - 1),
            y: Phaser.Math.Clamp(t.y, 0, this.voidSize.h - 1),
        }
    }
    rectFrom(a, b) {
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
        return { x, y, w: Math.abs(b.x - a.x) + 1, h: Math.abs(b.y - a.y) + 1 }
    }
    areaAt(tile) {
        for (let i = this.areas.length - 1; i >= 0; i--) {
            if (this.areaHasTile(this.areas[i], tile.x, tile.y)) return this.areas[i]
        }
        return null
    }
    handlePoints(a) {
        const X = a.x * TILE, Y = a.y * TILE, W = a.w * TILE, H = a.h * TILE
        return {
            nw: { x: X, y: Y }, n: { x: X + W / 2, y: Y }, ne: { x: X + W, y: Y },
            w: { x: X, y: Y + H / 2 }, e: { x: X + W, y: Y + H / 2 },
            sw: { x: X, y: Y + H }, s: { x: X + W / 2, y: Y + H }, se: { x: X + W, y: Y + H },
        }
    }
    handleAt(world) {
        if (!this.selected || this.selected.shape !== "rect") return null
        const grab = HANDLE_PX / this.cameras.main.zoom
        const pts = this.handlePoints(this.selected)
        for (const k in pts) {
            const c = pts[k]
            if (Math.abs(world.x - c.x) <= grab && Math.abs(world.y - c.y) <= grab) return k
        }
        return null
    }

    // ---- camera ------------------------------------------------------------

    fitView() {
        const cam = this.cameras.main
        const worldW = this.voidSize.w * TILE, worldH = this.voidSize.h * TILE
        const fit = Math.min(cam.width / worldW, cam.height / worldH) * FIT_MARGIN
        cam.setZoom(Phaser.Math.Clamp(fit, ZOOM.min, ZOOM.max))
        cam.centerOn(worldW / 2, worldH / 2)
        this.renderInfo(null)
    }
    zoomBy(factor) {
        this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * factor, ZOOM.min, ZOOM.max))
        this.userAdjusted = true
    }

    // ---- rendering ---------------------------------------------------------

    drawGrid() {
        const g = this.gridGfx
        const { w, h } = this.voidSize
        const px = w * TILE, py = h * TILE
        g.clear()
        g.fillStyle(COLORS.voidFill, 1).fillRect(0, 0, px, py)
        g.lineStyle(1, COLORS.gridLine, 1)
        for (let x = 0; x <= w; x++) g.lineBetween(x * TILE, 0, x * TILE, py)
        for (let y = 0; y <= h; y++) g.lineBetween(0, y * TILE, px, y * TILE)
        g.lineStyle(2, COLORS.border, 1).strokeRect(0, 0, px, py)
    }

    render() {
        const g = this.dynGfx, cam = this.cameras.main
        const lw = 1.5 / cam.zoom
        g.clear()

        for (const a of this.areas) this.drawArea(g, a, a === this.selected)

        this.drawRoutePoints(g)
        this.drawPortals(g)

        // Opening-tool hover preview: where a doorway would land (translucent).
        if (this.tool === "opening" && this.hoverOpening && !this.action) {
            const hv = this.hoverOpening
            if (!(hv.area.openings && hv.area.openings.has(hv.key))) {
                const o = parseOpen(hv.key)
                g.lineStyle(3.5 / cam.zoom, COLORS.openHover, 0.5)
                this.drawEdgeSeg(g, o.x, o.y, o.side)
            }
        }

        if (this.action && this.action.type === "create" && this.action.rect) {
            const r = this.action.rect
            g.fillStyle(COLORS.preview, 0.25).fillRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE)
            g.lineStyle(lw, COLORS.preview, 1).strokeRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE)
        }

        // Resize handles only for a selected rectangle (freeform moves as a whole).
        if (this.selected && this.selected.shape === "rect" && !(this.action && this.action.type === "create")) {
            const hs = HANDLE_PX / cam.zoom
            const pts = this.handlePoints(this.selected)
            for (const k in pts) {
                const c = pts[k]
                g.fillStyle(COLORS.sel, 1).fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs)
                g.lineStyle(1 / cam.zoom, COLORS.handleEdge, 1).strokeRect(c.x - hs / 2, c.y - hs / 2, hs, hs)
            }
        }
    }

    drawArea(g, a, sel) {
        const cam = this.cameras.main
        const fill = sel ? COLORS.fillSel : COLORS.fill
        const border = sel ? COLORS.sel : (a.walled ? COLORS.wall : COLORS.open)
        const lw = (a.walled ? 2.5 : 1.25) / cam.zoom

        if (a.shape === "free") {
            g.fillStyle(fill, sel ? 0.6 : 0.45)
            for (const c of a.cells) { const [cx, cy] = parseCell(c); g.fillRect(cx * TILE, cy * TILE, TILE, TILE) }
            // Outline only the boundary edges (where a cell has no neighbour) so
            // the pixelated silhouette reads cleanly.
            g.lineStyle(lw, border, 1)
            for (const c of a.cells) {
                const [cx, cy] = parseCell(c)
                const X = cx * TILE, Y = cy * TILE
                if (!a.cells.has(key(cx, cy - 1))) g.lineBetween(X, Y, X + TILE, Y)
                if (!a.cells.has(key(cx, cy + 1))) g.lineBetween(X, Y + TILE, X + TILE, Y + TILE)
                if (!a.cells.has(key(cx - 1, cy))) g.lineBetween(X, Y, X, Y + TILE)
                if (!a.cells.has(key(cx + 1, cy))) g.lineBetween(X + TILE, Y, X + TILE, Y + TILE)
            }
        } else {
            const X = a.x * TILE, Y = a.y * TILE, W = a.w * TILE, H = a.h * TILE
            g.fillStyle(fill, sel ? 0.6 : 0.45).fillRect(X, Y, W, H)
            g.lineStyle(lw, border, 1).strokeRect(X, Y, W, H)
        }

        // Doorways: a bright segment over the wall edge, thicker than the wall.
        if (a.openings && a.openings.size) {
            g.lineStyle(3.5 / cam.zoom, COLORS.opening, 1)
            for (const k of a.openings) { const o = parseOpen(k); this.drawEdgeSeg(g, o.x, o.y, o.side) }
        }
    }

    // Draw the segment along one cell edge (side = n/s/e/w).
    drawEdgeSeg(g, x, y, side) {
        const X = x * TILE, Y = y * TILE
        if (side === "n") g.lineBetween(X, Y, X + TILE, Y)
        else if (side === "s") g.lineBetween(X, Y + TILE, X + TILE, Y + TILE)
        else if (side === "w") g.lineBetween(X, Y, X, Y + TILE)
        else g.lineBetween(X + TILE, Y, X + TILE, Y + TILE)
    }

    // Authored route points + their link lines (the "intent" overlay). Links are
    // dashed so they read as authored guidance, distinct from the solid generated
    // corridors. Diamonds are kept a constant screen size (scaled by 1/zoom).
    drawRoutePoints(g) {
        if (!this.routePoints.length) return
        const cam = this.cameras.main

        g.lineStyle(1.5 / cam.zoom, COLORS.routeLink, 0.85)
        for (const pt of this.routePoints) {
            const ax = (pt.x + 0.5) * TILE, ay = (pt.y + 0.5) * TILE
            for (const l of pt.links) {
                const t = this.linkTargetPos(l)
                if (t) this.dashLine(g, ax, ay, t.x, t.y, 5 / cam.zoom)
            }
        }

        const r = 5 / cam.zoom
        for (const pt of this.routePoints) {
            const cx = (pt.x + 0.5) * TILE, cy = (pt.y + 0.5) * TILE
            const col = pt === this.selectedPoint ? COLORS.routePointSel
                : (this.pointDegree(pt) >= 3 ? COLORS.routeJunction : COLORS.routePoint)
            const pts = [{ x: cx, y: cy - r }, { x: cx + r, y: cy }, { x: cx, y: cy + r }, { x: cx - r, y: cy }]
            g.fillStyle(col, 1).fillPoints(pts, true)
            g.lineStyle(1 / cam.zoom, COLORS.handleEdge, 1).strokePoints(pts, true)
        }
    }
    // Authored portals: a square source marker + a dashed link line to its
    // destination room center. Teal (distinct from the violet route overlay) so
    // the two authored graphs read apart. Markers stay a constant screen size.
    drawPortals(g) {
        if (!this.connections.length) return
        const cam = this.cameras.main
        const r = 5 / cam.zoom

        g.lineStyle(1.5 / cam.zoom, COLORS.portalLink, 0.85)
        for (const c of this.connections) {
            const t = this.connDestPos(c)
            if (t) this.dashLine(g, (c.source.x + 0.5) * TILE, (c.source.y + 0.5) * TILE, t.x, t.y, 5 / cam.zoom)
        }

        for (const c of this.connections) {
            const cx = (c.source.x + 0.5) * TILE, cy = (c.source.y + 0.5) * TILE
            const cross = c.dest.floor !== "same"
            const col = c === this.selectedConn ? COLORS.portalSel : (cross ? COLORS.portalCross : COLORS.portal)
            g.fillStyle(col, 1).fillRect(cx - r, cy - r, r * 2, r * 2)
            g.lineStyle(1 / cam.zoom, COLORS.handleEdge, 1).strokeRect(cx - r, cy - r, r * 2, r * 2)
        }
    }

    // A dashed line from (x1,y1) to (x2,y2), `dash` px on / `dash` px off.
    dashLine(g, x1, y1, x2, y2, dash) {
        const dx = x2 - x1, dy = y2 - y1
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len, uy = dy / len
        for (let d = 0; d < len; d += dash * 2) {
            const e = Math.min(d + dash, len)
            g.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e)
        }
    }

    renderInfo(p) {
        if (!this.infobar) return
        const cam = this.cameras.main
        let tile = "—"
        if (p) {
            const t = this.tileAt(p)
            if (t.x >= 0 && t.y >= 0 && t.x < this.voidSize.w && t.y < this.voidSize.h) tile = `${t.x}, ${t.y}`
        }
        this.infobar.textContent = [
            `tool: ${this.tool}`,
            `areas: ${this.areas.length}`,
            `routes: ${this.routePoints.length}`,
            `portals: ${this.connections.length}`,
            `tile: ${tile}`,
            `zoom: ${cam.zoom.toFixed(2)}x`,
            `void: ${this.voidSize.w}×${this.voidSize.h}`,
            `pan: middle/space-drag   zoom: wheel   reset: 0`,
        ].join("     ")
    }

    // Resize the authorable void = the shape resolution (§15.1). Re-fits so the
    // new grid stays centered; existing areas keep their tile coords.
    setVoid(w, h) {
        this.voidSize = { w: Phaser.Math.Clamp(w | 0, MIN_AREA, 400), h: Phaser.Math.Clamp(h | 0, MIN_AREA, 400) }
        if (this.ui) { this.ui.gridW.value = this.voidSize.w; this.ui.gridH.value = this.voidSize.h }
        this.drawGrid()
        this.userAdjusted = false
        this.fitView()
    }

    // ---- procedural fill preview (corridors connecting the skeleton) --------
    //
    // Connects the authored skeleton with corridors. SEEDED — a reseed gives a
    // different-but-valid layout because the router is weighted Dijkstra with a
    // per-tile seeded jitter, so it picks a different near-shortest path each
    // seed. Two layers:
    //   1. AUTHORED route-point links — each link routes a corridor segment
    //      between its two nodes (door outside-tile or route-point tile). Segments
    //      sharing a route point meet there → a junction. A door consumed by a
    //      link is not also auto-routed.
    //   2. PROCEDURAL door-to-door — every remaining (unlinked) opening routes to
    //      the nearest OTHER opening (seeded order + weighted path).
    // Corridors attach EXCLUSIVELY at openings / route points, never a bare wall.
    // Preview only — NOT persisted; regenerate on demand.

    setFillStatus(msg) { if (this.ui && this.ui.fillStatus) this.ui.fillStatus.textContent = msg || "" }

    // Current corridor-style knob values (with fallbacks if the UI isn't bound).
    corridorStyle() {
        const ui = this.ui
        return {
            straight:  ui && ui.fillStraight ? (+ui.fillStraight.value || 0) : 40,
            wander:    ui && ui.fillWander ? (+ui.fillWander.value || 0) : 30,
            width:     ui && ui.fillWidth ? Phaser.Math.Clamp(parseInt(ui.fillWidth.value, 10) || 1, 1, 10) : 1,
            rooms:     ui && ui.fillRooms ? !!ui.fillRooms.checked : false,
            roomCount: ui && ui.fillRoomCount ? Phaser.Math.Clamp(parseInt(ui.fillRoomCount.value, 10) || 0, 0, 40) : 6,
        }
    }

    // Pick the seed for a generate: reroll a fresh one unless the seed is locked.
    // Reflects it into the seed field so a good layout can be noted / re-locked.
    nextFillSeed() {
        const locked = this.ui && this.ui.fillLock && this.ui.fillLock.checked
        let seed
        if (locked) seed = (parseInt(this.ui.fillSeed.value, 10) || 0) >>> 0
        else { seed = (Math.floor(Math.random() * 0x100000000)) >>> 0; if (this.ui.fillSeed) this.ui.fillSeed.value = seed }
        this.fillSeed = seed
        return seed
    }

    // Generate the corridor/proc-room preview. The geometry itself lives in the
    // shared, engine-free generator (levels/authoredLayout.js) so the in-game
    // AuthoredLevel builds the SAME floor from the same skeleton (design §15.3).
    // This wrapper keeps the two designer-only seams — the seed-lock UI
    // (nextFillSeed) and the style-knob UI (corridorStyle) — and the drawing.
    generateFill() {
        const seed = this.nextFillSeed()
        const result = generateLayout({
            voidSize: this.voidSize,
            areas: this.areas,
            routePoints: this.routePoints,
            seed,
            style: this.corridorStyle(),
        })
        this.fill = result.corridors
        this.procRooms = result.procRooms
        this.drawFill()
        this.setFillStatus(result.status)
    }

    drawFill() {
        const g = this.fillGfx
        g.clear()
        // Procedural rooms, ghosted (drawn beneath corridors so corridors overlay).
        if (this.procRooms && this.procRooms.length) {
            const cam = this.cameras.main
            for (const r of this.procRooms) {
                const X = r.x * TILE, Y = r.y * TILE, W = r.w * TILE, H = r.h * TILE
                g.fillStyle(COLORS.procRoom, 0.5).fillRect(X, Y, W, H)
                g.lineStyle(1.25 / cam.zoom, COLORS.procRoomLine, 0.9).strokeRect(X, Y, W, H)
                if (r.openings && r.openings.size) {
                    g.lineStyle(3 / cam.zoom, COLORS.procRoomOpen, 1)
                    for (const k of r.openings) { const o = parseOpen(k); this.drawEdgeSeg(g, o.x, o.y, o.side) }
                }
            }
        }
        if (this.fill) {
            g.fillStyle(COLORS.fillCorridor, 0.55)
            for (const k of this.fill) { const [x, y] = parseCell(k); g.fillRect(x * TILE, y * TILE, TILE, TILE) }
        }
    }

    // ---- persistence (JSON export/import + localStorage autosave) ----------
    //
    // The exported object is the authored SKELETON of a recipe (design §15.1):
    // grid + areas. Kept forward-compatible — the fuller recipe (geometry,
    // theme, propPalette, roster) will add fields later; unknown fields are
    // ignored on import so old files keep loading.

    // ---- floor roster (§15.7) ----------------------------------------------

    // Per-floor converters: live editing buffers <-> JSON-shaped floor snapshot.
    _serializeAreas() {
        return this.areas.map(a => {
            const o = { id: a.id, name: a.name, kind: a.kind || "", walled: !!a.walled, shape: a.shape, x: a.x, y: a.y, w: a.w, h: a.h }
            if (a.enemyTheme) o.enemyTheme = a.enemyTheme
            if (a.enemyMix && a.enemyMix.length) o.enemyMix = a.enemyMix.slice()
            if (a.enemyCount != null) o.enemyCount = a.enemyCount
            if (a.stance) o.stance = a.stance
            if (a.encounter) o.encounter = a.encounter
            if (a.shape === "free" && a.cells) o.cells = [...a.cells].map(parseCell)
            if (a.openings && a.openings.size) o.openings = [...a.openings].map(parseOpen)
            return o
        })
    }
    _serializeRoutePoints() {
        return this.routePoints.map(p => ({
            id: p.id, x: p.x, y: p.y,
            links: p.links.map(l => l.point != null ? { point: l.point } : { area: l.area, opening: l.opening }),
        }))
    }
    // Hydrate JSON areas into this.areas (caller resets this.areas to [] first).
    _hydrateAreas(arr) {
        for (const o of (arr || [])) {
            const area = {
                id: o.id | 0,
                name: typeof o.name === "string" ? o.name : `Area ${this.areas.length + 1}`,
                kind: typeof o.kind === "string" ? o.kind : "",
                enemyTheme: typeof o.enemyTheme === "string" ? o.enemyTheme : "",
                enemyMix: Array.isArray(o.enemyMix) ? o.enemyMix.filter(x => typeof x === "string") : [],
                enemyCount: Number.isFinite(o.enemyCount) ? (o.enemyCount | 0) : null,
                stance: typeof o.stance === "string" ? o.stance : "",
                encounter: typeof o.encounter === "string" ? o.encounter : "",
                walled: o.walled !== false,
                shape: o.shape === "free" ? "free" : "rect",
                x: o.x | 0, y: o.y | 0, w: Math.max(1, o.w | 0), h: Math.max(1, o.h | 0),
            }
            if (area.shape === "free") {
                const cells = Array.isArray(o.cells) ? o.cells : []
                area.cells = new Set(cells.map(c => key(c[0] | 0, c[1] | 0)))
                if (area.cells.size === 0) area.shape = "rect"
                else this.recomputeBBox(area)
            }
            if (Array.isArray(o.openings) && o.openings.length) {
                area.openings = new Set(o.openings
                    .filter(op => op && SIDE_STEP[op.side])
                    .map(op => openKey(op.x | 0, op.y | 0, op.side)))
            }
            if (KIND_MIGRATE[area.kind]) { Object.assign(area, KIND_MIGRATE[area.kind]); area.kind = "" }
            this.areas.push(area)
        }
    }
    // Hydrate JSON route points into this.routePoints (caller resets it first;
    // this.areas must already be hydrated so dangling links can be pruned).
    _hydrateRoutePoints(arr) {
        for (const p of (arr || [])) {
            if (!p) continue
            const links = Array.isArray(p.links) ? p.links
                .filter(l => l && (l.point != null || (l.area != null && typeof l.opening === "string")))
                .map(l => l.point != null ? { point: l.point | 0 } : { area: l.area | 0, opening: l.opening })
                : []
            this.routePoints.push({ id: p.id | 0, x: p.x | 0, y: p.y | 0, links })
        }
        const areaIds = new Set(this.areas.map(a => a.id))
        const ptIds = new Set(this.routePoints.map(p => p.id))
        for (const p of this.routePoints) {
            p.links = p.links.filter(l => l.point != null ? ptIds.has(l.point) : areaIds.has(l.area))
        }
    }

    _serializeConnections() {
        return this.connections.map(c => ({
            id: c.id,
            source: { x: c.source.x, y: c.source.y },
            dest: {
                floor: (c.dest.floor === undefined) ? "same" : c.dest.floor,
                ...(c.dest.room != null ? { room: c.dest.room } : {}),
                ...(c.dest.tile ? { tile: { x: c.dest.tile.x, y: c.dest.tile.y } } : {}),
            },
            hidden: c.hidden !== false,
        }))
    }
    // Hydrate JSON connections into this.connections (caller resets it first;
    // this.areas must already be hydrated so dangling dest rooms can be pruned).
    _hydrateConnections(arr) {
        for (const c of (arr || [])) {
            if (!c || !c.source) continue
            const d = c.dest || {}
            this.connections.push({
                id: c.id | 0,
                source: { x: c.source.x | 0, y: c.source.y | 0 },
                dest: {
                    floor: (d.floor === undefined || d.floor === "same") ? "same" : (d.floor | 0),
                    room: d.room != null ? (d.room | 0) : null,
                    tile: (d.tile && typeof d.tile.x === "number") ? { x: d.tile.x | 0, y: d.tile.y | 0 } : null,
                },
                hidden: c.hidden !== false,
            })
        }
        // Prune a dangling dest room only for SAME-FLOOR portals — a cross-floor
        // portal's room lives on another floor and isn't in this floor's areas.
        const areaIds = new Set(this.areas.map(a => a.id))
        for (const c of this.connections) {
            if (c.dest.floor === "same" && c.dest.room != null && !areaIds.has(c.dest.room)) c.dest.room = null
        }
    }

    _makeFloor(name, grid = DEFAULT_VOID, areas = [], routePoints = [], connections = []) {
        return { id: this.nextId++, name, grid: { w: grid.w, h: grid.h }, areas, routePoints, connections, defaultStance: "", mode: "authored", maze: { ...DEFAULT_MAZE } }
    }
    // A general default floor (§15.7): start + end rooms pre-placed so a fresh
    // dungeon is immediately playable rather than a blank void.
    _makeDefaultFloor(name) {
        const g = { ...DEFAULT_VOID }
        const areas = [
            { id: this.nextId++, name: "Start", kind: "starting", walled: true, shape: "rect", x: 3, y: 3, w: 8, h: 6 },
            { id: this.nextId++, name: "End",   kind: "ending",   walled: true, shape: "rect", x: g.w - 11, y: g.h - 9, w: 8, h: 6 },
        ]
        return this._makeFloor(name || "Floor 1", g, areas, [])
    }
    // Normalize a floor record loaded from JSON. areas/routePoints stay JSON —
    // loadFloor hydrates them into the live buffers when the floor is selected.
    _floorFromData(f, i) {
        f = f || {}
        const g = f.grid || {}
        return {
            id: f.id | 0,
            name: (typeof f.name === "string" && f.name) ? f.name : `Floor ${i + 1}`,
            grid: {
                w: Phaser.Math.Clamp((g.w | 0) || DEFAULT_VOID.w, MIN_AREA, 400),
                h: Phaser.Math.Clamp((g.h | 0) || DEFAULT_VOID.h, MIN_AREA, 400),
            },
            areas: Array.isArray(f.areas) ? f.areas : [],
            routePoints: Array.isArray(f.routePoints) ? f.routePoints : [],
            connections: Array.isArray(f.connections) ? f.connections : [],
            // Per-floor default stance (§16 Stage 2 ergonomics). Unknown/absent → "".
            defaultStance: STANCES.some(s => s.value === f.defaultStance) ? f.defaultStance : "",
            // Per-floor generation mode (§17). Unknown/absent → "authored".
            mode: f.mode === "maze" ? "maze" : "authored",
            // Maze-floor params (§17 slice 2). Absent/partial → defaults.
            maze: mazeFromData(f.maze),
        }
    }

    // Write the live buffers back into the current floor's snapshot.
    snapshotCurrentFloor() {
        const f = this.floors[this.currentFloor]
        if (!f) return
        f.grid = { w: this.voidSize.w, h: this.voidSize.h }
        f.areas = this._serializeAreas()
        f.routePoints = this._serializeRoutePoints()
        f.connections = this._serializeConnections()
    }
    // Load floor i into the live buffers + canvas.
    loadFloor(i) {
        if (i < 0 || i >= this.floors.length) return
        this.currentFloor = i
        const f = this.floors[i]
        this.voidSize = { w: f.grid.w, h: f.grid.h }
        if (this.ui) { this.ui.gridW.value = this.voidSize.w; this.ui.gridH.value = this.voidSize.h }
        this.drawGrid()
        this.areas = []; this._hydrateAreas(f.areas)
        this.routePoints = []; this._hydrateRoutePoints(f.routePoints)
        this.connections = []; this._hydrateConnections(f.connections)
        this.fill = null; this.procRooms = []; this.drawFill(); this.setFillStatus("")
        this.select(null)
        this.userAdjusted = false
        this.fitView()
        this.refreshFloorsUI()
    }
    selectFloor(i) {
        if (i === this.currentFloor || i < 0 || i >= this.floors.length) return
        this.snapshotCurrentFloor()
        this.loadFloor(i)
        this.saveLocal()
    }
    addFloor() {
        if (this.floors.length >= MAX_FLOORS) { window.alert(`Editor cap is ${MAX_FLOORS} floors.`); return }
        this.snapshotCurrentFloor()
        // Seed with a start + end so the new floor is immediately playable and
        // traversable (its End becomes the down-stair, its Start the up-stair).
        this.floors.push(this._makeDefaultFloor(`Floor ${this.floors.length + 1}`))
        this.loadFloor(this.floors.length - 1)
        this.saveLocal()
    }
    removeFloor(i) {
        if (this.floors.length <= 1) { window.alert("A dungeon needs at least one floor."); return }
        const f = this.floors[i]
        if (!f) return
        const authored = (f.areas && f.areas.length) || (f.routePoints && f.routePoints.length) || (f.connections && f.connections.length)
        if (authored && !window.confirm(`Delete "${f.name}" and its authored rooms?`)) return
        if (i !== this.currentFloor) this.snapshotCurrentFloor()   // keep the current floor's live edits
        this.floors.splice(i, 1)
        this.currentFloor = Phaser.Math.Clamp(this.currentFloor > i ? this.currentFloor - 1 : this.currentFloor, 0, this.floors.length - 1)
        this.loadFloor(this.currentFloor)
        this.saveLocal()
    }
    setFloorCount(n) {
        n = Phaser.Math.Clamp(n | 0, 1, MAX_FLOORS)
        this.snapshotCurrentFloor()
        if (n > this.floors.length) {
            // New floors get a start + end so they're immediately playable.
            while (this.floors.length < n) this.floors.push(this._makeDefaultFloor(`Floor ${this.floors.length + 1}`))
        } else if (n < this.floors.length) {
            const trimmed = this.floors.slice(n)
            const authored = trimmed.some(f => (f.areas && f.areas.length) || (f.routePoints && f.routePoints.length) || (f.connections && f.connections.length))
            if (authored && !window.confirm(`Reducing to ${n} floor(s) deletes ${this.floors.length - n} with authored rooms. Continue?`)) {
                this.refreshFloorsUI()   // snap the count input back to the real value
                return
            }
            this.floors.length = n
            if (this.currentFloor >= n) this.currentFloor = n - 1
        }
        this.loadFloor(this.currentFloor)
        this.saveLocal()
    }
    // Set the current floor's size (== its grid), from either grid editor.
    setFloorSize(w, h) {
        this.setVoid(w, h)   // clamps, redraws, refits, updates the Layout grid inputs
        const f = this.floors[this.currentFloor]
        if (f) f.grid = { w: this.voidSize.w, h: this.voidSize.h }
        this.refreshFloorsUI()
        this.saveLocal()
    }

    // Rebuild only the floor LIST rows (on rename, so the name input keeps focus).
    _refreshFloorList() {
        const box = this.ui && this.ui.dungFloorList
        if (!box) return
        box.innerHTML = ""
        this.floors.forEach((f, i) => {
            const row = document.createElement("div")
            row.className = "floorrow" + (i === this.currentFloor ? " active" : "")
            const sel = document.createElement("button")
            sel.className = "floorsel"
            const modeTag = f.mode === "maze" ? "  · maze" : ""
            sel.textContent = `${i + 1}. ${f.name || "(unnamed)"}  (${f.grid.w}×${f.grid.h})${modeTag}`
            sel.onclick = () => this.selectFloor(i)
            const del = document.createElement("button")
            del.className = "floordel"; del.textContent = "✕"; del.title = "delete floor"
            del.onclick = (e) => { e.stopPropagation(); this.removeFloor(i) }
            row.appendChild(sel); row.appendChild(del)
            box.appendChild(row)
        })
    }
    // Full Dungeon-tab floor UI refresh (list + count + selected-floor editors).
    refreshFloorsUI() {
        if (!this.ui || !this.ui.dungFloorList) return
        this.ui.dungFloorCount.value = this.floors.length
        this._refreshFloorList()
        const cur = this.floors[this.currentFloor]
        if (cur) {
            this.ui.dungFloorName.value = cur.name || ""
            const mazeMode = cur.mode === "maze"
            if (this.ui.dungFloorMode) this.ui.dungFloorMode.value = mazeMode ? "maze" : "authored"
            if (this.ui.dungFloorMazeHint) this.ui.dungFloorMazeHint.style.display = mazeMode ? "" : "none"
            if (this.ui.dungMazeParams) this.ui.dungMazeParams.style.display = mazeMode ? "" : "none"
            if (mazeMode && this.ui.dungMazeAlgo) {
                const mz = cur.maze || DEFAULT_MAZE
                this.ui.dungMazeAlgo.value = mz.algorithm
                const braidPct = Math.round((mz.braid != null ? mz.braid : DEFAULT_MAZE.braid) * 100)
                this.ui.dungMazeBraid.value = braidPct
                if (this.ui.dungMazeBraidVal) this.ui.dungMazeBraidVal.textContent = `${braidPct}%`
                this.ui.dungMazeRooms.value = mz.roomDensity | 0
                if (this.ui.dungMazeRoomsVal) this.ui.dungMazeRoomsVal.textContent = `${mz.roomDensity | 0}`
            }
            if (this.ui.dungFloorStance) this.ui.dungFloorStance.value = cur.defaultStance || ""
            this.ui.dungFloorW.value = cur.grid.w
            this.ui.dungFloorH.value = cur.grid.h
            this.ui.dungFloorSize.value = sizePresetFor(cur.grid.w, cur.grid.h)
        }
    }

    // ---- goal / win condition (§15.8) --------------------------------------

    // Collected Atlas assets usable as a goal sprite: spritesheet-frame entries
    // only (the game renders the goal item from a { sheet, frame }).
    _collectionForGoal() {
        const coll = this.registry.get("assetCollection") || []
        return coll
            .map(it => ({ name: it.name, sheet: it.sheet, frame: it.entry && (it.entry.frame ?? it.entry.tile) }))
            .filter(it => it.sheet && it.frame != null)
    }

    setGoalSource(source) {
        if (source === "atlas") this.goal = { win: "collect", item: { source: "atlas" } }
        else if (source === "item") this.goal = { win: "collect", item: { source: "item", key: (this.ui.dungGoalKey.value || "").trim() } }
        else this.goal = null   // default → Amulet
        this.refreshGoalUI()     // populates the Atlas dropdown (first entry selected)
        // Capture the currently-shown Atlas asset immediately, so choosing "Atlas
        // asset" sets a real sheet+frame without needing a manual re-pick (the
        // <select> only fires `change` on an actual change).
        if (source === "atlas") this.applyGoalAtlas()
        this.saveLocal()
    }

    applyGoalAtlas() {
        if (this.ui.dungGoalAtlas.value === "cur") return   // already the goal (a direct Atlas pick)
        const coll = this._collectionForGoal()
        const a = coll[parseInt(this.ui.dungGoalAtlas.value, 10)]
        if (!a) return
        this.goal = { win: "collect", item: { source: "atlas", name: a.name, sheet: a.sheet, frame: a.frame } }
        this.refreshGoalUI()
        this.saveLocal()
    }

    applyGoalItem() {
        const key = (this.ui.dungGoalKey.value || "").trim()
        const name = (this.ui.dungGoalName.value || "").trim()
        this.goal = { win: "collect", item: { source: "item", key, ...(name ? { name } : {}) } }
        this.ui.dungGoalSummary.textContent = this._goalSummary()   // live summary; don't rebuild inputs mid-type
        this.saveLocal()
    }

    refreshGoalAtlasOptions() {
        const sel = this.ui && this.ui.dungGoalAtlas
        if (!sel) return
        const coll = this._collectionForGoal()
        const cur = (this.goal && this.goal.item && this.goal.item.source === "atlas" && this.goal.item.sheet) ? this.goal.item : null
        const curInColl = cur && coll.some(a => a.sheet === cur.sheet && a.frame === cur.frame)
        sel.innerHTML = ""
        // A directly-picked asset that isn't in the collection shows first so the
        // dropdown always reflects the actual goal.
        if (cur && !curInColl) {
            const o = document.createElement("option")
            o.value = "cur"; o.textContent = `${cur.name || "asset"} (${cur.sheet} #${cur.frame}) · picked`
            sel.appendChild(o)
        }
        if (!coll.length && !cur) {
            const o = document.createElement("option"); o.value = ""; o.textContent = "— Pick… from the Atlas, or collect assets there —"
            sel.appendChild(o)
        }
        coll.forEach((a, i) => {
            const o = document.createElement("option")
            o.value = String(i); o.textContent = `${a.name} (${a.sheet} #${a.frame})`
            sel.appendChild(o)
        })
        if (cur && !curInColl) sel.value = "cur"
        else if (cur) {
            const idx = coll.findIndex(a => a.sheet === cur.sheet && a.frame === cur.frame)
            if (idx >= 0) sel.value = String(idx)
        }
    }

    _goalSummary() {
        const item = this.goal && this.goal.item
        if (!item) return "Win: collect the Amulet (default)."
        if (item.source === "atlas") return item.sheet ? `Win: collect "${item.name || "asset"}" (${item.sheet} #${item.frame}).` : "Win: pick an Atlas asset above."
        return item.key ? `Win: collect game item "${item.key}".` : "Win: enter a game-item key above."
    }

    refreshGoalUI() {
        if (!this.ui || !this.ui.dungGoalSource) return
        const item = this.goal && this.goal.item
        const source = !item ? "default" : (item.source === "atlas" ? "atlas" : "item")
        this.ui.dungGoalSource.value = source
        this.ui.dungGoalAtlasRow.style.display = source === "atlas" ? "" : "none"
        this.ui.dungGoalItemRow.style.display = source === "item" ? "" : "none"
        if (source === "atlas") this.refreshGoalAtlasOptions()
        if (source === "item") {
            this.ui.dungGoalKey.value = (item && item.key) || ""
            this.ui.dungGoalName.value = (item && item.name) || ""
        }
        this.ui.dungGoalSummary.textContent = this._goalSummary()
    }

    // Jump to the Atlas tab in pick mode; a click there returns via 'atlas:pick'
    // (target "goal") to applyGoalPick. Same mechanism as the theme pickers.
    beginGoalPick() {
        this.registry.set("atlasPick", "goal")
        if (this.game.showTab) this.game.showTab("atlas")
    }

    // Apply an Atlas asset picked directly from the browser as the goal item.
    applyGoalPick({ sheet, frame, name }) {
        this.goal = { win: "collect", item: { source: "atlas", name, sheet, frame } }
        this.refreshGoalUI()
        this.saveLocal()
    }

    serialize() {
        this.snapshotCurrentFloor()
        const cur = this.floors[this.currentFloor] || this.floors[0] || this._makeFloor("Floor 1")
        const out = {
            format: FORMAT,
            version: 2,
            // Flat CURRENT-floor view — the game / Play still reads the selected
            // floor from these top-level fields (unchanged) until in-game multi-floor
            // (slice 3). `floors` below is the full authoring roster.
            grid: { w: cur.grid.w, h: cur.grid.h },
            areas: cur.areas,
            floors: this.floors.map(f => ({
                id: f.id, name: f.name, grid: { w: f.grid.w, h: f.grid.h },
                areas: f.areas, routePoints: f.routePoints, connections: f.connections,
                defaultStance: f.defaultStance || "",
                mode: f.mode === "maze" ? "maze" : "authored",   // §17 generation mode
                maze: mazeFromData(f.maze),                      // §17 slice 2 maze params
            })),
            currentFloor: this.currentFloor,
        }
        if (cur.routePoints && cur.routePoints.length) out.routePoints = cur.routePoints
        if (cur.connections && cur.connections.length) out.connections = cur.connections
        if (Object.keys(this.presets).length) out.presets = this.presets
        if (this.dungeonPool.length) out.dungeonPool = this.dungeonPool.slice()
        out.poolMode = this.poolMode
        // Special-room mix. Written only when the author actually changed
        // something — an absent key means "the table's defaults", which is what
        // every dungeon built before this existed should keep getting.
        const roomKinds = normalizeRoomKindMix(this.roomKinds)
        if (roomKinds) out.roomKinds = roomKinds
        ENEMY_TOGGLES.forEach(t => { out[t.key] = this[t.key] })
        out.perception = { rangeScale: this.perception.rangeScale, coneScale: this.perception.coneScale }
        // Persist the seed only when locked (a reproducible layout the user pinned).
        if (this.ui && this.ui.fillLock && this.ui.fillLock.checked) {
            out.fillSeed = this.fillSeed | 0
            out.fillSeedLocked = true
        }
        out.corridorStyle = this.corridorStyle()   // dungeon-level path-style prefs
        if (this.theme && this.theme.sheet) out.theme = this.theme
        if (this.goal && this.goal.item) out.goal = this.goal   // win condition (§15.8)
        if (this.heldAsset && this.heldAsset.sheet) out.heldAsset = this.heldAsset   // asset-reference primitive
        if (this.dungeon.name) out.name = this.dungeon.name
        if (this.dungeon.description) out.description = this.dungeon.description
        // Asset collection (the Atlas tab's staging shelf) — one JSON, no side file.
        const collection = this.registry.get("assetCollection")
        if (Array.isArray(collection) && collection.length) out.collection = collection
        return out
    }

    deserialize(data) {
        if (!data) return

        // --- dungeon-level fields (independent of the floor format) ---
        this.presets = {}
        if (data.presets && typeof data.presets === "object") {
            for (const [name, members] of Object.entries(data.presets)) {
                if (Array.isArray(members)) this.presets[name] = members.filter(x => typeof x === "string")
            }
        }
        this.dungeonPool = Array.isArray(data.dungeonPool) ? data.dungeonPool.filter(x => typeof x === "string") : []
        this.poolMode = data.poolMode === "random" ? "random" : "authored"
        // Special-room mix; absent / malformed = the table's defaults.
        this.roomKinds = normalizeRoomKindMix(data.roomKinds) || {}
        ENEMY_TOGGLES.forEach(t => { this[t.key] = !!data[t.key] })
        const perc = (data.perception && typeof data.perception === "object") ? data.perception : {}
        this.perception = {
            rangeScale: Number.isFinite(perc.rangeScale) ? perc.rangeScale : 1,
            coneScale: Number.isFinite(perc.coneScale) ? perc.coneScale : 1,
        }
        // Asset collection into the shared registry; the Atlas tab repaints off the
        // resulting changedata event.
        this.registry.set("assetCollection", Array.isArray(data.collection) ? data.collection : [])
        // Floor theme (unknown/partial themes fall back to the default in-game).
        // Migrates legacy SCALAR themes (floorTile/wallTile) into the weighted-list
        // model so old saves load unchanged (§15.10).
        this.theme = this._themeFromData(data.theme)
        // Win condition (§15.8); malformed/absent → default Amulet.
        this.goal = (data.goal && data.goal.item && typeof data.goal.item === "object") ? data.goal : null
        // Held asset reference (asset-reference primitive); needs a sheet to be usable.
        this.heldAsset = (data.heldAsset && typeof data.heldAsset === "object" && data.heldAsset.sheet) ? data.heldAsset : null
        this.refreshHeldAssetUI()
        this.dungeon = {
            name: typeof data.name === "string" ? data.name : "",
            description: typeof data.description === "string" ? data.description : "",
        }
        this.fillSeed = data.fillSeed | 0

        // --- floor roster: new floors[] format, else migrate the legacy flat one ---
        let floors
        if (Array.isArray(data.floors) && data.floors.length) {
            floors = data.floors.map((f, i) => this._floorFromData(f, i))
        } else if (Array.isArray(data.areas)) {
            floors = [this._floorFromData(
                { name: "Floor 1", grid: data.grid, areas: data.areas, routePoints: data.routePoints, connections: data.connections }, 0)]
        } else {
            return   // nothing authorable
        }
        this.floors = floors
        this.currentFloor = Phaser.Math.Clamp(data.currentFloor | 0, 0, this.floors.length - 1)

        // nextId above every floor / area / route-point id so new ones can't collide.
        let maxId = 0
        for (const f of this.floors) {
            maxId = Math.max(maxId, f.id | 0)
            for (const a of f.areas) maxId = Math.max(maxId, a.id | 0)
            for (const p of f.routePoints) maxId = Math.max(maxId, p.id | 0)
            for (const c of (f.connections || [])) maxId = Math.max(maxId, c.id | 0)
        }
        this.nextId = maxId + 1

        // --- dungeon-level UI ---
        this.refreshThemeUI()
        this.refreshDungeonUI()
        this.refreshGoalUI()
        this.refreshPresetSelects()
        this.renderDungeonChips()
        if (this.ui) {
            this.ui.fillLock.checked = !!data.fillSeedLocked
            this.ui.fillSeed.value = data.fillSeedLocked ? (data.fillSeed | 0) : ""
            const cs = data.corridorStyle
            if (cs) {
                if (typeof cs.straight === "number") this.ui.fillStraight.value = cs.straight
                if (typeof cs.wander === "number") this.ui.fillWander.value = cs.wander
                if (cs.width) this.ui.fillWidth.value = String(cs.width)
                if (typeof cs.rooms === "boolean") this.ui.fillRooms.checked = cs.rooms
                if (typeof cs.roomCount === "number") this.ui.fillRoomCount.value = cs.roomCount
            }
        }

        // Load the selected floor into the live buffers + canvas (draws, fits, and
        // refreshes the floor UI).
        this.loadFloor(this.currentFloor)

        // A locked layout regenerates its corridors on load (deterministic).
        if (data.fillSeedLocked && this.areas.length >= 2) this.generateFill()
        this.refreshFloorsUI()
    }

    exportJSON() {
        const json = JSON.stringify(this.serialize(), null, 2)
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
        const a = document.createElement("a")
        a.href = url; a.download = "dungeon.json"
        document.body.appendChild(a); a.click(); a.remove()
        URL.revokeObjectURL(url)
    }

    importFromFile(file) {
        const reader = new FileReader()
        reader.onload = () => {
            try { this.deserialize(JSON.parse(reader.result)) }
            catch (err) { console.warn("[designer] import failed:", err) }
        }
        reader.readAsText(file)
    }

    // "Walk into it" (design §15.6 step 6): save the current design to the
    // localStorage slot the game reads, then open the game in authored mode. The
    // game's MapState sees ?authored=1, loads this skeleton, and builds it as a
    // single AuthoredLevel floor. Temporary handoff (URL param + localStorage) —
    // a start-screen importer replaces it later.
    playAuthored() {
        if (!this.areas.length) { window.alert("Draw at least one area before playing."); return }
        this.saveLocal()
        // Open the game in a NEW tab (noopener — the game has no need to drive the
        // designer tab back). localStorage is shared across same-origin tabs, so the
        // saveLocal() handoff the game reads on ?authored=1 still resolves. Fires from
        // the button's click handler, so the popup blocker allows it.
        window.open("index.html?authored=1", "_blank", "noopener")
    }

    // ---- floor theme (picked from the Atlas tab) ---------------------------

    // Enter Atlas pick mode for a slot ('floor' | 'wall') and switch to that tab.
    // The Atlas reads this registry value; a click there emits 'atlas:pick' back.
    beginThemePick(slot) {
        this.registry.set("atlasPick", slot)
        if (this.game.showTab) this.game.showTab("atlas")
    }

    // Apply a pick returned from the Atlas by APPENDING the frame to the target
    // list (floor|wall) at weight 1 (§15.10). The engine paints ONE tileset per
    // floor, so floor and wall must share a sheet: if the picked sheet differs
    // from the current one, BOTH lists are cleared (the sheet changed). Duplicate
    // frames are ignored — adjust prominence via the weight input instead.
    applyThemePick({ target, sheet, frame, tileSize, spacing, margin }) {
        if (!this.theme) this.theme = { sheet: null, tileSize: 16, spacing: 0, margin: 0, floorTiles: [], wallTiles: [] }
        if (this.theme.sheet && this.theme.sheet !== sheet) {
            this.theme.floorTiles = []
            this.theme.wallTiles = []
            // Terrain names are scoped to a sheet, so they can't survive a sheet
            // change either — a stale name would leave the dropdown blank (it's
            // filtered to the new sheet's terrains) while the theme still carried
            // it, and the engine would look it up on the wrong sheet and find
            // nothing. Clear them with the frames they belong to.
            this.theme.autotile = null
            this.theme.wallAutotile = null
        }
        this.theme.sheet = sheet
        this.theme.tileSize = tileSize
        this.theme.spacing = spacing
        this.theme.margin = margin
        // Hand-picking a frame means this is no longer a stock dungeon type.
        this.theme.type = null
        const list = target === "wall" ? this.theme.wallTiles : this.theme.floorTiles
        if (!list.some(e => e.frame === frame)) list.push({ frame, weight: 1 })
        this.refreshThemeUI()
        this.saveLocal()
    }

    // Remove a frame from a list (slot = 'floor'|'wall'). If both lists end up
    // empty the theme drops back to null (the game's default tileset).
    removeThemeTile(slot, frame) {
        if (!this.theme) return
        const keyName = slot === "wall" ? "wallTiles" : "floorTiles"
        this.theme[keyName] = (this.theme[keyName] || []).filter(e => e.frame !== frame)
        this.theme.type = null   // edited by hand — no longer a stock type
        if (!(this.theme.floorTiles || []).length && !(this.theme.wallTiles || []).length) this.theme = null
        this.refreshThemeUI()
        this.saveLocal()
    }

    // Set a frame's sampling weight (integer ≥ 1; higher = more common). No full
    // re-render — the input already shows the value.
    setThemeTileWeight(slot, frame, weight) {
        if (!this.theme) return
        const keyName = slot === "wall" ? "wallTiles" : "floorTiles"
        const entry = (this.theme[keyName] || []).find(e => e.frame === frame)
        if (!entry) return
        entry.weight = Number.isFinite(weight) && weight > 0 ? Math.floor(weight) : 1
        this.saveLocal()
    }

    // Render one weighted tile list into its container: a row per frame with a
    // "#frame" label (sheet in the tooltip), a weight input, and a remove button.
    // Empty (or no theme) shows "default", meaning the game paints its own tileset.
    renderThemeList(listEl, slot, entries) {
        if (!listEl) return
        listEl.innerHTML = ""
        if (!this.theme || !this.theme.sheet || !entries.length) {
            const em = document.createElement("div")
            em.className = "themeempty"
            em.textContent = "default"
            listEl.appendChild(em)
            return
        }
        for (const e of entries) {
            const row = document.createElement("div")
            row.className = "themetile"
            const lbl = document.createElement("span")
            lbl.className = "themetilelabel"
            lbl.textContent = `#${e.frame}`
            lbl.title = `${this.theme.sheet} #${e.frame}`
            const w = document.createElement("input")
            w.type = "number"; w.min = "1"; w.className = "themeweight"; w.value = e.weight
            w.title = "weight — higher = painted more often"
            w.onchange = () => this.setThemeTileWeight(slot, e.frame, parseInt(w.value, 10))
            const rm = document.createElement("button")
            rm.className = "smallbtn"; rm.textContent = "✕"; rm.title = "remove tile"
            rm.onclick = () => this.removeThemeTile(slot, e.frame)
            row.append(lbl, w, rm)
            listEl.appendChild(row)
        }
    }

    // Apply a dungeon TYPE — the one-pick look (levels/dungeonTypes.js). Replaces
    // the whole theme: sheet, slice params, both terrains, and the flat fallback
    // frames derived from each terrain's fill. An empty key clears back to the
    // game's default tileset, matching "Use default tileset".
    applyDungeonType(key) {
        if (!key) {
            this.theme = null
        } else {
            const theme = themeForDungeonType(key)
            // Guarded rather than trusted: readyDungeonTypes() filters the list at
            // bind time, but the Atlas can re-label a sheet while the designer is
            // open. A type that no longer resolves leaves the theme untouched.
            if (!theme) { this.refreshThemeUI(); return }
            this.theme = theme
        }
        this.refreshThemeUI()
        this.saveLocal()
    }

    // Repaint both tile lists + the shared-sheet caption from this.theme.
    refreshThemeUI() {
        if (!this.ui || !this.ui.themeFloorList) return
        const t = this.theme
        if (this.ui.themeSheetVal) this.ui.themeSheetVal.textContent = (t && t.sheet) ? `· ${t.sheet}` : ""
        this.renderThemeList(this.ui.themeFloorList, "floor", (t && t.floorTiles) || [])
        this.renderThemeList(this.ui.themeWallList, "wall", (t && t.wallTiles) || [])
        this._refreshAutotileOptions()
        if (this.ui.themeLighting) this.ui.themeLighting.value = (t && t.lighting) || "torchlit"
        if (this.ui.themeTimeOfDay) this.ui.themeTimeOfDay.value = (t && t.timeOfDay) || "cycle"
        this.refreshDungeonTypeUI()
    }

    // Sync the Dungeon-tab type select + its blurb to the theme. theme.type is
    // cleared whenever the theme is edited by hand, so this falls back to
    // "custom" and the two tabs never disagree about what the dungeon looks like.
    refreshDungeonTypeUI() {
        const sel = this.ui && this.ui.dungType
        if (!sel) return
        const key = (this.theme && this.theme.type) || ""
        sel.value = [...sel.options].some(o => o.value === key) ? key : ""
        if (this.ui.dungTypeDesc) {
            const type = getDungeonType(sel.value)
            this.ui.dungTypeDesc.textContent = type ? type.description : ""
        }
    }

    // Fill the Autotile ground/wall dropdowns with the terrains fully labeled on
    // the current theme sheet (X:c + 4 edges + 4 corners). Empty when there's no
    // sheet or no ready terrain — then the controls just offer "none".
    _refreshAutotileOptions() {
        const t = this.theme
        const ready = (t && t.sheet) ? autotileReadyTerrains(t.sheet) : []
        const fill = (sel, current, noneLabel) => {
            if (!sel) return
            // Inline option creation — the bindDom `addOption` helper is out of scope here.
            const opt = (value, label) => { const o = document.createElement("option"); o.value = value; o.textContent = label; sel.appendChild(o) }
            sel.innerHTML = ""
            opt("", ready.length ? noneLabel : "— none (no labeled terrain) —")
            for (const name of ready) opt(name, name)
            sel.value = (current && ready.includes(current)) ? current : ""
        }
        fill(this.ui && this.ui.themeAutotile, t && t.autotile, "— none (sampled floor) —")
        fill(this.ui && this.ui.themeWallAutotile, t && t.wallAutotile, "— none (sampled wall) —")
    }

    // Normalize a serialized theme into the editor's weighted-list model, or null
    // if it carries no usable frames. Accepts BOTH the legacy scalar shape
    // ({ floorTile, wallTile }) and the widened list shape ({ floorTiles[],
    // wallTiles[] }); list entries may be bare frame numbers or { frame, weight }.
    _themeFromData(t) {
        if (!t || typeof t !== "object" || !t.sheet) return null
        const toList = (scalar, list) => {
            const src = Array.isArray(list) && list.length ? list : (scalar != null ? [scalar] : [])
            return src
                .map(e => typeof e === "number"
                    ? { frame: e, weight: 1 }
                    : (e && e.frame != null ? { frame: e.frame, weight: e.weight > 0 ? Math.floor(e.weight) : 1 } : null))
                .filter(Boolean)
        }
        const floorTiles = toList(t.floorTile, t.floorTiles)
        const wallTiles = toList(t.wallTile, t.wallTiles)
        if (!floorTiles.length && !wallTiles.length) return null
        // Carry the engine-owned content fields through UNTOUCHED. This object is
        // rebuilt from scratch on every load, so anything not copied here is lost
        // — and because the 2s autosave then writes the stripped theme back, the
        // loss is permanent and silent. That cost the scenery on every dungeon
        // whose designer page had been reloaded since the type was picked.
        const carried = {}
        for (const field of THEME_CONTENT_FIELDS) {
            if (t[field] !== undefined) carried[field] = t[field]
        }
        return {
            ...carried,
            sheet: t.sheet,
            tileSize: t.tileSize != null ? t.tileSize : 16,
            spacing: t.spacing != null ? t.spacing : 0,
            margin: t.margin != null ? t.margin : 0,
            floorTiles,
            wallTiles,
            // Autotile ground terrain labeled on `sheet` (Atlas labels); paints
            // floor cells neighbor-aware in-game. null/absent = off.
            autotile: (typeof t.autotile === "string" && t.autotile) ? t.autotile : null,
            // Same for wall cells (levels/dungeonTypes.js sets both together).
            wallAutotile: (typeof t.wallAutotile === "string" && t.wallAutotile) ? t.wallAutotile : null,
            // The dungeon TYPE this theme came from, if any — purely a designer
            // affordance (it keeps the Dungeon-tab select showing the right name
            // across a reload). The engine reads the resolved fields, not this.
            type: (typeof t.type === "string" && t.type) ? t.type : null,
        }
    }

    // ---- held asset (asset-reference primitive) ----------------------------

    // Enter Atlas "asset" pick mode and switch to that tab. Unlike theme/goal,
    // this accepts ANY renderable asset and returns the full reference. The pick
    // returns to the Layout tab (where the Held-asset controls live) via the
    // pinned `atlasPickReturn`.
    beginAssetPick() {
        this.registry.set("atlasPick", "asset")
        this.registry.set("atlasPickReturn", "layout")
        if (this.game.showTab) this.game.showTab("atlas")
    }

    // Set (or clear) the held asset reference and refresh the label.
    setHeldAsset(ref) {
        this.heldAsset = ref || null
        this.refreshHeldAssetUI()
        this.saveLocal()
    }

    // Copy the held reference's JSON to the clipboard (the "copy important data"
    // action) so it can be pasted/reused. Falls back to a flash if the async
    // clipboard API is unavailable.
    copyHeldAssetData() {
        if (!this.heldAsset) return
        const text = JSON.stringify(this.heldAsset)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {})
        }
    }

    // Reflect the held asset into its inspector label.
    refreshHeldAssetUI() {
        if (!this.ui || !this.ui.heldAssetVal) return
        this.ui.heldAssetVal.textContent = this.heldAsset ? describeAssetRef(this.heldAsset) : "none"
    }

    // ---- items tab (item/lore archive editor) ------------------------------

    _populateItemSelects() {
        if (!this.ui || !this.ui.itemCategory) return
        this.ui.itemCategory.innerHTML = ITEM_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("")
        this.ui.itemSlot.innerHTML = `<option value="">(none)</option>` + ITEM_SLOTS.map(s => `<option value="${s}">${s}</option>`).join("")
    }

    // Load the archive from disk (via the dev endpoint) into memory + render.
    // Falls back to an empty archive if the endpoint isn't there (Vite not
    // restarted / a built page) — see itemArchiveClient.
    async loadArchiveFromDisk() {
        this.itemArchive = await loadItemArchive()
        this.selectedItemKey = this.itemArchive.items[0] ? this.itemArchive.items[0].key : null
        this._syncAuthoredItemsRegistry()
        this.renderItemEditor()
        this.setItemsStatus(`Loaded ${this.itemArchive.items.length} item${this.itemArchive.items.length === 1 ? "" : "s"}.`)
    }

    async saveArchive() {
        const ok = await saveItemArchive(this.itemArchive)
        this.setItemsStatus(ok
            ? `Saved ${this.itemArchive.items.length} item${this.itemArchive.items.length === 1 ? "" : "s"}.`
            : "Save failed — dev endpoint unavailable (restart Vite after adding vite.config.js).")
    }

    selectedItem() {
        return this.itemArchive.items.find(i => i.key === this.selectedItemKey) || null
    }

    // Mirror the archive's items into the shared registry so the Atlas tab can
    // render them as its "authored items" page (item browsing lives there now,
    // not a list in this tab). Only the fields the browser needs travel.
    _syncAuthoredItemsRegistry() {
        this.registry.set("authoredItems", this.itemArchive.items.map(i => ({ key: i.key, name: i.name, art: i.art })))
    }

    selectItem(key) {
        this.selectedItemKey = key
        this.renderItemEditor()
    }

    renderItemEditor() {
        if (!this.ui || !this.ui.itemFields) return
        const it = this.selectedItem()
        this.ui.itemNone.style.display = it ? "none" : ""
        this.ui.itemFields.style.display = it ? "" : "none"
        if (!it) return
        this.ui.itemKey.value = it.key
        this.ui.itemName.value = it.name || ""
        this.ui.itemCategory.value = it.category
        this.ui.itemSlot.value = it.slot || ""
        this.ui.itemQuest.checked = !!it.questItem
        this.ui.itemLore.value = it.lore || ""
        this.ui.itemArtVal.textContent = it.art ? describeAssetRef(it.art) : "none"
    }

    _slugify(s) {
        return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    }

    // A key not already used by another item (the editing item keeps its own).
    _uniqueKey(base) {
        const root = base || "item"
        let key = root, n = 2
        while (this.itemArchive.items.some(i => i.key === key)) key = `${root}-${n++}`
        return key
    }

    addItem() {
        const key = this._uniqueKey("new-item")
        this.itemArchive.items.push({ key, name: "New item", category: "misc", slot: null, questItem: false, lore: "", art: null, stats: {} })
        this.selectedItemKey = key
        this._syncAuthoredItemsRegistry()
        this.renderItemEditor()
        this.setItemsStatus("Unsaved changes.")
    }

    deleteSelectedItem() {
        const it = this.selectedItem()
        if (!it) return
        if (!window.confirm(`Delete "${it.name || it.key}"?`)) return
        this.itemArchive.items = this.itemArchive.items.filter(i => i.key !== it.key)
        this.selectedItemKey = this.itemArchive.items[0] ? this.itemArchive.items[0].key : null
        this._syncAuthoredItemsRegistry()
        this.renderItemEditor()
        this.setItemsStatus("Unsaved changes.")
    }

    editItemField(field, value) {
        const it = this.selectedItem()
        if (!it) return
        it[field] = value
        if (field === "name") this._syncAuthoredItemsRegistry()   // name shows on the Atlas page
        this.setItemsStatus("Unsaved changes.")
    }

    // Key is the stable id — slugified + kept unique. Empty input restores the
    // current key (a key is required).
    editItemKey(raw) {
        const it = this.selectedItem()
        if (!it) return
        const slug = this._slugify(raw)
        if (!slug) { this.renderItemEditor(); return }
        const key = slug === it.key ? slug : this._uniqueKey(slug)
        it.key = key
        this.selectedItemKey = key
        this._syncAuthoredItemsRegistry()
        this.renderItemEditor()
        this.setItemsStatus("Unsaved changes.")
    }

    // Consume the held asset-reference (asset-reference primitive) as the selected
    // item's art — the first real consumer of that primitive.
    useHeldAssetAsArt() {
        if (!this.heldAsset) { this.setItemsStatus("No held asset — pick one on the Layout tab first."); return }
        this.setItemArt(this.heldAsset)
    }

    setItemArt(ref) {
        const it = this.selectedItem()
        if (!it) return
        it.art = ref || null
        this.ui.itemArtVal.textContent = it.art ? describeAssetRef(it.art) : "none"
        this._syncAuthoredItemsRegistry()   // art shows as the item's Atlas thumbnail
        this.setItemsStatus("Unsaved changes.")
    }

    setItemsStatus(msg) {
        if (this.ui && this.ui.itemsStatus) this.ui.itemsStatus.textContent = msg
    }

    // Reflect the Dungeon container (identity) into the Dungeon-tab inputs.
    refreshDungeonUI() {
        if (!this.ui || !this.ui.dungName) return
        this.ui.dungName.value = this.dungeon.name || ""
        this.ui.dungDesc.value = this.dungeon.description || ""
        if (this.ui.dpoolMode) this.ui.dpoolMode.value = this.poolMode
        ENEMY_TOGGLES.forEach(t => { if (this.ui[t.id]) this.ui[t.id].checked = this[t.key] })
        if (this.ui.percRange) this.ui.percRange.value = this.perception.rangeScale
        if (this.ui.percCone) this.ui.percCone.value = this.perception.coneScale
        // The room-type rows live on the Generate tab, but they're dungeon-level
        // state like everything else here — an import has to repaint them or the
        // rail keeps showing the previous dungeon's mix.
        this.renderRoomKinds()
    }

    newDungeon() {
        const hasWork = this.floors.length > 1 || this.areas.length || this.routePoints.length || this.connections.length
        if (hasWork && !window.confirm("Clear everything and start a new dungeon?")) return
        this.nextId = 1
        this.floors = [this._makeDefaultFloor("Floor 1")]   // general default (start + end pre-placed)
        this.currentFloor = 0
        this.dungeon = { name: "", description: "" }
        this.goal = null
        this.heldAsset = null
        this.roomKinds = {}                                 // back to the default special-room mix
        this.registry.set("assetCollection", [])            // clear the Atlas collection too
        this.refreshDungeonUI()
        this.refreshGoalUI()
        this.refreshHeldAssetUI()
        this.loadFloor(0)
        this.saveLocal()
    }

    saveLocal() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(this.serialize())) } catch (e) { /* quota/private mode */ }
    }
    loadLocal() {
        try { const s = localStorage.getItem(LS_KEY); if (s) this.deserialize(JSON.parse(s)) } catch (e) { /* ignore */ }
    }
}
