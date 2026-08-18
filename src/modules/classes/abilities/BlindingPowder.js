import Ability from './Ability.js'
import blind from '../../tags/blind.js'
import { bolt } from '../../abilities/patterns.js'
import { playSplash, playCough } from '../../Animations.js'
import { reactCough } from '../../dialog/enemyReactions.js'

// Elf / skirmisher — the BLINDING POWDER. The elf lobs a ball of stinging powder
// that bursts over the target, fouling its eyes: a little chip damage plus Blind,
// so its next few attacks are likely to MISS. A control tool, not a damage one —
// neuter a dangerous attacker for a beat rather than out-trade it.
//
// NOT weapon-delegated (it's powder, not an arrow) and needs no bow — a self-
// contained thrown debuff. Reworked from "Crippling Loose" (a bow shot + Weaken),
// which never made thematic sense: an arrow doesn't sap attack POWER, but powder
// in the eyes plausibly spoils your aim.
//
// Deferred ladder (per the batch's ladder-later plan) grows TWO knobs the design
// called for: an AoE puff that catches nearby foes as it ranks (switch the bolt to
// areaStrike with a center-inclusive footprint), and more Blind charges / a higher
// miss chance (a stronger, longer blinding).

export default class BlindingPowder extends Ability {
    name = 'Blinding Powder'
    icon = 31
    description = 'Lob a burst of blinding powder at a foe — minor damage, and its next few attacks are likely to miss. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 6
    target = 'pickEnemy'

    // Low self-computed damage — this is a debuff, not a nuke.
    damageMin = 2
    damageMax = 5
    damageStat = null
    damageType = 'physical'

    // The blinding debuff. dealHit applies it to the survivor with Blind's default
    // params (3 attacks @ 60% miss); the deferred ladder parameterizes those up.
    appliesStatus = blind

    // Pale powder color — the single FX knob (cast pulse + the impact puff).
    fxColor = 0xe8d8a0

    activate(hero, target) {
        const victim = target.entity
        // Cough EMOTE up front — it claims the react slot so the foe hacks instead
        // of giving its usual "Argh!" status yell when Blind lands a beat later.
        reactCough(victim)
        // instant (no projectile sprite — it's a quick powder toss). bolt's
        // instant path still fires onImpact, so the puff + reel land on the foe.
        return bolt(this, hero, victim, {
            instant: true,
            castType: 'arcane',
            onImpact: (v) => {
                if (!v?.sprite) return
                playSplash(v.x, v.y, { color: this.fxColor, residue: true })  // powder bursts on the tile
                playCough(v, { color: this.fxColor })                         // …and the foe reels/coughs
            },
        })
    }
}
