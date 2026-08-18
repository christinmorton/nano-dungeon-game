// Environment voice: dungeon props reacting to the player. A shrine speaks
// a blessing when prayed at, a cursed gem whispers while it clings to you, a
// chest reacts as it's opened, a door creaks shut. Pure flavor on the
// existing speech-bubble system.
//
// Props that still have a sprite when they speak (shrine, door) speak as
// themselves. Things with no sprite at that moment — a gem already in your
// pack, a chest consumed on opening — borrow the hero's bubble, wearing the
// item's face and name via the portraitTile/name opts.

import speech from "../SpeechBubble.js"

const SHRINE_LINES = ["Rest, traveler.", "Your wounds are mended.", "Go forth renewed.", "The light restores you."]
const CURSED_WHISPERS = ["...mine...", "...you cannot let go...", "...closer...", "...give in...", "*whispers*"]
const CHEST_LINES = ["*creaks open*", "*the hinges groan*", "*the lid swings back*"]
const DOOR_LINES = ["*creak*", "*the hinges groan*", "*thud*"]

function pick(list) {
    return list[Math.floor(Math.random() * list.length)]
}

export function shrineSpeaks(shrine) {
    if (!shrine) return
    speech.say(shrine, pick(SHRINE_LINES))
}

export function cursedGemWhispers(hero, gem) {
    if (!hero || !gem) return
    speech.say(hero, pick(CURSED_WHISPERS), { portraitTile: gem.tile, name: gem.name })
}

export function chestReveals(hero, chest) {
    if (!hero || !chest) return
    speech.say(hero, pick(CHEST_LINES), { portraitTile: chest.tile, name: chest.name })
}

export function doorCreaks(door) {
    if (!door) return
    speech.say(door, pick(DOOR_LINES))
}
