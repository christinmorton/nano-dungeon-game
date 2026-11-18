import tm from './TurnManager.js'
import worldTooltip from './WorldTooltip.js'
import run from './Run.js'
import gameLog from './GameLog.js'
import mapState from './MapState.js'
import fogOfWar from './FogOfWar.js'
import combat from './Combat.js'
import audio from './Audio.js'
import classes from './Classes.js'
import BaseHero from './classes/BaseHero.js'
import { playDeath, playDeathMarker } from './Animations.js'
import { kindOf } from './enemies/enemyKinds.js'
import { resolveArt } from './assetLoader.js'
import { triggerHazardsAt, clearHazards } from './hazards/Hazards.js'

// Death-marker tile pools by enemy kind — tile indices verified in test.html
// (the gravesAndCandles region; names in tileReference.json drifted, see
// known-issue #9, so these are confirmed by index). Humanoids leave skull +
// bones, beasts (animals/insects/creatures) leave a monster skull, spirits
// leave nothing (incorporeal). One is picked at random per death for variety.
const HUMANOID_DEATH_MARKERS = [735, 577, 620]
const BEAST_DEATH_MARKERS = [621, 736]
const TOMBSTONE_MARKERS = [686, 687, 688]

// Active-follower cap (follower roster). A COSMIC follower — a cosmic being (angel,
// demon, mythical beast; identified by `cosmicKind`) — is a "god" fighting at your
// side. Only this many may be ACTIVE (manifested) at once; surplus waits on the
// hero's reserve bench, kept for a later Beckon. Stops two demi-gods from snowballing
// a run: the player keeps BOTH affinities, but only one god fights at a time. Lesser
// followers (pets, summons, tamed mortals — no cosmicKind) are uncapped here.
const MAX_ACTIVE_COSMIC = 1

function pickDeathMarkerTile(entity) {
    const kind = kindOf(entity)
    let pool = null
    if (kind === 'humanoid') pool = HUMANOID_DEATH_MARKERS
    else if (kind === 'animal' || kind === 'insect' || kind === 'creature') pool = BEAST_DEATH_MARKERS
    else return null // spirits (and anything unclassified) leave no marker
    return pool[Math.floor(Math.random() * pool.length)]
}

function randomFrom(pool) {
    return pool[Math.floor(Math.random() * pool.length)]
}

// What's left on Dungeon after the cluster of extractions:
//   - scene + player references
//   - per-floor lifecycle (initialize / cleanup) — delegates to mapState,
//     run, worldTooltip, gameLog, tm
//   - entity lifecycle (initializeEntity / moveEntityTo / stepEntityTo /
//     removeEntity / itemPicked)
//   - player placement (placePlayer) — picks spawn tile, constructs or
//     re-positions dungeon.player, registers with tm
//   - attackEntity delegate to Combat (kept so existing callers in
//     BaseHero / archetypes / tags don't have to switch imports)
//   - describeEntity tooltip-into-log helper
//
// Everything map-related (level data, LevelManager, Phaser tilemap
// layer, spatial queries) lives in MapState. Combat owns damage
// resolution and attack animation routing. Animations / WorldTooltip /
// Run / GameLog all own their own concerns. Dungeon is now an
// entity-lifecycle + scene-coordination shell rather than a singleton
// mailbox.

class Dungeon {
    constructor() {
        this.scene = null
        this.player = null
        this.initialized = false
    }

    initialize (scene) {
        run.transitioning = false

        if (!this.initialized) {
            mapState.start()
            run.start()
            this.initialized = true
        }

        this.scene = scene
        mapState.bind(scene)
        // Start the per-floor play-time timer + round baseline (run-time budgeting).
        // Runs on every floor entry (incl. revisits); the fields are safe even if
        // this is the very first floor (run.start ran just above).
        run.beginFloor()
        // Tooltip text now lives on the UI scene (zoom 1, no scroll) so
        // the world camera's 2x zoom doesn't blow up the font size and
        // push it off-screen. UI scene binds the text inside its
        // createUI handler; attach() here only wires pointer events and
        // is safe if bind hasn't run yet (show() guards against null).
    }

    cleanup () {
        gameLog.clear()
        if (this.player) this.player.cleanup()
        tm.cleanup()
        // The hazard tile registry is a module-level Map that survives
        // scene.restart — drop it on teardown so a thrown zone (or trap) tile
        // from this floor doesn't haunt the same tile on the next one.
        clearHazards()
    }

    // Pick a spawn tile from the current floor's rooms and either build
    // dungeon.player (first run) or relocate the existing instance (floor
    // transition / scene restart). Three tile-selection paths:
    //   - Floor revisit: place exactly on the stair the player entered
    //     through, so re-entering a floor doesn't randomly relocate them.
    //   - Level override: levels may define getPlayerSpawnTile to steer
    //     placement (ArenaLevel uses this to keep the player off the
    //     enemy band).
    //   - Default: a random walkable tile in the kind-tagged start/end
    //     room ("starting" on descent, "ending" on ascent).
    // Also consumes dungeon.pendingLoadout (if Loadout overlay set one)
    // and registers the player + their items with the turn manager.
    placePlayer () {
        const stairs = mapState.stairs
        // v5 is one-way descent, so arrival is always the starting room. v3 also
        // handled arriving at the "ending" room after climbing UP a staircase.
        const startRoom = mapState.rooms.find(r => r.kind === "starting")
            || mapState.rooms[0]
        let p = mapState.randomWalkableTileInRoom(startRoom.x, startRoom.y, startRoom.w, startRoom.h)

        // A cross-floor portal jump (§15.9 slice 2b) sets an explicit arrival —
        // a room or tile on THIS destination floor. It wins over the default start
        // room AND the stair / spawn overrides below, and is consumed once.
        const portalArrival = run.pendingArrival ? mapState.arrivalTileFor(run.pendingArrival) : null
        run.pendingArrival = null

        if (portalArrival) {
            p = portalArrival
        } else {
            const level = mapState.levelManager.getCurrent()
            if (typeof level.getPlayerSpawnTile === "function") {
                const preferred = level.getPlayerSpawnTile(startRoom)
                if (preferred) p = preferred
            }
        }

        if (!this.player) {
            const profile = classes[this.hero] || classes.Wizard
            // v5 spawns a hero with its full class kit. v3 defaulted to a lean
            // start - one ability plus the ultimate, drafting the rest through the
            // run - and read a "classic" account preference to opt out. The draft,
            // the skillbook and the account book are all cut (scope doc section 6),
            // so there is only one path left and it is the full kit.
            this.player = new BaseHero(p.x, p.y).applyProfile(profile)
            // Loadout from the Loadout overlay replaces class default
            // starting items. Consumed on first creation; survives floor
            // transitions because this.player persists.
            if (this.pendingLoadout && this.pendingLoadout.length) {
                this.player.items = this.pendingLoadout
                this.pendingLoadout = null
            }
        } else {
            this.player.x = p.x
            this.player.y = p.y
            this.player.refresh()
        }
        this.initializeEntity(this.player)
        tm.addEntity(this.player)
        this.player.items.forEach(item => tm.addEntity(item))
        this._placeParty()
    }

    // Re-place the hero's party (allies / followers) onto the current floor. They
    // travel with the hero across floor transitions the way carried items do:
    // tm.cleanup destroyed their sprites and cleared them from the turn manager, but
    // left them in hero.party (cleanup doesn't run onDestroy), so rebuild each —
    // reposition beside the hero, rebuild the sprite, re-register with tm. Without
    // this a pact-bound ally or summoned companion is orphaned on descent and gone on
    // return (allies aren't floor-snapshotted, so nothing else restores them). Dead
    // members are skipped (onDestroy already pruned them from the party).
    _placeParty () {
        const hero = this.player
        if (!hero || !Array.isArray(hero.party) || hero.party.length === 0) return
        for (const ally of hero.party) {
            if (!ally || ally.healthPoints <= 0) continue
            const tile = mapState.freeWalkableTileNear(hero.x, hero.y)
            ally.x = tile.x
            ally.y = tile.y
            ally.moving = false
            this.initializeEntity(ally)
            tm.addEntity(ally)
        }
    }

    // A COSMIC follower = a cosmic being (angel / demon / mythical beast). `cosmicKind`
    // is set only by CosmicBeing, so it cleanly separates a "god" ally from a pet /
    // summon / tamed mortal.
    _isCosmicFollower(ally) {
        return !!ally && ally.cosmicKind != null
    }

    // Move an ACTIVE follower to the reserve bench: pull it from the world (sprite +
    // turn manager) and the party, and stash it on the hero so it survives floor
    // transitions and can be Beckoned back later. Deliberately NOT removeEntity — no
    // onDestroy (that prunes it for good + drops loot); benching is a rest, not a death.
    benchFollower(ally) {
        const hero = this.player
        if (!hero || !ally) return
        if (ally.sprite) { ally.sprite.destroy(); delete ally.sprite }
        tm.entities.delete(ally)
        if (Array.isArray(hero.party)) {
            const i = hero.party.indexOf(ally)
            if (i >= 0) hero.party.splice(i, 1)
        }
        if (!Array.isArray(hero.followerBench)) hero.followerBench = []
        if (!hero.followerBench.includes(ally)) hero.followerBench.push(ally)
    }

    // Bring a benched follower back into play beside the hero (the Beckon target).
    // Re-places it the way _placeParty re-places a party member on a new floor.
    activateFollower(ally) {
        const hero = this.player
        if (!hero || !ally) return
        if (Array.isArray(hero.followerBench)) {
            const i = hero.followerBench.indexOf(ally)
            if (i >= 0) hero.followerBench.splice(i, 1)
        }
        const tile = mapState.freeWalkableTileNear(hero.x, hero.y)
        ally.x = tile.x
        ally.y = tile.y
        ally.moving = false
        this.initializeEntity(ally)
        tm.addEntity(ally)
        if (!Array.isArray(hero.party)) hero.party = []
        if (!hero.party.includes(ally)) hero.party.push(ally)
    }

    // Manifest a SPECIFIC benched follower into play, respecting the cap: if it's a
    // cosmic god and another is already active, bench the active god first (a swap).
    // The per-ally Beckon used by the Companions roster (vs. beckonFollowers, which
    // manifests the whole reserve).
    manifestFollower(ally) {
        const hero = this.player
        if (!hero || !ally) return
        if (this._isCosmicFollower(ally)) {
            const activeCosmic = (hero.party || []).find(a => this._isCosmicFollower(a) && a !== ally)
            if (activeCosmic) this.benchFollower(activeCosmic)
        }
        this.activateFollower(ally)
    }

    // Enforce the active-cosmic cap after a new cosmic ally joins (pact / boon). Keeps
    // the FIRST (established) cosmic follower active and benches any beyond the cap —
    // the just-arrived one — so the player's current guardian isn't yanked away; the
    // newcomer waits in reserve. Affinities are untouched; this only gates who fights.
    enforceCosmicFollowerCap(hero) {
        hero = hero || this.player
        if (!hero || !Array.isArray(hero.party)) return
        const cosmic = hero.party.filter(a => this._isCosmicFollower(a))
        if (cosmic.length <= MAX_ACTIVE_COSMIC) return
        for (const ally of cosmic.slice(MAX_ACTIVE_COSMIC)) {
            this.benchFollower(ally)
            gameLog.log(`${ally.name} withdraws to your reserve — only one god may fight at your side at once.`)
        }
    }

    // Beckon (keybind) — call your companions to your side. If any are ACTIVE, recall
    // each to a tile beside the hero and resume follow (fixes a follower left behind or
    // stuck across a floor). If none are active but the reserve holds followers,
    // MANIFEST them (then the cap re-benches any surplus god). No turn cost.
    beckonFollowers() {
        const hero = this.player
        if (!hero) return
        const active = (hero.party || []).filter(a => a && a.healthPoints > 0)
        if (active.length) {
            for (const ally of active) this._recallToSide(ally)
            gameLog.log(`You call your companions to your side.`)
            return
        }
        const bench = [...(hero.followerBench || [])]
        if (bench.length) {
            for (const ally of bench) this.activateFollower(ally)
            this.enforceCosmicFollowerCap(hero)
            gameLog.log(`Your reserve answers the call.`)
            return
        }
        gameLog.log(`You have no companions to call.`)
    }

    // Snap an already-active follower to a free tile beside the hero and clear any
    // standing order so it resumes following (Beckon's "come to heel").
    _recallToSide(ally) {
        const hero = this.player
        const tile = mapState.freeWalkableTileNear(hero.x, hero.y)
        ally.x = tile.x
        ally.y = tile.y
        ally.moving = false
        if (ally.sprite) {
            ally.sprite.x = mapState.map.tileToWorldX(tile.x)
            ally.sprite.y = mapState.map.tileToWorldY(tile.y)
        }
        ally.allyCommand = null   // back to the default FOLLOW behavior
    }

    // Dismiss (keybind) — send your active companions to the reserve bench (off-world,
    // kept). Pairs with Beckon to swap which god fights: Dismiss the active one, then
    // Beckon to bring a reserve god out. No turn cost.
    dismissFollowers() {
        const hero = this.player
        if (!hero) return
        const active = [...(hero.party || [])]
        if (!active.length) { gameLog.log(`You have no companions to dismiss.`); return }
        for (const ally of active) this.benchFollower(ally)
        gameLog.log(`Your companions withdraw to your reserve.`)
    }

    initializeEntity (entity) {
        // Use != null so 0 counts as a valid coordinate. Truthy checks here
        // skipped sprite creation when the entity spawned at x=0 or y=0
        // (common for entities placed in the leftmost / topmost room).
        if (entity.x != null && entity.y != null) {
            let x = mapState.map.tileToWorldX(entity.x)
            let y = mapState.map.tileToWorldY(entity.y)

            // New PNG art (entity.art = { sheet, file|frame }) renders from its
            // own sheet. Falls back to the legacy Kenney `entity.tile` when no
            // art is declared or its texture isn't loaded.
            //
            // Slice 1 keeps the legacy top-left origin + tile position and just
            // fits the art to one tile, so movement tweens (moveEntityTo), HP
            // bars, floating numbers and attack animations — which all assume
            // this anchor — keep working unchanged. The taller bottom-anchored
            // "overflow" look is a follow-up that makes those consumers
            // anchor-aware first.
            const art = resolveArt(entity.art)
            const useArt = art && this.scene.textures.exists(art.key)
            if (useArt) {
                entity.sprite = art.isImage
                    ? this.scene.add.sprite(x, y, art.key)
                    : this.scene.add.sprite(x, y, art.key, art.frame)
                entity.sprite.setOrigin(0)
                entity.sprite.setScale(mapState.tileSize / art.nativeSize)
            } else {
                entity.sprite = this.scene.add.sprite(x, y, "tiles", entity.tile)
                entity.sprite.setOrigin(0)
            }
            // Render above the tilemap layer (default depth 0). HP bars and
            // floating numbers use higher depths and stay above this.
            entity.sprite.setDepth(10)
            if (entity.tint) {
                entity.sprite.tint = entity.tint
                // Kenney monochrome silhouettes are filled solid; coloured PNG
                // art uses a multiply tint so the artwork stays visible.
                entity.sprite.tintFill = !useArt
            }
            entity.setEvents?.()
            entity.onSpriteCreated?.()

            if (entity.type !== "hero") {
                worldTooltip.attach(entity)
            }
        }
    }

    moveEntityTo (entity, x, y) {
        // Logical position updates SYNCHRONOUSLY — the sprite tween is
        // visual catch-up only. Without this, entity.x stays at the old
        // tile for the tween's 200ms, so any other entity's AI tick
        // during that window sees the destination as empty (via
        // entityAtTile / isWalkableTile) and can plan its own move
        // onto the same tile. Two entities end up logically on the
        // same tile after both tweens complete.
        //
        // Universals (glide, knockback, teleport) already pre-set
        // entity.x/y before calling here for the same reason. Baking
        // the sync update into moveEntityTo itself means callers that
        // DON'T pre-set (notably dungeon.stepEntityTo for AI moves)
        // also get the protection.
        //
        // Perception / room / fog-of-war refresh stays in onComplete —
        // those are visual concerns that should fire when the sprite
        // visually arrives, not when logical position updates.

        // Update enemy facing toward travel BEFORE the synchronous x/y
        // overwrite below — their vision cone (inVisionCone) keys off this,
        // so a patroller sweeps its sight as it walks its route. Computed
        // from the still-current position; no-op for zero-delta callers
        // (glide/knockback pre-set x/y, so the delta is 0 and facing holds).
        if (entity.type === "enemy" && (x !== entity.x || y !== entity.y)) {
            entity.facing = { dx: Math.sign(x - entity.x), dy: Math.sign(y - entity.y) }
        }

        entity.moving = true
        entity.x = x
        entity.y = y

        // Footstep, on the hero only — thirteen call sites route through here,
        // so this covers walking, gliding, knockback and teleport alike. Enemies
        // stay silent on purpose: ten of them stepping every round would be a
        // wall of noise, and the player cannot see most of them through the fog.
        // No attenuation here: the footstep samples are already ~19 dB quieter
        // than the rest of the set, and are boosted back up by LEVEL_TRIM in
        // Audio.js. Halving them here is what made them inaudible.
        if (entity.type === "hero") audio.playPool('step')

        this.scene.tweens.add({
            targets: entity.sprite,
            onComplete: () => {
                entity.moving = false
                if (entity.type === "hero") {
                    // Refresh enemy perception on the player's turn so circles
                    // (and notice log/flash) react the moment the player's slide
                    // completes, not when each enemy next ticks.
                    for (const e of tm.entities) {
                        if (e.type === "enemy" && e.updatePerception) {
                            e.updatePerception(entity)
                        }
                    }
                    this.updateHeroRoom(entity)
                    // Recompute fog of war from the hero's new tile — drops
                    // previously-visible tiles to "seen" and re-lights tiles
                    // within radius + LOS.
                    fogOfWar.update(entity)
                    // Tile hazards: any entity exposing onHeroNear affects the
                    // hero when stepped within its auraRadius (chebyshev). The
                    // void rift's corruption ring uses this to apply a temporary
                    // Cursed debuff. Generic so other aura props can reuse it.
                    for (const e of tm.entities) {
                        if (!e.onHeroNear) continue
                        const d = Math.max(Math.abs(e.x - entity.x), Math.abs(e.y - entity.y))
                        if (d <= (e.auraRadius ?? 1)) e.onHeroNear(entity)
                    }
                }
                // On-step hazards (thrown zones now, traps next) fire for ANY
                // entity that lands on a registered tile — the hero AND wandering
                // enemies — so a fire patch or trap threatens whatever crosses it.
                triggerHazardsAt(entity, x, y)
            },
            x: mapState.map.tileToWorldX(x),
            y: mapState.map.tileToWorldY(y),
            ease: "Power2",
            duration: 200
        })
    }

    // Track which room the hero is currently in and fire onExit/onEnter
    // hooks when it changes. A hero in a corridor has currentRoom = null;
    // exits and re-entries fire as expected. Called from moveEntityTo's
    // onComplete and once from World.create after spawn placement.
    updateHeroRoom (hero) {
        const newRoom = mapState.rooms
            ? mapState.rooms.find(r => r.contains(hero.x, hero.y)) || null
            : null
        if (newRoom === hero.currentRoom) return
        if (hero.currentRoom && hero.currentRoom.onExit) {
            hero.currentRoom.onExit(hero)
        }
        if (newRoom && newRoom.onEnter) {
            newRoom.onEnter(hero)
        }
        hero.currentRoom = newRoom
    }

    stepEntityTo (entity, x, y) {
        // If the next step is a closed door, open it instead of moving onto it.
        // Lets Crafty pathfinder routes succeed without overlapping the door
        // entity, and costs the entity one MP for the open action.
        const at = mapState.entityAtTile(x, y)
        if (at && at.type === "door" && at.state === "closed") {
            at.open()
            return
        }
        // Enemy / NPC case (design §15.9): stepping onto an ACTIVE portal
        // teleports the mover, mirroring the hero's bump case. A HIDDEN portal
        // stays a wall to non-heroes — only the hero searches secrets. A
        // CROSS-FLOOR portal is heroOnly (floors are the player's run context),
        // so enemies just block on it. use() itself also guards heroOnly, but
        // gating here avoids a wasted step + keeps the block explicit.
        if (at && at.type === "portal") {
            if (at.state === "active" && !at.heroOnly) at.use(entity)
            return
        }
        // Reject moves onto another combat body — hero, enemy, OR ally. Allies
        // are solid to enemies, so a follower body-blocks a corridor (the
        // intended "ally blocks an enemy's path"); enemies and allies also can't
        // overlap each other. The hero slips PAST a friendly ally via a swap
        // handled in HeroController (a player convenience), so it never reaches
        // this gate against its own units. Pathfinding usually routes around
        // bodies via gridForEntity, but the grid is computed once per turn — a
        // faster enemy can move into the planned tile before this step resolves,
        // and stale paths can plan onto the hero. The separate attack block
        // handles damage when adjacency is reached. A phased enemy (passing
        // through an active arena it isn't part of) is in a separate dimension —
        // it neither blocks nor is blocked, so it walks straight through instead
        // of getting stuck routing around invisible bodies.
        if (at && (at.type === "hero" || at.type === "enemy" || at.type === "ally") && at !== entity
            && !entity.phased && !at.phased) {
            return
        }
        // Arena isolation: an enemy committed to a live battle cannot step
        // outside its arena bound. Keeps the roster fenced into the fight (the
        // doc's "isolate" rule) without map mutation — they hold at the edge
        // rather than chasing the hero off across the floor.
        if (entity.type === "enemy" && entity.battle && entity.battle.active
            && !entity.battle.contains(x, y)) {
            return
        }
        // Safe-room isolation: no enemy may step into a room flagged restSafe
        // (the player's active rest-camp) or pacified (a permanent sanctuary
        // room type, e.g. a neutral village). Holds them at the threshold;
        // gridForEntity also routes them around it.
        if (entity.type === "enemy" && mapState.rooms
            && mapState.rooms.some(r => (r.restSafe || r.pacified) && r.contains(x, y))) {
            return
        }
        // Leash (scope doc §10.18): a thrall raised by a Corrupted Skull never
        // leaves the room it was raised in. One guard here covers every AI step,
        // whatever the archetype planned; it simply holds at the threshold.
        if (entity.leashRoom && !entity.leashRoom.contains(x, y)) {
            return
        }
        // Faction barriers (force/stone/ice walls): a wall segment is sprite-less
        // so the caster's side passes through — which also makes it invisible to
        // isWalkableTile/entityAtTile. AI tile-picks (archer sidestep/retreat,
        // wander) that scan those queries could otherwise step an enemy ONTO a
        // wall. blockingStructureAt is faction-aware (the wall's own side still
        // passes); the hero moves via moveEntityTo, so it's unaffected.
        if (mapState.blockingStructureAt(x, y, entity)) {
            return
        }
        this.moveEntityTo(entity, x, y)
    }

    // Swap two entities' tiles — the hero slipping past a friendly ally in a
    // one-wide corridor. Deliberately bypasses the stepEntityTo collision gate
    // (a swap is the one move that should). Capture the origin tile before the
    // first move so the second lands where the first one started.
    swapEntities (a, b) {
        const ax = a.x
        const ay = a.y
        this.moveEntityTo(a, b.x, b.y)
        this.moveEntityTo(b, ax, ay)
    }

    removeEntity (entity) {
        // Deathless entities (the training dummy) refuse removal — they stay in
        // the world and run their own downed/reset cycle in refresh().
        if (entity.deathless) return
        if (!entity.sprite) return
        // Capture the sprite, then detach it logically up front so the tile
        // frees and onDestroy's loot drops fire immediately. Only ENEMIES get
        // the death treatment (fade-out + bones/skull marker) — removeEntity is
        // generic (containers, doors, the hero on death all flow through here),
        // so anything that isn't an enemy keeps the plain instant teardown.
        // Hero death stays instant until the dedicated hero-death/revival slice.
        const sprite = entity.sprite
        tm.entities.delete(entity)
        delete entity.sprite
        worldTooltip.hide()
        if (entity.type === 'enemy') {
            playDeath(sprite)
            // The stronghold's elite leader dies to its own two-phase fanfare;
            // everything else gets the generic thud plus its own voice, so a
            // dying ogre still sounds like an ogre.
            //
            // Elite status is read off the tag list because that is the only
            // record of it: spawnLeader marks the leader by adding eliteEnrager
            // (which carries the whole HPx4/rage/block package) and there is no
            // isElite flag anywhere. Taggable stores tag NAMES in _tags.
            if (entity._tags?.includes("Elite Enrager")) {
                audio.play('boss-death')
            } else {
                audio.play('enemy-death')
                audio.playEnemy(entity)
            }
            const markerTile = pickDeathMarkerTile(entity)
            if (markerTile !== null) playDeathMarker(entity.x, entity.y, markerTile)
        } else if (entity.type === 'hero') {
            // Hero falls: a tombstone marks the spot, then onDestroy opens the
            // DeathScreen (which fades a grey-black overlay over the dimmed
            // dungeon). Sprite teardown is immediate — the overlay is the fade.
            // Keep the tombstone reference so a revive can clear it.
            sprite.destroy()
            this._heroTombstone = playDeathMarker(entity.x, entity.y, randomFrom(TOMBSTONE_MARKERS))
        } else {
            sprite.destroy()
        }
        entity.onDestroy()
    }

    // Bring the dead hero back (DeathScreen "Revive"). The hero object itself
    // survived removeEntity — only its sprite + tm membership were torn down —
    // so revival restores HP, rebuilds the sprite, re-registers with the turn
    // manager, grants a fresh action economy to react with, and clears the
    // tombstone. The "once per run" gate lives in Run.
    revivePlayer () {
        const p = this.player
        if (!p) return
        p.healthPoints = Math.floor(p.maxHealthPoints / 2)
        p.movementPoints = p.maxMovementPoints
        p.actionPoints = p.maxActionPoints
        this.initializeEntity(p)
        tm.addEntity(p)
        // initializeEntity built a NEW sprite; the camera was following the old
        // (now-destroyed) one, so re-point it or it freezes and the player
        // walks off-screen.
        this.scene.cameras.main.startFollow(p.sprite)
        if (this._heroTombstone) {
            this._heroTombstone.destroy()
            this._heroTombstone = null
        }
    }

    itemPicked (entity) {
        // Every pickup path routes through here — bag items, tally gems and
        // keys, and the collect-on-touch Amulet — so one hook covers all three
        // branches in HeroController rather than three copies of the same line.
        audio.play('pickup')
        entity.sprite.destroy()
        delete entity.sprite
        worldTooltip.hide()
    }

    attackEntity (attacker, victim, weapon, opts = {}) {
        // Friendly-fire guard: never resolve an attack between same-team
        // combatants (the hero clicking its own ally, an ally and the hero,
        // etc.). The targeting seam already keeps AI off allies; this is the
        // safety net for direct/click attacks. Entities with no team (props,
        // containers) fall through unaffected.
        if (attacker?.team && victim?.team && attacker.team === victim.team) return
        // Striking a NEUTRAL breaks the truce: it turns hostile and fights back (a
        // struck pact/boon offerer also withdraws its offer). Done BEFORE the hit so
        // even a 0-damage swing (a scratch on an armoured demi-god) still provokes it.
        // provokeFromNeutral is idempotent; the victim's onDamaged covers indirect hits.
        if (victim?.team === "neutral" && attacker?.team && attacker.team !== "neutral") {
            victim.provokeFromNeutral?.(attacker)
        }
        // opts carries presentation hints (e.g. { strikeStyle: 'overhead' } from Bash).
        combat.attack(attacker, victim, weapon, opts)
    }

    describeEntity (entity) {
        if (entity) {
            let name = entity.name
            // Universal rank (modules/Rank.js): items compute rankKey() from
            // their quality tags. Prefix it so a describe reads "[Rank S] ...".
            const rankStr = (typeof entity.rankKey === 'function') ? `[Rank ${entity.rankKey()}] ` : ''
            let description = entity.description || ""
            let tags = entity._tags ? entity._tags.map(t => `#${t}`).join(", ") : ""

            gameLog.log(`${rankStr}${name}\n${tags}\n${description}`)
        }
    }
}

export default new Dungeon()
