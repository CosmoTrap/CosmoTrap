import { G } from '../game/state'
import type { RoomDef } from '../game/types'

/** One power state for the ceiling lights and their emergency replacements. */
export function roomPowerCut(room: RoomDef) {
  const s = G()
  if (room.noDynLight) return false // Deliberately dark storage rooms have no backup circuit.
  if (s.event?.kind === 'blackout') return true
  if (room.id === 'machinerie' && !(s.flags.power && s.flags.pw_lights)) return true

  const unstable = room.flicker || (s.zone === 1 && room.id === 'sas' && !s.flags.pressurized)
  // Sixteen seconds of backup lighting, then twenty seconds of normal power.
  // Extending the cycle preserves the normal interval between local outages.
  // Gameplay time freezes this cycle in pause, loading and cinematics.
  return !!unstable && s.playTime >= 8 && (s.playTime - 8) % 36 < 16
}
