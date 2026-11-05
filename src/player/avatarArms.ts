import * as THREE from 'three'

// First-person arms, rebuilt from each avatar's picture in public/skins: same silhouette,
// and the surfaces are the picture's own pixels. Coordinates below are pixels of that picture.

type Px = [number, number]
/** Part of the picture: runs from `from` (towards the shoulder) to `to` (towards the hand). */
export interface Strip { from: Px; to: Px; half: number }
/** Along a limb: distance in metres, radius in metres, position in its strip (0 = `to`, 1 = `from`). */
export type Knot = [number, number, number]

export interface ArmSpec {
  forearm: { strip: Strip; knots: Knot[] }
  upper: { strip: Strip; knots: Knot[] }
  elbow: { strip: Strip; radius: number }
  /** The hand in the picture: from the wrist line to the fingertips. `flip` is for a hand whose thumb points away from the body in the picture. */
  hand: { wrist: Px; tip: Px; half: number; flip?: boolean }
  roughness: number
}

export const FOREARM_LENGTH = 0.54
/** The avatars have short, stocky arms: every radius in the tables below is multiplied by this. */
export const ARM_THICKNESS = 1.3
/** The hand grows with the arm, a little less, so it still fits its cuff. */
export const HAND_SCALE = 1.15

const ARMS: Record<string, ArmSpec> = {
  leo: {
    forearm: { strip: { from: [506, 490], to: [509, 626], half: 32 }, knots: [[0, 0.072, 0.01], [0.05, 0.074, 0.21], [0.053, 0.066, 0.215], [FOREARM_LENGTH, 0.072, 1]] },
    upper: { strip: { from: [505, 490], to: [506, 560], half: 32 }, knots: [[0, 0.07, 0], [0.33, 0.072, 1], [0.7, 0.08, 1]] },
    elbow: { strip: { from: [506, 520], to: [506, 560], half: 28 }, radius: 0.071 },
    hand: { wrist: [112, 622], tip: [112, 718], half: 46, flip: true },
    roughness: 0.95,
  },
  sam: {
    forearm: { strip: { from: [530, 500], to: [553, 624], half: 36 }, knots: [[0, 0.083, 0], [0.06, 0.085, 0.27], [0.064, 0.074, 0.28], [FOREARM_LENGTH, 0.088, 1]] },
    upper: { strip: { from: [505, 455], to: [528, 530], half: 30 }, knots: [[0, 0.085, 0], [0.33, 0.1, 1], [0.7, 0.11, 1]] },
    elbow: { strip: { from: [525, 500], to: [530, 540], half: 26 }, radius: 0.088 },
    hand: { wrist: [549, 627], tip: [549, 700], half: 42 },
    roughness: 0.92,
  },
  nova: {
    forearm: { strip: { from: [533, 527], to: [537, 627], half: 33 }, knots: [[0, 0.076, 0], [0.05, 0.077, 0.27], [0.054, 0.068, 0.28], [0.44, 0.07, 0.8], [0.46, 0.056, 0.82], [0.53, 0.056, 0.97], [FOREARM_LENGTH, 0.05, 1]] },
    upper: { strip: { from: [515, 450], to: [530, 530], half: 28 }, knots: [[0, 0.06, 0], [0.05, 0.072, 0.12], [0.33, 0.08, 1], [0.7, 0.085, 1]] },
    elbow: { strip: { from: [530, 528], to: [530, 548], half: 20 }, radius: 0.058 },
    hand: { wrist: [530, 628], tip: [530, 732], half: 46 },
    roughness: 0.6,
  },
  kenji: {
    forearm: { strip: { from: [518, 548], to: [552, 622], half: 24 }, knots: [[0, 0.068, 0], [0.06, 0.068, 0.33], [0.064, 0.055, 0.34], [FOREARM_LENGTH, 0.05, 1]] },
    upper: { strip: { from: [503, 490], to: [520, 552], half: 20 }, knots: [[0, 0.045, 0], [0.33, 0.055, 1], [0.7, 0.07, 1]] },
    elbow: { strip: { from: [522, 540], to: [522, 576], half: 18 }, radius: 0.052 },
    hand: { wrist: [572, 640], tip: [572, 776], half: 50 },
    roughness: 0.5,
  },
  maya: {
    forearm: { strip: { from: [502, 568], to: [502, 638], half: 30 }, knots: [[0, 0.062, 0.04], [0.05, 0.066, 0.33], [0.054, 0.056, 0.36], [FOREARM_LENGTH, 0.058, 1]] },
    upper: { strip: { from: [497, 495], to: [497, 555], half: 26 }, knots: [[0, 0.05, 0], [0.06, 0.062, 0.15], [0.33, 0.066, 1], [0.7, 0.07, 1]] },
    elbow: { strip: { from: [497, 550], to: [497, 582], half: 20 }, radius: 0.048 },
    hand: { wrist: [500, 636], tip: [500, 778], half: 40 },
    roughness: 0.7,
  },
  ines: {
    forearm: { strip: { from: [133, 525], to: [128, 622], half: 33 }, knots: [[0, 0.078, 0.02], [0.03, 0.08, 0.2], [0.036, 0.082, 0.22], [FOREARM_LENGTH, 0.085, 1]] },
    upper: { strip: { from: [140, 440], to: [127, 522], half: 34 }, knots: [[0, 0.085, 0], [0.33, 0.095, 1], [0.7, 0.105, 1]] },
    elbow: { strip: { from: [127, 500], to: [127, 535], half: 30 }, radius: 0.086 },
    hand: { wrist: [128, 621], tip: [128, 716], half: 46, flip: true },
    roughness: 0.9,
  },
}

export const armOf = (id?: string) => ARMS[id ?? 'ines'] ?? ARMS.ines

/** Limb radius at a distance along it, to fit straps around the arm. */
export function radiusAt(knots: Knot[], d: number) {
  for (let i = 1; i < knots.length; i++) {
    if (d <= knots[i][0]) {
      const [d0, r0] = knots[i - 1], [d1, r1] = knots[i]
      return (r0 + (r1 - r0) * ((d - d0) / Math.max(d1 - d0, 1e-6))) * ARM_THICKNESS
    }
  }
  return knots[knots.length - 1][1] * ARM_THICKNESS
}

const pictures = new Map<string, Promise<HTMLImageElement>>()
function picture(id: string) {
  let p = pictures.get(id)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = `/skins/${id}.png`
    })
    pictures.set(id, p)
  }
  return p
}

const materials = new Map<string, THREE.MeshStandardMaterial>()

/** The picture already has its own light and shine: half of it is shown as is, so it keeps its
 *  colours in a bright room as in a dark one, and the room's light only adds the rest. */
function pictureMaterial(map: THREE.Texture, roughness: number) {
  const material = new THREE.MeshStandardMaterial({ map, color: '#a0a0a0', roughness, metalness: 0, envMapIntensity: 0.2 })
  material.emissive.set('#ffffff')
  material.emissiveMap = map
  material.emissiveIntensity = 0.3
  // The picture's own creases, seams and scales catch the room's light.
  material.bumpMap = map
  material.bumpScale = 1.6
  return material
}

function drawStrip(g: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, from: Px, to: Px, half: number) {
  const dx = from[0] - to[0], dy = from[1] - to[1]
  g.imageSmoothingQuality = 'high'
  g.translate(w / 2, h)
  g.scale(w / 2 / half, h / Math.hypot(dx, dy))
  g.rotate(-Math.PI / 2 - Math.atan2(dy, dx))
  g.translate(-to[0], -to[1])
  g.drawImage(img, 0, 0)
}

/** Material cut out of the avatar's picture. Starts in the avatar's colour until the picture is loaded. */
export function stripMaterial(id: string, strip: Strip, base: string, spec: ArmSpec) {
  const key = `${id}:${strip.from}:${strip.to}:${strip.half}`
  const known = materials.get(key)
  if (known) return known
  const c = document.createElement('canvas')
  c.width = 256; c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, 256, 512)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.MirroredRepeatWrapping
  map.repeat.set(2, 1)
  map.anisotropy = 8
  const material = pictureMaterial(map, spec.roughness)
  materials.set(key, material)
  void picture(id).then((img) => {
    drawStrip(g, img, 256, 512, strip.from, strip.to, strip.half)
    map.needsUpdate = true
  }).catch(() => { /* the plain colour stays */ })
  return material
}

/** Metres per pixel of the pictures. */
const PX = 0.00185
/** Share of the hand's length before the fingers start to close. */
const PALM = 0.42

export interface HandMesh { geometry: THREE.BufferGeometry; material: THREE.Material }

/**
 * The picture's own hand, inflated into a volume: its silhouette is the picture's, and it is thickest
 * in the middle. With `grip`, the fingers roll forward around what the hand holds.
 * Wrist at the origin, fingers along +y, back of the hand towards +z.
 */
async function buildHand(id: string, spec: ArmSpec, grip: boolean): Promise<HandMesh> {
  const { wrist, tip, half, flip } = spec.hand
  const img = await picture(id)
  const length = Math.hypot(tip[0] - wrist[0], tip[1] - wrist[1]) * PX
  const width = 2 * half * PX
  const W = 512, H = Math.round(W * length / width)
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })!
  if (flip) { g.translate(W, 0); g.scale(-1, 1) }
  drawStrip(g, img, W, H, tip, wrist, half)
  // Keep only what is connected to the wrist line: no tail, belt or body next to the hand.
  g.setTransform(1, 0, 0, 1, 0, 0)
  const data = g.getImageData(0, 0, W, H)
  const solid = (x: number, y: number) => data.data[(y * W + x) * 4 + 3] > 128
  const kept = new Uint8Array(W * H)
  const stack: number[] = []
  for (let x = W >> 2; x < W - (W >> 2); x++) if (solid(x, H - 2)) stack.push((H - 2) * W + x)
  while (stack.length) {
    const at = stack.pop()!
    if (kept[at]) continue
    kept[at] = 1
    const x = at % W, y = (at - x) / W
    if (x > 0 && solid(x - 1, y)) stack.push(at - 1)
    if (x < W - 1 && solid(x + 1, y)) stack.push(at + 1)
    if (y > 0 && solid(x, y - 1)) stack.push(at - W)
    if (y < H - 1 && solid(x, y + 1)) stack.push(at + W)
  }
  for (let i = 0; i < W * H; i++) if (!kept[i]) data.data[i * 4 + 3] = 0
  g.putImageData(data, 0, 0)

  // Distance to the edge of the silhouette, on a coarse grid; the wrist line does not count as an edge.
  const NX = 72, NY = Math.max(8, Math.round(NX * H / W))
  const node = (i: number, j: number) => j * (NX + 1) + i
  const dist = new Float32Array((NX + 1) * (NY + 1))
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const px = Math.min(W - 1, Math.round(i / NX * (W - 1))), py = Math.min(H - 1, Math.round((1 - j / NY) * (H - 1)))
    dist[node(i, j)] = kept[py * W + px] ? 1e6 : 0
  }
  const read = (i: number, j: number) => (i < 0 || i > NX || j > NY) ? 0 : j < 0 ? 1e6 : dist[node(i, j)]
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) if (dist[node(i, j)]) dist[node(i, j)] = Math.min(dist[node(i, j)], read(i - 1, j) + 1, read(i, j - 1) + 1, read(i - 1, j - 1) + 1.41, read(i + 1, j - 1) + 1.41)
  for (let j = NY; j >= 0; j--) for (let i = NX; i >= 0; i--) if (dist[node(i, j)]) dist[node(i, j)] = Math.min(dist[node(i, j)], read(i + 1, j) + 1, read(i, j + 1) + 1, read(i + 1, j + 1) + 1.41, read(i - 1, j + 1) + 1.41)

  const cell = width / NX
  const palm = length * PALM, depth = 0.03, reach = 0.035
  const position = new Float32Array((NX + 1) * (NY + 1) * 2 * 3)
  const uv = new Float32Array((NX + 1) * (NY + 1) * 2 * 2)
  for (let shell = 0; shell < 2; shell++) for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const at = shell * (NX + 1) * (NY + 1) + node(i, j)
    const d = Math.min(dist[node(i, j)] * cell / reach, 1)
    const z = (shell ? -1 : 1) * depth * Math.sqrt(1 - (1 - d) ** 2)
    const y = j / NY * length
    let py = y, pz = z
    if (y > palm) {
      // Fully closed around a handle, or just relaxed when the hand is free.
      const R = grip ? 0.028 : 0.16
      const angle = Math.min((y - palm) / R, 3.5)
      py = palm + (R + z) * Math.sin(angle)
      pz = -R + (R + z) * Math.cos(angle)
    }
    // A closed hand is narrower: the thumb comes back against the fingers.
    const squeeze = grip ? 1 - 0.28 * Math.min(Math.max((y - palm * 0.7) / (length * 0.3), 0), 1) : 1
    position.set([(i / NX - 0.5) * width * squeeze, py, pz], at * 3)
    uv.set([i / NX, j / NY], at * 2)
  }
  const index: number[] = []
  const used = (i: number, j: number) => dist[node(i, j)] > 0
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (!used(i, j) && !used(i + 1, j) && !used(i, j + 1) && !used(i + 1, j + 1)) continue
    const a = node(i, j), b = node(i + 1, j), e = node(i + 1, j + 1), f = node(i, j + 1), s = (NX + 1) * (NY + 1)
    index.push(a, b, e, a, e, f, s + a, s + e, s + b, s + a, s + f, s + e)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  const material = pictureMaterial(map, spec.roughness)
  material.alphaTest = 0.5 // The outline comes from the picture, not from the grid.
  return { geometry, material }
}

const hands = new Map<string, Promise<HandMesh>>()
export function handMesh(id: string, spec: ArmSpec, grip: boolean) {
  const key = `${id}:${grip}`
  let p = hands.get(key)
  if (!p) { p = buildHand(id, spec, grip); hands.set(key, p) }
  return p
}
