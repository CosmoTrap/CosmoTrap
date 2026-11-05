import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { rockSet } from '../textures'

// Champ d'astéroïdes : un seul sens de passage, des vitesses différentes.
// Le flux traverse le volume de la station en rasant la zone interdite, jamais en y entrant.
// Un choc ne fait que les décaler : ils gardent le même sens.
// Le maillage dépasse l'échelle nominale (bruit + étirement, ~1,9) : REACH le couvre, SKIN écarte du vitrage.

export interface KeepOut {
  cx: number
  cy: number
  cz: number
  hx: number
  hy: number
  hz: number
}

const REACH = 2
/** Écart entre la surface du rocher et la coque. Les gros modèles dépassent l'échelle, d'où la marge. */
const SKIN = 10
/** Rayon de contact entre rochers, collé au maillage (sans la marge de la coque). */
const BODY = 2.15
const DT_CAP = 0.05
const MIN_SPEED = 3.2
const MAX_SPEED = 10.5

export interface RockBody {
  p: THREE.Vector3
  v: THREE.Vector3
  rot: THREE.Euler
  spin: THREE.Vector3
  s: number
}

/** Sens commun du champ, dans le plan horizontal. */
const _flow = new THREE.Vector3(1, 0, 0)
const _side = new THREE.Vector3(0, 0, 1)

export function setAsteroidFlow(flow: THREE.Vector3) {
  _flow.set(flow.x, 0, flow.z)
  if (_flow.lengthSq() < 1e-6) _flow.set(1, 0, 0)
  else _flow.normalize()
  _side.set(-_flow.z, 0, _flow.x)
}

const _n = new THREE.Vector3()
const _span = { tmin: 0, tmax: 1e9 }
const seenPairs = new Set<number>()
const buckets = new Map<number, number[]>()
const bucketPool: number[][] = []

export function asteroidRadius(scale: number) {
  return scale * REACH + SKIN
}

export function bodyRadius(scale: number) {
  return Math.max(0.45, scale * BODY)
}

/** Vrai si la sphère est entièrement hors du volume de la station. */
export function outsideStation(p: THREE.Vector3, rad: number, box: KeepOut) {
  const dx = Math.abs(p.x - box.cx) - box.hx - rad
  const dy = Math.abs(p.y - box.cy) - box.hy - rad
  const dz = Math.abs(p.z - box.cz) - box.hz - rad
  return dx > 0 || dy > 0 || dz > 0
}

function rayBoxTime(ox: number, oy: number, oz: number, vx: number, vy: number, vz: number, hx: number, hy: number, hz: number) {
  _span.tmin = 0
  _span.tmax = 1e9
  if (!clipAxis(ox, vx, hx) || !clipAxis(oy, vy, hy) || !clipAxis(oz, vz, hz)) return null
  if (_span.tmax < 0) return null
  return _span.tmin < 0 ? 0 : _span.tmin
}

function clipAxis(o: number, vel: number, h: number) {
  if (Math.abs(vel) < 1e-6) return Math.abs(o) <= h
  let t1 = (-h - o) / vel
  let t2 = (h - o) / vel
  if (t1 > t2) {
    const s = t1
    t1 = t2
    t2 = s
  }
  if (t1 > _span.tmin) _span.tmin = t1
  if (t2 < _span.tmax) _span.tmax = t2
  return _span.tmin <= _span.tmax
}

/** Garde le sens du flux. Un écart latéral reste petit : c'est le décalage d'un choc, pas un demi-tour. */
function keepFlow(v: THREE.Vector3) {
  const forward = v.x * _flow.x + v.y * _flow.y + v.z * _flow.z
  const f = THREE.MathUtils.clamp(forward, MIN_SPEED, MAX_SPEED)
  let lx = v.x - _flow.x * forward
  let ly = v.y - _flow.y * forward
  let lz = v.z - _flow.z * forward
  const lat = Math.hypot(lx, ly, lz)
  if (lat > 0.7) {
    const s = 0.7 / lat
    lx *= s
    ly *= s
    lz *= s
  }
  v.set(_flow.x * f + lx, _flow.y * f + ly, _flow.z * f + lz)
}

/** Le flux est rectiligne. S'il entrerait dans la coque, on le décale sur le côté, sans changer son sens. */
function steerPast(p: THREE.Vector3, v: THREE.Vector3, rad: number, box: KeepOut, minY: number, dt: number) {
  const forward = v.x * _flow.x + v.y * _flow.y + v.z * _flow.z
  const damp = Math.exp(-0.4 * dt)
  v.x = _flow.x * forward + (v.x - _flow.x * forward) * damp
  v.y = _flow.y * forward + (v.y - _flow.y * forward) * damp
  v.z = _flow.z * forward + (v.z - _flow.z * forward) * damp
  keepFlow(v)

  const dx = p.x - box.cx
  const dy = p.y - box.cy
  const dz = p.z - box.cz
  const t = rayBoxTime(dx, dy, dz, v.x, v.y, v.z, box.hx + rad, box.hy + rad, box.hz + rad)
  if (t !== null && t < 5) {
    const off = dx * _side.x + dz * _side.z
    const push = off >= 0 ? 1 : -1
    const accel = Math.min(5, 12 / Math.max(t * t, 0.4))
    v.x += _side.x * push * accel * dt
    v.z += _side.z * push * accel * dt
    if (dy > 0) v.y += accel * 0.35 * dt
    keepFlow(v)
  }

  if (p.y < minY + 6 && v.y < 0) v.y += (minY + 6 - p.y) * dt * 0.6
}

/** Dernier filet : si un rocher est déjà dans la coque, il racle la face touchée et garde sa vitesse le long du mur. */
export function deflectFromStation(p: THREE.Vector3, v: THREE.Vector3, rad: number, box: KeepOut) {
  const dx = p.x - box.cx
  const dy = p.y - box.cy
  const dz = p.z - box.cz
  const ox = box.hx + rad - Math.abs(dx)
  const oy = box.hy + rad - Math.abs(dy)
  const oz = box.hz + rad - Math.abs(dz)
  if (ox <= 0 || oy <= 0 || oz <= 0) return false
  const e = 0.35
  const gap = 0.8
  if (ox <= oy && ox <= oz) {
    const sign = dx >= 0 ? 1 : -1
    p.x = box.cx + sign * (box.hx + rad + gap)
    if (v.x * sign < 0) v.x *= -e
  } else if (oy <= oz) {
    const sign = dy >= 0 ? 1 : -1
    p.y = box.cy + sign * (box.hy + rad + gap)
    if (v.y * sign < 0) v.y *= -e
  } else {
    const sign = dz >= 0 ? 1 : -1
    p.z = box.cz + sign * (box.hz + rad + gap)
    if (v.z * sign < 0) v.z *= -e
  }
  keepFlow(v)
  return true
}

/** @returns vrai si le filet de coque a dû rattraper le rocher. */
export function stepRock(p: THREE.Vector3, v: THREE.Vector3, rad: number, box: KeepOut, dt: number, minY = -80) {
  const h = Math.min(Math.max(dt, 0), DT_CAP)
  steerPast(p, v, rad, box, minY, h)
  p.addScaledVector(v, h)
  if (p.y < minY) {
    p.y = minY
    if (v.y < 0) v.y = -v.y * 0.45
  }
  return deflectFromStation(p, v, rad, box)
}

function laneMisses(p: THREE.Vector3, rad: number, box: KeepOut) {
  return rayBoxTime(p.x - box.cx, p.y - box.cy, p.z - box.cz, _flow.x, _flow.y, _flow.z, box.hx + rad, box.hy + rad, box.hz + rad) === null
}

export function placeRock(center: THREE.Vector3, box: KeepOut, minY = -80): RockBody {
  const p = new THREE.Vector3()
  const reach = box.hx * Math.abs(_side.x) + box.hz * Math.abs(_side.z)
  const over = Math.random() < 0.28
  const s = over ? 2.2 + Math.pow(Math.random(), 1.4) * 6 : 1.25 + Math.pow(Math.random(), 1.15) * 3.1
  const rad = asteroidRadius(s)
  const gap = 5 + Math.random() * (over ? 10 : 16)
  const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)
  const along = (Math.random() - 0.5) * (Math.max(box.hx, box.hz) * 2 + 170)
  let lateral = over ? (Math.random() - 0.5) * reach * 1.3 : (Math.random() < 0.5 ? 1 : -1) * (reach + rad + gap)
  let y = over ? Math.max(minY + 2, box.cy + box.hy + rad + gap) : Math.max(minY + 2, 1 + Math.random() * 12)
  p.copy(center)
  p.addScaledVector(_flow, along)
  p.addScaledVector(_side, lateral)
  p.y = y
  for (let i = 0; i < 8 && !laneMisses(p, rad, box); i++) {
    const push = lateral >= 0 ? 1 : -1
    p.addScaledVector(_side, push * 5)
    lateral += push * 5
    if (i > 3) p.y += 4
  }
  const v = new THREE.Vector3(_flow.x * speed, _flow.y * speed, _flow.z * speed)
  deflectFromStation(p, v, rad, box)
  return {
    p,
    v,
    rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
    spin: new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3),
    s,
  }
}

function wrapStream(p: THREE.Vector3, box: KeepOut) {
  const along = (p.x - box.cx) * _flow.x + (p.z - box.cz) * _flow.z
  const limit = Math.max(box.hx, box.hz) + 155
  if (along > limit) p.addScaledVector(_flow, -2 * limit)
}

/** Décalage léger : on évite la fusion, sans renvoyer les deux rochers dans des sens opposés. */
function hitRocks(a: RockBody, b: RockBody, box: KeepOut) {
  const ra = bodyRadius(a.s)
  const rb = bodyRadius(b.s)
  _n.subVectors(b.p, a.p)
  let dist = _n.length()
  const min = ra + rb
  if (dist >= min) return
  if (dist < 1e-4) {
    _n.copy(_side)
    dist = 1
  } else _n.multiplyScalar(1 / dist)

  const ma = Math.max(0.35, a.s * a.s * a.s)
  const mb = Math.max(0.35, b.s * b.s * b.s)
  const inv = 1 / (ma + mb)
  const pen = min - dist + 0.12
  a.p.addScaledVector(_n, -pen * (mb * inv))
  b.p.addScaledVector(_n, pen * (ma * inv))

  const reln = (b.v.x - a.v.x) * _n.x + (b.v.y - a.v.y) * _n.y + (b.v.z - a.v.z) * _n.z
  if (reln < 0) {
    const j = -(1 + 0.08) * reln * 0.22 / (1 / ma + 1 / mb)
    a.v.addScaledVector(_n, -j / ma)
    b.v.addScaledVector(_n, j / mb)
    a.spin.x += _n.y * 0.15
    b.spin.z -= _n.x * 0.15
  }
  keepFlow(a.v)
  keepFlow(b.v)
  deflectFromStation(a.p, a.v, asteroidRadius(a.s), box)
  deflectFromStation(b.p, b.v, asteroidRadius(b.s), box)
}

const CELL = 36

/** Sépare les rochers qui se chevauchent, sans changer le sens du flux. */
export function resolveCollisions(rocks: RockBody[], box: KeepOut) {
  seenPairs.clear()
  for (const bin of buckets.values()) {
    bin.length = 0
    bucketPool.push(bin)
  }
  buckets.clear()

  for (let i = 0; i < rocks.length; i++) {
    const a = rocks[i]
    const rad = bodyRadius(a.s)
    const x0 = Math.floor((a.p.x - rad) / CELL)
    const x1 = Math.floor((a.p.x + rad) / CELL)
    const y0 = Math.floor((a.p.y - rad) / CELL)
    const y1 = Math.floor((a.p.y + rad) / CELL)
    const z0 = Math.floor((a.p.z - rad) / CELL)
    const z1 = Math.floor((a.p.z + rad) / CELL)
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          const key = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0
          let bin = buckets.get(key)
          if (!bin) {
            bin = bucketPool.pop() ?? []
            buckets.set(key, bin)
          }
          for (let k = 0; k < bin.length; k++) {
            const j = bin[k]
            const lo = i < j ? i : j
            const hi = i < j ? j : i
            const id = lo * 1024 + hi
            if (seenPairs.has(id)) continue
            seenPairs.add(id)
            hitRocks(a, rocks[j], box)
          }
          bin.push(i)
        }
      }
    }
  }
}

export function stepField(rocks: RockBody[], box: KeepOut, dt: number, minY = -80) {
  const h = Math.min(Math.max(dt, 0), DT_CAP)
  for (const r of rocks) {
    stepRock(r.p, r.v, asteroidRadius(Math.max(r.s, 0.2)), box, h, minY)
    wrapStream(r.p, box)
  }
  resolveCollisions(rocks, box)
}

/** Passage au large : la trajectoire longe une face, en s'écartant, sans entrer dans le volume. */
export function planMeteor(box: KeepOut, rng: () => number = Math.random) {
  const dur = 3.2 + rng() * 1.6
  const side = Math.floor(rng() * 4)
  const gap = 28 + rng() * 40
  const along = 480 + rng() * 220
  const y0 = 8 + rng() * 36
  const y1 = y0 + (rng() - 0.5) * 24
  const from = new THREE.Vector3()
  const dir = new THREE.Vector3()
  if (side === 0) {
    from.set(box.cx + box.hx + gap, y0, box.cz - along)
    dir.set(0.05, (y1 - y0) / (along * 2), 1)
  } else if (side === 1) {
    from.set(box.cx - box.hx - gap, y0, box.cz - along)
    dir.set(-0.05, (y1 - y0) / (along * 2), 1)
  } else if (side === 2) {
    from.set(box.cx - along, y0, box.cz + box.hz + gap)
    dir.set(1, (y1 - y0) / (along * 2), 0.05)
  } else {
    from.set(box.cx - along, y0, box.cz - box.hz - gap)
    dir.set(1, (y1 - y0) / (along * 2), -0.05)
  }
  const travel = along * 2
  dir.normalize()
  const alongAxis = side < 2 ? Math.abs(dir.z) : Math.abs(dir.x)
  return { from, dir, speed: travel / (dur * alongAxis), dur }
}

function hash(x: number, y: number, z: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const s = (t: number) => t * t * (3 - 2 * t)
  const u = s(xf)
  const v = s(yf)
  const w = s(zf)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(
    l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v),
    w,
  )
}

export function rockGeometry(seed: number, detail = 4, rough = 0.35) {
  const g = new THREE.IcosahedronGeometry(1, detail)
  const p = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  const st = [0.8 + hash(seed, 1, 2) * 0.6, 0.6 + hash(seed, 3, 4) * 0.5, 0.7 + hash(seed, 5, 6) * 0.6]
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    let d = 0
    let a = 1
    let f = 1.3
    for (let o = 0; o < 5; o++) {
      d += (vnoise(v.x * f + seed * 7, v.y * f, v.z * f) - 0.5) * a
      a *= 0.5
      f *= 2.1
    }
    // cratères grossiers
    const c = vnoise(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2)
    d -= Math.max(0, c - 0.68) * 1.2
    v.multiplyScalar(1 + d * rough)
    v.set(v.x * st[0], v.y * st[1], v.z * st[2])
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

export function Asteroids({ center, count = 220, keepOut, minY = -80, flow }: { center: THREE.Vector3; count?: number; keepOut: KeepOut; minY?: number; flow?: THREE.Vector3 }) {
  const variants = 4
  const geos = useMemo(() => Array.from({ length: variants }, (_, i) => rockGeometry(i + 1)), [])
  const mat = useMemo(() => {
    const s = rockSet(512, '#5e5650')
    return new THREE.MeshStandardMaterial({ ...s, roughness: 1, metalness: 0, envMapIntensity: 0.05, fog: false })
  }, [])
  const per = Math.ceil(count / variants)
  const data = useMemo(() => {
    if (flow) setAsteroidFlow(flow)
    const list: RockBody[] = []
    for (let k = 0; k < variants; k++) for (let i = 0; i < per; i++) list.push(placeRock(center, keepOut, minY))
    return list
  }, [center, per, keepOut, minY, flow])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const h = Math.min(Math.max(dt, 0), 0.05)
    if (flow) setAsteroidFlow(flow)
    stepField(data, keepOut, h, minY)
    for (let k = 0; k < variants; k++) {
      const im = refs.current[k]
      if (!im) continue
      for (let i = 0; i < per; i++) {
        const d = data[k * per + i]
        d.rot.x += d.spin.x * h
        d.rot.y += d.spin.y * h
        d.rot.z += d.spin.z * h
        q.setFromEuler(d.rot)
        sc.setScalar(d.s)
        m4.compose(d.p, q, sc)
        im.setMatrixAt(i, m4)
      }
      im.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <group>
      {geos.map((g, k) => (
        <instancedMesh key={k} ref={(r) => (refs.current[k] = r)} args={[g, mat, per]} castShadow frustumCulled={false} />
      ))}
      <Meteor keepOut={keepOut} />
    </group>
  )
}

function Meteor({ keepOut }: { keepOut: KeepOut }) {
  const g = useRef<THREE.Group>(null)
  const st = useRef({ t: 99, dur: 4, speed: 260, from: new THREE.Vector3(), dir: new THREE.Vector3() })
  const trail = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uA: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        // Keep the fractional power finite at interpolated UV edges, as for sunlight shafts.
        fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float a = pow(1.0 - clamp(vUv.y, 0.0, 1.0), 2.5); gl_FragColor = vec4(vec3(1.0, 0.55, 0.2) * a * 8.0 * uA, 1.0); }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )
  useFrame((_, dt) => {
    const s = st.current
    s.t += dt
    if (s.t > s.dur + 6 + Math.random() * 8) {
      const fly = planMeteor(keepOut)
      s.t = 0
      s.dur = fly.dur
      s.speed = fly.speed
      s.from.copy(fly.from)
      s.dir.copy(fly.dir)
    }
    if (!g.current) return
    const vis = s.t < s.dur
    g.current.visible = vis
    if (!vis) return
    const p = s.from.clone().addScaledVector(s.dir, s.t * s.speed)
    g.current.position.copy(p)
    g.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), s.dir)
  })
  return (
    <group ref={g} visible={false}>
      <mesh>
        <sphereGeometry args={[1.6, 12, 8]} />
        <meshBasicMaterial color={new THREE.Color(9, 4, 1.5)} fog={false} />
      </mesh>
      <mesh position={[0, 30, 0]} material={trail}>
        <cylinderGeometry args={[2.5, 0.5, 60, 12, 1, true]} />
      </mesh>
    </group>
  )
}
