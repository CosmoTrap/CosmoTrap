import type { Ent, GridMap, Wall, ZoneId } from '../types'
import { zone1 } from './zone1'
import { zone2 } from './zone2'
import { zone3 } from './zone3'
import { zone4Ents, zone4Props, zone4Spawn } from './zone4'

export const TILE = 2
export const CEIL = 2.8
export const GRID_MAPS: Record<1 | 2 | 3, GridMap> = { 1: zone1, 2: zone2, 3: zone3 }

export function gridMap(zone: ZoneId): GridMap | null {
  return zone === 4 ? null : GRID_MAPS[zone]
}

export function cellAt(map: GridMap, tx: number, tz: number) {
  if (tz < 0 || tz >= map.grid.length) return ' '
  const row = map.grid[tz]
  if (tx < 0 || tx >= row.length) return ' '
  return row[tx]
}

export const isSolid = (c: string) => c === '#' || c === 'W' || c === 'V' || c === ' '
export const isFloor = (c: string) => c === '.' || c === 'D'

export const tileCenter = (tx: number, tz: number): [number, number] => [tx * TILE + TILE / 2, tz * TILE + TILE / 2]

/** normale du mur (vers l'intérieur de la pièce) */
export const WALL_DIR: Record<Wall, [number, number]> = {
  N: [0, 1],
  S: [0, -1],
  E: [-1, 0],
  W: [1, 0],
}
/** rotation Y pour qu'un objet fasse face à l'intérieur */
export const WALL_ROT: Record<Wall, number> = {
  N: 0,
  S: Math.PI,
  E: -Math.PI / 2,
  W: Math.PI / 2,
}

/** position monde + rotation d'un objet placé par tuile */
export function placeOf(o: { tile?: [number, number]; pos?: [number, number, number]; wall?: Wall; y?: number; rot?: number; off?: [number, number] }, depth = 0.25) {
  if (o.pos) return { p: [o.pos[0], o.pos[1], o.pos[2]] as [number, number, number], r: o.rot ?? 0 }
  const [cx, cz] = tileCenter(o.tile![0], o.tile![1])
  let x = cx
  let z = cz
  let r = o.rot ?? 0
  if (o.wall) {
    const [nx, nz] = WALL_DIR[o.wall]
    x -= nx * (TILE / 2 - depth)
    z -= nz * (TILE / 2 - depth)
    r = WALL_ROT[o.wall]
  }
  if (o.off) {
    // décalage dans le repère local (x = droite, z = vers l'intérieur)
    const c = Math.cos(r)
    const s = Math.sin(r)
    x += o.off[0] * c + o.off[1] * s
    z += -o.off[0] * s + o.off[1] * c
  }
  return { p: [x, o.y ?? 0, z] as [number, number, number], r }
}

export function entsOf(zone: ZoneId): Ent[] {
  return zone === 4 ? zone4Ents : GRID_MAPS[zone].ents
}

export function propsOf(zone: ZoneId) {
  return zone === 4 ? zone4Props : GRID_MAPS[zone].props
}

export function spawnOf(zone: ZoneId): { pos: [number, number, number]; yaw: number } {
  if (zone === 4) return zone4Spawn
  const m = GRID_MAPS[zone]
  const [x, z] = tileCenter(m.spawn.tile[0], m.spawn.tile[1])
  return { pos: [x, 0, z], yaw: m.spawn.yaw }
}

export function roomAt(map: GridMap, x: number, z: number) {
  const tx = Math.floor(x / TILE)
  const tz = Math.floor(z / TILE)
  return map.rooms.find((r) => tx >= r.rect[0] && tx <= r.rect[2] && tz >= r.rect[1] && tz <= r.rect[3]) ?? null
}

/** position monde d'une entité (pour la caméra / téléportation) */
export function entWorld(e: Ent) {
  const depth = e.wall ? 0.22 : 0
  const { p, r } = placeOf(e, depth)
  return { p, r }
}
