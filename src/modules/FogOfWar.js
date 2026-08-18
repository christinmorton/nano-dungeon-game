import mapState from "./MapState.js"
import tm from "./TurnManager.js"
import account from "./Account.js"
import dungeon from "./Dungeon.js"
import { createDarkEyes } from "./Animations.js"
import { resolveAmbient, lightingPreset, DEFAULT_LIGHTING, PHASE_MESSAGES } from "./levels/lighting.js"
import gameLog from "./GameLog.js"

// Tile visibility states.
const UNSEEN = 0
const SEEN = 1
const VISIBLE = 2

const FILL_COLOR = 0x000000
// Undiscovered is fully black under every lighting preset — discovering the map
// is the same game outdoors as underground. What varies per preset is how far
// you see and how clearly you remember; see levels/lighting.js.
const ALPHA_UNSEEN = 1.0
const TILE = 16

// Darkness-room rendering (the void theme). In a room with lightRadius set,
// everything beyond the hero's small light cone is PITCH BLACK — including the
// "remembered" terrain (no dim memory of walls/floor), so you can't see the
// room unless it's close. A near-black void tint instead of pure black gives it
// a faint colour without lifting the dark.
const VOID_BLACK = 0x090012
// How far the rift "absorbs" the hero's light: within this chebyshev distance
// the light cone shrinks by (ABSORB_RANGE - distance), to a floor of 1.
const ABSORB_RANGE = 2
// How near (chebyshev) a lurking enemy must be before its glowing eyes show
// through the dark. Beyond this they're swallowed entirely.
const EYES_RANGE = 5

// Sight radius and memory dim now come from the floor's LIGHTING PRESET
// (levels/lighting.js), resolved in bind() from theme.lighting. The old
// DEFAULT_SIGHT_RADIUS = 5 / ALPHA_SEEN = 0.55 constants ARE the `torchlit`
// preset, so every interior behaves exactly as it did — they live there now so
// the two files can't drift apart. lighting.js is a leaf module (no imports) so
// the designer can read the preset list without pulling this file's singleton
// graph onto the designer page.

// FogOfWar — tile-based visibility on top of mapState. Three states per
// tile: unseen (black), seen-but-not-current (dim, terrain only), visible
// (full color, entities rendered).
//
// Lifecycle:
//   bind(scene)        on each World.create (new floor): allocate the
//                      visibility grid (all UNSEEN) and the Graphics
//                      overlay above the tilemap layer.
//   update(hero, r=8)  on each hero move: drop currently-VISIBLE tiles
//                      to SEEN, then re-light tiles within chebyshev
//                      radius r that pass mapState.hasLineOfSight.
//                      Redraws the overlay and resyncs entity sprite
//                      visibility.
//   syncEntities()     on each frame from World.update: cheap pass that
//                      keeps enemy / item visibility in sync as enemies
//                      move between visibility frames.
//   isVisible(x, y)    query used elsewhere if needed.
//
// Reuses mapState.hasLineOfSight so the LOS rules are consistent with
// enemy perception. Hero stays in tm.entities and is always visible
// because it's the source of the visibility cone.

class FogOfWar {
    constructor() {
        this.scene = null
        this.visibility = null
        this.graphics = null
        // Resolved from the floor's theme + the clock on every update; these are
        // just the pre-bind defaults. See _syncAmbient.
        this.lighting = lightingPreset(DEFAULT_LIGHTING)
        this.radius = this.lighting.radius
        this._phaseKey = null   // last announced day/night phase
        this.debugTimeOfDay = null   // window.setTime override; null = follow the clock
    }

    // savedSeen (optional): a previously exported visibility grid for THIS
    // floor (from FloorMemory, via exportSeen). When present and its
    // dimensions match the current level, the explored memory is restored so a
    // revisited floor keeps its "remembered" dim instead of going black again.
    // Dimension mismatch falls back to a fresh UNSEEN grid (defensive — floors
    // are fixed-size per index, so this shouldn't happen, but a stale snapshot
    // must never index out of bounds).
    bind(scene, savedSeen = null) {
        this.scene = scene
        // Resolve the ambient for the floor we're arriving on. bind runs on every
        // floor change (World.create) right after mapState.bind has normalized
        // the theme, so descending from a sunlit courtyard into a keep switches
        // sky types here; the clock keeps running either way.
        //
        // Announce nothing on arrival — _phaseKey is primed so stepping onto a
        // floor at night doesn't open with "Night falls" for something that
        // happened while you were on the stairs.
        this._phaseKey = null
        this._syncAmbient({ announce: false })
        const level = mapState.level
        if (!level) {
            this.visibility = null
            return
        }
        const h = level.length
        const w = level[0].length
        if (savedSeen && savedSeen.length === h && savedSeen[0] && savedSeen[0].length === w) {
            this.visibility = savedSeen.map(row => row.slice())
        } else {
            this.visibility = Array.from({ length: h }, () => Array(w).fill(UNSEEN))
        }

        if (this.graphics) this.graphics.destroy()
        // Above the tilemap (depth 0), below entity sprites (depth 10).
        // Visible tiles draw nothing here, so entities at depth 10 are
        // unobscured. Seen tiles draw a semi-transparent overlay that
        // dims static entities (items, doors, stairs) the player has
        // walked past — a "remembered" look.
        this.graphics = scene.add.graphics().setDepth(5)
        // Per-floor caches: which tiles fall in a darkness room (built lazily on
        // first render, after populate has set room.lightRadius), and the set of
        // enemies currently showing glowing eyes. The scene persists across
        // floors (bind re-runs), so destroy last floor's eye objects here.
        this._darkMask = null
        if (this._eyesEntities) {
            for (const e of this._eyesEntities) {
                if (e._darkEyes) { e._darkEyes.destroy(); e._darkEyes = null }
            }
        }
        this._eyesEntities = new Set()
    }

    // Lazily build (and cache) a boolean grid of tiles that belong to a darkness
    // room (room.lightRadius set). Reset to null on bind; rooms don't change
    // mid-floor, so one build per floor is enough.
    _ensureDarkMask() {
        if (this._darkMask) return
        const h = this.visibility.length
        const w = this.visibility[0].length
        const mask = Array.from({ length: h }, () => Array(w).fill(false))
        for (const r of (mapState.rooms || [])) {
            if (r.lightRadius == null) continue
            for (let y = r.y; y < r.y + r.h; y++) {
                for (let x = r.x; x < r.x + r.w; x++) {
                    if (mask[y] && x >= 0 && x < w) mask[y][x] = true
                }
            }
        }
        this._darkMask = mask
    }

    _isDarkTile(x, y) {
        return !!(this._darkMask && this._darkMask[y] && this._darkMask[y][x])
    }

    // Force the darkness-room mask to rebuild on the next render — e.g. after a
    // rift is cleansed and its room.lightRadius clears, so the room stops
    // rendering pitch-black and floods back to normal sight.
    invalidateDarkMask() {
        this._darkMask = null
    }

    // Effective light radius for this update: a room may shrink the hero's
    // sight (darkness settlements set room.lightRadius — see
    // documents/v3_darkness_settlements.md). updateHeroRoom runs immediately
    // before fogOfWar.update in moveEntityTo's onComplete, so currentRoom is
    // fresh; stepping into a dark room shrinks the cone and stepping out
    // restores the default with no extra wiring at the call sites.
    // Light contributed by an equipped offhand light source (torch/lantern/
    // beacon), zero once burned out. The mortal counter to the Void's dark.
    _heroLightBonus(hero) {
        const off = hero?.inventory?.equippedSlots?.offhand
        return off?.isLightSource ? (off.currentLight?.() ?? 0) : 0
    }

    // Re-resolve how lit this floor is right now, from its sky type and the
    // run-long round counter. Cheap arithmetic, so it runs on every hero move
    // rather than on a timer — the phase then advances exactly in step with the
    // turn loop, and a floor with no sky short-circuits to its static preset.
    //
    // Also publishes the ambient enemy-sight multiplier onto mapState. That's
    // where BaseEnemy already reads the designer's perception scale from, so
    // night dimming enemy vision needs no new import on the enemy side, and the
    // two multipliers stay independent — the designer's knob still means what it
    // meant, the clock just scales it.
    _syncAmbient({ announce = true } = {}) {
        const round = tm.tickCount || 0
        // Debug override (window.setTime). Pins the hour without touching the
        // turn counter, so you can look at dusk without walking to it.
        const theme = this.debugTimeOfDay
            ? { ...(mapState.theme || {}), timeOfDay: this.debugTimeOfDay }
            : mapState.theme
        const a = resolveAmbient(theme, round)
        this.lighting = a
        this.radius = a.radius
        mapState.ambientPerceptionScale = a.enemySight

        if (a.cycles && a.key !== this._phaseKey) {
            const first = this._phaseKey === null
            this._phaseKey = a.key
            if (announce && !first && PHASE_MESSAGES[a.key]) gameLog.log(PHASE_MESSAGES[a.key])
        } else if (!a.cycles) {
            this._phaseKey = a.key || null
        }
    }

    _radiusFor(hero) {
        const room = hero && hero.currentRoom
        // A held light is scaled by the floor's lighting (0 under open sky — a
        // torch adds nothing at noon). A DARKNESS room is the exception: the
        // dark there is local, not ambient, so the torch works normally even on
        // a sunlit floor. That keeps a void rift threatening outdoors.
        const inDarkRoom = !!(room && room.lightRadius != null)
        const scale = inDarkRoom ? 1 : this.lighting.lightBonus
        const bonus = this._heroLightBonus(hero) * scale
        if (!inDarkRoom) return this.radius + bonus
        let r = room.lightRadius
        // The rift drinks the hero's light: the closer they are, the smaller the
        // cone (down to a floor of 1) — vision is "absorbed" near the skull.
        const src = room.darkSource
        if (src) {
            const dist = Math.max(Math.abs(src.x - hero.x), Math.abs(src.y - hero.y))
            r -= Math.max(0, ABSORB_RANGE - dist)
        }
        // A held light pushes the dark back out.
        return Math.max(1, r + bonus)
    }

    update(hero, radius = null) {
        if (!this.visibility || !hero) return
        // Advance the sky BEFORE measuring sight, so the radius used this move is
        // the one the player can see in the tint.
        this._syncAmbient()
        if (radius == null) radius = this._radiusFor(hero)

        const h = this.visibility.length
        const w = this.visibility[0].length

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (this.visibility[y][x] === VISIBLE) this.visibility[y][x] = SEEN
            }
        }

        const hx = hero.x
        const hy = hero.y
        const from = { x: hx, y: hy }
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue
                const tx = hx + dx
                const ty = hy + dy
                if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue
                if (mapState.hasLineOfSight(from, { x: tx, y: ty })) {
                    this.visibility[ty][tx] = VISIBLE
                }
            }
        }

        this.render()
        this.syncEntities()
    }

    render() {
        if (!this.graphics || !this.visibility) return
        this.graphics.clear()
        // Dev toggle: when fog of war is off, render nothing — the world
        // shows through with no dim/black overlay. Entity visibility is
        // handled in syncEntities; isVisible short-circuits to true.
        if (!account.getPreferences().showFogOfWar) return
        this._ensureDarkMask()
        const h = this.visibility.length
        const w = this.visibility[0].length
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const state = this.visibility[y][x]
                // The lit cone is always clear, even in a void room, so the hero
                // CAN see what's close. Under a night sky it takes the ambient
                // wash instead of nothing: without this, dusk would just be a
                // smaller circle of fog rather than the light actually going.
                // Alpha is 0 at midday, so daytime draws exactly nothing here.
                if (state === VISIBLE) {
                    const ta = this.lighting.tintAlpha
                    if (ta > 0) {
                        this.graphics.fillStyle(this.lighting.tint, ta)
                        this.graphics.fillRect(x * TILE, y * TILE, TILE, TILE)
                    }
                    continue
                }
                const dark = this._isDarkTile(x, y)
                // In a void room everything beyond the cone is fully black —
                // SEEN tiles get no remembered-terrain dim, so walls and floor
                // vanish unless close. Elsewhere SEEN stays a light memory dim.
                const color = dark ? VOID_BLACK : FILL_COLOR
                // The memory dim is per-lighting: open country is remembered
                // more clearly than a corridor.
                //
                // UNSEEN is normally solid black, EXCEPT for barrier terrain on a
                // floor that reveals it (see revealTerrain in levels/lighting.js).
                // Outdoors the barrier is the landscape — the lake, the treeline —
                // and hiding it read as a bug, not as fog. Those tiles get the
                // memory dim instead, so the shape of the land is legible from the
                // start while the open ground you could WALK through stays dark
                // until you explore it. Tested against the raw terrain grid, not
                // isWalkableTile, because an entity standing somewhere must not
                // make that tile read as scenery.
                const revealed = state === UNSEEN
                    && this.lighting.revealTerrain
                    && !dark
                    && mapState.level?.[y]?.[x] === 1
                const alpha = dark
                    ? 1.0
                    : (state === UNSEEN && !revealed ? ALPHA_UNSEEN : this.lighting.alphaSeen)
                this.graphics.fillStyle(color, alpha)
                this.graphics.fillRect(x * TILE, y * TILE, TILE, TILE)
            }
        }
    }

    syncEntities() {
        if (!this.visibility) return
        const fogEnabled = account.getPreferences().showFogOfWar
        // Catch preference flips between moves so the overlay clears /
        // reappears on the same frame the toggle changes, not the next
        // hero step.
        if (fogEnabled !== this._lastFogEnabled) {
            this._lastFogEnabled = fogEnabled
            this.render()
        }
        // Sense (Elf S) bypasses FoW for enemy visibility — the hero
        // sees every enemy on the floor regardless of LoS while the
        // tag is active. Read directly off dungeon.player each frame
        // (cheap; doesn't affect when fog isn't enabled).
        const heroHasSense = dungeon.player?._tags?.includes("Sense")
        const hero = dungeon.player
        for (const e of tm.entities) {
            if (!e.sprite) continue
            if (e.type === "hero") continue

            // Beacon props (the void rift) pierce the dark: visible whenever the
            // hero is in their room, regardless of the light cone — the glowing
            // skull is always a landmark you can see in the gloom.
            if (e.isBeacon) {
                e.sprite.visible = !fogEnabled || (e.beaconVisible ? e.beaconVisible() : true)
                continue
            }

            const state = (this.visibility[e.y] && this.visibility[e.y][e.x]) ?? UNSEEN
            const isCombatActive = e.type === "enemy"
            const lit = state === VISIBLE

            // Enemies lurking in a void room beyond the light cone: hide the full
            // sprite, but show glowing eyes once they're near enough to glimpse.
            // Sense reveals everyone, so it skips the eyes. (Adjacent attackers
            // fall inside the small light cone, so they're seen in full.)
            if (isCombatActive && fogEnabled && !heroHasSense && !lit && this._isDarkTile(e.x, e.y)) {
                e.sprite.visible = false
                if (e.worldHpBg) e.worldHpBg.visible = false
                if (e.worldHpFill) e.worldHpFill.visible = false
                const dist = hero ? Math.max(Math.abs(hero.x - e.x), Math.abs(hero.y - e.y)) : Infinity
                this._setEyes(e, dist <= EYES_RANGE)
                continue
            }
            this._setEyes(e, false)

            // Combat entities (enemies) only render on currently-visible
            // tiles. Static entities (items, doors, stairs, containers)
            // remain visible in the "seen" state so the player can plan
            // returns to remembered loot or routes.
            const visible = !fogEnabled
                || (isCombatActive && heroHasSense)
                || (isCombatActive ? lit : state >= SEEN)

            e.sprite.visible = visible
            if (e.worldHpBg) e.worldHpBg.visible = visible
            if (e.worldHpFill) e.worldHpFill.visible = visible
            // Perception circles are gated by user preference too — World's
            // update() calls syncPerceptionCircle with the AND of the pref
            // and fogOfWar.isVisible, so FoW doesn't touch them here.
        }

        // Tear down eyes for enemies that died or left this floor (no longer in
        // tm.entities, so the loop above can't hide them).
        if (this._eyesEntities.size) {
            const live = new Set(tm.entities)
            const gone = []
            for (const e of this._eyesEntities) {
                if (!live.has(e)) {
                    if (e._darkEyes) { e._darkEyes.destroy(); e._darkEyes = null }
                    gone.push(e)
                }
            }
            for (const e of gone) this._eyesEntities.delete(e)
        }
    }

    // Position + show/hide an enemy's glowing-eyes overlay (lurking in the dark).
    // Lazily built; tracked in _eyesEntities so death/floor-change tears it down.
    _setEyes(entity, on) {
        if (on) {
            if (!entity._darkEyes) {
                entity._darkEyes = createDarkEyes(this.scene)
                if (entity._darkEyes) this._eyesEntities.add(entity)
            }
            if (entity._darkEyes) {
                const ts = mapState.tileSize || TILE
                entity._darkEyes.x = entity.sprite.x + ts / 2
                entity._darkEyes.y = entity.sprite.y + ts * 0.45
                entity._darkEyes.setVisible(true)
            }
        } else if (entity._darkEyes) {
            entity._darkEyes.setVisible(false)
        }
    }

    // Export the explored grid for persistence (FloorMemory snapshot). Any
    // currently-VISIBLE tile is downgraded to SEEN: on revisit nothing is lit
    // until the hero's first move re-lights its radius, so the floor should
    // come back "remembered" (dim), not falsely current. Returns a deep copy so
    // the snapshot can't be mutated by later in-place visibility updates.
    exportSeen() {
        if (!this.visibility) return null
        return this.visibility.map(row => row.map(s => (s === VISIBLE ? SEEN : s)))
    }

    isVisible(x, y) {
        if (!this.visibility) return true
        if (!account.getPreferences().showFogOfWar) return true
        const row = this.visibility[y]
        if (!row) return false
        return row[x] === VISIBLE
    }
}

export default new FogOfWar()
