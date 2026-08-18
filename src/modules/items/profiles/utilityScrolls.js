// Utility scrolls (§13e) — non-combat reads. SYSTEM PENDING (recall/hub,
// rune-bind, timed Shield). Data only; #47.
const R = (name) => ({ sheet: "32rogues-items", name })

export default {
    scrollOfRecall: { itemClass: 'Consumable', name: "Scroll of Recall", description: "Tears a way back to where you started — or the surface, if you've earned one.", tile: 768, art: R("scroll"), droppable: false, effect: "return to floor entry / hub" },
    scrollOfEnchant: { itemClass: 'Consumable', name: "Scroll of Enchant", description: "Coaxes a loose rune to take, and hold.", tile: 768, art: R("scroll2"), droppable: false, effect: "bind a Rune into equipped gear" },
    scrollOfProtection: { itemClass: 'Consumable', name: "Scroll of Protection", description: "A read-aloud ward that turns the next few blows.", tile: 768, art: R("page"), droppable: false, effect: "temporary barrier / Shield" },
}
