// Party / companion-care helpers (the player-side group around the hero).

// The heal target for a consumed potion: the hero itself, unless the hero is
// already at full HP and a party member is wounded — then the dose goes to the
// most-wounded ally instead of being wasted. This lets a non-healer (e.g. the
// Elf tamer) maintain a pet by drinking a potion while topped off, with no extra
// targeting UI: heal yourself when you're hurt, your companion when you're not.
export function bestHealTarget(hero) {
    const wounded = (hero.party || []).filter(
        a => a.sprite && a.healthPoints < a.maxHealthPoints
    )
    if (hero.healthPoints < hero.maxHealthPoints || wounded.length === 0) return hero
    return wounded.reduce((worst, a) =>
        (a.healthPoints / a.maxHealthPoints) < (worst.healthPoints / worst.maxHealthPoints)
            ? a : worst
    )
}
