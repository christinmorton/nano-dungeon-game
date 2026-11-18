import GenericItem from "./GenericItem.js"
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import inputMap from "../InputMap.js"
import audio from "../Audio.js"
import { spawnHealNumber } from "../Animations.js"
import { frameForName } from "../assetLoader.js"

// Kenney fallback (tileReference.json regions.elements "campfire"), used when the
// realm's prop sheet names no brazier. Same fallback discipline Container uses.
const TILE_CAMPFIRE = 504

// The fire is drawn from the CURRENT REALM's own prop sheet, so a camp in the
// Magma Deep looks like the Magma Deep. All three shipping biomes list "brazier"
// among their shared props (levels/recipes.js), and the furnisher already renders
// it — this reuses that art rather than introducing a sprite the pack lacks.
// Read inside the call, not at module scope: mapState is in a chain this file
// also sits in, and a module-evaluation-time read is the TDZ trap this codebase
// keeps hitting (see Container.js for the same note).
function brazierArt() {
    const sheet = mapState.theme && mapState.theme.propSheet
    if (!sheet) return null
    const frame = frameForName(sheet, "brazier")
    return frame == null ? null : { sheet, frame }
}

// Campfire — the rest half of a Camp room (scope doc §10.11).
//
// Resting is a FULL heal, ONCE per camp. v3's camp was free, full and unlimited,
// which in v5 would make the shopkeeper's guaranteed health potions pointless —
// any floor whose camp you can walk back to is a floor you never need a potion
// on. Spending the fire keeps the potions a real purchase and makes reaching a
// camp a milestone rather than a refill station. One camp per floor follows from
// the one-room-per-floor rule already in levels/roomKinds.js.
//
// THE SAFE ZONE IS NOT BUILT HERE. `room.restSafe` was already read in two
// places that came over with the port and were never written to:
//   - Dungeon.stepEntityTo   — refuses an enemy step into the room
//   - WorldQueries.gridForEntity — stamps the room out of the enemy A* matrix
// So the whole mechanic costs setting one flag. Unlike v3, the flag is set at
// SPAWN and never cleared: the camp is a standing sanctuary for as long as the
// player is on the floor, rather than something armed by making camp. That also
// drops v3's hero movement-lock (`hero.camped`) and its three teardown paths —
// there is nothing to break camp from, so nothing can strand the player.
export default class Campfire extends GenericItem {
    constructor(x, y) {
        super(x, y, TILE_CAMPFIRE, null, brazierArt())
        this.type = "decor"
        this.name = "Campfire"
        this.slot = null
        this.blocksPath = true
        this.tagPolicy = { materials: false, effects: false }
        this.spent = false
        this._describe()
        this._markRoomSafe()
    }

    // Flag the containing room so enemies neither step into it nor path through
    // it. Resolved once, here, rather than looked up per-step.
    _markRoomSafe() {
        const room = (mapState.rooms || []).find(
            r => this.x >= r.x && this.x < r.x + r.w && this.y >= r.y && this.y < r.y + r.h
        )
        if (room) room.restSafe = true
    }

    _describe() {
        const key = inputMap.keyLabel('interact')
        this.description = this.spent
            ? "The embers are cold. This camp has been used."
            : `A banked fire. Press ${key} to rest and recover.`
    }

    interactPrompt(actor) {
        if (this.spent) return null
        // Nothing to offer at full health — decline the prompt so the shopkeeper
        // standing next to the fire can win the adjacent-interact scan instead.
        if (actor && actor.healthPoints >= actor.maxHealthPoints) return null
        return `[${inputMap.keyLabel('interact')}] Rest at the campfire`
    }

    onInteract(hero) {
        if (this.spent) return
        const restored = hero.maxHealthPoints - hero.healthPoints
        if (restored <= 0) return

        hero.healthPoints = hero.maxHealthPoints
        spawnHealNumber(hero, restored)
        // Keyed exactly as audioManifest.json spells it — a wrong key is
        // SILENTLY mute here, the same trap ABILITY_SOUNDS carries.
        audio.play('potion-health')

        this.spent = true
        this._describe()
        // Dim the fire so a spent camp reads as spent from across the room,
        // rather than only through the interact prompt.
        if (this.sprite) this.sprite.setAlpha(0.45)

        gameLog.log(`${hero.name} rests by the fire and recovers ${restored} health.`)
        gameLog.log(`The fire burns low — this camp is spent.`)
        hero.hud?.refresh()
    }

    // Decor, not loot — never drops into a bag.
    onDestroy() {}
}
