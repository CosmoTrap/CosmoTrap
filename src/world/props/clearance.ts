import { TILE, WALL_DIR, cellAt, placeOf } from '../../game/maps'
import type { GridMap, Prop } from '../../game/types'

// Décors muraux qui ne doivent jamais masquer un hublot, une porte ou une échelle.
// La demi-largeur sert à tester toute l'emprise de l'objet, pas seulement son centre.
const WALL_DECOR: Record<string, number> = {
  photos: 0.5,
  postits: 0.35,
  screen: 0.55,
  monitor: 0.4,
  sign: 0.4,
  poster: 0.36,
  sockets: 0.28,
  clock: 0.12,
  camera: 0.16,
  utilityBox: 0.3,
  beacon: 0.12,
  bands: 0.16,
}

const FLOOR_FIT: Record<string, number> = {
  treadmill: 0.7,
  ergBike: 0.4,
  dumbbells: 0.2,
  bodyScale: 0.2,
  lounge: 0.4,
  sideTable: 0.2,
  gasTank: 0.2,
  shelfUnit: 0.45,
}

const BULKY = new Set([
  'bunk', 'bunkMirrored', 'personalLocker', 'cabinet', 'labBench', 'counter', 'elecCabinet', 'suitRack', 'rack',
  'plantRack', 'medbed', 'console', 'pilotSeat', 'crewSeats', 'engineCore', 'treadmill', 'ergBike',
  'sideConsole', 'toolChest', 'generator', 'lounge', 'shelfUnit', 'gasTank',
])

const SHIFTS = [0, 1.15, -1.15, 1.75, -1.75, 2.2, -2.2]
const GLASS_Y = 1.5
const GLASS_R = 0.42
const HALF_H: Record<string, number> = {
  photos: 0.16, postits: 0.5, screen: 0.35, monitor: 0.25, sign: 0.25, poster: 0.42,
  sockets: 0.08, clock: 0.08, camera: 0.14, utilityBox: 0.28, beacon: 0.1, bands: 0.12,
}

function coversGlass(pr: Prop) {
  const y = pr.y ?? 1.2
  const h = HALF_H[pr.model] ?? 0.3
  return y + h > GLASS_Y - GLASS_R && y - h < GLASS_Y + GLASS_R
}

function reserved(map: GridMap, tx: number, tz: number, glass: boolean) {
  const c = cellAt(map, tx, tz)
  if (c === 'D' || (glass && (c === 'W' || c === 'V'))) return true
  const key = `${tx},${tz}`
  for (const d of map.doors) if (d.tile[0] === tx && d.tile[1] === tz) return true
  for (const p of map.props) {
    if (!p.tile || `${p.tile[0]},${p.tile[1]}` !== key) continue
    if (p.model === 'ladder') return true
  }
  for (const e of map.ents) {
    if (!e.tile || `${e.tile[0]},${e.tile[1]}` !== key) continue
    if (e.model === 'hatch' || e.model === 'dockHatch') return true
  }
  return false
}

function hitsReserved(map: GridMap, pr: Prop, half: number) {
  const glass = coversGlass(pr)
  if (!pr.wall || !pr.tile) return pr.tile ? reserved(map, pr.tile[0], pr.tile[1], glass) : false
  if (reserved(map, pr.tile[0], pr.tile[1], glass)) return true
  const { p, r } = placeOf(pr, 0.25)
  const [nx, nz] = WALL_DIR[pr.wall]
  // L'origine est dans la pièce, à ~0,25 m du mur : il faut dépasser le plan du mur.
  const bx = p[0] - nx * 0.9
  const bz = p[2] - nz * 0.9
  const ax = Math.cos(r)
  const az = -Math.sin(r)
  for (const s of [-half, 0, half]) {
    const tx = Math.floor((bx + ax * s) / TILE)
    const tz = Math.floor((bz + az * s) / TILE)
    if (reserved(map, tx, tz, glass)) return true
  }
  return false
}

function crowded(map: GridMap, pr: Prop, original: Prop) {
  if (!pr.wall) return false
  const { p } = placeOf(pr, 0.25)
  const tx = Math.floor(p[0] / TILE)
  const tz = Math.floor(p[2] / TILE)
  return map.props.some((other) => other !== original && other.wall === pr.wall && other.tile?.[0] === tx && other.tile?.[1] === tz && BULKY.has(other.model))
}

/** Décale un décor le long du mur, ou le retire s'il n'y a pas de place hors des ouvertures. */
export function resolveProp(map: GridMap, pr: Prop): Prop | null {
  if (pr.pos) return pr
  const half = pr.wall ? WALL_DECOR[pr.model] : undefined
  if (half != null && pr.wall) {
    for (const shift of SHIFTS) {
      const next: Prop = shift === 0 ? pr : { ...pr, off: [(pr.off?.[0] ?? 0) + shift, pr.off?.[1] ?? 0] }
      if (!hitsReserved(map, next, half) && !crowded(map, next, pr)) return next
    }
    return null
  }
  if (FLOOR_FIT[pr.model] != null) {
    if (pr.tile && reserved(map, pr.tile[0], pr.tile[1], true)) return null
    if (pr.wall && hitsReserved(map, pr, FLOOR_FIT[pr.model])) return null
    return pr
  }
  return pr
}

export function resolveProps(map: GridMap): Prop[] {
  const out: Prop[] = []
  for (const pr of map.props) {
    const placed = resolveProp(map, pr)
    if (placed) out.push(placed)
  }
  return out
}
