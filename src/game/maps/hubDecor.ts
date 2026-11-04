import type { Ent, Prop, RoomDef } from '../types'

/** Place furniture against the circular wall, facing the room's centre. */
export function atHub(room: RoomDef, model: string, degrees: number, radius: number, y = 0): Prop {
  const a = degrees * Math.PI / 180
  const [x0, z0, x1, z1] = room.rect
  return { model, pos: [x0 + x1 + 1 + Math.sin(a) * radius, y, z0 + z1 + 1 + Math.cos(a) * radius], rot: a + Math.PI }
}

/** Lift controls: the tablet on its pillar inside the cab, and the closed door seen from the hub. */
export function liftEnts(room: RoomDef): Ent[] {
  const [x0, z0, x1, z1] = room.rect
  const cx = x0 + x1 + 1, cz = z0 + z1 + 1
  return [
    { id: 'lift', model: 'lift', pos: [cx - 1, 0, cz], rot: Math.PI / 2, dot: 'exit', hit: [0.9, 2.3, 0.3] },
    { id: 'liftDoor', model: 'lift', pos: [cx + 1.8, 0, cz], rot: Math.PI / 2, hit: [1.5, 2.3, 0.3] },
  ]
}

export function hubDecor(room: RoomDef): Prop[] {
  return [
    atHub(room, 'console', 22, 6.65), atHub(room, 'screen', 22, 6.94, 1.75),
    atHub(room, 'console', 202, 6.65), atHub(room, 'screen', 202, 6.94, 1.75),
    atHub(room, 'crewSeats', 135, 6.25), atHub(room, 'crewSeats', 315, 6.25),
    atHub(room, 'plant', 68, 6.05), atHub(room, 'plant', 248, 6.05),
    atHub(room, 'utilityBox', 158, 6.92, 1.15), atHub(room, 'extinguisher', 338, 6.9),
  ]
}
