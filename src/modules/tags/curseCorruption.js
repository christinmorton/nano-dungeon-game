import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Curse Corruption — the Curse affinity's advanced base passive (§18). A single
// Corruption Level (CL) drives power UP and healing DOWN together, so the curse is a
// tempting-but-mounting hijack, not a death clock. Feeds on kills.
//
//   - CL 1..MAX, +1 per KILL (onKill). Anti-heal: incomingHealMult 0.5 (CL1) -> 0.0
//     (MAX). Empowerment (outgoingDamageMult, multiplicative): corruption by CL,
//     DESPERATION by missing HP, RAVENOUS ×1.5 vs a Cursed target (the affinity's own
//     rider curses everyone it hits).
//   - CURSED CONDUIT: while a Cursed Gem is held, the curse also slowly WITHERS the
//     body — every DECAY_INTERVAL turns, -1 to a random CON/SPD/DEX (NEVER STR/Magic/
//     INT: offense is protected so the curse can't neuter your attack). The sacrifice
//     converts back into damage (so power stays "comparable"). Restored on cleanse.
//
// Attached/detached by the Curse advanced affinity via BaseHero.forceCurse /
// restoreSuppressedBasic; cleanup() gives back every decayed stat point.

const MAX_CL = 5
const DECAY_INTERVAL = 8
const DECAY_STATS = ['CON', 'SPD', 'DEX']   // offense (STR/Magic/INT) is never touched
const CONVERSION_K = 0.03

const curseCorruption = defineStatus({
    name: "Curse Corruption",
    category: "debuff",
    valence: "mixed",
    duration: null,
    initialize: function () {
        this._curseCL = 1
        this._curseDecayTimer = 0
        this._curseStatDrained = { CON: 0, SPD: 0, DEX: 0 }
        gameLog.log(`A deepening corruption takes root in ${this.name}.`)
    },
    // Feeds on death — each kill deepens the curse.
    onKill: function (ret, victim) {
        if (this._curseCL < MAX_CL) {
            this._curseCL += 1
            gameLog.log(`The curse deepens in ${this.name} (level ${this._curseCL}/${MAX_CL}).`)
        }
        return ret
    },
    // Escalating anti-heal: receive 50% at CL1, 0% at MAX.
    incomingHealMult: function (mult) {
        const t = (this._curseCL - 1) / (MAX_CL - 1)
        return (mult ?? 1) * (0.5 * (1 - t))
    },
    // Empowerment: corruption × desperation × ravenous(vs Cursed) × conduit conversion.
    outgoingDamageMult: function (running, victim) {
        let m = running ?? 1
        m *= 1 + this._curseCL * 0.08
        const maxHp = this.maxHealthPoints || 1
        const hpFrac = Math.max(0, Math.min(1, this.healthPoints / maxHp))
        m *= 1 + (1 - hpFrac) * 0.5
        if (victim?._tags?.includes?.("Cursed")) m *= 1.5
        const sac = (this._curseStatDrained.CON || 0) + (this._curseStatDrained.SPD || 0) + (this._curseStatDrained.DEX || 0)
        if (sac > 0) m *= 1 + sac * CONVERSION_K
        return m
    },
    // Cursed Conduit — only while a Cursed Gem is held: slow physical decay. Runs in
    // the hero's per-round refresh (after points refill), like Slow.
    refresh: function (baseResult) {
        const holdsGem = this.items?.some?.(it => it?.isCursedGem)
        if (holdsGem) {
            this._curseDecayTimer += 1
            if (this._curseDecayTimer >= DECAY_INTERVAL) {
                this._curseDecayTimer = 0
                const pool = DECAY_STATS.filter(s => (this.stats?.[s] ?? 0) > 1)
                if (pool.length) {
                    const s = pool[Math.floor(Math.random() * pool.length)]
                    this.upgradeBaseStat?.(s, -1)
                    this._curseStatDrained[s] = (this._curseStatDrained[s] || 0) + 1
                    gameLog.log(`The curse withers ${this.name}'s ${s}.`)
                }
            }
        }
        return baseResult
    },
    // Cleanse teardown — return every stat point the conduit decayed.
    cleanup: function () {
        for (const s of DECAY_STATS) {
            const n = this._curseStatDrained?.[s] || 0
            if (n > 0) this.upgradeBaseStat?.(s, n)
        }
    }
})

export default curseCorruption
