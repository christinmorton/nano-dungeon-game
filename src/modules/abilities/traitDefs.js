// Shared trait factory — the generic (🟢) trait families from
// documents/v3_ability_traits.md §1, built as one-line factories so every
// ability composes the same modifiers instead of hand-writing them.
//
// A trait is just `{ label, apply(ability) }`; `apply` MUTATES the ability's
// declarative fields. Ability.rebuild() resets every field to a pristine base
// snapshot before re-layering level boosts → augment → traits, so these are
// additive and idempotent — slotting/unslotting never compounds (see Ability.js).
//
// Each export is a FACTORY (takes the magnitude / target field) returning a
// trait entry, so an ability composes its menu by calling them:
//   traits = { reaching: reaching(2), quickened: quickened(1) }
//
// These stay tag-agnostic: status traits take the status object as an argument
// (the ability imports its own tag) so this module never depends on tags/.

// --- generic numeric field bump ------------------------------------------------
// The primitive every reach/economy trait is built on: add `n` to a named
// numeric field, clamped at `floor` (default unbounded). Use directly for
// ability-local fields (impactRadius, wallLength, dotTurns…) that don't have a
// named convenience factory below.
export const bump = (label, field, n, floor = -Infinity) => ({
    label,
    apply: a => { a[field] = Math.max(floor, (a[field] ?? 0) + n) },
})

// --- 1.1 Damage (only bite on self-computed-damage abilities; a no-op on
// weapon-delegated ones whose damageMin/Max stay 0) ----------------------------
export const empowered = (n) => ({
    label: `Empowered +${n}`,
    apply: a => { a.damageMin += n; a.damageMax += n },
})

export const brutal = (n, apCost = 1) => ({
    label: `Brutal +${n}`,
    apply: a => { a.damageMin += n; a.damageMax += n; a.cost = { ...a.cost, ap: (a.cost.ap ?? 0) + apCost } },
})

export const honed = (stat = 'attackPower') => ({
    label: `Honed (${stat})`,
    apply: a => { a.damageStat = stat },
})

// --- 1.2 Rider / status --------------------------------------------------------
// Append a status tag onto appliesStatus (normalized to an array). The delivery
// pattern / activate body must READ appliesStatus for this to land.
export const addStatus = (label, status) => ({
    label,
    apply: a => { a.appliesStatus = [].concat(a.appliesStatus || []).concat(status) },
})

// --- 1.3 Reach / shape ---------------------------------------------------------
export const reaching = (n = 2) => bump(`Reaching +${n}`, 'range', n, 0)
export const extended = (n = 1) => ({ label: `Extended +${n}`, apply: a => { a.shape.length += n } })
export const wide      = (n = 1) => ({ label: `Wide +${n}`,     apply: a => { a.shape.spread = (a.shape.spread ?? 0) + n } })
export const enlarge   = (n = 1) => bump(`Enlarge +${n}`, 'radius', n, 0)

// --- 1.4 Economy ---------------------------------------------------------------
export const quickened = (n = 1) => bump(`Quickened -${n}`, 'cooldown', -n, 0)
export const efficient = ({ ap = 0, mp = 0 } = {}) => ({
    label: `Efficient${ap ? ` -${ap}AP` : ''}${mp ? ` -${mp}MP` : ''}`,
    apply: a => {
        a.cost = {
            ...a.cost,
            ap: Math.max(0, (a.cost.ap ?? 0) - ap),
            mp: Math.max(0, (a.cost.mp ?? 0) - mp),
        }
    },
})

// --- 1.5 Element / conversion --------------------------------------------------
export const attunement = (label, damageType, fxColor) => ({
    label,
    apply: a => { a.damageType = damageType; if (fxColor != null) a.fxColor = fxColor },
})
