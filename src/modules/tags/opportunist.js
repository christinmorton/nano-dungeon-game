import { defineStatus } from "./Status.js"

// Permanent trait tag behind the Opportunist passive: strike the helpless harder —
// +damage to a foe that is hard-disabled (Stun / Rooted / Freeze / Sleep /
// Petrify). Wraps the attacker-side outgoingDamageMult(victim) shim (base 1),
// applied in Combat.attack + resolveDamage. No duration — managed by the Passive
// wrapper.

const OPPORTUNIST_BONUS = 1.25
const DISABLED = ["Stun", "Rooted", "Freeze", "Sleep", "Petrify"]

const opportunist = defineStatus({
    name: "Opportunist",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    // Wraps outgoingDamageMult(victim): scale up when the victim is disabled.
    outgoingDamageMult: function (ret, victim) {
        const disabled = victim?._tags?.some(t => DISABLED.includes(t))
        return disabled ? ret * OPPORTUNIST_BONUS : ret
    }
})

export default opportunist
