// Shield-then-HP damage application. A leaf module (imports nothing) so that
// BOTH damage paths — Combat.attack (weapon hits) and the ability-side
// resolveDamage (universals.js) — can spend an entity's shield pool before its
// health, without an import cycle (Combat <-> universals <-> Dungeon would
// otherwise loop).
//
// `_shieldPool` is a depletable absorb buffer granted by the `absorb` universal
// verb (via the Shield status, which owns the pool's lifetime). Here we only
// SPEND it: soak as much of the incoming (already-mitigated) damage as the pool
// holds, then pass the remainder to HP. Returns { absorbed, dealt } so callers
// can show the right number / log line; the caller still owns death handling
// (checking healthPoints after).
export function applyDamage(victim, amount) {
    let absorbed = 0
    const pool = victim._shieldPool || 0
    if (amount > 0 && pool > 0) {
        absorbed = Math.min(pool, amount)
        victim._shieldPool = pool - absorbed
        amount -= absorbed
        // Leech / drain shield (Void Shroud): a shield can heal its bearer for a
        // fraction of what it absorbs. _shieldDrainRatio is set by the granting
        // ability and cleared with the Shield tag's cleanup, so a plain shield
        // (ratio 0/undefined) never leeches. Clamped to maxHealthPoints.
        const ratio = victim._shieldDrainRatio || 0
        if (ratio > 0) {
            const leech = Math.round(absorbed * ratio)
            const cap = victim.maxHealthPoints ?? (victim.healthPoints + leech)
            if (leech > 0) victim.healthPoints = Math.min(cap, victim.healthPoints + leech)
        }
    }
    victim.healthPoints -= amount
    // LAST BREATH (§10.17, the Revenant Mail): once per run, a blow that would
    // kill the bearer leaves them at a quarter of max HP instead. It lives
    // HERE because this is the one choke both damage paths share; a proc in
    // Combat alone would let a Dark Priest's curse (resolveDamage) kill through
    // it. `lastBreath` is a stat key the hero's reducer defaults to 0 and the
    // mail contributes 1 to; the flag on the victim makes it once per run. The
    // caller logs it from the `revived` flag — this module imports nothing.
    // A DoT ticking HP directly (burning, poison) bypasses this; accepted.
    let revived = false
    if (victim.healthPoints <= 0 && !victim._lastBreathUsed && (victim.stat?.('lastBreath') ?? 0) > 0) {
        victim._lastBreathUsed = true
        victim.healthPoints = Math.max(1, Math.ceil((victim.maxHealthPoints || 1) * 0.25))
        revived = true
    }
    return { absorbed, dealt: amount, revived }
}
