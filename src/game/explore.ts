import { gridMap, TILE } from './maps'
import { live } from './state'
import type { ZoneId } from './types'

// Brouillard de la mini-carte : on révèle la pièce où l'on entre et les cases autour du joueur.

export const CELL4 = 4 // taille d'une case de la carte en zone 4 (m)
let last = ''

export function reveal(zone: ZoneId, x: number, z: number) {
  if (zone === 4) {
    const cx = Math.floor(x / CELL4)
    const cz = Math.floor(z / CELL4)
    const k = `${cx},${cz}`
    if (k === last) return
    last = k
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dz * dz <= 16) live.explored.add(`4:${cx + dx},${cz + dz}`)
    return
  }
  const map = gridMap(zone)!
  const tx = Math.floor(x / TILE)
  const tz = Math.floor(z / TILE)
  const k = `${zone}:${tx},${tz}`
  if (k === last) return
  last = k
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) live.explored.add(`${zone}:${tx + dx},${tz + dz}`)
  const room = map.rooms.find((r) => tx >= r.rect[0] && tx <= r.rect[2] && tz >= r.rect[1] && tz <= r.rect[3])
  if (!room) return
  const [x0, z0, x1, z1] = room.rect
  for (let j = z0 - 1; j <= z1 + 1; j++) for (let i = x0 - 1; i <= x1 + 1; i++) live.explored.add(`${zone}:${i},${j}`)
}

export function isExplored(zone: ZoneId, x: number, z: number) {
  if (zone === 4) return live.explored.has(`4:${Math.floor(x / CELL4)},${Math.floor(z / CELL4)}`)
  return live.explored.has(`${zone}:${Math.floor(x / TILE)},${Math.floor(z / TILE)}`)
}

export function loadExplored(list: string[] | undefined) {
  live.explored = new Set(list ?? [])
  last = ''
}
