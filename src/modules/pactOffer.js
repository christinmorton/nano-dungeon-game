import gameLog from "./GameLog.js"
import { speakPactOffer, speakPactSealed, speakPactRejected } from "./dialog/pactBarks.js"
import { PACT_IS_TITHE } from "../data/cosmicBeings.js"

// Shared in-world pact flow behind BOTH entry vectors:
//   Model A — a cosmic being offering DIRECTLY (CosmicBeing, spawned neutral).
//   Model B — a neutral BROKER NPC (components/PactGiver).
// Three steps mapped to keys: interact (F) HEARS the offer, accept (Y) SEALS it,
// decline (N) REFUSES it. The offerer supplies `pactAffinity` + `name` and carries
// the `pactPending`/`pactSealed` flags. See documents/v3_cosmic_hierarchy_and_entities.md §9.

// HEAR (F/interact): arm the offer + speak its terms. Idempotent — hearing again
// just re-shows it.
export function pactOffer(offerer) {
    offerer.pactPending = true
    speakPactOffer(offerer)
    gameLog.log(`${offerer.name} offers a pact — the ${offerer.pactAffinity} attunement. [Y] accept · [N] reject.`)
}

// ACCEPT (Y): seal a pending offer. `onAccept` binds the affinity on the hero and
// aligns/spawns the bound being, returning the acceptPact result.
export function pactSeal(offerer, onAccept) {
    if (!offerer.pactPending) return
    const r = onAccept()
    if (r?.ok) {
        offerer.pactSealed = true
        offerer.pactPending = false
        speakPactSealed(offerer, PACT_IS_TITHE.has(offerer.pactAffinity))
        gameLog.log(`Pact sealed — bound to ${r.name}.`)
    } else {
        gameLog.log(`The pact cannot be sealed${r?.reason ? ` (${r.reason})` : ""}.`)
    }
}

// DECLINE (N): the offer lapses, but can be reheard by interacting again. Shared
// by both offerer vectors.
export function pactReject(offerer) {
    if (!offerer.pactPending) return
    offerer.pactPending = false
    speakPactRejected(offerer)
    gameLog.log(`${offerer.name}'s offer is refused — for now.`)
}
