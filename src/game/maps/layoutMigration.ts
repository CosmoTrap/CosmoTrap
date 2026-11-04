import type { SaveFile } from '../state'
import type { GridMap } from '../types'
import { zone1 } from './zone1'
import { zone2 } from './zone2'

export const LAYOUT_VERSION = 3

// Rectangles before the station was split into four wings. Room contents retain
// their local coordinates, so a saved position inside a room can follow it.
const previousRooms: Record<number, Record<string, [number, number, number, number]>> = {
  1: { dortoir: [1, 1, 6, 3], refectoire: [8, 1, 22, 3], reserve: [1, 7, 6, 9], infirmerie: [8, 7, 16, 9], sas: [18, 7, 22, 9] },
  2: { labo: [1, 1, 7, 3], serre: [9, 1, 15, 3], disjoncteur: [17, 1, 23, 3], machinerie: [1, 7, 15, 10], amarrage: [17, 7, 23, 10] },
}

function onFloor(map: GridMap, x: number, z: number) {
  return ['.', 'D'].includes(map.grid[Math.floor(z / 2)]?.[Math.floor(x / 2)] ?? ' ')
}

/** The lift now stands at the hub's centre: a saved position there moves just outside it. */
function outsideLift(map: GridMap, pos: [number, number, number]): [number, number, number] {
  const [x0, z0, x1, z1] = map.rooms.find((r) => r.id === 'couloir')!.rect
  const cx = x0 + x1 + 1, cz = z0 + z1 + 1
  const dx = pos[0] - cx, dz = pos[2] - cz, r = Math.hypot(dx, dz)
  if (r >= 2.2) return pos
  return r < 0.01 ? [cx + 2.6, 0, cz] : [cx + dx / r * 2.6, 0, cz + dz / r * 2.6]
}

/** Migrate geometry only; inventory, locks, puzzles and elapsed time are kept. */
export function migrateStationSave(saved: SaveFile, version: number): SaveFile {
  if (version >= LAYOUT_VERSION) return saved
  const out = { ...saved, layoutVersion: LAYOUT_VERSION, propPositions: { ...saved.propPositions } }
  if (version >= 2) {
    if ((saved.zone === 1 || saved.zone === 2) && saved.pos?.every(Number.isFinite)) out.pos = outsideLift(saved.zone === 1 ? zone1 : zone2, saved.pos)
    return out
  }
  if (saved.zone === 1 || saved.zone === 2) {
    const map = saved.zone === 1 ? zone1 : zone2
    const hub = map.rooms.find((r) => r.id === 'couloir')!
    let pos: [number, number, number] = [hub.rect[0] + hub.rect[2] + 1, 0, hub.rect[1] + hub.rect[3] + 1]
    const old = saved.pos
    if (old?.every(Number.isFinite)) {
      const tx = Math.floor(old[0] / 2), tz = Math.floor(old[2] / 2)
      const entry = Object.entries(previousRooms[saved.zone]).find(([, r]) => tx >= r[0] && tx <= r[2] && tz >= r[1] && tz <= r[3])
      if (entry) {
        const room = map.rooms.find((r) => r.id === entry[0])!
        const x = old[0] + (room.rect[0] - entry[1][0]) * 2
        const z = old[2] + (room.rect[1] - entry[1][1]) * 2
        if (onFloor(map, x, z)) pos = [x, 0, z]
      }
    }
    out.pos = outsideLift(map, pos)
  }
  const cart = out.propPositions['serre-cart']
  if (cart) {
    const moved: [number, number, number] = [cart[0] + 18, cart[1], cart[2] + 8]
    if (moved.every(Number.isFinite) && onFloor(zone2, moved[0], moved[2])) out.propPositions['serre-cart'] = moved
    else delete out.propPositions['serre-cart'] // Recreate at its new doorway.
  }
  // Old corridor exploration and ghost samples refer to a different floor plan.
  out.explored = saved.explored.filter((key) => !/^[12]:/.test(key))
  out.track = []
  for (let i = 0; i + 3 < saved.track.length; i += 4) {
    if (saved.track[i + 1] > 2) out.track.push(...saved.track.slice(i, i + 4))
  }
  return out
}
