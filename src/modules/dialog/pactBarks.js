import speech from "../SpeechBubble.js"

// Pact dialog — the cosmic-being lines for the pact system (offer → sealed →
// broken), spoken as in-world speech bubbles rather than a menu screen. Themed
// by the being's advanced affinity: Light-aligned (light/holy/seraphic) court
// you with a boon; Void-aligned (void/demonic) bargain with a tithe. See
// documents/v3_cosmic_hierarchy_and_entities.md §9.

const OFFER = {
    light: "The first making is not finished. Lend Me your hands, and My light is yours.",
    holy: "Kneel, and be counted among the just. Keep faith, and carry My blessing.",
    seraphic: "I bow to no throne. Serve MY purpose, and my power becomes yours.",
    void: "All things end. Hasten the quiet with me — but the dark takes its due.",
    demonic: "Power now, mortal. The price comes later, as prices do. Do we bargain?",
}

const SEALED_BOON = "The pact is struck. Walk now in my light."
const SEALED_TITHE = "Sealed. I will collect what I am owed."

const BROKEN = [
    "You break faith?! Then know My wrath.",
    "A pact shattered — you will not survive the reckoning.",
]

// Speak the offer above the being (sets the terms; the player accepts by
// interacting again).
export function speakPactOffer(being) {
    speech.say(being, OFFER[being.pactAffinity] || "Make a pact with me, mortal.")
}

// Confirm a sealed pact — flavor differs for a tithe vs a pure boon.
export function speakPactSealed(being, isTithe) {
    speech.say(being, isTithe ? SEALED_TITHE : SEALED_BOON)
}

// The betrayal line when the player breaks the pact (the being turns hostile).
export function speakPactBroken(being) {
    speech.say(being, BROKEN[Math.floor(Math.random() * BROKEN.length)], { combat: true })
}

const REJECTED = [
    "So be it. The offer stands, should you find your resolve.",
    "Refuse, then. I am patient, mortal.",
    "As you wish. You know where to find me.",
]

// The line when the player declines the offer (the offer simply lapses; it can be
// heard again by interacting).
export function speakPactRejected(being) {
    speech.say(being, REJECTED[Math.floor(Math.random() * REJECTED.length)])
}
