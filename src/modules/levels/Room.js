// Room — a rectangular region inside a level.
//
// Rooms are returned by Level.getRegions() and consumed by the spawn pass
// (BSPLevel.populate). All rooms share the same geometry and methods;
// what differs between a treasure room and a combat room is the `kind`
// field plus the spawn table that reads from it. See feedback memory
// "Kind field over hierarchy" — no Room subclasses.
//
// `kind` and `tags` are part of the contract; `name` and `onEnter` /
// `onExit` are optional per-instance hooks set during populate or by
// the kind handler. Hero room transitions fire onExit on the old room
// then onEnter on the new (see Dungeon.updateHeroRoom).

export default class Room {
    constructor(x, y, w, h, kind = null) {
        this.x = x
        this.y = y
        this.w = w
        this.h = h
        this.kind = kind
        this.tags = []
        this.name = null
        this.onEnter = null
        this.onExit = null
        // Set true by an active Tent (rest room): while true, no enemy may
        // step into this room (Dungeon.stepEntityTo / WorldQueries.gridForEntity).
        this.restSafe = false
        // Set true by a "pacified" room TYPE (e.g. a neutral village): a
        // permanent no-enemies sanctuary enforced the same way as restSafe, but
        // independent of the player's rest-camp/tent mechanic — no make-camp,
        // no heal, just "enemies don't path in or through here".
        this.pacified = false
        // For kind === "settlement": { species, form } read by the settlement
        // generator (spawnSettlement) to pick the band theme + scale + layout.
        // See documents/v3_enemy_settlements.md.
        this.settlement = null
        // Optional floor re-theme applied in MapState.bind. "outdoor" repaints
        // this room's floor as dirt/grass so a fortress/outpost reads as an
        // open-air war-camp rather than dungeon interior. Set at room-kind
        // assignment (before the tilemap is built) so it persists across
        // revisits with no runtime tile editing.
        this.floorTheme = null
        // Optional per-room override of the hero's fog-of-war light radius
        // (FogOfWar reads currentRoom.lightRadius). null = use the fog default
        // (8). A "darkness" settlement (the void theme) sets a small value (e.g.
        // 3) via its darkness-source component so the hero is half-blind inside
        // it. Like restSafe, it lives on the Room and is re-applied per floor
        // rather than persisted. See documents/v3_darkness_settlements.md.
        this.lightRadius = null
        // The darkness-source entity (a VoidRift) that owns this room's gloom,
        // set in VoidRift.claimRoom. FogOfWar reads it so the hero's light
        // shrinks further the closer they get (the rift "absorbs" the light),
        // and it's the beacon/cleanse anchor. Cleared when the rift is destroyed.
        this.darkSource = null
        // Void-settlement escalation state (the captain channel → rift respawn
        // loop — see documents/v3_darkness_settlements.md). darkFaction marks the
        // room as a void settlement (persists after the rift dies, unlike
        // darkSource); darkRadius remembers the rift's light radius for respawns;
        // darkTier is the current escalation level (scales the buff); the
        // respawn fields are the configurable budget for how many times a
        // channeling captain may bring the rift back.
        this.darkFaction = false
        this.darkRadius = null
        this.darkTier = 0
        this.darkRespawnsLeft = 0
        this.darkRespawnsInfinite = false
    }

    contains(x, y) {
        return x >= this.x && x < this.x + this.w
            && y >= this.y && y < this.y + this.h
    }
}
