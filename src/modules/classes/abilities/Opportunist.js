import Passive from './Passive.js'
import opportunist from '../../tags/opportunist.js'

// Passive pool ability — Opportunist: deal +25% damage to a foe that is hard-
// disabled (Stun / Rooted / Freeze / Sleep / Petrify) — capitalize on the kit's
// own control (Snare Shot, Concussive Shot, Set Trap) and allies'. Bridge-to-tags:
// wraps the opportunist trait tag (the attacker-side outgoingDamageMult primitive).
// Unslotted.

export default class Opportunist extends Passive {
    name = 'Opportunist'
    icon = 31
    description = 'Passive: +25% damage to disabled enemies (stunned, rooted, frozen, asleep, petrified).'
    tags = [opportunist]
}
