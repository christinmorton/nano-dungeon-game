import Phaser from 'phaser'
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import tm from "../TurnManager.js"
import Stairs from "../items/Stairs.js"
import quest from "../Quest.js"
import run from "../Run.js"
import router from "../SceneRouter.js"
import prefs from "../Prefs.js"
import fogOfWar from "../FogOfWar.js"
import speech from "../SpeechBubble.js"
import audio from "../Audio.js"
import { preloadSheets, GAME_SHEETS } from "../assetLoader.js"
import { RECIPE_SHEETS } from "../levels/recipes.js"
import { resolveAmbient } from "../levels/lighting.js"

export default class World extends Phaser.Scene {
    constructor() {
        super({ key: "world-scene", active: false })
    }

    preload () {
        this.load.bitmapFont("arcade", "assets/fonts/arcade.png", "assets/fonts/arcade.xml");
        this.load.spritesheet('tiles', 'kenney_1-bit-pack/Tilesheet/colored-transparent.png', {
            frameWidth: 16,
            frameHeight: 16,
            spacing: 1
        })
        this.load.spritesheet('retroImpactLightning', 'retro_impact_lighting_effect.png', {
            frameWidth: 64,
            frameHeight: 64
        })
        // Ability icons — one 16px frame per ability, in the order declared by
        // scripts/build_skill_icons.mjs. Each Ability's `icon` field is its frame
        // index into THIS sheet, not into 'tiles'. Loaded here rather than through
        // assetSheets because it is a plain uniform grid with no tileReference
        // catalogue behind it — nothing needs to look these up by name.
        //
        // The file is generated and gitignored like all other art: a clone runs
        // `node scripts/build_skill_icons.mjs` to rebuild it from the pack. If it
        // is absent the slots render blank, the same way a missing tileset paints
        // nothing — no crash, just no icons.
        this.load.spritesheet('skills', 'art/skills.png', {
            frameWidth: 16,
            frameHeight: 16
        })
        // New PNG art packs (see src/data/assetSheets.js). Allowlisted so the
        // game only loads what it renders. Heroes first (Slice 1); enemies /
        // npcs / item drops get added here as each is wired to its art.
        preloadSheets(this, GAME_SHEETS)
        // Themed-floor tilesets used by dungeon recipes (levels/recipes.js) — the
        // floor layer paints from these, so they must be loaded before bind().
        preloadSheets(this, RECIPE_SHEETS)
        // Every sound in src/data/audioManifest.json. Phaser's audio cache is
        // game-wide, so loading here also covers the UI and end screens — none
        // of which ever run before World.
        audio.preload(this)
    }

    create () {
        this.events.once('dungeon-changed', () => {
            this.scene.restart()
        })

        dungeon.initialize(this)

        let stairs = mapState.stairs
        if (stairs.down) {
            tm.addEntity(new Stairs(stairs.down.x, stairs.down.y, "down"))
        }

        dungeon.placePlayer()


        // A fresh floor always starts unpaused. The combat intro beat owns
        // dungeon.paused and only clears it from _hideIntro (UI scene). If a
        // battle forms on the same frame the player descends, the floor restart
        // destroys that pending unpause before it runs, stranding paused=true
        // onto the new floor — which freezes World.update and HeroController.
        // Clearing it here makes the freeze unable to survive a transition,
        // regardless of how the intro beat was interrupted.
        dungeon.paused = false


        // Per-room enemy/item spawn, elite roll, BSP-specific door + key
        // placement — all owned by the level type now. Reads dungeon.player
        // for the door-placement BFS, so it must run after player placement.
        // On revisit, FloorMemory hydrates the persisted entities instead
        // of re-rolling a fresh population. Quest hooks are skipped on the
        // hydrate path so addAmulet doesn't double-spawn the Amulet on
        // floor-N revisits — the snapshot already carries it if it was
        // un-picked-up at exit.
        // v5 populates every floor fresh. Descent is one-way and there is no
        // floor persistence (scope doc section 6), so there is nothing to hydrate
        // and no explored fog to carry forward.
        const restoredFog = null
        mapState.levelManager.getCurrent().populate(tm)
        quest.forEach(f => f())

        // Day/night debug, kept from v3. The cycle runs on the round counter, so
        // seeing dusk otherwise means walking ~64 rounds to it.
        //   time()           -> where the clock is now
        //   setTime('night') -> pin an hour; setTime(null) to release
        if (typeof window !== 'undefined') {
            window.time = () => {
                const a = resolveAmbient(mapState.theme, tm.tickCount || 0)
                return {
                    round: tm.tickCount || 0,
                    phase: a.label,
                    cycles: a.cycles,
                    sightRadius: a.radius,
                    enemySight: a.enemySight,
                    pinned: fogOfWar.debugTimeOfDay || null,
                }
            }
            window.setTime = (key) => {
                fogOfWar.debugTimeOfDay = key || null
                if (dungeon.player) fogOfWar.update(dungeon.player)
                return window.time()
            }

            // Volume, until there is a Settings screen to hold it. There is no
            // key binding for mute because every conventional letter is taken
            // (m/b/c/g/o/h/t are unequip-slot keys), and the real control
            // belongs on the Pause menu.
            //   volume()            -> current levels
            //   volume({music: 0})  -> set any of master/music/sfx/muted
            //   mute()              -> toggle
            window.volume = (patch) => {
                if (patch) {
                    for (const [k, v] of Object.entries(patch)) {
                        const key = k === 'master' ? 'masterVolume'
                            : k === 'music' ? 'musicVolume'
                                : k === 'sfx' ? 'sfxVolume' : k
                        prefs.setPreference(key, v)
                    }
                    audio.refreshVolume()
                }
                const p = prefs.getPreferences()
                return {
                    master: p.masterVolume, music: p.musicVolume,
                    sfx: p.sfxVolume, muted: p.muted
                }
            }
            window.mute = () => window.volume({ muted: !prefs.getPreferences().muted })
            // The Mana Beam variant switcher (window.beam / beamState) lived here
            // from 2026-09-20 to 2026-10-04. The sustained beam won (scope doc
            // §10.16); the VARIANTS table it switched is gone from ManaBeam.js.
        }

        // Fire onEnter for the spawn room. populate() runs first so any
        // per-room hooks attached by the kind handler are in place. On
        // revisit, the Room instances persist on the BSPLevel so hooks
        // set during the original visit are still bound — kind handlers
        // are responsible for checking persisted state (e.g. duelist
        // checks whether the elite is still alive).
        dungeon.player.currentRoom = null
        dungeon.updateHeroRoom(dungeon.player)

        // HUD is a small floating box owned by the UI scene; the world camera
        // uses the full canvas. Bounds match the MAP's pixel size so the camera
        // can scroll the player into any corner of the level. (Must be the map
        // dimensions, not camera.worldView — worldView is the visible viewport,
        // which clips scrolling on any floor larger than one screen. Authored
        // designer floors can be much bigger than the run-length presets, so the
        // old viewport-based bounds made them read as "cut off".)
        let camera = this.cameras.main
        const cols = mapState.level[0] ? mapState.level[0].length : 0
        const rows = mapState.level.length
        const fullW = cols * mapState.tileSize
        const fullH = rows * mapState.tileSize
        // Pad the bounds by half a viewport on every side so the camera can scroll
        // slightly past the map edge and keep the player centered even at the
        // boundary — otherwise tight bounds clamp the camera and pin the player to
        // the very edge of the window, with the outer wall jammed at the screen
        // border (worst on authored floors whose rooms sit near the void edge).
        const zoom = prefs.getPreferences().cameraZoom
        const padX = camera.width / zoom / 2
        const padY = camera.height / zoom / 2
        camera.setBounds(-padX, -padY, fullW + padX * 2, fullH + padY * 2)
        camera.startFollow(dungeon.player.sprite)
        // Zoom from the player's preference (Settings > Display > Camera zoom;
        // default 3). Whole numbers only — pixelArt makes fractional zoom shimmer.
        // Higher = bigger tiles but less of the map visible.
        camera.setZoom(prefs.getPreferences().cameraZoom)

        // Fog of war — bind to the new floor's level grid (restoring the
        // explored memory from the snapshot on a revisit), then light the
        // tiles around the spawn position so the player can see their
        // starting room on entry.
        fogOfWar.bind(this, restoredFog)
        fogOfWar.update(dungeon.player)


        // Floating prompt above the player's current interact target.
        // Positioned and shown each tick by update().
        this.interactHint = this.add.text(0, 0, "", {
            font: "10px Arial",
            color: "#ffd700",
            backgroundColor: "rgba(0,0,0,0.6)",
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 1).setDepth(30).setVisible(false)

        this._maybeDrawRoomKindOverlay()

        // Floating "talking head" speech bubbles. Re-bound every floor entry
        // because scene.restart() destroys the old display objects. Any actor
        // can speak on demand via speech.say(entity, text). See SpeechBubble.js.
        speech.bind(this)

        // Sound. Bound after the floor is built so the first thing it does is
        // start that floor's track. The last floor is the stronghold and gets
        // its own music — same test Quest.js uses to place the goal.
        audio.bind(this)
        const lm = mapState.levelManager
        audio.playFloorMusic(lm.currentLevel, lm.currentLevel === lm.levels.length - 1)

        // Trigger UI scene construction
        this.events.emit('createUI')

        // Demo: the hero greets the player on entering a floor. Remove or
        // replace once real dialog content is authored per actor.
        speech.say(dungeon.player, "Another floor... let's keep moving.")

    }

    // Dev tool: tint each room by its assigned kind and stamp the kind name
    // at the center. Gated on the URL param `?debugRooms=1` so the cost is
    // zero in normal play. Useful for verifying which kinds are landing on
    // a given floor without reading console logs.
    _maybeDrawRoomKindOverlay() {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        if (params.get("debugRooms") !== "1") return

        const TILE = 16
        const KIND_COLORS = {
            starting: 0x66ff66,
            ending: 0xff6666,
            treasure: 0xffcc33,
            camp: 0x33ffcc,
            combat: 0x666666,
            shrine: 0x66ccff,
            duelist: 0xff66ff,
            secret: 0x9966ff,
            "bats-only": 0xff9933,
            "skeletons-only": 0xff9933,
            "orcs-only": 0xff9933,
            "trolls-only": 0xff9933
        }

        const g = this.add.graphics().setDepth(1000)
        for (const room of mapState.rooms) {
            const color = KIND_COLORS[room.kind] || 0xffffff
            g.fillStyle(color, 0.25)
            g.fillRect(room.x * TILE, room.y * TILE, room.w * TILE, room.h * TILE)
            g.lineStyle(1, color, 0.9)
            g.strokeRect(room.x * TILE, room.y * TILE, room.w * TILE, room.h * TILE)

            const cx = (room.x + room.w / 2) * TILE
            const cy = (room.y + room.h / 2) * TILE
            this.add.text(cx, cy, room.kind || "?", {
                font: "10px Arial",
                color: "#ffffff",
                backgroundColor: "rgba(0,0,0,0.7)",
                padding: { x: 3, y: 1 }
            }).setOrigin(0.5).setDepth(1001)
        }
    }

    update (time, delta) {
        if (dungeon.paused) return

        // Accrue real play-time for the current floor (run-time budgeting). This
        // runs only while the World scene is active — a modal overlay pauses it, so
        // menu time is naturally excluded. Delta is capped so a large frame after
        // resuming from a modal or a backgrounded tab doesn't jump the clock.
        run.tickFloorTime(Math.min(delta || 0, 100) / 1000)

        if (tm.over()) {
            tm.refresh()
            if (run.stats) run.stats.turns += 1
        }


        tm.turn()

        // Advance a frame-paced channel (a charged cast) every frame. It cannot
        // ride tm.turn(): tickInvocation zeroes the hero's movement points, which
        // makes hero.over() true, which stops TurnManager calling turn() on the
        // hero for the rest of the round — so a wall-clock-paced wind-up got one
        // animation frame per round and flickered. The turn COST is still taken
        // once per round in tickInvocation; this only drives the animation.
        dungeon.player?.controller?.tickChannelFrame?.()

        const showPerceptionZones = prefs.getPreferences().showPerceptionZones
        for (const e of tm.entities) {
            e.syncWorldHpBar?.()
            // Perception circles need both the user preference and a
            // currently-visible tile under the enemy — otherwise the player
            // sees detection zones through fog of war.
            // A phased enemy (crossing an active arena it isn't part of) is in
            // a separate dimension — every overlay tied to it goes dark too, not
            // just its sprite. Without this its perception ring and order dot
            // would still hover over the "empty" tiles it's passing through.
            const shown = fogOfWar.isVisible(e.x, e.y) && !e.phased
            // Engaged enemies ignore perception (designated combat), so don't
            // draw their now-irrelevant vision cone.
            e.syncPerceptionCircle?.(showPerceptionZones && shown && !e.isEngaged?.())
            e.syncOrderIndicator?.(shown)
            e.syncCaptainMarker?.(shown)
            e.syncStatusBadges?.(shown)
            e.syncStatusFX?.(shown)
            // Persistent prop FX (e.g. the void rift's floating bob + crackle
            // aura) lazily build on first sight and fog-gate to the lit area.
            e.syncVoidFX?.(shown)
        }
        // FoW handles entity sprite + HP bar visibility from the visibility
        // grid. Called every frame so enemies fading in/out of LOS stay
        // synced as they (and the hero between moves) shift tiles.
        fogOfWar.syncEntities()

        // Pocket-dimension phasing: an enemy crossing an active arena it isn't
        // part of is hidden entirely, overriding the FoW visibility just set.
        // It still exists and takes its turn — it's just invisible while inside
        // the ring, reappearing when it leaves (phased is recomputed each tick).
        for (const e of tm.entities) {
            if (!e.phased || !e.sprite) continue
            e.sprite.visible = false
            if (e.worldHpBg) e.worldHpBg.visible = false
            if (e.worldHpFill) e.worldHpFill.visible = false
        }

        // Reposition any active speech bubbles above their speakers and hide
        // ones whose speaker just went into fog or phased out. Runs after the
        // FoW + phasing passes above so it reads the final sprite.visible state.
        speech.sync()

        const target = dungeon.player?.controller?.findInteractTarget?.()
        if (target && target.entity.sprite) {
            const s = target.entity.sprite
            this.interactHint.setText(target.prompt)
            this.interactHint.x = s.x + 8
            this.interactHint.y = s.y - 2
            this.interactHint.setVisible(true)
        } else {
            this.interactHint.setVisible(false)
        }
    }
}
