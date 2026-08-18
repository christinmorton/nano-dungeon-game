import { defineStatus } from "./Status.js"

// Simple-tier basic-affinity SIGNATURES (§19.6). A PLAIN (unempowered) basic affinity
// gets ONE light-touch, deepen-able signature — the effect-vocabulary made real —
// contrast the advanced/empowered 3-path forks. Each reads its rank live off
// `entity.affinityPaths[key].rank`, so deepening with shards scales the effect.
//
// Names are chosen unique from the pool-passive tags (Combustion/Virulence/etc.) so the
// status registry doesn't collide. Exposed as BASIC_SIGNATURES (element -> descriptor);
// affinityPaths.js wraps each tag in a Passive and statusList.js registers them.

const rankOf = (e, key) => e.affinityPaths?.[key]?.rank || 1

// +% outgoing damage vs a target carrying `statusName` (fire/frost/poison/lightning).
function synergy(name, key, statusName, perRank = 0.12) {
    return defineStatus({
        name, category: "buff", valence: "positive", duration: null,
        outgoingDamageMult: function (running, victim) {
            const hit = victim?._tags?.includes?.(statusName)
            return (running ?? 1) * (hit ? 1 + rankOf(this, key) * perRank : 1)
        },
    })
}

// + flat contribution to a stat (arcane magicPower, wind dodge).
function statSig(name, key, stat, perRank) {
    return defineStatus({
        name, category: "buff", valence: "positive", duration: null,
        statContribution: function (running, statName) {
            if (statName === stat) return (running || 0) + rankOf(this, key) * perRank
            return running
        },
    })
}

// + armor/barrier penetration (physical brute force, acid corrosion).
function penSig(name, key, perRank = 3) {
    return defineStatus({
        name, category: "buff", valence: "positive", duration: null,
        armorPen: function (running, damageType) {
            return (running || 0) + rankOf(this, key) * perRank
        },
    })
}

// damage reduction (earth).
function drSig(name, key, perRank = 0.05) {
    return defineStatus({
        name, category: "buff", valence: "positive", duration: null,
        damageTakenMult: function (mult) {
            return (mult ?? 1) * (1 - Math.min(0.5, rankOf(this, key) * perRank))
        },
    })
}

const synPct = (perRank) => Math.round(perRank * 100)

export const BASIC_SIGNATURES = {
    physical: { key: 'brutality', label: 'Brutality', blurb: 'Brute force pierces armor & barrier.',
        tag: penSig('Brutality', 'brutality', 3), readout: (e, r = 1) => `+${(r || 1) * 3} armor/barrier pierce` },
    fire: { key: 'conflagration', label: 'Conflagration', blurb: 'Burn hotter — bonus vs Burning foes.',
        tag: synergy('Conflagration', 'conflagration', 'Burning', 0.12), readout: (e, r = 1) => `+${synPct(0.12) * (r || 1)}% damage vs Burning targets` },
    frost: { key: 'permafrost', label: 'Permafrost', blurb: 'Prey on the chilled — bonus vs Slowed foes.',
        tag: synergy('Permafrost', 'permafrost', 'Slow', 0.12), readout: (e, r = 1) => `+${synPct(0.12) * (r || 1)}% damage vs Slowed targets` },
    poison: { key: 'pestilence', label: 'Pestilence', blurb: 'Bonus vs Poisoned foes.',
        tag: synergy('Pestilence', 'pestilence', 'Poison', 0.12), readout: (e, r = 1) => `+${synPct(0.12) * (r || 1)}% damage vs Poisoned targets` },
    acid: { key: 'dissolution', label: 'Dissolution', blurb: 'Corrosion eats armor & barrier.',
        tag: penSig('Dissolution', 'dissolution', 3), readout: (e, r = 1) => `+${(r || 1) * 3} armor/barrier pierce` },
    lightning: { key: 'overcharge', label: 'Overcharge', blurb: 'Bonus vs Shocked foes.',
        tag: synergy('Overcharge', 'overcharge', 'Shocked', 0.12), readout: (e, r = 1) => `+${synPct(0.12) * (r || 1)}% damage vs Shocked targets` },
    earth: { key: 'bastion', label: 'Bastion', blurb: 'Immovable — take less damage.',
        tag: drSig('Bastion', 'bastion', 0.05), readout: (e, r = 1) => `-${synPct(0.05) * (r || 1)}% damage taken` },
    wind: { key: 'tailwind', label: 'Tailwind', blurb: 'Hard to pin — more evasion.',
        tag: statSig('Tailwind', 'tailwind', 'dodge', 3), readout: (e, r = 1) => `+${(r || 1) * 3} dodge` },
    arcane: { key: 'arcanum', label: 'Arcanum', blurb: 'Raw current — more magic power.',
        tag: statSig('Arcanum', 'arcanum', 'magicPower', 3), readout: (e, r = 1) => `+${(r || 1) * 3} magic power` },
}
