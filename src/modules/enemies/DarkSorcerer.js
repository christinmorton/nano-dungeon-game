import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"
import { makeItem } from "../items/itemProfiles.js"
import darkPriestCaster from "../tags/darkPriestCaster.js"

// The roster's magic ranged threat.
//
// v3 gave this class a melee archetype pool and a weapon whose NAME was changed
// to "dark bolt" while staying a virtual melee stub — so a Dark Sorcerer walked
// up and hit you. Its ranged behaviour came from the recipe layer's caster role,
// which v5 cuts.
//
// v5 bakes it in. archetypes/archer.js is the kiting AI for BOTH archers and
// casters (its own comment says so) — it reads weapon.range() / minRange() and
// treats a non-physical damageType as a magic projectile, so a wand routes
// through the same code as a bow and just looks different when it fires.
export default class DarkSorcerer extends BaseEnemy {
    static tier = 1
    static archetype = "archer"

    constructor(x, y) {
        super(x, y)
        // "Dark Priest" as of 2026-10-04 (scope doc §10.18) — the user's word for
        // it throughout. The CLASS stays DarkSorcerer: enemyArt, enemyKinds, the
        // stronghold art maps and the title table all key on constructor.name.
        this.name = "Dark Priest"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 318
        this.weapon = makeItem('darkBolt')

        // Signature moves (scope doc §10.12). The tag wraps turn() — see
        // tags/darkPriestCaster.js for why this is a tag and not an enemy
        // ability system.
        this.addTag(darkPriestCaster)

        dungeon.initializeEntity(this)
    }

    // A caster needs to SEE further than the archer it shares an archetype with:
    // it is the floor's standing threat, and the whole point is that it opens on
    // you before you are ready. Set after super() so it overrides the
    // archetype's perception block rather than being overwritten by it.
    get detectionRadius() { return this._detectionRadius ?? 10 }
    set detectionRadius(v) { this._detectionRadius = v }

    // Stats are rolled from the ARCHETYPE in finalizeSpawn, which runs after the
    // constructor — so a constructor override would be silently wiped. This is
    // the seam that survives.
    //
    // The archer template rolls Magic 3-6, which on a wand that scales off
    // magicPower made a "dark sorcerer" hit like an apprentice. Raising Magic is
    // what makes its spells hurt; CON stays low so it is still a fragile kiter
    // that punishes you for ignoring it rather than a second brute.
    finalizeSpawn() {
        const already = this._spawnFinalized
        super.finalizeSpawn()
        if (already || !this.stats) return this
        this.stats.Magic = 14 + Math.floor(Math.random() * 5)   // 14-18
        this.stats.INT = 12 + Math.floor(Math.random() * 4)     // 12-15
        // CON raised 2026-10-04 (§10.18): the archer template's 6-9 gave it
        // 50-65 HP, two hits from any class. A priest that Shadowsteps is meant
        // to be chased, which needs it to survive being reached. HP is derived
        // from CON through the template formula, so set max then current.
        this.stats.CON = 11 + Math.floor(Math.random() * 3)     // 11-13
        this.maxHealthPoints = 20 + this.stats.CON * 5
        this.healthPoints = this.maxHealthPoints
        return this
    }
}
