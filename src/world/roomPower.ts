import { G } from '../game/state'
import type { RoomDef } from '../game/types'

/** One power state for the ceiling lights and their emergency replacements. */
export function roomPowerCut(room: RoomDef) {
  const s = G()
  if (room.noDynLight) return false // Deliberately dark storage rooms have no backup circuit.
  if (s.event?.kind === 'blackout') return true
  if (room.id === 'machinerie' && !(s.flags.power && s.flags.pw_lights)) return true

  const unstable = room.flicker || (s.zone === 1 && room.id === 'sas' && !s.flags.pressurized)
  // Damaged circuits still cut out periodically. Hold each outage for six
  // seconds instead of rapidly strobing; the gyro takes over for that duration.
  // Gameplay time freezes this cycle in pause, loading and cinematics.
  return !!unstable && s.playTime >= 8 && (s.playTime - 8) % 26 < 6
}
