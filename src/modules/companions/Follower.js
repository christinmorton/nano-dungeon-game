import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import BaseEnemy from "../enemies/BaseEnemy.js"
import Stats from "../classes/Stats.js"

// Follower — the reusable companion entity for summoned-from-nothing allies (a
// pet/summon). An ally that trails a leader and fights the leader's enemies.
//
// It extends BaseEnemy to REUSE that machinery (stats, combat, status tags, the
// archetype-dispatching turn(), HP-bar / status-badge visuals). It is NOT an
// enemy: team is "player" and type is "ally". The shared ally behaviors —
// ally-paced isEngaged, suppressed vision cone, no-loot/party-leaving death —
// now live on BaseEnemy (keyed on team/archetype), so a Follower and a tamed
// beast (convertToAlly) behave identically; this class just sets the fields and
// a default beast stat sheet.
//
// Created directly by the debug SummonAlly ability and the PartyTestLevel today;
// later the `summon` universal verb composes it.

export default class Follower extends BaseEnemy {
    constructor(x, y, opts = {}) {
        super(x, y)

        this.name = opts.name || "Spectral Ally"
        this.type = "ally"          // not "enemy" — keeps enemy-only systems off it
        this.team = "player"        // the targeting seam reads this
        // BaseEnemy.turn() dispatches to archetypes[this.archetype]. Default 'ally'
        // (the bodyguard brain); a summon can pass another for a different kind of
        // construct — e.g. 'sentinel' (a stationary turret). This is the framework
        // that lets every core element conjure its own familiar/golem/turret.
        this.archetype = opts.archetype || "ally"

        // The entity this follower trails and fights for. owner is who summoned
        // it (for future upkeep/ownership); leader is who it physically follows
        // — the same hero today, but kept separate for retinues later.
        this.owner = opts.owner || opts.leader || null
        this.leader = opts.leader || opts.owner || null

        // Which summon BOND TYPE this follower is (encyclopedia §6.5 taxonomy):
        // 'pet' (tamed, containable), 'construct' (conjured, mindless), 'spirit'
        // (pact), or null for a plain ally. Drives containability + rules.
        this.bondType = opts.bondType || null

        // Deterministic stat sheet — no archetype roll (the ally archetype has
        // no statTemplate). A capable bruiser: STR drives attackPower (its hit
        // damage), so it's set high enough that each throttled swing lands with
        // weight rather than chipping for ~10.
        this.stats = Stats.from(opts.stats || {
            STR: 14, DEX: 11, CON: 12, SPD: 12, INT: 5, Magic: 5
        })
        this.maxHealthPoints = opts.hp || 40
        this.healthPoints = this.maxHealthPoints

        // 2 movement points to match the hero's per-round movement, so the ally
        // keeps pace when following instead of losing a tile each round. The
        // ally archetype spends them one step per frame across the round.
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = { movementPoints: 2, actionPoints: 1, healthPoints: 0 }

        // Built-in natural weapon (the virtual stub from BaseEnemy) — damage
        // scales off attackPower (STR), like a primitive enemy's claws, and
        // never drops because it's virtual. Give the stub a small damage roll on
        // top of STR (the bare stub rolls 0), so a hit lands for ~STR+roll
        // instead of just STR — enough weight that kills don't drag.
        this.weapon.name = opts.weaponName || "spectral fangs"
        this.weapon.damage = () => 2 + Math.floor(Math.random() * 4) // 2–5

        // PNG art (e.g. a summoned Spirit Wolf using the wolf sprite). Falls back
        // to the Kenney tile when no art is passed.
        if (opts.art) this.art = opts.art
        this.tile = opts.tile ?? 323
        // Friendly tint so a debug ally reads as distinct from a monster on the
        // field (an allegiance cue, not elemental empowerment).
        this.tint = opts.tint ?? 0x88ccff

        // Construct params — extra per-brain config (e.g. the sentinel's shootRange
        // / shootDamage / shootProjectile). Copied verbatim onto the entity so the
        // archetype brain can read them. Element variants differ only here + in the
        // identity fields above (name/tint/art/stats).
        if (opts.constructParams) Object.assign(this, opts.constructParams)

        dungeon.initializeEntity(this)
        tm.addEntity(this)

        // Join the leader's party roster, if it keeps one (the hero does). This
        // is what makes several followers a *party* rather than independent pets
        // — the group is trackable for HUD / formation / commands later. (Leaving
        // the roster on death is handled in BaseEnemy.onDestroy for any ally.)
        if (this.leader && Array.isArray(this.leader.party)) {
            this.leader.party.push(this)
        }
    }
}
