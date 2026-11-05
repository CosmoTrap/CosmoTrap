import { tileCenter } from '../game/maps'
import { G } from '../game/state'
import type { RoomDef } from '../game/types'

/**
 * The alarm sounds on floor 1 only, until the lift unlocks with the last puzzle of that floor.
 * Until then the lights are out and the beacons turn; afterwards everything is back to normal.
 */
export function alarmOn(zone = G().zone) {
  return zone === 1 && !G().flags.pressurized
}

/** One power state for the ceiling lights and the service panels. */
export function roomPowerCut(room: RoomDef, zone = G().zone) {
  const s = G()
  if (room.noDynLight) return false // Deliberately dark storage rooms have no backup circuit.
  if (s.event?.kind === 'blackout') return true
  if (alarmOn(zone)) return true
  return room.id === 'machinerie' && !(s.flags.power && s.flags.pw_lights)
}

/** World [x, z] of each ceiling lamp of a room, along its middle line (a ring in a round room). */
export function lampPositions(room: RoomDef): [number, number][] {
  const [x0, z0, x1, z1] = room.rect
  if (room.shape === 'round') return Array.from({ length: 4 }, (_, i) => {
    const a = i * Math.PI / 2
    return tileCenter((x0 + x1) / 2 + Math.sin(a) * 1.6, (z0 + z1) / 2 + Math.cos(a) * 1.6)
  })
  const wide = x1 - x0 >= z1 - z0
  const out: [number, number][] = []
  for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
    const k = wide ? tx - x0 : tz - z0
    const mid = wide ? Math.floor((z0 + z1) / 2) === tz : Math.floor((x0 + x1) / 2) === tx
    if (mid && k % 2 === 0) out.push(tileCenter(tx, tz))
  }
  return out
}
