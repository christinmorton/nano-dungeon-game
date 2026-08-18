import dungeon from '../Dungeon.js'
import tm from '../TurnManager.js'
import router from '../SceneRouter.js'
import { playCast } from '../Animations.js'
import run from '../Run.js'
import gameLog from '../GameLog.js'
import mapState from '../MapState.js'
import encounters from '../encounters/index.js'
import { INVENTORY_CAP } from '../items/Container.js'
import { reactHeroLoot } from '../dialog/heroReactions.js'
import { footprintTiles } from '../hazards/Hazards.js'
import { wallLineTiles } from '../hazards/Wall.js'
import { isBurrowed } from '../tags/underground.js'
import inputMap from '../InputMap.js'

// Input + interact + targeting layer for a player-controlled hero.
// Bound to the world scene's keyboard/pointer events. Translates raw
// input into intent (move / attack / equip / drop / interact / target)
// and dispatches against the hero's stats, inventory, and HUD.
//
// Owns `targeting` state — temporary input mode for ranged scrolls
// (currently just Scroll of Blink). Not a hero attribute; lives here
// because it's a controller-mode flag.
//
// Extracted from BaseHero. See PR 3 of known issue #14 in
// documents/v3_known_issues.md.

export default class HeroController {
    constructor(hero) {
        this.hero = hero
        this.targeting = null
        // Active channeled-ability state: { ability, target, slotIndex } or null.
        this.invoking = null
        // Continuous click-to-move (shift+click): { path: [{x,y}…], index } or null.
        this.travel = null
    }

    bind(scene) {
        this.scene = scene
        // Store the handler refs so unbind() can remove exactly these listeners.
        // Without this, a re-bind (revive / floor re-placement both re-enter
        // BaseHero.setEvents) stacks a second keyup handler on the same scene,
        // and every keypress fires processKey twice — the "move N tiles per
        // press after revive" bug.
        this._onKeyUp = (event) => {
            if (run.transitioning) return
            if (dungeon.paused) return
            // Escape opens pause unless the hero is targeting a Blink scroll
            // (targeting uses Escape to cancel — let processKey handle it).
            if (event.key === "Escape" && !this.targeting && !this.invoking) {
                router.bind(scene)
                router.openPause()
                return
            }
            // While invoking, keep processing keys even when the turn reads
            // "over" (the channel spends the turn each round) so the player can
            // always toggle the channel off or hit Escape.
            if (!this.hero.over() || this.invoking) {
                this.processKey(event)
            }
        }
        this._onPointerUp = (event) => {
            if (run.transitioning) return
            if (dungeon.paused) return
            if (!this.hero.over()) {
                this.processPointer(event)
            }
        }
        // Hover preview for targeting modes (cursor tile + AoE footprint).
        // Only draws while this.targeting is set; otherwise it's a cheap no-op.
        this._onPointerMove = (event) => {
            if (run.transitioning || dungeon.paused) { this._clearTargetPreview(); return }
            this._updateTargetPreview(event)
        }
        scene.input.keyboard.on("keyup", this._onKeyUp)
        scene.input.on("pointerup", this._onPointerUp)
        scene.input.on("pointermove", this._onPointerMove)
    }

    // Remove the listeners this controller registered. Called by
    // BaseHero.setEvents before a new controller is bound, so revive / re-place
    // doesn't leave a stale duplicate handler firing alongside the new one.
    // Defensive optional-chaining: the prior scene may already be torn down.
    unbind() {
        const keyboard = this.scene?.input?.keyboard
        if (keyboard && this._onKeyUp) keyboard.off("keyup", this._onKeyUp)
        if (this.scene?.input && this._onPointerUp) this.scene.input.off("pointerup", this._onPointerUp)
        if (this.scene?.input && this._onPointerMove) this.scene.input.off("pointermove", this._onPointerMove)
        this._onKeyUp = null
        this._onPointerUp = null
        this._onPointerMove = null
        this.invoking = null
        this.travel = null
        this._clearTargetPreview()
    }

    processPointer(event) {
        const hero = this.hero
        const x = mapState.map.worldToTileX(event.worldX)
        const y = mapState.map.worldToTileY(event.worldY)

        if (this.targeting) {
            this.resolveTargetedClick(x, y)
            return
        }

        // Locked while channeling — no click-to-move / click-to-attack.
        if (this.invoking) return

        // Shift+click: continuous travel — pathfind and auto-walk to the tile
        // (or adjacent to a clicked entity), one step per turn, until arrival,
        // a blocker, combat, or any manual input. See tickTravel.
        if (event?.event?.shiftKey) {
            this._startTravelTo(x, y)
            return
        }
        // A plain click takes manual control — cancel any travel in progress.
        this._stopTravel()

        const entity = mapState.entityAtTile(x, y)

        if (entity && (entity.type == "enemy" || entity.destructible) && hero.actionPoints > 0) {
            const currentWeapon = hero.currentWeapon()
            const distance = mapState.distanceBetweenEntities(hero, entity)
            // Spatial "Extended Reach" enchant: a melee weapon (no attackTile) can
            // strike from further when the hero carries a reach bonus. Ranged
            // weapons are unaffected.
            const meleeReach = currentWeapon ? currentWeapon.range() + (!currentWeapon.attackTile ? (hero._reachBonus || 0) : 0) : 0
            if (currentWeapon && distance <= meleeReach && distance >= currentWeapon.minRange()) {
                if (currentWeapon.attackTile && !mapState.hasLineOfSight(hero, entity)) {
                    gameLog.log(`${hero.name} has no line of sight to ${entity.name}.`)
                    return
                }
                dungeon.attackEntity(hero, entity, currentWeapon)
                hero.actionPoints -= 1
                return
            }
            // Innate fists fallback: an adjacent foe the weapon can't hit point-blank
            // (ranged weapon, or no weapon) still gets a melee bump — uniform for all classes.
            if (distance === 1) {
                dungeon.attackEntity(hero, entity, hero.unarmed())
                hero.actionPoints -= 1
                return
            }
            // Out of range — fall through to click-to-move so the click walks
            // the hero one step toward the target instead of doing nothing.
        }

        // Mouse failsafe for the interact system. Lets the player pick a
        // specific adjacent target (cardinal or diagonal) instead of relying
        // on the keyboard F's cardinal-order auto-pick. Same container-over-
        // door priority as the keyboard scan.
        const dx = Math.abs(x - hero.x)
        const dy = Math.abs(y - hero.y)
        if (dx <= 1 && dy <= 1 && (dx + dy > 0)) {
            const target = this.bestInteractTargetAtTile(x, y)
            if (target) { target.entity.onInteract(hero); return }
        }

        // Click-to-move (A5): otherwise, step one tile toward the clicked
        // destination. Slides along walls (try the diagonal, then each cardinal
        // component) and never bump-attacks — attacking is the in-range enemy
        // click above. Re-click to keep walking toward a far tile.
        if (this._blockedByCamp()) return
        if (hero.movementPoints <= 0) return
        const stepX = Math.sign(x - hero.x)
        const stepY = Math.sign(y - hero.y)
        if (stepX === 0 && stepY === 0) return
        const candidates = []
        if (stepX !== 0 && stepY !== 0) candidates.push([stepX, stepY])
        if (stepX !== 0) candidates.push([stepX, 0])
        if (stepY !== 0) candidates.push([0, stepY])
        for (const [sx, sy] of candidates) {
            if (this._tryStepToward(hero.x + sx, hero.y + sy)) return
        }
    }

    // Camp COMMITS the hero — no voluntary movement until camp is broken (F). Nudges
    // the player (throttled so a held key doesn't spam the log) and returns true to
    // abort the move. Only movement paths call this; interact (to break camp) is free.
    _blockedByCamp() {
        if (!this.hero?.camped) return false
        const now = Date.now()
        if (now - (this._campNudgeAt || 0) > 1500) {
            gameLog.log("You're camped — break camp [F] before moving.")
            this._campNudgeAt = now
        }
        return true
    }

    // One movement step for click-to-move. Returns true if the hero moved (or
    // swapped past an ally). Walls / non-ally occupants block it (no bump), so
    // the caller can try the next candidate direction to slide along a wall.
    _tryStepToward(nx, ny) {
        const hero = this.hero
        const occupant = mapState.entityAtTile(nx, ny)
        if (occupant && occupant !== hero) {
            if (occupant.team && occupant.team === hero.team) {
                hero.movementPoints -= 1
                dungeon.swapEntities(hero, occupant)
                return true
            }
            return false   // enemy / blocker — don't bump-attack from a move click
        }
        if (mapState.isWalkableTile(nx, ny) || this._canTunnelInto(nx, ny)) {
            hero.movementPoints -= 1
            dungeon.moveEntityTo(hero, nx, ny)
            return true
        }
        return false
    }

    // --- continuous travel (shift+click) -------------------------------------

    // Begin auto-walking to (tx,ty). Clicking a non-ally entity paths to a tile
    // ADJACENT to it (so the hero stops next to a foe rather than onto it).
    _startTravelTo(tx, ty) {
        const hero = this.hero
        if (this.targeting || this.invoking) return
        if (this._blockedByCamp()) return
        const target = mapState.entityAtTile(tx, ty)
        const stopAdjacent = !!(target && target !== hero
            && !(target.team && target.team === hero.team))
        const path = mapState.findPath(hero, tx, ty, { stopAdjacent })
        if (!path || path.length === 0) { this._stopTravel(); return }
        this.travel = { path, index: 0 }
    }

    _stopTravel() {
        this.travel = null
    }

    // Driven each hero turn (BaseHero.turn). Steps one tile along the travel path
    // when the hero is idle with movement to spend; MP exhaustion paces it across
    // rounds. Stops on arrival, a blocker, combat, or manual input.
    tickTravel() {
        const t = this.travel
        if (!t) return
        const hero = this.hero
        if (this.targeting || this.invoking) { this._stopTravel(); return }
        if (hero._arenaBattle) { this._stopTravel(); return }   // a fight started
        if (hero.moving) return                                  // mid-step tween
        if (hero.movementPoints <= 0) return                     // resume next round

        const next = t.path[t.index]
        if (!next) { this._stopTravel(); return }

        const occupant = mapState.entityAtTile(next.x, next.y)
        if (occupant && occupant !== hero) {
            if (occupant.team && occupant.team === hero.team) {
                hero.movementPoints -= 1
                dungeon.swapEntities(hero, occupant)
                t.index += 1
            } else {
                this._stopTravel()       // something hostile moved into the path
                return
            }
        } else if (mapState.isWalkableTile(next.x, next.y) || this._canTunnelInto(next.x, next.y)) {
            hero.movementPoints -= 1
            dungeon.moveEntityTo(hero, next.x, next.y)
            t.index += 1
        } else {
            this._stopTravel()           // path invalidated (e.g., a door closed)
            return
        }

        if (t.index >= t.path.length) this._stopTravel()
    }

    processKey(event) {
        const hero = this.hero

        // Any manual key cancels continuous travel — the player takes over.
        this._stopTravel()

        // Targeting mode (e.g. Scroll of Blink, ability direction prompts):
        // only Escape cancels, all other keys are blocked so movement and
        // item presses don't fire. Direction-prompt abilities resolve in
        // this branch when an arrow key arrives.
        if (this.targeting) {
            if (event.key === "Escape") {
                this.cancelTargeting()
                return
            }
            if (this.targeting.type === 'direction') {
                const dir = this._directionFromKey(event)
                if (dir) {
                    const callback = this.targeting.callback
                    this.targeting = null
                    callback({ dx: dir.dx, dy: dir.dy })
                }
            }
            return
        }

        // Invocation lock: while channeling, the caster can't move or use any
        // other ability. Only the invoking ability's own hotkey — or Escape —
        // toggles it off; every other key is swallowed.
        if (this.invoking) {
            if (event.key === "Escape") { this.stopInvoking(`${hero.name} ends the invocation.`); return }
            // Steerable channels (a Sustained Beam): arrow keys RE-AIM the channel in
            // place — turning the beam without ending it — instead of being swallowed.
            if (this.invoking.ability.steerable && this.invoking.ability.target === 'direction') {
                const dir = this._directionFromKey(event)
                if (dir) { this.invoking.aim = { dx: dir.dx, dy: dir.dy }; return }
            }
            // Same ability-slot keymap as the normal dispatch (below), so the
            // channel toggle and the cast key never drift apart.
            const slot = inputMap.abilitySlotForEvent(event)
            if (slot === this.invoking.slotIndex) {
                // Re-pressing a charged cast's own key during windup OVERCHARGES it
                // (consumed by the ability); a plain channel (Siphon) has no such
                // hook, so the press falls through to ending the invocation.
                if (this.invoking.ability.overchargeOnRepress?.()) {
                    this.hero.hud?.refresh()
                } else {
                    this.stopInvoking(`${hero.name} ends the invocation.`)
                }
            }
            return
        }

        // Drop items (Shift + 1-9, 0)
        if (event.shiftKey && event.code && event.code.startsWith("Digit")) {
            let digit = parseInt(event.code.slice(5))
            if (digit == 0) digit = 10
            hero.dropItem(digit - 1)
            return
        }

        // Equip items (1-9, 0)
        // Gate on event.code starting with "Digit" — Number(" ") is 0, not
        // NaN, so a looser check would have spacebar (the pass-turn key)
        // silently fire toggleItem(9) every time it's pressed.
        if (event.code && event.code.startsWith("Digit")) {
            let digit = parseInt(event.code.slice(5))
            if (digit == 0) digit = 10
            hero.toggleItem(digit - 1)
        }

        // Unequip a slot back to carry (M=mainhand, O=offhand, H=head,
        // B=body, T=feet ["treads"], G=gloves, C=accessory ["clasp"]).
        // Equipped items leave the carry list so the digit keys no longer
        // address them; these letter keys are the only in-world way to put a
        // slotted item back in carry. Accessory moved off A to free that key
        // for ability slot 3 per the abilities design. Provisional bindings —
        // keymap rework planned alongside configurable keybinds.
        const slotKeys = { m: 'mainhand', o: 'offhand', h: 'head', b: 'body', t: 'feet', g: 'gloves', c: 'accessory' }
        if (event.key && slotKeys[event.key.toLowerCase()]) {
            hero.unequipSlot(slotKeys[event.key.toLowerCase()])
            return
        }

        // Discrete bindings now resolve through the central keymap (InputMap.js)
        // instead of hardcoded literals, so the planned Controls UI can rebind
        // them. Defaults match the previous behavior exactly.
        const action = inputMap.actionForEvent(event)

        // Interact (default F) — first adjacent interactable in N/E/S/W order.
        // Moved off E historically to free that key for ability slot 3.
        if (action === 'interact') {
            this.tryInteract()
            return
        }

        // Accept / Decline (default Y / N) — the general yes/no for decisions.
        // Today they answer a pending pact offer from an adjacent offerer; future
        // yes/no prompts hook in here too.
        if (action === 'accept') {
            this.tryAccept()
            return
        }
        if (action === 'decline') {
            this.tryDecline()
            return
        }

        // Skillbook / spend-points screen (default K). Modal — pauses the world.
        if (action === 'skillbook') {
            router.bind(this.scene)
            router.openUpgrade()
            return
        }

        // Beckon (default V) — call companions to your side / manifest your reserve.
        // Dismiss (default D) — send active companions to the reserve bench. Free
        // party management (no turn cost); together they swap which god fights.
        if (action === 'beckon') {
            dungeon.beckonFollowers()
            return
        }
        if (action === 'dismiss') {
            dungeon.dismissFollowers()
            return
        }

        // Ability hotkeys (default Q/W/E/A/S) map to slots 0..4. Dispatcher checks
        // canActivate, resolves target, debits cost, starts cooldown.
        const slot = inputMap.abilitySlotForEvent(event)
        if (slot >= 0) {
            this.onAbilityKey(slot)
            return
        }

        // Retreat (default R) — break off the current fight. The universal flee
        // verb for the hero: combat-only, costs the action whether it lands or
        // not. See documents/v3_objective_driven_encounters.md.
        if (action === 'retreat') {
            this.tryRetreat()
            return
        }

        // Pass the turn (default Space). Falls through to the movement check,
        // which is a no-op for a non-direction key — preserving prior behavior.
        if (action === 'passTurn') {
            hero.movementPoints = 0
            hero.actionPoints = 0
        }

        // Movement decision (default arrow keys).
        const step = inputMap.directionForEvent(event)
        if (!step) return
        // Camp COMMITS the hero — no walking until camp is broken (F). Guarded here so
        // only MOVEMENT is blocked; interact/abilities/pass above still work.
        if (this._blockedByCamp()) return
        let newX = hero.x + step.dx
        let newY = hero.y + step.dy

        // Friendly unit at the destination (an ally / summon — same team): slip
        // past it by swapping places, so a follower can't wall the hero into a
        // one-wide corridor. Costs the move like a normal step. Enemies aren't
        // same-team, so they still fall through to the bump → attack path.
        const occupant = mapState.entityAtTile(newX, newY)
        if (occupant && occupant !== hero && occupant.team && occupant.team === hero.team) {
            hero.movementPoints -= 1
            dungeon.swapEntities(hero, occupant)
            return
        }

        if (mapState.isWalkableTile(newX, newY) || this._canTunnelInto(newX, newY)) {
            hero.movementPoints -= 1
            dungeon.moveEntityTo(hero, newX, newY)
        } else {
            this._resolveBumpAt(newX, newY)
        }
    }

    // While burrowed (Dig), the hero tunnels through shallow dungeon walls — but
    // never a sturdy/story wall, a door, or out of bounds. surface() refuses to
    // pop while standing in a wall, so a mid-tunnel hero can't be stranded.
    _canTunnelInto(x, y) {
        if (!isBurrowed(this.hero)) return false
        return mapState.isBreachableWallAt(x, y) && !mapState.isDoorAt(x, y)
    }

    // The hero bumped into a non-walkable tile. Dispatch based on what's
    // at the destination — enemy / item / stairs / door. No-op if the
    // bump hits a wall.
    _resolveBumpAt(newX, newY) {
        const hero = this.hero
        const entity = mapState.entityAtTile(newX, newY)

        // A NEUTRAL (a pact / boon offerer) is bump-SAFE: walking into it never attacks
        // — it just blocks like a body, so you can't provoke a demi-god by accident.
        // Attacking one is a DELIBERATE act via the click-to-attack path, which then
        // breaks the truce (dungeon.attackEntity). Interact (F) hears its offer.
        if (entity && entity.team === "neutral") return

        if (entity && (entity.type == "enemy" || entity.destructible) && hero.actionPoints > 0) {
            const currentWeapon = hero.currentWeapon()
            const distance = mapState.distanceBetweenEntities(hero, entity)
            // Spatial "Extended Reach" enchant (melee only — see the other range gate).
            const meleeReach = currentWeapon ? currentWeapon.range() + (!currentWeapon.attackTile ? (hero._reachBonus || 0) : 0) : 0
            if (currentWeapon && distance <= meleeReach && distance >= currentWeapon.minRange()) {
                dungeon.attackEntity(hero, entity, currentWeapon)
                hero.actionPoints -= 1
            } else {
                // Innate fists fallback so every class can bump-attack an adjacent
                // foe (bow can't fire point-blank; Wizard carries no melee weapon).
                dungeon.attackEntity(hero, entity, hero.unarmed())
                hero.actionPoints -= 1
            }
            return
        }

        if (entity && entity.type == "item") {
            if (entity.bypassInventory) {
                // Collect-on-touch trigger (win / goal item): never stored in the
                // bag, so a full inventory can't block collecting it and soft-lock
                // the win. Mirror the tally path — pull it from the world, step
                // onto the tile, then fire onPickup (which ends the run).
                tm.removeEntity(entity)
                dungeon.itemPicked(entity)
                if (run.stats) run.stats.itemsFound += 1
                gameLog.log(`${hero.name} obtained ${entity.name}.`)
                hero.movementPoints -= 1
                dungeon.moveEntityTo(hero, newX, newY)
                entity.onPickup?.()
                return
            }
            if (entity.tallyKey && !entity.cursed) {
                // Tally items (gems → coins, keys) bypass inventory:
                // no slot consumed, no full check, fully consumed on pickup.
                // Cursed tally items (CursedGem) skip this branch and go to
                // inventory; they only convert to tally on cleanse.
                const value = entity.value?.() ?? 1
                hero.tallies[entity.tallyKey] = (hero.tallies[entity.tallyKey] || 0) + value
                tm.removeEntity(entity)
                dungeon.itemPicked(entity)
                if (run.stats) run.stats.itemsFound += 1
                const valueText = value > 1 ? ` (+${value})` : ''
                gameLog.log(`${hero.name} picked up a ${entity.name}${valueText}.`)
                hero.movementPoints -= 1
                dungeon.moveEntityTo(hero, newX, newY)
                entity.onPickup?.()
            } else if (hero.items.length >= 10) {
                gameLog.log(`${hero.name}'s inventory is full.`)
            } else {
                hero.items.push(entity)
                dungeon.itemPicked(entity)
                if (run.stats) run.stats.itemsFound += 1
                gameLog.log(`${hero.name} picked ${entity.name}: ${entity.description}`)
                reactHeroLoot(hero, entity)
                hero.movementPoints -= 1
                dungeon.moveEntityTo(hero, newX, newY)
                entity.onPickup?.()
            }
            return
        }

        if (entity && entity.type == "stairs") {
            hero.movementPoints -= 1
            if (entity.direction == "down") {
                run.goDown()
            } else {
                run.goUp()
            }
            return
        }

        if (entity && entity.type == "portal") {
            // Hero case (design §15.9). An ACTIVE portal teleports on step-in
            // (the stairs model — the hero never stands on the portal tile). A
            // HIDDEN portal reads as a wall: bumping it does nothing; the player
            // reveals it with [E] via onInteract, then a later bump uses it.
            if (entity.state === "active") {
                hero.movementPoints -= 1
                if (entity.heroOnly) {
                    // Cross-floor jump (slice 2b): hand off to the floor transition
                    // (its camera fade is the feedback); the destination is resolved
                    // on arrival in placePlayer via run.pendingArrival.
                    run.goToFloor(entity.dest.floor, { room: entity.dest.room ?? null, tile: entity.dest.tile ?? null })
                } else {
                    entity.use(hero)   // same-floor relocate
                }
            }
            return
        }

        if (entity && entity.type == "door") {
            if (entity.state === "locked") {
                if ((hero.tallies.keys || 0) <= 0) {
                    gameLog.log(`The door is locked.`)
                } else {
                    hero.tallies.keys -= 1
                    entity.unlock()
                    entity.open()
                    gameLog.log(`${hero.name} unlocks and opens the door.`)
                    hero.movementPoints -= 1
                }
            } else if (entity.state === "sealed") {
                gameLog.log(`The door is sealed by magic.`)
            } else if (entity.state === "hidden") {
                // Looks like a wall. Player must use interact (E)
                // to reveal — no log here keeps spam off when the
                // player bumps a wall they didn't realize was one.
            } else {
                entity.open()
                gameLog.log(`${hero.name} opens the door.`)
                hero.movementPoints -= 1
            }
        }
    }

    bestInteractTargetAtTile(x, y) {
        // Returns {entity, prompt} or null. Prefers containers over other
        // interactables when multiple sit on the same tile (e.g., a loot bag
        // dropped on top of an open door — player should be able to grab the
        // loot first; door interaction takes over once the bag self-destroys).
        const hero = this.hero
        let otherTarget = null
        for (const e of tm.entities) {
            if (e.x !== x || e.y !== y) continue
            if (typeof e.onInteract !== "function") continue
            if (typeof e.interactPrompt !== "function") continue
            const prompt = e.interactPrompt(hero)
            if (!prompt) continue
            if (e.type === "container") return { entity: e, prompt }
            if (!otherTarget) otherTarget = { entity: e, prompt }
        }
        return otherTarget
    }

    findInteractTarget() {
        const cardinals = [
            { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
        ]
        for (const dir of cardinals) {
            const target = this.bestInteractTargetAtTile(this.hero.x + dir.dx, this.hero.y + dir.dy)
            if (target) return target
        }
        return null
    }

    // The "yes" action (default Y). For now: if an adjacent offerer is mid-offer,
    // seal its pact. A no-op otherwise — safe to press anytime.
    tryAccept() {
        const target = this.findInteractTarget()
        const e = target?.entity
        if (e?.pactPending && typeof e.confirmPact === "function") e.confirmPact(this.hero)
    }

    // The "no" action (default N). For now: if an adjacent offerer is mid-offer,
    // refuse its pact. A no-op otherwise — safe to press anytime.
    tryDecline() {
        const target = this.findInteractTarget()
        const e = target?.entity
        if (e?.pactPending && typeof e.rejectPact === "function") e.rejectPact(this.hero)
    }

    tryInteract() {
        const target = this.findInteractTarget()
        if (!target) {
            // Container.interactPrompt silently returns null when the
            // hero's inventory is full and the container has no tally
            // items — surface that specifically so the player isn't
            // told "Nothing to interact with" while standing next to
            // a chest.
            if (this._adjacentContainerSuppressedByCap()) {
                gameLog.log(`Your inventory is full — drop something to make room.`)
            } else {
                gameLog.log(`Nothing to interact with.`)
            }
            return
        }
        target.entity.onInteract(this.hero)
    }

    _adjacentContainerSuppressedByCap() {
        const hero = this.hero
        if (hero.items.length < INVENTORY_CAP) return false
        for (const e of tm.entities) {
            if (e.type !== "container" || e.contents.length === 0) continue
            const dx = Math.abs(e.x - hero.x)
            const dy = Math.abs(e.y - hero.y)
            if (dx + dy !== 1) continue
            return true
        }
        return false
    }

    cancelTargeting() {
        if (!this.targeting) return
        this.targeting = null
        this._clearTargetPreview()
        gameLog.log(`Targeting canceled.`)
        this.hero.hud?.refresh()
    }

    // --- Invocation (channeled abilities) ------------------------------------
    // The Invoking/Invocation mechanic. Toggle a channeled ability on/off:
    // starting it parks pickEnemy targeting; the click locks the target and
    // enters the invoking state. Pressing the same ability again (or Escape)
    // toggles it off. Per-round auto-fire + break conditions live in
    // tickInvocation, driven each frame by BaseHero.turn().
    toggleInvocation(ability, slotIndex) {
        const hero = this.hero
        if (this.invoking && this.invoking.ability === ability) {
            this.stopInvoking(`${hero.name} ends the invocation.`)
            return
        }
        // Starting a channel respects the same gates as a one-shot (cooldown,
        // resource cost, Magic/INT requirements). The channeled dispatch path in
        // onAbilityKey skips the cost/cooldown branch, so the gate lives here.
        // (Toggling OFF is handled above, before this check, so a spent ability
        // can always be ended.)
        if (!ability.canActivate()) return
        this.resolveTarget(ability, (target) => {
            if (!target) return
            // Two channel flavors: ENTITY-locked (Siphon's pickEnemy — breaks when
            // the victim dies/flees) vs AIM-locked (a charged beam's direction —
            // fires along a fixed vector, no entity to track). For entity channels
            // `target` is the victim; for aim channels it's the { dx, dy } vector.
            const victim = target.entity ?? null
            if (ability.target !== 'direction' && !victim) return
            this.invoking = { ability, target: victim, aim: target, slotIndex }
            ability.onChannelStart?.(target)
            const label = victim ? `${ability.invokeVerb} ${victim.name}` : ability.invokeVerb
            gameLog.log(`${hero.name} begins ${label}.`)
            this.hero.hud?.refresh()
        })
    }

    stopInvoking(message) {
        if (!this.invoking) return
        this.invoking = null
        if (message) gameLog.log(message)
        this.hero.hud?.refresh()
    }

    // Called every frame the hero takes a turn (BaseHero.turn). Fires the channel
    // once per round (AP gate), spends the whole turn, and snaps on break.
    tickInvocation() {
        const inv = this.invoking
        if (!inv) return
        if (run.transitioning || dungeon.paused) return
        const hero = this.hero
        const { ability, target, aim } = inv

        // Interrupted by hard CC on the caster — snaps the channel. For a charged
        // cast that hasn't fired yet, the shot is lost (the ability may react via
        // onChannelInterrupt).
        if (this._isDisabled(hero)) {
            ability.onChannelInterrupt?.()
            this.stopInvoking(`${hero.name}'s ${ability.name} is interrupted!`)
            return
        }
        // Entity-locked channels (Siphon) break when the victim is gone or slips
        // out of sight. Aim-locked channels (a charged beam) have no entity to
        // track — they just fire along their fixed vector.
        if (target) {
            if (!target.sprite || target.healthPoints <= 0) {
                this.stopInvoking(`${hero.name}'s invocation ends — nothing left to draw from.`)
                return
            }
            if (ability.breaksOnLineOfSight) {
                const dist = Math.max(Math.abs(target.x - hero.x), Math.abs(target.y - hero.y))
                if (dist > ability.range || !mapState.hasLineOfSight(hero, target)) {
                    this.stopInvoking(`${hero.name}'s invocation snaps — the target slips away.`)
                    return
                }
            }
        }
        // Fire once per round (AP gate); spend the whole turn — no other action.
        // A truthy tick() return means the (charged) sequence finished — release.
        if (hero.actionPoints > 0) {
            const done = ability.tick(hero, target ?? aim)
            hero.actionPoints -= (ability.cost.ap ?? 1)
            hero.movementPoints = 0
            this.hero.hud?.refresh()
            if (done) this.stopInvoking()
        }
    }

    _isDisabled(hero) {
        // Daze is the light-CC twin of Stun (skips one turn); the hero honors it
        // too, so an enemy slam/Bull Rush daze — or Breach's self-daze — costs the
        // hero a turn the same way it costs an enemy.
        const DISABLING = ['Stun', 'Freeze', 'Sleep', 'Petrify', 'Daze']
        return (hero._tags || []).some(t => DISABLING.includes(t))
    }

    // Deliberate Retreat. Combat-gated (only when the hero is inside an active
    // arena) and costs 1 AP for any real attempt — success or failure both
    // burn the action, so fleeing is a committed choice, not a free peek. The
    // SPD roll + Emboldened consequence live in encounters.playerRetreat.
    tryRetreat() {
        const hero = this.hero
        if (hero.actionPoints < 1) return
        const result = encounters.playerRetreat(hero)
        if (result === 'none') {
            gameLog.log('Nothing to retreat from.')
            return
        }
        hero.actionPoints -= 1
        if (result === 'fled') {
            gameLog.log(`${hero.name} breaks off and retreats!`)
        } else {
            gameLog.log(`${hero.name} tries to flee but can't break away!`)
        }
        this.hero.hud?.refresh()
    }

    // Ability dispatch. Per documents/v3_abilities_runtime.md call chain:
    // canActivate -> resolveTarget(mode) -> activate(hero, target) ->
    // debit cost + start cooldown -> hud.refresh. Cost/cooldown happen
    // AFTER activate so abilities can self-validate (e.g., Breach needs
    // an adjacent wall AND walkable beyond) and signal failure by
    // returning false — no cost paid, no cooldown started. Anything
    // else (including undefined) counts as success.
    onAbilityKey(slotIndex) {
        const ability = this.hero.abilities[slotIndex]
        if (!ability) return

        // Channeled invocation: toggle the sustained state instead of a one-shot.
        if (ability.channeled) {
            this.toggleInvocation(ability, slotIndex)
            if (this.targeting) { this.targeting.slotIndex = slotIndex; this.hero.hud?.refresh() }
            return
        }

        if (!ability.canActivate()) return

        this.resolveTarget(ability, (target) => {
            if (!target) return
            const result = ability.activate(this.hero, target)
            if (result === false) return
            gameLog.log(`${this.hero.name} uses ${ability.name}.`)
            this.hero.actionPoints -= (ability.cost.ap ?? 0)
            this.hero.movementPoints -= (ability.cost.mp ?? 0)
            ability.cooldownRemaining = ability.cooldown
            this.hero.hud?.refresh()
        })

        // If resolveTarget parked targeting state (direction mode), stamp
        // the originating slot so the HUD can highlight the icon while
        // we wait for the player's arrow-key follow-up.
        if (this.targeting) {
            this.targeting.slotIndex = slotIndex
            this.hero.hud?.refresh()
        }
    }

    // Resolve an ability's declared target mode into a target object,
    // then invoke callback(target). No-prompt modes (self / adjacent /
    // adjacentEnemies) fire synchronously; `direction` parks targeting
    // state until an arrow key arrives. pickTile/pickEnemy/aoeRadius
    // land with the PRs that consume them — kept off the targeting
    // path so the existing Scroll-of-Blink teleport branch is untouched.
    resolveTarget(ability, callback) {
        const mode = ability.target
        const hero = this.hero

        if (mode === 'self') {
            callback({ hero })
            return
        }

        if (mode === 'adjacent') {
            const tiles = this._adjacentTiles(hero)
            const entities = tiles
                .map(t => mapState.entityAtTile(t.x, t.y))
                .filter(e => e)
            callback({ tiles, entities })
            return
        }

        if (mode === 'adjacentEnemies') {
            const entities = this._adjacentTiles(hero)
                .map(t => mapState.entityAtTile(t.x, t.y))
                .filter(e => e && e.type === 'enemy')
            callback({ entities })
            return
        }

        if (mode === 'direction') {
            this.targeting = { type: 'direction', callback }
            gameLog.log(`${ability.name}: click a tile or press an arrow key to aim.`)
            return
        }

        if (mode === 'pickEnemy') {
            this.targeting = { type: 'pickEnemy', callback, range: ability.range }
            gameLog.log(`${ability.name}: click an enemy (range ${ability.range}).`)
            return
        }

        if (mode === 'pickAlly') {
            this.targeting = { type: 'pickAlly', callback, range: ability.range }
            gameLog.log(`${ability.name}: click yourself or a party member (range ${ability.range}).`)
            return
        }

        if (mode === 'pickTile') {
            this.targeting = { type: 'pickTile', callback, range: ability.range }
            gameLog.log(`${ability.name}: click a tile (range ${ability.range}).`)
            return
        }

        // Click-to-aim AoE (the skillshot mode). Parks targeting with the
        // ability's blast radius; the hover preview shows the footprint and the
        // click resolves callback({ tile, radius, tiles }). Shared with thrown
        // flasks/traps (ThrowableItem uses the same mode).
        if (mode === 'aoeTile') {
            const radius = ability.radius ?? 1
            const wallLength = ability.wallLength ?? 0
            this.targeting = { type: 'aoeTile', callback, range: ability.range, radius, wallLength }
            if (wallLength > 0) {
                gameLog.log(`${ability.name}: click to place the wall (range ${ability.range}).`)
            } else {
                gameLog.log(`${ability.name}: click a target area (range ${ability.range}, blast ${radius}).`)
            }
            return
        }

        // Unknown / unsupported mode: silently fail rather than crash.
        // The dispatcher hasn't debited cost yet so the ability stays
        // ready to retry once the mode is implemented.
        gameLog.log(`Ability target mode "${mode}" not yet implemented.`)
    }

    _adjacentTiles(entity) {
        const tiles = []
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue
                tiles.push({ x: entity.x + dx, y: entity.y + dy })
            }
        }
        return tiles
    }

    // Direction aiming (targeting prompts + steerable channels) shares the
    // movement keymap, so rebinding movement also rebinds aim.
    _directionFromKey(event) {
        return inputMap.directionForEvent(event)
    }

    // --- targeting hover preview ---------------------------------------------
    // A single reusable graphics overlay that highlights the cursor tile (every
    // targeting mode) plus the AoE footprint (aoeTile). Green = a valid in-range
    // target, red = out of range. Drawn at depth 9: above zones (8), below
    // actors (10). Cleared whenever targeting ends.
    _clearTargetPreview() {
        if (this._previewGfx) { this._previewGfx.destroy(); this._previewGfx = null }
    }

    _updateTargetPreview(event) {
        const t = this.targeting
        if (!t || !this.scene || !mapState.map) { this._clearTargetPreview(); return }

        const hero = this.hero
        const x = mapState.map.worldToTileX(event.worldX)
        const y = mapState.map.worldToTileY(event.worldY)
        const ts = mapState.tileSize || 16
        const range = t.range ?? 1
        const inRange = Math.max(Math.abs(x - hero.x), Math.abs(y - hero.y)) <= range
        const color = inRange ? 0x66ff88 : 0xff5555

        if (!this._previewGfx) {
            this._previewGfx = this.scene.add.graphics().setDepth(9)
        }
        const g = this._previewGfx
        g.clear()
        g.fillStyle(color, 0.28)

        if (t.type === 'aoeTile' && t.wallLength > 0) {
            // Wall: preview the actual line, oriented perpendicular to the cast —
            // exactly the tiles wallLineTiles() will lay the segments on.
            for (const tile of wallLineTiles(hero, { x, y }, t.wallLength)) {
                g.fillRect(mapState.map.tileToWorldX(tile.x), mapState.map.tileToWorldY(tile.y), ts, ts)
            }
        } else if (t.type === 'aoeTile') {
            const radius = t.radius ?? 1
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const tx = x + dx
                    const ty = y + dy
                    // Show the blast over floor tiles (occupied or not); skip walls.
                    if (mapState.level?.[ty]?.[tx] === 0) {
                        g.fillRect(mapState.map.tileToWorldX(tx), mapState.map.tileToWorldY(ty), ts, ts)
                    }
                }
            }
        } else {
            g.fillRect(mapState.map.tileToWorldX(x), mapState.map.tileToWorldY(y), ts, ts)
        }
    }

    resolveTargetedClick(x, y) {
        const hero = this.hero
        const t = this.targeting
        if (!t) return

        // Direction abilities (cones, lines, charges) are aimable by mouse as
        // well as by arrow key: the click resolves to the 8-way direction from
        // the hero toward the clicked tile. Diagonals are supported (the shape
        // generators best-estimate them). Clicking the hero's own tile is a no-op.
        if (t.type === "direction") {
            const dx = Math.sign(x - hero.x)
            const dy = Math.sign(y - hero.y)
            if (dx === 0 && dy === 0) {
                gameLog.log(`Pick a direction away from yourself.`)
                return
            }
            const callback = t.callback
            this.targeting = null
            this._clearTargetPreview()
            this.hero.hud?.refresh()
            callback({ dx, dy })
            return
        }

        if (t.type === "pickEnemy") {
            const entity = mapState.entityAtTile(x, y)
            if (!entity || entity.type !== "enemy") {
                gameLog.log(`No enemy at that tile.`)
                return
            }
            const dx = Math.abs(entity.x - hero.x)
            const dy = Math.abs(entity.y - hero.y)
            const chebyshev = Math.max(dx, dy)
            if (chebyshev > (t.range || 1)) {
                gameLog.log(`${entity.name} is out of range.`)
                return
            }
            const callback = t.callback
            this.targeting = null
            this._clearTargetPreview()
            this.hero.hud?.refresh()
            callback({ entity })
            return
        }

        if (t.type === "pickAlly") {
            // A friendly target: the hero itself or any player-team unit (a
            // Follower / tamed beast). Both read team === 'player'.
            const entity = mapState.entityAtTile(x, y)
            if (!entity || entity.team !== 'player') {
                gameLog.log(`No ally at that tile.`)
                return
            }
            const dx = Math.abs(entity.x - hero.x)
            const dy = Math.abs(entity.y - hero.y)
            if (Math.max(dx, dy) > (t.range || 0)) {
                gameLog.log(`${entity.name} is out of range.`)
                return
            }
            const callback = t.callback
            this.targeting = null
            this._clearTargetPreview()
            this.hero.hud?.refresh()
            callback({ entity })
            return
        }

        if (t.type === "pickTile") {
            const dx = Math.abs(x - hero.x)
            const dy = Math.abs(y - hero.y)
            const chebyshev = Math.max(dx, dy)
            if (chebyshev > (t.range || 1)) {
                gameLog.log(`That tile is out of range.`)
                return
            }
            if (!mapState.isWalkableTile(x, y)) {
                gameLog.log(`That tile is blocked.`)
                return
            }
            const callback = t.callback
            this.targeting = null
            this._clearTargetPreview()
            this.hero.hud?.refresh()
            callback({ tile: { x, y } })
            return
        }

        if (t.type === "aoeTile") {
            const chebyshev = Math.max(Math.abs(x - hero.x), Math.abs(y - hero.y))
            if (chebyshev > (t.range || 1)) {
                gameLog.log(`That area is out of range.`)
                return
            }
            // Center must be a floor tile (not a wall), but MAY be occupied —
            // the player aims the blast directly at an enemy's tile. Uses the
            // level grid (0 = open) rather than isWalkableTile, which rejects
            // occupied tiles.
            if (!mapState.level[y] || mapState.level[y][x] !== 0) {
                gameLog.log(`You can't target that tile.`)
                return
            }
            const radius = t.radius ?? 1
            const callback = t.callback
            this.targeting = null
            this._clearTargetPreview()
            this.hero.hud?.refresh()
            callback({ tile: { x, y }, radius, tiles: footprintTiles(x, y, radius) })
            return
        }

        if (t.type === "teleport") {
            if (!mapState.level[y] || mapState.level[y][x] === undefined) {
                gameLog.log(`That tile is out of bounds.`)
                return
            }
            if (mapState.level[y][x] !== 0) {
                gameLog.log(`You can't teleport into a wall.`)
                return
            }
            if (mapState.entityAtTile(x, y)) {
                gameLog.log(`That tile is occupied.`)
                return
            }
            gameLog.log(`A burst of light carries you to your chosen destination.`)
            this.targeting = null
            this._clearTargetPreview()
            const itemNumber = t.itemNumber
            playCast(hero, {
                type: 'arcane',
                onComplete: () => {
                    hero.x = x
                    hero.y = y
                    if (hero.sprite) {
                        hero.sprite.x = mapState.map.tileToWorldX(x)
                        hero.sprite.y = mapState.map.tileToWorldY(y)
                    }
                    if (typeof itemNumber === "number") {
                        hero.removeItem(itemNumber)
                    }
                    // Replay the cast at the destination so the player visually
                    // sees "vanish here, appear there" rather than just snapping.
                    playCast(hero, { type: 'arcane' })
                }
            })
        }
    }
}
