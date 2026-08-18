class TurnManager {
    constructor() {
        this.interval = 150;
        this.entities = new Set();
        this.lastCall = Date.now();
        // Monotonic round counter — incremented on each refresh (start of
        // a new round). Captain order timing reads this so "execute on
        // next turn" doesn't depend on entity iteration order.
        this.tickCount = 0;
    }
    addEntity (entity) { this.entities.add(entity)}

    removeEntity (entity) { this.entities.delete(entity)}

    refresh () {
        this.tickCount += 1
        this.entities.forEach(e => e.refresh())
    }

    turn () {
        // State-aware throttle (folds in known-issue #43): non-engaged
        // entities (IDLE/PATROLLING enemies, the hero's UI tick, anything
        // without an isEngaged hook) drain every frame with no wait. Only
        // engaged enemies (alerted/searching/engaging/fleeing) gate on the
        // 150ms interval, and at most one of them acts per interval so the
        // player sees combat resolve one swing at a time.
        const now = Date.now()
        const throttled = now <= this.lastCall + this.interval
        let engagedActed = false

        for (let e of this.entities) {
            if (e.over()) continue

            // A pet (actsImmediately) bypasses the engaged throttle so it resolves
            // PROMPTLY (every frame, tween-paced) right alongside the player, instead
            // of waiting its 150ms slot behind the enemies — which (with Set
            // insertion order) is why it used to act dead last. Enemies stay
            // throttled.
            const isCombatActive = !e.actsImmediately
                && typeof e.isEngaged === "function" && e.isEngaged()

            if (isCombatActive) {
                if (throttled || engagedActed) continue
                e.turn()
                this.lastCall = Date.now()
                engagedActed = true
            } else {
                e.turn()
            }
        }
    }
    over () { return [...this.entities].every(e => e.over()) }

    cleanup () {
        this.entities.forEach(e => {
            if (e.sprite) e.sprite.destroy()
            if (e.UIsprite) e.UIsprite.destroy()
        })
        this.entities = new Set()
    }
}

export default new TurnManager()