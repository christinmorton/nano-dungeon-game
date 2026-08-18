// NPC voice: lines spoken by non-hostile characters the player talks to.
// Today that's the shopkeeper; oracle / captive / quest-giver NPCs will add
// their own pools here as those rooms land.
//
// Unlike environmentBarks (which speaks through world SpeechBubbles), these
// lines surface as text inside the NPC's screen — the world is paused behind
// the shop overlay, so a world bubble would be hidden. The shop scene reads
// shopkeeperLine(kind) and renders it as the merchant's spoken line.

const SHOPKEEPER_LINES = {
    greet: [
        "Welcome, traveler. Coin for wares, wares for coin.",
        "Ah, a customer! Browse, buy, sell — no haggling.",
        "Step in. The dungeon's cheaper than my prices, but only just.",
    ],
    backAgain: [
        "Back so soon? Take another look.",
        "Changed your mind? Good.",
    ],
    buy: [
        "A fine choice.",
        "Use it well.",
        "Sold. Try not to die with it.",
    ],
    sell: [
        "I'll find a use for it.",
        "Coin's coin. Pleasure doing business.",
        "Hmph. It'll fetch something.",
    ],
    cantAfford: [
        "Come back when your purse is heavier.",
        "That's beyond your coin, friend.",
    ],
    full: [
        "Your pack's full. Make room first.",
    ],
    leave: [
        "Safe travels. Mind the dark.",
        "Off you go. Spend it on something useful.",
    ],
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)]
}

// kind: "greet" | "backAgain" | "buy" | "sell" | "cantAfford" | "full" | "leave"
export function shopkeeperLine(kind) {
    const pool = SHOPKEEPER_LINES[kind] || SHOPKEEPER_LINES.greet
    return pick(pool)
}
