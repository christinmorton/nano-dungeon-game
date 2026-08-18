import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import sunder from '../../tags/sunder.js'
import bleed from '../../tags/bleed.js'
import slow from '../../tags/slow.js'
import { throwSalvo, applyThrowEmpowerments } from '../../abilities/throwing.js'
import { addStatus, bump } from '../../abilities/traitDefs.js'

// Throw Hatchets — the heavy sibling of Throw Knives in the THROWING combat
// style. Same gear-gated, self-contained model, but fewer/harder hits that SHOVE
// the target (knockback), trading the knives' spammy DoT identity for physical
// disruption. Has a short cooldown (vs the knives' none) since each throw lands
// harder. Knife/hatchet COUNT is rank-only. Any throwable weapon equipped powers
// it; dedicated throwing axes add traits via throwEmpower (abilities/throwing.js).
export default class ThrowHatchets extends Ability {
    name = 'Throw Hatchets'
    icon = 31
    description = 'Hurl a heavy hatchet at an enemy up to 3 tiles away, shoving it back. Weak with a non-throwing weapon; equip throwing axes to throw hard. Rank up to throw more. 1 AP, cd 1.'
    cost = { ap: 1, mp: 0 }
    cooldown = 1
    range = 3
    target = 'pickEnemy'
    damageType = 'physical'

    // Self-supplied projectile sprite — the axe frame (tile 382), a touch bigger
    // than a thrown knife.
    projectileTile = 382
    projectileScale = 0.6

    // Heavier than knives: fewer, harder hits that knock back. Same gear-gating —
    // improvised (no throwable) = weak flat toss; armed = attackPower*scale +
    // weapon roll. armedScale higher than knives (0.5 vs 0.3).
    hatchets = 1
    unarmedMin = 3
    unarmedMax = 7
    armedScale = 0.5
    knockbackTiles = 1
    appliesStatus = null

    // --- Progression ladder ----------------------------------------------------
    //   L1 : 1 hatchet, knockback 1
    //   L2 : 2 hatchets                                               [boost]
    //   L3 : augment — Barrage (3) | Cleaving (+sunder) | Overhead (+knockback)
    //   L4 : a trait slot (Keen (+scaling) | Maiming (+bleed) | Crippling (+slow))
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.hatchets += 1 },
    }

    augments = {
        barrage:  { label: 'Barrage', apply: a => { a.hatchets += 1 } },
        cleaving: addStatus('Cleaving', sunder),
        overhead: { label: 'Overhead', apply: a => { a.knockbackTiles += 1 } },
    }

    traits = {
        keen:      bump('Keen', 'armedScale', 0.1),
        maiming:   addStatus('Maiming', bleed),
        crippling: addStatus('Crippling', slow),
    }

    // Empower from the EQUIPPED throwing weapon (status / scaling).
    applyEmpowerments() { applyThrowEmpowerments(this) }

    activate(hero, target) {
        this.rebuild()   // refresh equipped throwing-weapon empowerments + ladder
        const victim = target.entity
        const count = Math.max(1, this.hatchets)
        const weapon = throwSalvo(this, hero, victim, {
            count,
            statuses: [].concat(this.appliesStatus || []),
            knockbackTiles: this.knockbackTiles,
        })
        gameLog.log(`${hero.name} hurls ${count} ${count > 1 ? 'hatchets' : 'hatchet'}${weapon ? '' : ' (improvised)'} at ${victim.name}.`)
    }
}
