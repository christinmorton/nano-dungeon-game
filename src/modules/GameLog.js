// In-game message log. Most recent message first; capped at 50 entries
// so the pause Log scene has useful scrollback without unbounded
// growth. The cap was 8 when the HUD log existed (#44 removed the HUD
// log; the pause Log scene from a later pass replaced it).
//
// Singleton lives outside Dungeon because the log is presentation
// concern, not map/entity state. Dungeon.cleanup() calls clear() on
// floor transitions to drop stale messages.

class GameLog {
    constructor() {
        this.msgs = []
    }

    log(text) {
        this.msgs.unshift(text)
        this.msgs = this.msgs.slice(0, 50)
    }

    clear() {
        this.msgs = []
    }
}

export default new GameLog()
