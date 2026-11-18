import {
    playSwing,
    playOverheadStrike,
    playProjectile,
    spawnDamageNumber,
    spawnHealNumber,
    spawnMissNumber,
    spawnBlockNumber,
    spawnCriticalNumber,
    playCast,
    playHitReaction,
    playFlinch,
    playDraw,
    playBurst
} from './Animations.js'
import gameLog from './GameLog.js'
import dungeon from './Dungeon.js'
import tm from './TurnManager.js'
import audio from './Audio.js'
import { applyDamage } from './damage.js'
import { getStatusTemplate } from './tags/Status.js'
import { isUndead } from './enemies/enemyKinds.js'
import burning from './tags/burning.js'
import poison from './tags/poison.js'
import slow from './tags/slow.js'

// Element flavor -> status tag dispatch table. A flavored hit applies the mapped
// tag to the victim after damage settles — this is the "magic trait" a weapon
// carries (baked on special weapons, or via enchant later). Applies on any hit:
// melee here, and thrown via abilities/throwing.js (flavorStatus). lightning/
// earth/wind/holy still ship as visual-only flavors (no auto-status — e.g.
// lightning->Stun every hit would be too strong). See
// documents/v3_magic_and_elements.md §"Status routing".
const STATUS_BY_FLAVOR = {
    fire: burning,
    poison: poison,
    ice: slow,
}

// The status tag a damage flavor applies, or null. Shared so the throwing path
// (and any non-Combat hit) can apply weapon flavors the same way melee does.
export function flavorStatus(flavor) {
    return STATUS_BY_FLAVOR[flavor] ?? null
}

// Resolves an attack between two entities. Owns:
//   - animation routing (swing / projectile / cast-then-projectile)
//   - tween bookkeeping so back-to-back attacks queue rather than overlap
//   - the full resolution order from documents/v3_combat_stats_system.md:
//       1) dodge roll       (all damage types)
//       2) tag block        (existing elite block behavior — preserved)
//       3) block roll       (physical only, stat-driven)
//       4) crit roll        (multiplies damage if landed)
//       5) apply damage     (subtract armor for physical, barrier for magic,
//                            nothing for true; floor at max(1, damage))
//   - log lines + floating outcome label (Miss! / Block! / damage / Critical)
//   - weapon "damagedEntity" tag dispatch
//   - death cleanup via dungeon.removeEntity
//
// Public surface unchanged: attack(attacker, victim, weapon).

class Combat {
    attack (attacker, victim, weapon, opts = {}) {
        // Arena isolation: while the hero is dueling inside an active arena,
        // ONLY that arena's roster may damage them. This blocks every other
        // enemy — a phased crosser, a fog-hidden straggler, a free-for-all
        // squad member — from interfering with (or invisibly chipping at) the
        // 1-on-1 fight. hero._arenaBattle is refreshed each tick by the
        // EncounterManager; the guard is synchronous here, before any tween,
        // so a suppressed attack lands no damage and plays no swing.
        if (victim.type === "hero" && attacker.type === "enemy"
            && victim._arenaBattle && !victim._arenaBattle.roster.has(attacker)) {
            return
        }


        // Combat recency (Momentum): any attack the hero is part of — landing or
        // receiving — counts as being in combat. markCombat only exists on the hero.
        attacker.markCombat?.()
        victim.markCombat?.()

        attacker.moving = true
        attacker.tweens = (attacker.tweens || 0) + 1
        const delay = attacker.tweens * 200

        const damageType = weapon?.damageType ?? 'physical'

        const resolveAttack = () => {
            attacker.moving = false
            attacker.tweens -= 1

            // 0) Attacker accuracy — a Blinded attacker swings wild and may miss
            // outright, independent of the victim's dodge (Combat's only other miss
            // source). Blind wraps attackHits() to roll the miss + spend a charge.
            if (attacker.attackHits && attacker.attackHits() === false) {
                gameLog.log(`${attacker.name} is blinded and swings wide of ${victim.name}!`)
                spawnMissNumber(victim)
                audio.play('melee-miss')
                return
            }

            // Unblockable hits (e.g. a Bull Rush slam — you can't parry a charging
            // brute) skip the dodge + block rolls entirely; armor mitigation and
            // crits below still apply. opts.unblockable is threaded from
            // Dungeon.attackEntity.
            const unblockable = opts.unblockable === true

            // 1) Dodge roll
            const dodgeChance = unblockable ? 0 : (victim.dodgeChance?.() ?? 0)
            if (dodgeChance > 0 && Math.random() < dodgeChance) {
                gameLog.log(`${victim.name} dodges ${attacker.name}'s attack!`)
                spawnMissNumber(victim)
                audio.play('melee-miss')
                playFlinch(victim)
                victim.onDodge?.(attacker)   // dodge-triggered passives (Adrenaline)
                return
            }

            // 2) Tag block (preserves elite enrager/healer block behavior)
            if (!unblockable && victim.blockAttack && victim.blockAttack(attacker)) {
                gameLog.log(`${victim.name} blocks ${attacker.name}'s attack!`)
                spawnBlockNumber(victim)
                audio.play('melee-hit-light')
                playFlinch(victim)
                return
            }

            // 3) Stat-driven block (physical only)
            if (!unblockable && damageType === 'physical') {
                const blockChance = victim.blockChance?.() ?? 0
                if (blockChance > 0 && Math.random() < blockChance) {
                    gameLog.log(`${victim.name} blocks ${attacker.name}'s attack!`)
                    spawnBlockNumber(victim)
                    audio.play('melee-hit-light')
                    playFlinch(victim)
                    return
                }
            }

            // 4) Crit roll. opts.forceCrit (threaded from Dungeon.attackEntity —
            // e.g. Deadeye's precision shot) guarantees the crit; otherwise it's
            // the normal stat-driven chance.
            const critChance = attacker.stat?.('critChance') ?? 0
            const critMultiplier = attacker.stat?.('critMultiplier') ?? 2
            const isCrit = opts.forceCrit === true || (critChance > 0 && Math.random() < critChance)

            // 5) Damage applied with type-specific mitigation
            let damage = attacker.attack()
            // Ability damage multiplier (e.g. Bash's heavy blow) — scales the
            // weapon's damage BEFORE mitigation, so armor still applies and a
            // bigger weapon benefits proportionally. Threaded via opts.damageMult.
            if (opts.damageMult && opts.damageMult !== 1) {
                damage = Math.round(damage * opts.damageMult)
            }
            // Legendary weapon procs on the OUTGOING number (§10.17), before
            // mitigation so armor still applies:
            //   executeBelow { fraction, mult } — The Executioner against a
            //     target already under `fraction` of its max HP
            //   bonusVs { undead }               — Dawnbreaker against the undead
            if (weapon?.executeBelow && victim.maxHealthPoints) {
                const { fraction = 0.25, mult = 2 } = weapon.executeBelow
                if (victim.healthPoints / victim.maxHealthPoints < fraction) damage = Math.round(damage * mult)
            }
            if (weapon?.bonusVs?.undead && isUndead(victim)) {
                damage = Math.round(damage * weapon.bonusVs.undead)
            }
            // Protection minus the attacker's penetration for this damage type
            // (Arcane Spell Pierce shaves magic barrier). Floored at 0 — pen can
            // negate mitigation but not turn it into bonus damage.
            const rawProtection = victim.protection(damageType)
            const protection = Math.max(0, rawProtection - (attacker.armorPen?.(damageType) ?? 0))
            const pierced = rawProtection - protection   // armor/barrier the attacker's pen ignored
            damage = damage - protection
            if (isCrit) damage = Math.floor(damage * critMultiplier)
            // Marked (Hunter's Mark) etc. amplify damage taken on the victim.
            const takenMult = victim.damageTakenMult?.() ?? 1
            if (takenMult !== 1) damage = Math.round(damage * takenMult)
            // Opportunist etc. — attacker-side bonus keyed to the victim's state.
            const outMult = attacker.outgoingDamageMult?.(victim) ?? 1
            if (outMult !== 1) damage = Math.round(damage * outMult)
            damage = Math.max(1, damage)

            // Shield soak (absorb): a Shield pool spends before HP. `dealt` is
            // the HP loss after the pool eats what it can; `absorbed` is what the
            // pool ate. A fully-soaked hit deals 0 and reads as a block.
            const { absorbed, dealt, revived } = applyDamage(victim, damage)
            if (revived) gameLog.log(`${victim.name} should have fallen — the Revenant Mail refuses it!`)
            // Impact sound. A ranged weapon lands as an arrow; melee scales
            // with how much got through, so a crit and a chipped hit do not
            // sound the same. Kept beside the damage numbers so the audio and
            // the visible feedback can never disagree about what happened.
            //
            // Recomputed here rather than reusing the `isRanged` below: that
            // const is declared AFTER this closure, and the opts.skipFx path
            // calls resolveAttack() before reaching it — reading it from in
            // here would be a temporal-dead-zone crash on every skipFx ability.
            const rangedHit = !!(weapon?.range?.() && weapon.attackTile)
            if (dealt > 0) {
                if (rangedHit) audio.play('arrow-hit-flesh')
                else if (isCrit) audio.play('melee-crit')
                else audio.play(dealt >= 8 ? 'melee-hit-heavy' : 'melee-hit')
            } else {
                audio.play('melee-hit-light')
            }
            if (dealt > 0) {
                if (isCrit) {
                    spawnCriticalNumber(victim, dealt, weapon)
                    gameLog.log(`Critical! ${attacker.name} does ${dealt} damage to ${victim.name} with ${weapon.name}.`)
                } else {
                    spawnDamageNumber(victim, dealt, weapon)
                    gameLog.log(`${attacker.name} does ${dealt} damage to ${victim.name} with ${weapon.name} (mitigated ${protection}${pierced > 0 ? `, pierced ${pierced}` : ''}${absorbed ? `, absorbed ${absorbed}` : ''}).`)
                }
            } else {
                // Fully soaked by the shield.
                spawnBlockNumber(victim)
                gameLog.log(`${victim.name}'s shield absorbs ${attacker.name}'s attack (${absorbed}).`)
            }

            weapon.executeTag("damagedEntity", victim)

            // Attacker on-hit procs (Devour lifesteal) — fires whenever the swing
            // dealt HP, on BOTH a surviving and a lethal hit, before the kill branch.
            if (dealt > 0) attacker.onDealtDamage?.(victim, dealt)

            // Legendary procs on the landed hit (§10.17):
            //   lifesteal — the attacker heals this fraction of HP dealt (Lifedrinker)
            //   thorns    — the VICTIM's gear cuts a melee attacker back for a flat
            //               amount (Bramblecoat); straight to HP, no second roll, and
            //               never for a ranged hit — thorns bite what touches them.
            if (dealt > 0 && weapon?.lifesteal && attacker.maxHealthPoints) {
                const heal = Math.round(dealt * weapon.lifesteal)
                if (heal > 0) {
                    attacker.healthPoints = Math.min(attacker.maxHealthPoints, attacker.healthPoints + heal)
                    spawnHealNumber(attacker, heal)
                }
            }
            const thorns = dealt > 0 && !rangedHit ? (victim.stat?.('thorns') ?? 0) : 0
            if (thorns > 0 && attacker.healthPoints > 0 && attacker.sprite) {
                const { dealt: cut } = applyDamage(attacker, thorns)
                if (cut > 0) {
                    spawnDamageNumber(attacker, cut, weapon)
                    gameLog.log(`${attacker.name} is cut for ${cut} by ${victim.name}'s thorns.`)
                    if (attacker.healthPoints <= 0) dungeon.removeEntity(attacker)
                }
            }

            // 6) Element status trigger. Flavored hit applies the mapped
            // status tag (idempotent via Taggable's name-dedupe). Only fires
            // when the hit actually reached HP (a fully-absorbed hit shouldn't
            // apply Burning etc.) and the victim survives — no tagging a corpse.
            if (dealt > 0 && victim.healthPoints > 0 && weapon?.damageFlavor) {
                const status = STATUS_BY_FLAVOR[weapon.damageFlavor]
                if (status) victim.addTag(status)
            }

            // 6b) Weapon riders (scope doc §10.16) — the data fields that let a
            // higher-tier staff or bow do something a lower one cannot, read off
            // the weapon so no weapon needs code of its own.
            //
            //   onHitStatus { name, chance } — a status by REGISTERED name (the
            //     tag's `name`, as applyStatuses matches it), rolled per landed hit.
            //     This is how the Stormcaller stuns on one hit in five while the
            //     lightning FLAVOR above stays visual-only: every hit stunning was
            //     judged too strong, so the chance lives on the weapon that earns it.
            //   splash { radius, mult } — every other enemy within `radius` of the
            //     victim takes `mult` of a normal hit through THIS same pipeline
            //     (dodge, block, armour, flavour all apply), resolved at once with
            //     no second projectile. `opts.splashed` stops a splash from
            //     splashing again. The snapshot of tm.entities matters: a splash
            //     kill removes an entity mid-loop.
            if (dealt > 0 && victim.healthPoints > 0 && weapon?.onHitStatus) {
                const rider = weapon.onHitStatus
                if (Math.random() < (rider.chance ?? 1)) {
                    const template = getStatusTemplate(rider.name)
                    if (template) victim.addTag(template)
                    else console.warn(`[combat] ${weapon.name}: onHitStatus '${rider.name}' is not a registered status`)
                }
            }
            if (dealt > 0 && weapon?.splash && !opts.splashed) {
                const radius = weapon.splash.radius ?? 1
                const mult = weapon.splash.mult ?? 0.5
                const cx = victim.x, cy = victim.y
                playBurst(cx, cy, { radius: radius + 0.5, color: weapon.damageColor ?? 0xffffff })
                for (const other of [...tm.entities]) {
                    if (other === victim || other === attacker || !other.sprite) continue
                    if (other.type !== 'enemy' && other.type !== 'hero') continue
                    if (other.healthPoints <= 0) continue
                    if (Math.max(Math.abs(other.x - cx), Math.abs(other.y - cy)) > radius) continue
                    // Through Dungeon so the same-team guard applies: a Warrior's
                    // splash never catches the hero's own allies.
                    dungeon.attackEntity(attacker, other, weapon, { skipFx: true, splashed: true, damageMult: mult })
                }
            }


            // On-damaged passives (Thorns/Retaliation) — a separate hook from the
            // Counter tag, so an always-on thorns passive doesn't collide with the
            // active Counterstroke/Reflect (which own the single Counter tag).
            if (dealt > 0 && victim.healthPoints > 0) victim.onDamaged?.(attacker, dealt)

            // Combat-feel reaction on a landed hit — flash + recoil for
            // survivors. The death path below plays its own fade instead.
            if (victim.healthPoints > 0) {
                playHitReaction(victim, { crit: isCrit, damageType, attacker })
            } else {
                dungeon.removeEntity(victim)
                attacker.onKill?.(victim)   // on-kill passives (Bloodthirst)
            }
        }

        // An ability that supplies its OWN impact visuals (e.g. Arrow Storm's
        // arrows falling from above) sets opts.skipFx to resolve the hit
        // immediately — no second projectile/swing flying in from the attacker,
        // which would read as a double attack. Hit feedback (numbers/flash) still
        // plays inside resolveAttack.
        if (opts.skipFx) { resolveAttack(); return }

        // Route to swing or projectile based on whether the weapon has a
        // ranged attackTile. If the weapon has a castType (e.g. spell
        // scrolls), play a cast pulse at the attacker first, then fire
        // the projectile.
        const isRanged = weapon.range() && weapon.attackTile
        // Launch sound, paired with the animation that is about to play: a
        // spell pulse for a cast, a bow for a shot, a blade for a swing.
        if (weapon.castType) audio.play('cast')
        else if (isRanged) audio.play('bow-shot')
        else audio.playPool('swing')
        if (isRanged) {
            if (weapon.castType) {
                playCast(attacker, {
                    type: weapon.castType,
                    delay,
                    onComplete: () => playProjectile(attacker, victim, weapon, { onComplete: resolveAttack })
                })
            } else if (weapon.drawType) {
                playDraw(attacker, victim, {
                    delay,
                    onComplete: () => playProjectile(attacker, victim, weapon, { onComplete: resolveAttack })
                })
            } else {
                playProjectile(attacker, victim, weapon, { onComplete: resolveAttack, delay })
            }
        } else {
            // Melee strike style: 'overhead' (Bash's raise-and-slam) or the
            // default horizontal swing. opts.strikeStyle is threaded from the
            // ability via dungeon.attackEntity.
            const playStrike = opts.strikeStyle === 'overhead' ? playOverheadStrike : playSwing
            playStrike(attacker, victim, weapon, { onComplete: resolveAttack, delay })
        }
    }
}

export default new Combat()
