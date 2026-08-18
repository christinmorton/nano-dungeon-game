import Phaser from 'phaser'
import Ability from './Ability.js'
import { shapeStrike } from '../../abilities/patterns.js'
import { applyAcid } from '../../tags/acid.js'

// Magic pool ability — spray corrosive acid in a cone in front of the caster.
// Two-part payload: a flat IMPACT hit on every enemy in the fan, then a STACKING
// acid DoT (the game's first stacking status — see tags/acid.js). Re-spraying an
// already-coated enemy adds a stack, raising the per-turn corrosion and
// refreshing it. The first SHAPE-based ability; delivery is patterns.shapeStrike.
// Unslotted.

export default class AcidSpray extends Ability {
    name = 'Acid Spray'
    icon = 31
    description = 'Spray acid in a cone: 15..20 impact damage, then a stacking acid DoT (4..7/turn for 3 turns, up to 3 stacks). 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 4
    target = 'direction'

    // Delivery shape (§ composable components). spread:1 paints the expanding
    // triangle — each forward row widens 1,3,5,7... `length` is the RANK ladder:
    //   length 2 (lowest rank) -> rows 1,3        (reaches 3 wide)
    //   length 3               -> rows 1,3,5      (reaches 5 wide)
    //   length 4 (top rank)    -> rows 1,3,5,7    (reaches 7 wide) + special traits
    // Rank-up just bumps `length` in place; this ships at the lowest rank.
    shape = { kind: 'cone', length: 2, spread: 1 }

    // Base color: acid green — the single color knob (cast pulse + splash +
    // residue). A rank trait/variant recolors by mutating this (e.g. a "Toxin"
    // trait swaps to purple while raising toxicity).
    fxColor = 0xaaff00

    // IMPACT payload — a flat 15..20 hit per enemy in the cone. No stat scaling
    // (set damageStat to 'attackPower'/'magicPower' to scale). appliesStatus
    // stays null: the DoT STACKS, so it's applied via applyAcid (plain addTag
    // can't stack — see tags/acid.js), not the declarative status slot.
    damageMin = 15
    damageMax = 20
    damageStat = null
    damageType = 'magic'

    // Stacking acid DoT (declarative so a rank trait can scale these): adds
    // dotDamageMin..Max to the per-turn corrosion each stack, up to dotMaxStacks.
    dotDamageMin = 4
    dotDamageMax = 7
    dotTurns = 3
    dotMaxStacks = 3

    // --- Progression ladder (the first authored ability; see Ability.js) ---
    //   L1 base : cone length 2 · 15-20 impact · DoT 4-7/turn x3 · 3 stacks · green
    //   L2      : cone length 3 (reaches 5 wide)                          [boost]
    //   L3      : pick an augment branch (wide / concentrated / virulent)
    //   L4      : a trait slot opens (toxin / caustic / lingering)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.shape.length = 3 },   // reaches 5 wide
        // L3 unlocks the augment choice, L4 opens the trait slot — no passive boost.
    }

    // Mutually-exclusive build branch chosen at L3. Each mutates the declarative
    // fields; rebuild() recomputes from base so swapping picks never compounds.
    augments = {
        wide:         { label: 'Wide Spray',       apply: a => { a.shape.length = 4; a.shape.spread = 1 } },
        concentrated: { label: 'Concentrated Jet', apply: a => { a.shape = { kind: 'line', length: 5 }; a.damageMin += 4; a.damageMax += 8 } },
        virulent:     { label: 'Virulent Acid',    apply: a => { a.dotMaxStacks += 2; a.dotDamageMin += 2; a.dotDamageMax += 3 } },
    }

    // Additive trait slotted at L4. Toxin is the planned purple-recolor variant.
    traits = {
        toxin:     { label: 'Toxin',     apply: a => { a.fxColor = 0x9b30ff; a.dotDamageMin += 2; a.dotDamageMax += 4 } },
        caustic:   { label: 'Caustic',   apply: a => { a.damageMin += 5; a.damageMax += 5 } },
        lingering: { label: 'Lingering', apply: a => { a.dotTurns += 2 } },
    }

    activate(hero, target) {
        // shapeStrike deals the impact hit + paints the green cone; it returns
        // [{ entity, result }] so we can stack the DoT on each survivor.
        const results = shapeStrike(this, hero, target.dx, target.dy, { splash: true, residue: true })
        for (const { entity, result } of results) {
            if (result.killed) continue
            const perTurn = Phaser.Math.Between(this.dotDamageMin, this.dotDamageMax)
            applyAcid(entity, perTurn, this.dotTurns, this.dotMaxStacks)
        }
    }
}
