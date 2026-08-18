import { defineStatus } from "./Status.js"

// Permanent trait tag behind the Fleet-footed passive: +1 MAX movement point.
// Bumps maxMovementPoints on apply (the canonical stat — refresh() derives the
// per-turn movementPoints from it) and reverts on cleanup, so granting/removing
// the passive is clean. No duration — managed by the Passive wrapper.

const FLEET_MP = 1

const fleetFooted = defineStatus({
    name: "Fleet-footed",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    initialize: function () {
        this.maxMovementPoints = (this.maxMovementPoints ?? 0) + FLEET_MP
    },
    cleanup: function () {
        this.maxMovementPoints = (this.maxMovementPoints ?? FLEET_MP) - FLEET_MP
    }
})

export default fleetFooted
