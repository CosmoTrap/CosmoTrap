import type { DoorDef, RoomDef } from '../types'

/** Modules separated by vacuum, joined only by the specified corridor rooms. */
export function modularGrid(rooms: RoomDef[], doors: DoorDef[], windows: [number, number, 'W' | 'V'][], hub: string) {
  const width = Math.max(...rooms.map((r) => r.rect[2])) + 2
  const height = Math.max(...rooms.map((r) => r.rect[3])) + 2
  const cells = Array.from({ length: height }, () => Array<string>(width).fill(' '))
  for (const room of rooms) {
    const [x0, z0, x1, z1] = room.rect
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (room.id === hub && Math.abs(x - (x0 + x1) / 2) + Math.abs(z - (z0 + z1) / 2) > 4) continue
      cells[z][x] = '.'
    }
  }
  for (const door of doors) cells[door.tile[1]][door.tile[0]] = 'D'
  const floor = cells.map((row) => [...row])
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
    if (floor[z][x] !== '.' && floor[z][x] !== 'D') continue
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (cells[z + dz]?.[x + dx] === ' ') cells[z + dz][x + dx] = '#'
    }
  }
  for (const [x, z, kind] of windows) if (cells[z]?.[x] === '#') cells[z][x] = kind
  return cells.map((row) => row.join(''))
}
