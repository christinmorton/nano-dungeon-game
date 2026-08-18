import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { throwSalvo } from '../../abilities/throwing.js'

// Hurl Weapon — the Dwarf's signature heavy throw, and the THROWING style's
// "throw your EQUIPPED weapon" case (vs the self-contained Throw Knives/Hatchets
// that carry their own ammo). DWARF-only, and requires a throwable weapon in hand
// — you can't hurl a greatsword. A single full-weight throw (armedScale 1.0, so
// ~a full attack + the weapon's roll) at longer range that knocks the target back.
// Routes through the shared throwSalvo with projectileTile null, so it flings the
// equipped weapon's OWN sprite.
export default class HurlWeapon extends Ability {
    name = 'Hurl Weapon'
    icon = 31
    description = 'Hurl your equipped throwing weapon at an enemy up to 4 tiles away for a heavy hit that knocks them back. Dwarf only; needs a throwable weapon. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 4
    target = 'pickEnemy'
    requiresClass = 'Dwarf'
    damageType = 'physical'

    // Throws the EQUIPPED weapon: projectileTile null -> throwSalvo uses the
    // weapon's own sprite. Full-weight throw, big shove.
    projectileTile = null
    projectileScale = 1
    armedScale = 1.0
    knockbackTiles = 2
    // No improvised path — Hurl Weapon requires a throwable weapon (gated below).
    unarmedMin = 0
    unarmedMax = 0

    activate(hero, target) {
        const weapon = hero.currentWeapon()
        const throwable = weapon?.throwable ?? weapon?.profile?.throwable
        if (!throwable) {
            gameLog.log(`${hero.name} has no throwable weapon to hurl.`)
            return false
        }
        const victim = target.entity
        throwSalvo(this, hero, victim, { count: 1, knockbackTiles: this.knockbackTiles })
        gameLog.log(`${hero.name} hurls ${weapon.name} at ${victim.name}.`)
    }
}
