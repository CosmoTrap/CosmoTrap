import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CEIL, GRID_MAPS, TILE } from '../../game/maps'
import { SOLAR_ARRAYS, SOLAR_CELL, SOLAR_GAP } from '../../game/maps/solarArrays'
import type { GridMap, RoomDef } from '../../game/types'
import { WIN_R, WIN_Y } from '../Level'
import { hullMaterial } from '../materials'
import { drawTexture } from '../textures'

// The station seen from outside, inspired by the ISS: white pressurized modules, a main truss, radiators
// and solar arrays. It stands around the rooms and never replaces them. Each floor is played on its own, so
// through the windows the other floor is this model: floor 1 stands above floor 2, on the lift's axis.

/** Height of floor 1 above floor 2 (m). */
export const FLOOR_GAP = 6
/** Height of the main truss above floor 2, midway between the two floors. */
const TRUSS_Y = 4.4
const MID_Y = CEIL / 2

/**
 * Service modules, with no interior, in each floor's own tiles [x0, z0, x1, z1]. They stand where a window
 * of the other floor would otherwise look out at nothing, so the other floor can be seen from every side.
 * Those of the floor being played are left out: they would stand right in front of its own windows.
 */
const SERVICE_MODULES: Record<1 | 2, [number, number, number, number][]> = {
  1: [[9, 1, 22, 3], [39, 17, 41, 23], [14, 37, 25, 39], [3, 25, 6, 27]],
  2: [[13, 0, 26, 2], [5, 11, 10, 13], [19, 34, 25, 36]],
}

type Bucket = 'hull' | 'trim' | 'frame' | 'foil' | 'truss' | 'solar' | 'radiator' | 'lit' | 'paint' | 'tile' | 'accent' | 'nozzle' | 'label'
type Parts = Record<Bucket, THREE.BufferGeometry[]>
const emptyParts = (): Parts => ({ hull: [], trim: [], frame: [], foil: [], truss: [], solar: [], radiator: [], lit: [], paint: [], tile: [], accent: [], nozzle: [], label: [] })

const UP = new THREE.Vector3(0, 1, 0)
const hubOf = (map: GridMap) => {
  const [x0, z0, x1, z1] = map.rooms.find((r) => r.id === 'couloir')!.rect
  return new THREE.Vector2(x0 + x1 + 1, z0 + z1 + 1)
}

function put(parts: Parts, bucket: Bucket, geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) {
  geometry.applyMatrix4(matrix)
  parts[bucket].push(geometry.index ? geometry.toNonIndexed() : geometry)
}

/** A box running from a to b. */
function beam(parts: Parts, bucket: Bucket, a: THREE.Vector3, b: THREE.Vector3, size: number) {
  const dir = b.clone().sub(a)
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()), new THREE.Vector3(size, dir.length(), size))
  put(parts, bucket, new THREE.BoxGeometry(1, 1, 1), m)
}

/** An open lattice girder: four rails, with frames and diagonals at each bay. */
function girder(parts: Parts, a: THREE.Vector3, b: THREE.Vector3, width: number) {
  const dir = b.clone().sub(a)
  const length = dir.length()
  dir.normalize()
  const side = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize().multiplyScalar(width / 2)
  const over = new THREE.Vector3().crossVectors(side, dir).normalize().multiplyScalar(width / 2)
  const corners = [side.clone().add(over), side.clone().sub(over), side.clone().negate().sub(over), side.clone().negate().add(over)]
  const rail = width * 0.09
  for (const c of corners) beam(parts, 'truss', a.clone().add(c), b.clone().add(c), rail)
  const bays = Math.max(1, Math.round(length / (width * 1.6)))
  for (let i = 0; i <= bays; i++) {
    const at = a.clone().addScaledVector(dir, (length * i) / bays)
    corners.forEach((c, k) => {
      const next = corners[(k + 1) % 4]
      beam(parts, 'truss', at.clone().add(c), at.clone().add(next), rail * 0.6)
      if (i < bays) beam(parts, 'truss', at.clone().add(c), at.clone().addScaledVector(dir, length / bays).add(next), rail * 0.45)
    })
  }
}

/** One pressurized module around a room: a white cylinder of oval section, with domed ends and banded seams. */
function moduleAround(parts: Parts, room: RoomDef, y: number) {
  const [x0, z0, x1, z1] = room.rect
  const left = x0 * TILE, right = (x1 + 1) * TILE, top = z0 * TILE, bottom = (z1 + 1) * TILE
  const cx = (left + right) / 2, cz = (top + bottom) / 2
  if (room.shape === 'round') {
    const r = (right - left) / 2 + 0.3
    const m = new THREE.Matrix4().makeTranslation(cx, y + MID_Y, cz)
    put(parts, 'hull', new THREE.CylinderGeometry(r, r, 3.6, 48, 1, true), m)
    for (const s of [1, -1]) {
      put(parts, 'hull', new THREE.SphereGeometry(r, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().compose(new THREE.Vector3(cx, y + MID_Y + s * 1.8, cz), new THREE.Quaternion(), new THREE.Vector3(1, s * 0.11, 1)))
      put(parts, 'foil', new THREE.TorusGeometry(r, 0.09, 8, 56), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(cx, y + MID_Y + s * 1.8, cz)))
    }
    return
  }
  const alongX = right - left >= bottom - top
  const length = alongX ? right - left : bottom - top
  const half = (alongX ? bottom - top : right - left) / 2 + 0.35
  const tall = Math.max(1.75, Math.min(2.1, half))
  const turn = new THREE.Quaternion().setFromUnitVectors(UP, alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1))
  // After the turn, local x and z are the section's two axes.
  const section = alongX ? new THREE.Vector3(tall, 1, half) : new THREE.Vector3(half, 1, tall)
  const centre = new THREE.Vector3(cx, y + MID_Y, cz)
  const axis = alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)
  const skin = new THREE.CylinderGeometry(1, 1, length, 32, 1, true)
  const uv = skin.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.round((half + tall) * 1.6), uv.getY(i) * Math.max(1, Math.round(length / 3)))
  put(parts, 'hull', skin, new THREE.Matrix4().compose(centre, turn, section))
  for (const s of [1, -1]) {
    const end = centre.clone().addScaledVector(axis, (s * length) / 2)
    const dome = new THREE.Quaternion().setFromUnitVectors(UP, axis.clone().multiplyScalar(s))
    const shape = alongX ? new THREE.Vector3(tall, 0.8, half) : new THREE.Vector3(half, 0.8, tall)
    put(parts, 'hull', new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().compose(end, dome, shape))
  }
  for (let d = -length / 2; d <= length / 2 + 0.01; d += Math.max(4, length / Math.round(length / 4.5))) {
    const at = centre.clone().addScaledVector(axis, d)
    const ring = new THREE.TorusGeometry(1, 0.012, 6, 36)
    ring.rotateX(Math.PI / 2)
    put(parts, 'trim', ring, new THREE.Matrix4().compose(at, turn, section))
  }
}

const FLOOR = ['.', 'D']
const isFloorAt = (map: GridMap, x: number, z: number) => FLOOR.includes(map.grid[z]?.[x] ?? ' ')
const SIDES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
/** How far the outer skin stands from a room's wall: the hull's thickness and a little insulation (m). */
const SKIN = 0.45
/** Segments of the vault above and below a module. */
const VAULT_STEPS = 12

/** A quad given as a → b → d → c around, with a normal at each corner; visible from the normals' side only. */
function quad(parts: Parts, bucket: Bucket, c: THREE.Vector3[], n: THREE.Vector3[], uv: [number, number][]) {
  const g = new THREE.BufferGeometry()
  const order = [0, 1, 2, 2, 1, 3]
  // Wind the triangles to agree with the normal: seen from the wrong side, they must not exist.
  const face = new THREE.Vector3().crossVectors(c[1].clone().sub(c[0]), c[2].clone().sub(c[0]))
  const seq = face.dot(n[0]) >= 0 ? order : [0, 2, 1, 2, 3, 1]
  g.setAttribute('position', new THREE.Float32BufferAttribute(seq.flatMap((i) => c[i].toArray()), 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(seq.flatMap((i) => n[i].toArray()), 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(seq.flatMap((i) => uv[i]), 2))
  parts[bucket].push(g)
}

/**
 * The outer skin of one room, or of a door between two rooms: flat sides a few centimetres off the walls, and
 * a vault above and below, as on the ISS's modules. Every face points outwards: from inside a room it does not
 * exist, and nothing crosses a door, so the rooms and their windows stay exactly as they are.
 */
function moduleSkin(parts: Parts, map: GridMap, rect: [number, number, number, number], y: number) {
  const [x0, z0, x1, z1] = rect
  const alongX = x1 - x0 >= z1 - z0
  // u runs along the module, v across it, both in metres from the room's own edges.
  const uStart = (alongX ? x0 : z0) * TILE, uEnd = ((alongX ? x1 : z1) + 1) * TILE
  const vStart = (alongX ? z0 : x0) * TILE, vEnd = ((alongX ? z1 : x1) + 1) * TILE
  const point = (u: number, v: number, h: number) => (alongX ? new THREE.Vector3(u, y + h, v) : new THREE.Vector3(v, y + h, u))
  const dir = (u: number, v: number, h: number) => (alongX ? new THREE.Vector3(u, h, v) : new THREE.Vector3(v, h, u)).normalize()
  const halfV = (vEnd - vStart) / 2, midV = (vStart + vEnd) / 2
  const width = halfV + SKIN
  const crown = Math.min(1.25, width * 0.55)
  const lo = uStart - SKIN, hi = uEnd + SKIN
  // Vault, over and under: an elliptical arc from one side to the other.
  for (const [base, sign] of [[CEIL + 0.05, 1], [-0.05, -1]] as const) {
    for (let i = 0; i < VAULT_STEPS; i++) {
      const a0 = Math.PI * (i / VAULT_STEPS), a1 = Math.PI * ((i + 1) / VAULT_STEPS)
      const v0 = midV + Math.cos(a0) * width, v1 = midV + Math.cos(a1) * width
      const h0 = base + sign * Math.sin(a0) * crown, h1 = base + sign * Math.sin(a1) * crown
      const n0 = dir(0, Math.cos(a0) / width, (sign * Math.sin(a0)) / crown), n1 = dir(0, Math.cos(a1) / width, (sign * Math.sin(a1)) / crown)
      const arc = (a: number) => (a * width) / TILE
      quad(parts, 'hull', [point(lo, v0, h0), point(hi, v0, h0), point(lo, v1, h1), point(hi, v1, h1)], [n0, n0, n1, n1], [[0, arc(a0)], [(hi - lo) / TILE, arc(a0)], [0, arc(a1)], [(hi - lo) / TILE, arc(a1)]])
    }
    // The vault's two ends, as flat half-moons above the ceiling and below the floor.
    for (const [uEdge, nu] of [[lo, -1], [hi, 1]] as const) {
      const normal = dir(nu, 0, 0)
      for (let i = 0; i < VAULT_STEPS; i++) {
        const a0 = Math.PI * (i / VAULT_STEPS), a1 = Math.PI * ((i + 1) / VAULT_STEPS)
        const v0 = midV + Math.cos(a0) * width, v1 = midV + Math.cos(a1) * width
        const h0 = base + sign * Math.sin(a0) * crown, h1 = base + sign * Math.sin(a1) * crown
        quad(parts, 'hull', [point(uEdge, v0, base), point(uEdge, v1, base), point(uEdge, v0, h0), point(uEdge, v1, h1)], [normal, normal, normal, normal], [[v0 / TILE, base / TILE], [v1 / TILE, base / TILE], [v0 / TILE, h0 / TILE], [v1 / TILE, h1 / TILE]])
      }
    }
  }
  /** One flat tile of wall, unless a door or a window goes through it: windows get their own plate. */
  const wall = (tx: number, tz: number, a: THREE.Vector3, b: THREE.Vector3, normal: THREE.Vector3, along: number) => {
    const cell = map.grid[tz]?.[tx] ?? ' '
    if (FLOOR.includes(cell) || cell === 'W' || cell === 'V') return
    const up = new THREE.Vector3(0, CEIL + 0.1, 0)
    quad(parts, 'hull', [a, b, a.clone().add(up), b.clone().add(up)], [normal, normal, normal, normal], [[0, 0], [along / TILE, 0], [0, 1.4], [along / TILE, 1.4]])
    // Gold insulation and a grab rail here and there, standing just off the skin.
    if ((tx * 3 + tz) % 4 === 0) {
      const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5).addScaledVector(normal, 0.015).setY(y + 1.4), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal), new THREE.Vector3(1, 1, 1))
      put(parts, 'foil', new THREE.PlaneGeometry(Math.min(1.5, along * 0.75), 1), m)
    }
    if ((tx + tz * 3) % 3 === 0) {
      const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5).addScaledVector(normal, 0.08).setY(y + 2.3), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal), new THREE.Vector3(1, 1, 1))
      put(parts, 'trim', new THREE.BoxGeometry(Math.min(1.3, along * 0.7), 0.035, 0.035), m)
    }
  }
  const tile = (along: number, across: number) => (alongX ? [along, across] : [across, along]) as [number, number]
  const from = alongX ? x0 : z0, to = alongX ? x1 : z1, acrossFrom = alongX ? z0 : x0, acrossTo = alongX ? z1 : x1
  // A wall may only run on past the room's edge to close a real corner. Where the corner tile belongs to
  // a room, a door or the hub, it would stand inside that room and show on its walls.
  const hubRect = map.rooms.find((r) => r.shape === 'round')?.rect
  const inHub = (x: number, z: number) => !!hubRect && x >= hubRect[0] && x <= hubRect[2] && z >= hubRect[1] && z <= hubRect[3]
  const closes = (along: number, across: number) => {
    const [x, z] = tile(along, across)
    return !isFloorAt(map, x, z) && !inHub(x, z)
  }
  const span = (t: number, across: number) => [t === from && closes(from - 1, across) ? lo : t * TILE, t === to && closes(to + 1, across) ? hi : (t + 1) * TILE]
  // Long sides, tile by tile; the first and last run on to meet the end walls.
  for (let t = from; t <= to; t++) {
    const [a0, a1] = span(t, acrossFrom - 1)
    wall(...tile(t, acrossFrom - 1), point(a0, midV - width, -0.05), point(a1, midV - width, -0.05), dir(0, -1, 0), a1 - a0)
    const [b0, b1] = span(t, acrossTo + 1)
    wall(...tile(t, acrossTo + 1), point(b0, midV + width, -0.05), point(b1, midV + width, -0.05), dir(0, 1, 0), b1 - b0)
  }
  // End walls.
  for (let t = acrossFrom; t <= acrossTo; t++) {
    for (const [end, u, nu] of [[from - 1, lo, -1], [to + 1, hi, 1]] as const) {
      const v0 = t === acrossFrom && closes(end, acrossFrom - 1) ? midV - width : t * TILE
      const v1 = t === acrossTo && closes(end, acrossTo + 1) ? midV + width : (t + 1) * TILE
      wall(...tile(end, t), point(u, v0, -0.05), point(u, v1, -0.05), dir(nu, 0, 0), v1 - v0)
    }
  }
  // Foil-wrapped equipment along the crown.
  for (let u = uStart + 2; u < uEnd - 1; u += 6) {
    const c = point(u, midV, CEIL + 0.05 + crown + 0.06)
    put(parts, 'foil', new THREE.BoxGeometry(alongX ? 1.3 : 0.9, 0.14, alongX ? 0.9 : 1.3), new THREE.Matrix4().makeTranslation(c.x, c.y, c.z))
  }
}

/** Every room and door of a floor in its skin. The hub, round, is apart: it keeps its own shell. */
function floorSkin(parts: Parts, map: GridMap, y: number) {
  for (const room of map.rooms) if (room.shape !== 'round') moduleSkin(parts, map, room.rect, y)
  for (const door of map.doors) moduleSkin(parts, map, [door.tile[0], door.tile[1], door.tile[0], door.tile[1]], y)
}

/**
 * The real shape of a floor's windows from outside: round, the same size and height as the portholes in the
 * rooms, set in the skin. One-sided: lit glass from outside, nothing at all from inside, so the view stays clear.
 */
function windowsFromOutside(parts: Parts, map: GridMap, y: number) {
  map.grid.forEach((row, tz) => [...row].forEach((cell, tx) => {
    if (cell !== 'W') return
    const side = SIDES.find(([dx, dz]) => isFloorAt(map, tx + dx, tz + dz))
    if (!side) return
    const out = new THREE.Vector3(-side[0], 0, -side[1])
    // From the tile's centre back to the room's wall, then out to the skin.
    const at = (d: number) => new THREE.Matrix4().compose(new THREE.Vector3(tx * TILE + TILE / 2, y + WIN_Y, tz * TILE + TILE / 2).addScaledVector(out, -TILE / 2 + SKIN + d), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), out), new THREE.Vector3(1, 1, 1))
    const plate = new THREE.Shape()
    const low = -0.05 - WIN_Y, high = CEIL + 0.05 - WIN_Y
    plate.moveTo(-TILE / 2, low); plate.lineTo(TILE / 2, low); plate.lineTo(TILE / 2, high); plate.lineTo(-TILE / 2, high); plate.closePath()
    const hole = new THREE.Path()
    hole.absarc(0, 0, WIN_R, 0, Math.PI * 2, true)
    plate.holes.push(hole)
    const plateGeometry = new THREE.ShapeGeometry(plate, 20)
    const uv = plateGeometry.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TILE, uv.getY(i) / TILE)
    put(parts, 'hull', plateGeometry, at(0))
    put(parts, 'frame', new THREE.RingGeometry(WIN_R - 0.005, WIN_R + 0.1, 36), at(0.012))
    put(parts, 'lit', new THREE.CircleGeometry(WIN_R, 32), at(0.006))
  }))
}

/** The round hub's four observation windows, lit, on the other floor: same arcs and heights as inside. */
function hubWindows(parts: Parts, map: GridMap, y: number) {
  const [x0, z0, x1, z1] = map.rooms.find((r) => r.shape === 'round')!.rect
  const radius = (x1 - x0 + 1) * TILE / 2
  const r = radius + 0.32
  const opening = Math.asin(1 / radius)
  const cx = x0 * TILE + (x1 - x0 + 1) * TILE / 2, cz = z0 * TILE + (z1 - z0 + 1) * TILE / 2
  for (let q = 0; q < 4; q++) {
    const begin = q * Math.PI / 2 + opening
    const span = Math.PI / 2 - 2 * opening
    const m = new THREE.Matrix4().makeTranslation(cx, y + 1.5, cz)
    put(parts, 'lit', new THREE.CylinderGeometry(r + 0.02, r + 0.02, 1.3, 20, 1, true, begin + span * (10 / 32), span * (12 / 32)), m)
    for (const h of [0.68, -0.68]) put(parts, 'frame', new THREE.CylinderGeometry(r + 0.035, r + 0.035, 0.07, 20, 1, true, begin + span * (10 / 32), span * (12 / 32)), new THREE.Matrix4().makeTranslation(cx, y + 1.5 + h, cz))
  }
}

/** The arrays exactly as drawn on the tablet's plan: same place, same two rows of five cells. */
function solarArrays(parts: Parts, zone: number, y: number, sunZ: number) {
  const tilt = (sunZ >= 0 ? 1 : -1) * 0.85
  const height = SOLAR_CELL * 0.78
  const across = 5 * SOLAR_CELL + 4 * SOLAR_GAP, deep = 2 * height + SOLAR_GAP
  for (const a of SOLAR_ARRAYS[zone] ?? []) {
    const centre = new THREE.Vector3(a.x + across / 2, y + MID_Y, a.z + deep / 2)
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + tilt, 0, 0))
    for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
      const local = new THREE.Vector3(col * (SOLAR_CELL + SOLAR_GAP) + SOLAR_CELL / 2 - across / 2, -(row * (height + SOLAR_GAP) + height / 2 - deep / 2), 0)
      const m = new THREE.Matrix4().compose(local.applyQuaternion(q).add(centre), q, new THREE.Vector3(1, 1, 1))
      put(parts, 'solar', new THREE.PlaneGeometry(SOLAR_CELL, height), m)
    }
    // Frame and central boom holding the cells, then the strut back to the module.
    const edge = new THREE.Vector3(across / 2 + 0.25, 0, 0)
    beam(parts, 'truss', centre.clone().sub(edge), centre.clone().add(edge), 0.14)
    const pylon = new THREE.Vector3(a.strutX, y + MID_Y, centre.z)
    if (a.strutX < a.x || a.strutX > a.x + across) beam(parts, 'truss', pylon, new THREE.Vector3(centre.x, y + MID_Y, centre.z), 0.16)
    // The plan's strut ends at the room's wall; in 3D it stops at the outer skin, just before it.
    const stop = a.strutZ + Math.sign(centre.z - a.strutZ) * (SKIN - 0.05)
    girder(parts, pylon, new THREE.Vector3(a.strutX, y + MID_Y, stop), 0.42)
  }
}

/** Main truss across the station, with its radiators: the long spine that makes it read as the ISS. */
function spine(parts: Parts, hub: THREE.Vector2) {
  const reach = 44
  girder(parts, new THREE.Vector3(hub.x - reach, TRUSS_Y, hub.y), new THREE.Vector3(hub.x + reach, TRUSS_Y, hub.y), 1.1)
  for (const x of [-34, -24, 24, 34]) {
    // Three ribbed panels, slightly folded, as radiators deploy.
    for (let i = 0; i < 3; i++) {
      const z = hub.y + (x < 0 ? -1 : 1) * (2.6 + i * 3.05)
      const m = new THREE.Matrix4().compose(new THREE.Vector3(hub.x + x, TRUSS_Y + (i % 2 ? 0.26 : 0), z), new THREE.Quaternion().setFromEuler(new THREE.Euler((i % 2 ? 1 : -1) * 0.17, 0, 0)), new THREE.Vector3(7, 0.07, 3))
      put(parts, 'radiator', new THREE.BoxGeometry(1, 1, 1), m)
    }
    beam(parts, 'truss', new THREE.Vector3(hub.x + x, TRUSS_Y, hub.y), new THREE.Vector3(hub.x + x, TRUSS_Y, hub.y + (x < 0 ? -1 : 1) * 2), 0.2)
  }
  // Foil-wrapped equipment boxes along the truss.
  for (const x of [-40, -29, -15, 15, 29, 40]) put(parts, 'foil', new THREE.BoxGeometry(2, 1.1, 1.5), new THREE.Matrix4().makeTranslation(hub.x + x, TRUSS_Y, hub.y))
}

/** Everything on the Hermès is laid out along x, from the engines (low x) to the nose (high x, docked to the station). */
export const HERMES = { x: 0, y: MID_Y, z: 36, radius: 2.2, tail: -7.6, shoulder: 1.4, nose: 7.7 }

/** A shape turned around the Hermès's axis; profile points are [radius, position along it]. */
function turned(parts: Parts, bucket: Bucket, profile: [number, number][], phiStart = 0, phiLength = Math.PI * 2) {
  const g = new THREE.LatheGeometry(profile.map(([r, along]) => new THREE.Vector2(r, along)), 40, phiStart, phiLength)
  g.rotateZ(-Math.PI / 2)
  put(parts, bucket, g, new THREE.Matrix4().makeTranslation(HERMES.x, HERMES.y, HERMES.z))
}

/** A flat swept fin, in the plane of its own (along, out) shape, then turned to stand on the hull. */
function fin(parts: Parts, angle: number, out: number) {
  const r = HERMES.radius - 0.05
  const shape = new THREE.Shape()
  shape.moveTo(HERMES.tail + 0.35, r)
  shape.lineTo(HERMES.tail + 4.6, r)
  shape.lineTo(HERMES.tail + 1.5, r + out)
  shape.lineTo(HERMES.tail + 0.5, r + out)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 })
  g.translate(0, 0, -0.07)
  g.rotateX(angle)
  put(parts, 'paint', g, new THREE.Matrix4().makeTranslation(HERMES.x, HERMES.y, HERMES.z))
  // Heat-resistant leading edge, in the mission's colour.
  const edge = new THREE.Vector3(HERMES.tail + 4.6, r, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), angle).add(new THREE.Vector3(HERMES.x, HERMES.y, HERMES.z))
  const tip = new THREE.Vector3(HERMES.tail + 1.5, r + out, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), angle).add(new THREE.Vector3(HERMES.x, HERMES.y, HERMES.z))
  beam(parts, 'accent', edge, tip, 0.18)
}

/**
 * The Hermès, moored where the plan shows it: a return vehicle made to come home through the atmosphere,
 * with a pointed nose, a dark belly of heat tiles, swept fins and three rocket engines.
 */
function dockedRocket(parts: Parts) {
  const { radius: R, tail, shoulder, nose } = HERMES
  // Ogive from the shoulder to the tip, rounded off rather than sharp.
  const ogive: [number, number][] = []
  for (let i = 0; i <= 14; i++) {
    const k = i / 14
    ogive.push([Math.max(0.28, R * Math.sqrt(1 - k * k * 0.97) * (1 - 0.12 * k)), shoulder + (nose - shoulder) * Math.pow(k, 0.9)])
  }
  const body: [number, number][] = [[R * 0.86, tail], [R, tail + 0.7], [R, shoulder], ...ogive.slice(1)]
  // Top half white; underside, which meets the atmosphere first, in black heat tiles.
  turned(parts, 'paint', body, Math.PI, Math.PI)
  turned(parts, 'tile', body, 0, Math.PI)
  // Mission-coloured bands around the hull.
  for (const at of [tail + 0.75, -2.6, shoulder]) turned(parts, 'accent', [[R + 0.015, at - 0.13], [R + 0.015, at + 0.13]])
  turned(parts, 'nozzle', [[R * 0.8, tail - 0.25], [R * 0.86, tail + 0.02]])
  // Swept wings on either side, one tail fin on top. Nothing underneath: it lands on its belly.
  fin(parts, Math.PI / 2, 2.2)
  fin(parts, -Math.PI / 2, 2.2)
  fin(parts, 0, 1.9)
  // Three bell-shaped engines, with a dark throat.
  for (const [dy, dz] of [[0.75, 0], [-0.55, -0.85], [-0.55, 0.85]]) {
    const bell: [number, number][] = []
    for (let i = 0; i <= 8; i++) {
      const k = i / 8
      bell.push([0.72 - 0.42 * Math.pow(k, 0.6), tail - 1.5 + 1.25 * k])
    }
    const g = new THREE.LatheGeometry(bell.map(([r, along]) => new THREE.Vector2(r, along)), 24)
    g.rotateZ(-Math.PI / 2)
    put(parts, 'nozzle', g, new THREE.Matrix4().makeTranslation(HERMES.x, HERMES.y + dy, HERMES.z + dz))
  }
  // The crew's windows, on each flank, and the pilots' windows on the nose.
  for (const side of [1, -1]) {
    const facing = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.25, side).normalize())
    const place = (x: number, r: number, size: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, HERMES.y + r * 0.243, HERMES.z + side * r * 0.97), facing, new THREE.Vector3(size, size, size))
    for (const x of [-5, -3.9, 0.4, 1.3]) {
      put(parts, 'frame', new THREE.RingGeometry(0.21, 0.29, 20), place(x, R + 0.03, 1))
      put(parts, 'lit', new THREE.CircleGeometry(0.21, 18), place(x, R + 0.02, 1))
    }
    // The name, on the white of each flank.
    const label = new THREE.PlaneGeometry(3.4, 0.68)
    put(parts, 'label', label, new THREE.Matrix4().compose(new THREE.Vector3(-1.4, HERMES.y + 0.86 + 0.2, HERMES.z + side * (R * 0.9 + 0.02)), new THREE.Quaternion().setFromEuler(new THREE.Euler(side > 0 ? -0.45 : 0.45, side > 0 ? 0 : Math.PI, 0)), new THREE.Vector3(1, 1, 1)))
    // Cockpit windows, slanted on the nose.
    const pilots = new THREE.Matrix4().compose(new THREE.Vector3(3.55, HERMES.y + 1.32, HERMES.z + side * 0.72), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.5, 0.75, side * 0.42).normalize()), new THREE.Vector3(1, 0.62, 1))
    put(parts, 'lit', new THREE.CircleGeometry(0.42, 20), pilots)
  }
  // The docking tunnel to the station's hatch, stopping at the outer skin.
  const tunnel = (from: number, to: number, r: number, bucket: Bucket) => put(parts, bucket, new THREE.CylinderGeometry(r, r, to - from, 24, 1, true), new THREE.Matrix4().makeTranslation((from + to) / 2, HERMES.y, 37).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)))
  tunnel(nose - 0.5, 9.5, 0.62, 'trim')
  tunnel(9.1, 9.5, 0.8, 'foil')
}

/** The windowless modules of a floor, each tied back to the hub by a girder. */
function serviceModules(parts: Parts, floor: 1 | 2, hub: THREE.Vector2, y: number) {
  for (const rect of SERVICE_MODULES[floor]) {
    moduleAround(parts, { id: 'service', name: 'service', rect }, y)
    const centre = new THREE.Vector3(rect[0] + rect[2] + 1, y + MID_Y, rect[1] + rect[3] + 1)
    girder(parts, centre, new THREE.Vector3(hub.x, y + MID_Y, hub.y), 0.5)
  }
}

/**
 * full: the whole station, both floors complete (for the cinematics, where no floor is being played).
 * rocket: with the Hermès docked, or without when a cinematic moves it on its own.
 */
function buildParts(map: GridMap, full = false, rocket = true) {
  const parts = emptyParts()
  const upper = GRID_MAPS[1], lower = GRID_MAPS[2]
  const hub = hubOf(lower)
  const upperHub = hubOf(upper)
  // Built in floor 2's coordinates; floor 1 sits on the same lift axis, FLOOR_GAP higher.
  const toUpper = new THREE.Matrix4().makeTranslation(hub.x - upperHub.x, 0, hub.y - upperHub.y)
  const placed = (from: Parts, bucketOf: Parts, matrix: THREE.Matrix4) => {
    for (const key of Object.keys(from) as Bucket[]) for (const g of from[key]) {
      g.applyMatrix4(matrix)
      bucketOf[key].push(g)
    }
  }
  const sunZ = map.sun[2]
  const up = emptyParts()
  if (full || map.zone !== 1) {
    moduleAround(up, upper.rooms.find((r) => r.shape === 'round')!, FLOOR_GAP)
    hubWindows(up, upper, FLOOR_GAP)
    serviceModules(up, 1, upperHub, FLOOR_GAP)
  }
  floorSkin(up, upper, FLOOR_GAP)
  windowsFromOutside(up, upper, FLOOR_GAP)
  solarArrays(up, 1, FLOOR_GAP, sunZ)
  placed(up, parts, toUpper)
  if (full || map.zone !== 2) {
    moduleAround(parts, lower.rooms.find((r) => r.shape === 'round')!, 0)
    hubWindows(parts, lower, 0)
    serviceModules(parts, 2, hub, 0)
  }
  floorSkin(parts, lower, 0)
  windowsFromOutside(parts, lower, 0)
  solarArrays(parts, 2, 0, sunZ)
  spine(parts, hub)
  if (rocket) dockedRocket(parts)
  // The lift's shaft, joining the two floors along their shared axis.
  const shaft = new THREE.CylinderGeometry(2.1, 2.1, FLOOR_GAP - CEIL, 32, 1, true)
  put(parts, 'trim', shaft, new THREE.Matrix4().makeTranslation(hub.x, (FLOOR_GAP + CEIL) / 2, hub.y))
  // Everything is seen from one floor: bring that floor's own coordinates back to the origin.
  const view = !full && map.zone === 1 ? new THREE.Vector3(upperHub.x - hub.x, -FLOOR_GAP, upperHub.y - hub.y) : new THREE.Vector3()
  return { parts, view }
}

function solarTexture() {
  return drawTexture(256, 200, (c) => {
    c.fillStyle = '#123a8a'
    c.fillRect(0, 0, 256, 200)
    for (let x = 0; x < 8; x++) for (let y = 0; y < 6; y++) {
      c.fillStyle = (x + y) % 2 ? '#17479f' : '#123c8f'
      c.fillRect(x * 32 + 1, y * 33.3 + 1, 30, 31.3)
    }
    c.fillStyle = 'rgba(190,212,245,.7)'
    for (let x = 0; x <= 8; x++) c.fillRect(x * 32 - 1, 0, 2, 200)
    for (let y = 0; y <= 6; y++) c.fillRect(0, y * 33.3 - 1, 256, 2)
    c.strokeStyle = '#c7d6ea'
    c.lineWidth = 5
    c.strokeRect(0, 0, 256, 200)
  })
}

function foilTexture() {
  return drawTexture(128, 128, (c) => {
    c.fillStyle = '#b98d3c'
    c.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 90; i++) {
      c.fillStyle = `rgba(${i % 2 ? '255,220,140' : '90,60,20'},.16)`
      c.fillRect((i * 37) % 128, (i * 61) % 128, 4 + (i % 26), 2 + (i % 5))
    }
  })
}

function heatTileTexture() {
  const t = drawTexture(256, 256, (c) => {
    c.fillStyle = '#17191c'
    c.fillRect(0, 0, 256, 256)
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
      const v = 30 + ((x * 11 + y * 7) % 6) * 4
      c.fillStyle = `rgb(${v},${v},${v + 2})`
      c.fillRect(x * 32 + 1, y * 32 + 1, 30, 30)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 8)
  return t
}

function hermesLabelTexture() {
  return drawTexture(512, 100, (c) => {
    c.clearRect(0, 0, 512, 100)
    c.fillStyle = '#23304a'
    c.font = '800 74px Inter, Arial, sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('HERMÈS', 256, 54)
  })
}

export function Station({ map, full = false, rocket = true }: { map: GridMap; full?: boolean; rocket?: boolean }) {
  const { meshes, view, dispose } = useMemo(() => {
    const { parts, view } = buildParts(map, full, rocket)
    const solarMap = solarTexture()
    solarMap.anisotropy = 8
    const foilMap = foilTexture()
    const tileMap = heatTileTexture()
    const labelMap = hermesLabelTexture()
    // A trace of light of their own: in space, the shaded side would otherwise be a flat black hole.
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ fog: false, envMapIntensity: 0.35, emissiveIntensity: 0.07, ...o })
    const materials: Record<Bucket, THREE.Material> = {
      hull: hullMaterial('wall', 'station'),
      trim: std({ color: '#3c4147', roughness: 0.55, metalness: 0.6, emissive: '#3c4147' }),
      frame: std({ color: '#2f3338', roughness: 0.5, metalness: 0.65, emissive: '#2f3338' }),
      foil: std({ map: foilMap, roughness: 0.38, metalness: 0.75, emissive: '#6e5426' }),
      truss: std({ color: '#aeb3b8', roughness: 0.48, metalness: 0.55, emissive: '#70757a' }),
      solar: std({ map: solarMap, roughness: 0.28, metalness: 0.45, emissive: '#16407f', emissiveIntensity: 0.28, side: THREE.DoubleSide }),
      radiator: std({ color: '#f4f4f0', roughness: 0.68, metalness: 0.05, emissive: '#c9cfd6' }),
      lit: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.25, 0.9), fog: false, toneMapped: false }),
      paint: std({ color: '#f3f2ee', roughness: 0.4, metalness: 0.05, emissive: '#c9cfd6', side: THREE.DoubleSide }),
      tile: std({ map: tileMap, roughness: 0.82, metalness: 0.02, emissive: '#22262b', side: THREE.DoubleSide }),
      accent: std({ color: '#e8602a', roughness: 0.45, metalness: 0.1, emissive: '#e8602a', emissiveIntensity: 0.12, side: THREE.DoubleSide }),
      nozzle: std({ color: '#4a4e53', roughness: 0.36, metalness: 0.85, emissive: '#2c2f33', side: THREE.DoubleSide }),
      label: std({ map: labelMap, transparent: true, roughness: 0.5, emissiveIntensity: 0 }),
    }
    const meshes = (Object.keys(parts) as Bucket[]).filter((k) => parts[k].length).map((key) => {
      const geometry = mergeGeometries(parts[key].map((g) => { for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name); return g }))!
      parts[key].forEach((g) => g.dispose())
      return { key, geometry, material: materials[key] }
    })
    return { meshes, view, dispose: () => {
      meshes.forEach((m) => m.geometry.dispose())
      // The hull's skin is shared with the rooms' shell and stays cached.
      for (const [key, m] of Object.entries(materials)) if (key !== 'hull') m.dispose()
      solarMap.dispose(); foilMap.dispose(); tileMap.dispose(); labelMap.dispose()
    } }
  }, [map, full, rocket])
  useEffect(() => dispose, [dispose])
  return (
    <group name="station-exterior" position={view}>
      {meshes.map((m) => <mesh key={m.key} name={`station:${m.key}`} geometry={m.geometry} material={m.material} frustumCulled={false} />)}
    </group>
  )
}
