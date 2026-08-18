import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import might from '../../tags/might.js'
import { playCast } from '../../Animations.js'
import { buffAura } from '../../abilities/patterns.js'
import { quickened, efficient } from '../../abilities/traitDefs.js'

// Holy tree — divine empower. Grant Might (+attackPower) to yourself or an ally;
// the single-target cousin of War Cry's party aura. The Mass augment turns it into
// a party-wide blessing (buffAura). PLANNED RENAME → "Benediction" (de-WoW §1.6);
// kept as Bless until the user confirms. Slotted (Cleric).

export default class Bless extends Ability {
    name = 'Bless'
    icon = 31
    description = 'Grant Might (+2 attackPower) for 3 turns to yourself or an ally (range 5). 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 5
    target = 'pickAlly'
    fxColor = 0xffd966          // holy gold — cast pulse tint
    radius = 2                  // Mass augment aura radius

    mightBonus = 2
    mightTurns = 3
    mass = false                // augment: bless the whole party instead of one ally

    // --- Progression ladder ----------------------------------------------------
    //   L1 : +2 attack, 3 turns, single ally
    //   L2 : +1 Might bonus                                                [boost]
    //   L3 : augment — Greater (+bonus) | Mass Bless (party aura) | Enduring (+turns)
    //   L4 : a trait slot — Exalt (+bonus) | Quickened | Efficient
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.mightBonus += 1 },
    }

    augments = {
        greater:  { label: 'Greater',    apply: a => { a.mightBonus += 2 } },
        mass:     { label: 'Mass Bless', apply: a => { a.mass = true } },
        enduring: { label: 'Enduring',   apply: a => { a.mightTurns += 3 } },
    }

    traits = {
        exalt:     { label: 'Exalt', apply: a => { a.mightBonus += 1 } },
        quickened: quickened(2),
        efficient: efficient({ ap: 1 }),
    }

    activate(hero, target) {
        if (this.mass) {
            // Party-wide blessing. buffAura applies a status to every friendly unit
            // in radius via addTag (default Might +2 — the scaled bonus is the
            // single-target reward; the trade for Mass is breadth over magnitude).
            const count = buffAura(this, hero, { statuses: might, castType: 'heal' })
            gameLog.log(count
                ? `${hero.name} blesses the party (${count}).`
                : `${hero.name} calls a blessing.`)
            return true
        }
        const ally = target?.entity ?? hero
        ally.addTag(might, this.mightTurns, this.mightBonus)
        playCast(ally, { type: 'heal' })
        gameLog.log(`${hero.name} blesses ${ally.name} (+${this.mightBonus} attack).`)
        return true
    }
}
