import { tileCenter } from '../game/maps'
import { G, timeLimit } from '../game/state'
import type { RoomDef } from '../game/types'

/** The meteor shower hits the base when the timer ends: the alarm sounds this long before (s). */
const METEOR_ALARM = 5 * 60

/**
 * The station's alarm, independent of the electrical circuit: the lights can stay on while it sounds.
 * It sounds while the airlock is depressurized (floor 1), while gas leaks and drains the oxygen (floor 2),
 * during any micro-leak, and in the last minutes before the meteors hit.
 */
export function alarmOn(zone = G().zone) {
  const s = G()
  if (s.map === 'base' || zone >= 4) return false
  if (zone === 1 && !s.flags.pressurized) return true
  if (zone === 2 && !s.flags.steamFixed) return true
  if (s.event?.kind === 'leak' && s.playTime < s.event.until) return true
  return timeLimit() - (s.playTime + s.penalty) <= METEOR_ALARM
}

export function blackoutActive() {
  const s = G()
  return s.zone < 4 && s.event?.kind === 'blackout' && s.playTime < s.event.until
}

/** The whole second station deck is on emergency power until the breaker is repaired. */
export function stationPowerDown(zone = G().zone) {
  return G().map === 'station' && zone === 2 && !G().flags.power
}

/**
 * The mains are down: during a temporary outage, and on floor 2 from the moment you arrive
 * until its breaker is repaired. The ceiling lights go out and only the beacons remain.
 */
export function mainsOut(zone = G().zone) {
  return blackoutActive() || stationPowerDown(zone)
}

/** Where the beacons' mirrors are in their turn; the lift's red light swells to the same beat. */
export const beaconAngle = () => G().playTime * 1.65

/** One power state for the ceiling lights and the service panels. */
export function roomPowerCut(room: RoomDef, zone = G().zone) {
  const s = G()
  if (s.map === 'base') return blackoutActive() || room.id !== 'habitat' && !s.lunar.solved.includes('loads')
  if (stationPowerDown(zone)) return true
  if (room.noDynLight) return false // Deliberately dark storage rooms have no backup circuit.
  if (mainsOut(zone)) return true
  return zone === 2 && room.id === 'machinerie' && !(s.flags.power && s.flags.pw_lights)
}

/**
 * The beacons have their own circuit. Two moods: during an alarm they turn with the white lights on;
 * in a power cut they are the only light left.
 */
export function beaconsOn(room: RoomDef, zone = G().zone) {
  return alarmOn(zone) || mainsOut(zone) || roomPowerCut(room, zone)
}

/** The lift's light follows the hub's beacons: red while they turn, white otherwise. */
export function liftAlert(zone = G().zone) {
  return alarmOn(zone) || mainsOut(zone)
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
