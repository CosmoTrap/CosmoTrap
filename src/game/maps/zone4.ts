import type { Ent, Prop } from '../types'

// Terre — vallée de l'atterrissage. Coordonnées monde en mètres (x est, z sud).

export const RIVER_Z = -22
export const RIVER_HALF = 3.6
export const BRIDGE_X = 8
export const WATER_Y = -0.75
export const BOUNDS = { x0: -38, x1: 38, z0: -72, z1: 20 }

// bruit de valeur déterministe (partagé rendu / physique)
function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x: number, z: number) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi)
  const b = hash(xi + 1, zi)
  const c = hash(xi, zi + 1)
  const d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm(x: number, z: number, oct = 4) {
  let s = 0
  let a = 0.5
  let f = 1
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, z * f)
    f *= 2.03
    a *= 0.5
  }
  return s
}
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** hauteur du terrain */
export function terrainHeight(x: number, z: number) {
  let h = (fbm(x * 0.045, z * 0.045) - 0.5) * 1.6
  // lit de la rivière
  const d = Math.abs(z - RIVER_Z + Math.sin(x * 0.05) * 1.2)
  h -= 2.1 * smooth(RIVER_HALF + 1.6, RIVER_HALF - 0.8, d)
  // plateau de l'hélisurface au nord
  h += 1.8 * smooth(-44, -56, z)
  // collines hors zone jouable
  const ex = Math.max(0, Math.abs(x) - 34)
  const ez = Math.max(0, z - 16, -68 - z)
  const e = Math.hypot(ex, ez)
  const rise = e * e * 0.05 + e * 0.4 * fbm(x * 0.08, z * 0.08)
  // Keep distant hills finite: the former quadratic created 500 m walls
  // around the valley and completely concealed the sky and mountain skyline.
  h += 32 * (1 - Math.exp(-rise / 32))
  return h
}

/** ligne centrale de la rivière (avec méandre) */
export function riverCenter(x: number) {
  return RIVER_Z - Math.sin(x * 0.05) * 1.2
}

const g = (x: number, z: number, dy = 0): [number, number, number] => [x, terrainHeight(x, z) + dy, z]

export const zone4Spawn = { pos: [0, 0, -4] as [number, number, number], yaw: 0 }

export const zone4Ents: Ent[] = [
  { id: 'capsule', model: 'capsuleHatch', pos: g(0, 1.4, 1.2), dot: 'key', hit: [2.2, 2.2, 1.6] },
  { id: 'antenna', model: 'antennaItem', pos: g(-17, -5, 0.12), item: 'antenna', dot: 'key', hit: [1.6, 0.8, 1.6] },
  { id: 'lighter', model: 'lighter', pos: g(-5.2, 7.5, 0.45), item: 'lighter', dot: 'surv' },
  { id: 'sign', model: 'trailSign', pos: g(4, -15, 0), rot: 0.3, dot: 'exam', hit: [1.2, 2, 0.6] },
  { id: 'river', model: 'riverSpot', pos: [-4, WATER_Y + 0.3, riverCenter(-4) + RIVER_HALF - 0.4], dot: 'res', hit: [3, 1.6, 2] },
  { id: 'river2', model: 'riverSpot', pos: [20, WATER_Y + 0.3, riverCenter(20) - RIVER_HALF + 0.4], dot: 'res', hit: [3, 1.6, 2] },
  { id: 'bridge', model: 'bridgeAnchor', pos: g(BRIDGE_X, riverCenter(BRIDGE_X) + RIVER_HALF + 1.6, 0.6), dot: 'key', hit: [2.4, 1.6, 1.4] },
  { id: 'beacon', model: 'radioBeacon', pos: g(15, -35, 0), rot: -0.6, dot: 'key', hit: [1.2, 1.6, 1.2] },
  { id: 'flareGun', model: 'flareCrate', pos: g(-13, -41.5, 0), rot: 0.2, item: 'flareGun', dot: 'key', hit: [1.2, 1, 1] },
  { id: 'map', model: 'mapItem', pos: g(-15.5, -43.5, 0.95), item: 'map', dot: 'surv' },
  { id: 'helipad', model: 'helipadPanel', pos: g(6, -60, 0), dot: 'exit', hit: [3, 2, 3] },
]

export const zone4Props: Prop[] = [
  { model: 'capsule', pos: g(0, 2.2, -0.2), rot: 0.15 },
  { model: 'parachute', pos: g(-7, 9, 0) },
  { model: 'cabin', pos: g(-15, -44, 0), rot: 0.2 },
  { model: 'helipad', pos: g(6, -60, 0.02) },
  { model: 'bigRock', pos: g(17, -36.5, -0.4), scale: 2.2 },
  { model: 'bigRock', pos: g(-24, -12, -0.3), scale: 1.6, rot: 1 },
  { model: 'bigRock', pos: g(26, 6, -0.3), scale: 1.9, rot: 2 },
  { model: 'bigRock', pos: g(-6, -52, -0.3), scale: 1.4, rot: 0.5 },
]
