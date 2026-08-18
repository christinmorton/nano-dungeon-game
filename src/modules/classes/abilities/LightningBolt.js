import Ability from './Ability.js'
import { bolt } from '../../abilities/patterns.js'
import { empowered, quickened, reaching } from '../../abilities/traitDefs.js'

// Storm pool ability — a hard-hitting single-target bolt: pure magicPower-scaled
// damage, no status rider — lightning is the high-damage school here. Delivery =
// patterns.bolt (behavior-preserving conversion; identity unchanged). Display name
// "Levin Bolt" (levin = archaic lightning; de-WoW'd). Class stays LightningBolt so
// import sites don't churn. (The sky-strike "Lightning Bolt" is a SEPARATE ability,
// classes/abilities/LightningStrike.js.)

const LIGHTNING_TINT = 0x0022ff
const LIGHTNING_PROJECTILE = { attackTile: 7, attackTexture: 'retroImpactLightning', attackScale: 0.25, tint: 0x0022ff }

export default class LightningBolt extends Ability {
    name = 'Levin Bolt'
    icon = 31
    description = 'Bolt an enemy (range 5) for heavy magic damage: magicPower + 4..8. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 5
    target = 'pickEnemy'

    damageMin = 4
    damageMax = 8
    damageStat = 'magicPower'
    damageType = 'magic'
    fxColor = LIGHTNING_TINT

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magicPower + 4..8
    //   L2 : +2/+3 damage                                                  [boost]
    //   L3 : augment — Overcharged (+dmg) | Rapid Cast (cd -1) | Far Reach (+range)
    //   L4 : a trait slot — Empowered | Quickened | Reaching
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 2; a.damageMax += 3 },
    }

    augments = {
        overcharged: { label: 'Overcharged', apply: a => { a.damageMin += 4; a.damageMax += 6 } },
        rapid:       { label: 'Rapid Cast', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
        farReach:    { label: 'Far Reach', apply: a => { a.range += 3 } },
    }

    traits = {
        empowered: empowered(3),
        quickened: quickened(1),
        reaching:  reaching(2),
    }

    activate(hero, target) {
        bolt(this, hero, target.entity, { castType: 'arcane', projectile: LIGHTNING_PROJECTILE })
    }
}
