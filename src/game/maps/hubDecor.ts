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
    atHub(room, 'workstation', 22, 6.93), atHub(room, 'workstation', 202, 6.93),
    atHub(room, 'nook', 135, 6.88), atHub(room, 'nookMeal', 315, 6.88),
    atHub(room, 'utilityBox', 158, 6.92, 1.15), atHub(room, 'extinguisher', 338, 6.9),
  ]
}

/** Floor 2's hub is the plant's technical node: cabinets, a repair bench and stores, no rest corner. */
export function hubDecorTechnical(room: RoomDef): Prop[] {
  return [
    atHub(room, 'workstation', 202, 6.93),
    atHub(room, 'elecCabinet', 20, 6.9), atHub(room, 'elecCabinet', 70, 6.9),
    atHub(room, 'workTable', 135, 6.92),
    atHub(room, 'multimeter', 128, 6.65, 0.87), atHub(room, 'circuit', 135, 6.6, 0.87), atHub(room, 'screwdrivers', 142, 6.65, 0.87),
    atHub(room, 'metalStool', 135, 4.95),
    atHub(room, 'storageShelf', 160, 6.9),
    atHub(room, 'crateSmall', 160, 6.65, 1.12), atHub(room, 'cleanerCan', 160, 6.65, 0.63), atHub(room, 'lubricant', 160, 6.65, 0.15),
    atHub(room, 'containerLow', 225, 6.92), atHub(room, 'toolbox', 225, 6.6, 0.43),
    atHub(room, 'elecBox', 250, 6.9), atHub(room, 'powerBox', 292, 6.92),
    atHub(room, 'gasBottle', 315, 6.45), atHub(room, 'gasBottle', 322, 6.45),
    atHub(room, 'extinguisher', 340, 6.9), atHub(room, 'fireAlarm', 112, 6.95, 1.5),
  ]
}
