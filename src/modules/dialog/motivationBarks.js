// Motivation-flavored hero barks (documents/v3_hero_roster_and_account_progression.md §6).
// A hero's STRUCTURED backstory.motivation colors their voice — the FIRST consumer of
// the motivation field, and the per-actor dialog content the speech system flagged as
// next. Pure data + selector (no Phaser, headless-testable): heroReactions.js PREFERS a
// motivation line over its generic one when the hero has a motivation set. Null-safe —
// a hero with no motivation gets the generic line, so this is zero-regression until
// Phase 6 sets hero.motivation from the run's chosen Character.
//
// Occasions mirror the existing hero-reaction hooks (heroReactions.js): `loot` (found
// notable gear), `lowHp` (dropped to low health). `idle` lines are authored now for a
// future hero idle-chatter hook (data ready; not yet wired). Motivation keys mirror
// data/character.js MOTIVATIONS.

const LINES = {
    vengeance: {
        loot:  ["This brings the reckoning closer.", "A fine tool for what I owe them.", "One more step toward payback."],
        lowHp: ["Not — before I've had my due!", "I will NOT fall with the debt unpaid!", "They don't get to end me. Not yet."],
        idle:  ["They'll answer for it. Every one.", "I haven't forgotten. I never will.", "Down here, and closer to them."],
    },
    glory: {
        loot:  ["Now THIS belongs in the songs.", "A hero's prize!", "They'll speak of this find for years."],
        lowHp: ["No — the legend can't end here!", "Not the ending they'll sing about!", "A hero doesn't fall like this!"],
        idle:  ["They'll write ballads of this delve.", "Glory waits in the deep.", "My name will outlive these walls."],
    },
    redemption: {
        loot:  ["Perhaps this helps me set things right.", "A means to make amends.", "I'll put this to better use than I once would have."],
        lowHp: ["I haven't atoned yet — not yet!", "Let me make it right first!", "My debts aren't paid. I can't go."],
        idle:  ["One good deed at a time.", "I can still make this right.", "The past follows, but it doesn't lead."],
    },
    greed: {
        loot:  ["Mine. All mine.", "Now we're talking — shiny and mine.", "Cha-ching. Keep it coming."],
        lowHp: ["I'm not dying broke!", "You'll have to pry it from my cold hands!", "Not while there's loot left down here!"],
        idle:  ["Somewhere down here, a fortune waits.", "Every floor's another payday.", "Gold. It's always about the gold."],
    },
    duty: {
        loot:  ["This will serve the mission.", "Requisitioned. It has a purpose now.", "Good. The task needs every advantage."],
        lowHp: ["The mission isn't finished!", "I hold the line — I always hold!", "Duty doesn't end here. Neither do I."],
        idle:  ["Orders are orders. I see it through.", "The Hall is counting on me.", "One does what one must."],
    },
    curiosity: {
        loot:  ["Fascinating — what does THIS do?", "Ooh, I've never seen one of these.", "The deep keeps such secrets."],
        lowHp: ["I'm not done learning yet!", "So much still unseen — not now!", "The mystery outlives me? Never!"],
        idle:  ["I wonder what's on the next floor.", "Every shadow's a question.", "So much still to uncover down here."],
    },
    survival: {
        loot:  ["This'll help me last another floor.", "Anything that keeps me breathing.", "Good. I intend to walk out of here."],
        lowHp: ["Not like this — I keep going!", "Still breathing. Still moving.", "One more step. Just one more."],
        idle:  ["Stay sharp. Stay alive.", "The ones who rush are the ones who die.", "Careful gets you home."],
    },
    faith: {
        loot:  ["A gift from the Light.", "Blessed be — the dawn provides.", "This was left for me. I'm sure of it."],
        lowHp: ["The Light isn't finished with me!", "Carry me, dawn — not yet!", "I have faith. I will not fall."],
        idle:  ["The Light walks with me, even here.", "Into the dark, I carry the dawn.", "I am not alone down here."],
    },
}

// A motivation-flavored line for an occasion, or null when the motivation is unset /
// unknown or the occasion has no pool (the caller then falls back to a generic line).
export function motivationLine(motivation, occasion) {
    const pool = motivation && LINES[motivation] && LINES[motivation][occasion]
    if (!pool || !pool.length) return null
    return pool[Math.floor(Math.random() * pool.length)]
}

// Exposed for tests/tools (which motivations + occasions are authored).
export const MOTIVATION_BARK_OCCASIONS = ["loot", "lowHp", "idle"]
export { LINES as MOTIVATION_LINES }
