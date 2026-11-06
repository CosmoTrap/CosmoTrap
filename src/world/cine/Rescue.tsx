import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { terrainHeight } from '../../game/maps/zone4'
import { G } from '../../game/state'
import { drawTexture } from '../textures'

// The end of the mission: the flare has been seen. Over the helipad's plateau come the rescue helicopter,
// news helicopters, then the emergency services by road (police, ambulance, firefighters) and, last of all,
// CosmoTrap, the space company the crew works for. Everything here runs from the 'heli' cinematic's clock.

const sm = THREE.MathUtils.smoothstep
export const PAD = new THREE.Vector3(6, 0, -60)
/** Seconds since the rescue began, or -1 outside it. */
export const rescueTime = () => (G().cine === 'heli' ? (performance.now() - G().cineT0) / 1000 : -1)

type Kind = 'police' | 'ambulance' | 'fire' | 'cosmotrap' | 'cosmotrapVan'
interface Vehicle { kind: Kind; route: [number, number][]; from: number; to: number }

/**
 * Each comes down from the hills to the east on its own lane, at least 4 m from the next, and drives straight
 * to its own parking place round the helipad: no two ever share the road, so none drives through another.
 */
const lane = (z: number, parkX: number): [number, number][] => [[64, z], [parkX + 6, z], [parkX, z]]
export const VEHICLES: Vehicle[] = [
  { kind: 'police', route: lane(-52, 18), from: 9, to: 15.5 },
  { kind: 'police', route: lane(-66, 19), from: 10, to: 16.5 },
  { kind: 'ambulance', route: lane(-71, 13), from: 11, to: 18 },
  { kind: 'fire', route: lane(-59.5, 24), from: 12.5, to: 20 },
  { kind: 'cosmotrap', route: lane(-47, 14), from: 15, to: 22.5 },
  { kind: 'cosmotrapVan', route: lane(-42, -2), from: 16, to: 23.5 },
]

/** Where a vehicle is at time t: along its route, slowing down as it arrives, sitting on the ground. */
export function vehiclePose(v: Vehicle, t: number) {
  const k = 1 - Math.pow(1 - THREE.MathUtils.clamp((t - v.from) / (v.to - v.from), 0, 1), 2.2)
  const seg = v.route.slice(1).map((p, i) => Math.hypot(p[0] - v.route[i][0], p[1] - v.route[i][1]))
  let d = k * seg.reduce((a, b) => a + b, 0)
  let i = 0
  while (i < seg.length - 1 && d > seg[i]) d -= seg[i++]
  const [ax, az] = v.route[i], [bx, bz] = v.route[i + 1]
  const f = seg[i] ? d / seg[i] : 0
  const x = ax + (bx - ax) * f, z = az + (bz - az) * f
  const yaw = Math.atan2(bx - ax, bz - az)
  const fx = Math.sin(yaw), fz = Math.cos(yaw)
  const pitch = -Math.atan2(terrainHeight(x + fx * 1.5, z + fz * 1.5) - terrainHeight(x - fx * 1.5, z - fz * 1.5), 3)
  return { x, y: terrainHeight(x, z), z, yaw, pitch, moving: k > 0 && k < 1, arrived: k >= 1 }
}

interface HeliRoute { label: string; body: string; stripe: string; from: [number, number, number]; arrive: number; radius: number; height: number; phase: number }
/** News crews: they come in from either side, then circle the plateau to film it. */
export const NEWS_HELIS: HeliRoute[] = [
  { label: 'TV INFO', body: '#1f4fa8', stripe: '#f2f2ee', from: [-160, 70, -150], arrive: 15, radius: 34, height: 26, phase: 0.6 },
  { label: 'NEWS 24', body: '#f0b31d', stripe: '#1b1d20', from: [170, 80, -170], arrive: 17, radius: 46, height: 33, phase: 3.4 },
]

export function newsHeliPose(h: HeliRoute, t: number) {
  const orbit = (time: number) => {
    const a = h.phase + time * 0.16
    return new THREE.Vector3(PAD.x + Math.sin(a) * h.radius, terrainHeight(PAD.x, PAD.z) + h.height, PAD.z + Math.cos(a) * h.radius)
  }
  const start = 6
  const k = sm(t, start, h.arrive)
  const p = new THREE.Vector3(...h.from).lerp(orbit(h.arrive), k)
  if (t > h.arrive) p.copy(orbit(t))
  const ahead = t > h.arrive ? orbit(t + 0.3) : new THREE.Vector3(...h.from).lerp(orbit(h.arrive), sm(t + 0.3, start, h.arrive))
  return { pos: p, yaw: Math.atan2(ahead.x - p.x, ahead.z - p.z), bank: t > h.arrive ? -0.18 : 0, visible: t > start }
}

/** Livery text, on a transparent sheet. */
function livery(text: string, color: string, w = 512, h = 96, size = 64) {
  return drawTexture(w, h, (c) => {
    c.clearRect(0, 0, w, h)
    c.fillStyle = color
    // Long names shrink to fit the panel rather than run off its edges.
    c.font = `800 ${size}px Inter, Arial, sans-serif`
    const fit = Math.min(size, (size * w * 0.92) / Math.max(1, c.measureText(text).width))
    c.font = `800 ${fit}px Inter, Arial, sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(text, w / 2, h / 2 + 4)
  })
}

type P = [number, number]
/**
 * Each vehicle drawn from its side profile (z forward, y up, metres): a real silhouette with its wheel arches,
 * extruded across its width with rounded edges; side windows, windscreens, wheels and trim are fitted to it.
 */
interface Design {
  len: number; wid: number; wheel: number; sill: number; wheels: number[]
  body: P[]; windows: P[][]; screens: [P, P][]
  bar: [number, number]; belt: number; text: [number, number, number]; headY: number
  paint: string; stripe: string; label: string; labelColor: string; lights: [string, string]
}
const DESIGNS: Record<Kind, Design> = {
  police: {
    len: 4.7, wid: 1.82, wheel: 0.33, sill: 0.28, wheels: [1.42, -1.42],
    body: [[-2.35, 0.28], [-2.4, 0.62], [-2.32, 0.92], [-1.95, 0.98], [-1.35, 1.0], [-0.85, 1.4], [0.25, 1.44], [0.55, 1.42], [1.25, 0.98], [2.0, 0.88], [2.35, 0.72], [2.4, 0.45], [2.35, 0.28]],
    windows: [[[-1.22, 1.03], [-0.83, 1.36], [-0.06, 1.37], [-0.06, 1.03]], [[0.04, 1.03], [0.04, 1.37], [0.5, 1.37], [1.12, 1.03]]],
    screens: [[[-1.33, 1.01], [-0.86, 1.39]], [[0.56, 1.41], [1.24, 0.99]]],
    bar: [-0.15, 1.45], belt: 0.7, text: [-0.15, 0.78, 2.6], headY: 0.74,
    paint: '#f2f3f5', stripe: '#1d3f8a', label: 'POLICE', labelColor: '#1d3f8a', lights: ['#2f6bff', '#2f6bff'],
  },
  cosmotrap: {
    len: 4.9, wid: 1.95, wheel: 0.38, sill: 0.33, wheels: [1.5, -1.5],
    body: [[-2.45, 0.33], [-2.5, 0.75], [-2.42, 1.55], [-2.2, 1.78], [0.5, 1.82], [0.75, 1.78], [1.45, 1.18], [2.25, 1.05], [2.45, 0.85], [2.5, 0.5], [2.45, 0.33]],
    windows: [[[-2.2, 1.22], [-2.12, 1.66], [-0.92, 1.68], [-0.92, 1.22]], [[-0.82, 1.22], [-0.82, 1.68], [0.3, 1.68], [0.3, 1.22]], [[0.4, 1.22], [0.4, 1.68], [0.7, 1.68], [1.32, 1.22]]],
    screens: [[[-2.44, 1.25], [-2.26, 1.72]], [[0.78, 1.75], [1.42, 1.2]]],
    bar: [-0.3, 1.83], belt: 0.95, text: [-0.4, 0.95, 2.8], headY: 0.9,
    paint: '#16181c', stripe: '#e8602a', label: 'COSMOTRAP', labelColor: '#e8602a', lights: ['#ffb020', '#ffb020'],
  },
  ambulance: {
    len: 5.8, wid: 2.05, wheel: 0.38, sill: 0.34, wheels: [1.95, -1.85],
    body: [[-2.9, 0.34], [-2.95, 0.6], [-2.92, 2.5], [-2.8, 2.6], [1.3, 2.6], [1.5, 2.5], [2.35, 1.35], [2.85, 1.15], [2.95, 0.85], [2.95, 0.5], [2.9, 0.34]],
    windows: [[[1.25, 1.42], [1.25, 2.2], [1.5, 2.2], [2.12, 1.42]], [[-0.5, 1.65], [-0.5, 2.15], [0.5, 2.15], [0.5, 1.65]]],
    screens: [[[1.55, 2.45], [2.32, 1.38]]],
    bar: [1.0, 2.62], belt: 1.15, text: [-0.9, 1.25, 3.4], headY: 0.88,
    paint: '#f4f4f0', stripe: '#e8b21d', label: 'SAMU · AMBULANCE', labelColor: '#c22a22', lights: ['#2f6bff', '#2f6bff'],
  },
  cosmotrapVan: {
    len: 5.8, wid: 2.05, wheel: 0.38, sill: 0.34, wheels: [1.95, -1.85],
    body: [[-2.9, 0.34], [-2.95, 0.6], [-2.92, 2.5], [-2.8, 2.6], [1.3, 2.6], [1.5, 2.5], [2.35, 1.35], [2.85, 1.15], [2.95, 0.85], [2.95, 0.5], [2.9, 0.34]],
    windows: [[[1.25, 1.42], [1.25, 2.2], [1.5, 2.2], [2.12, 1.42]]],
    screens: [[[1.55, 2.45], [2.32, 1.38]]],
    bar: [1.0, 2.62], belt: 1.1, text: [-0.8, 1.7, 3.8], headY: 0.88,
    paint: '#f2f1ec', stripe: '#e8602a', label: 'COSMOTRAP · MISSION CONTROL', labelColor: '#16181c', lights: ['#ffb020', '#ffb020'],
  },
  fire: {
    len: 8.2, wid: 2.5, wheel: 0.52, sill: 0.5, wheels: [2.85, -1.9, -3.05],
    body: [[-4.1, 0.5], [-4.12, 2.9], [-4.0, 3.0], [2.0, 3.0], [2.05, 2.75], [2.1, 2.8], [3.55, 2.8], [3.8, 2.55], [4.05, 1.6], [4.12, 0.9], [4.1, 0.5]],
    windows: [[[2.22, 1.78], [2.22, 2.55], [3.45, 2.55], [3.85, 1.78]]],
    screens: [[[3.62, 2.72], [4.0, 1.78]]],
    bar: [2.9, 2.82], belt: 1.0, text: [-1.0, 2.35, 4.6], headY: 1.0,
    paint: '#c41f1a', stripe: '#f2f2ee', label: 'SAPEURS-POMPIERS', labelColor: '#f2f2ee', lights: ['#2f6bff', '#2f6bff'],
  },
}

/** Body outline with a real arch over each wheel. */
function silhouette(d: Design) {
  const shape = new THREE.Shape(), R = d.wheel + 0.07
  shape.moveTo(...d.body[0])
  for (const p of d.body.slice(1)) shape.lineTo(...p)
  for (const wz of [...d.wheels].sort((a, b) => b - a)) {
    shape.lineTo(wz + R, d.sill)
    shape.lineTo(wz + R, d.wheel)
    shape.absarc(wz, d.wheel, R, 0, Math.PI, false)
    shape.lineTo(wz - R, d.sill)
  }
  shape.closePath()
  return shape
}
/** A profile extruded across the car, centred, with x across and z forward. */
function across(shape: THREE.Shape, width: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 14 })
  return g.translate(0, 0, -(width - 2 * bevel) / 2).rotateY(-Math.PI / 2)
}

/** Shared materials and geometries: built once per kind, reused by every vehicle of that kind. */
const kits = new Map<Kind, ReturnType<typeof buildKit>>()
let common: ReturnType<typeof buildCommon> | null = null
function buildCommon() {
  const shutter = drawTexture(128, 256, (c) => {
    c.fillStyle = '#9a1714'; c.fillRect(0, 0, 128, 256)
    for (let y = 0; y < 256; y += 10) { c.fillStyle = '#6e0f0d'; c.fillRect(0, y, 128, 2); c.fillStyle = '#c23a33'; c.fillRect(0, y + 2, 128, 1) }
  })
  return {
    glass: new THREE.MeshStandardMaterial({ color: '#0d1319', roughness: 0.05, metalness: 0.75, envMapIntensity: 1.4 }),
    trim: new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 0.6, metalness: 0.2 }),
    tyre: new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: '#b4b9be', roughness: 0.25, metalness: 0.95 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#d7dadd', roughness: 0.15, metalness: 1 }),
    head: new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4d2', emissiveIntensity: 2.2 }),
    tail: new THREE.MeshStandardMaterial({ color: '#5a0a08', emissive: '#ff2a1a', emissiveIntensity: 1.2 }),
    shutter: new THREE.MeshStandardMaterial({ map: shutter, roughness: 0.45, metalness: 0.5 }),
  }
}
function buildKit(kind: Kind) {
  const d = DESIGNS[kind]
  const body = across(silhouette(d), d.wid, 0.07)
  const windows = d.windows.map((w) => across(new THREE.Shape(w.map(([z, y]) => new THREE.Vector2(z, y))), d.wid + 0.012, 0))
  const tyre = new THREE.CylinderGeometry(d.wheel, d.wheel, 0.28, 28).rotateZ(Math.PI / 2)
  const liner = new THREE.CylinderGeometry(d.wheel + 0.06, d.wheel + 0.06, d.wid - 0.16, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2)
  return {
    d, body, windows, tyre, liner,
    paint: new THREE.MeshStandardMaterial({ color: d.paint, roughness: 0.28, metalness: 0.45, envMapIntensity: 1.1 }),
    stripe: new THREE.MeshStandardMaterial({ color: d.stripe, roughness: 0.35, metalness: 0.25 }),
    text: new THREE.MeshStandardMaterial({ map: livery(d.label, d.labelColor), transparent: true, roughness: 0.5 }),
    linerMat: new THREE.MeshStandardMaterial({ color: '#0b0c0d', roughness: 1, side: THREE.DoubleSide }),
  }
}

/** A road vehicle, nose towards +z, built on its real side profile. */
function VehicleModel({ kind, flashRef }: { kind: Kind; flashRef: (m: THREE.MeshStandardMaterial[]) => void }) {
  const c = (common ??= buildCommon())
  let k = kits.get(kind)
  if (!k) { k = buildKit(kind); kits.set(kind, k) }
  const { d } = k
  const front = d.body.reduce((m, [z]) => Math.max(m, z), -Infinity), rear = d.body.reduce((m, [z]) => Math.min(m, z), Infinity)
  const beacons = useMemo(() => [0, 1].map((i) => new THREE.MeshStandardMaterial({ color: '#111', emissive: d.lights[i], emissiveIntensity: 0 })), [d])
  useEffect(() => { flashRef(beacons) }, [beacons, flashRef])
  useEffect(() => () => beacons.forEach((m) => m.dispose()), [beacons])
  const half = d.wid / 2
  // Door seams: at each window pillar, from the sill to the belt line.
  const seams = d.windows.flatMap((w) => [Math.min(...w.map(([z]) => z)) - 0.05])
  return (
    <group>
      <mesh geometry={k.body} material={k.paint} castShadow receiveShadow />
      {k.windows.map((g, i) => <mesh key={i} geometry={g} material={c.glass} />)}
      {/* Windscreens: glass laid along the profile's slopes, just proud of the paint. */}
      {d.screens.map(([[z1, y1], [z2, y2]], i) => {
        const dz = z2 - z1, dy = y2 - y1, l = Math.hypot(dz, dy)
        return <mesh key={i} position={[0, (y1 + y2) / 2 + (dz / l) * 0.03, (z1 + z2) / 2 - (dy / l) * 0.03]} rotation={[Math.atan2(-dy, dz), 0, 0]} material={c.glass}>
          <boxGeometry args={[d.wid - 0.2, 0.012, l * 0.92]} />
        </mesh>
      })}
      {/* Wheel arches, tyres and five-spoke rims. */}
      {d.wheels.map((wz) => <group key={wz} position={[0, d.wheel, wz]}>
        <mesh geometry={k!.liner} material={k!.linerMat} />
        {[1, -1].map((side) => <group key={side} position={[side * (half - 0.16), 0, 0]}>
          <mesh geometry={k!.tyre} material={c.tyre} castShadow />
          <mesh position={[side * 0.142, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={c.rim}><cylinderGeometry args={[d.wheel * 0.62, d.wheel * 0.62, 0.012, 20]} /></mesh>
          {[0, 1, 2, 3, 4].map((s) => <mesh key={s} position={[side * 0.15, 0, 0]} rotation={[s * Math.PI * 0.4, 0, 0]} material={c.trim}><boxGeometry args={[0.012, d.wheel * 0.95, 0.07]} /></mesh>)}
          <mesh position={[side * 0.155, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={c.chrome}><cylinderGeometry args={[d.wheel * 0.16, d.wheel * 0.16, 0.02, 12]} /></mesh>
        </group>)}
      </group>)}
      {/* Bumpers, grille, lamps. */}
      {[front, rear].map((z, i) => <mesh key={z} position={[0, d.sill + 0.16, z + (i ? -0.04 : 0.04)]} material={c.trim} castShadow><boxGeometry args={[d.wid + 0.04, 0.24, 0.16]} /></mesh>)}
      <mesh position={[0, d.headY - 0.02, front + 0.07]} material={c.trim}><boxGeometry args={[d.wid * 0.42, 0.2, 0.02]} /></mesh>
      <mesh position={[0, d.headY + 0.09, front + 0.081]} material={c.chrome}><boxGeometry args={[d.wid * 0.42, 0.025, 0.01]} /></mesh>
      {[1, -1].map((side) => <group key={side}>
        <mesh position={[side * half * 0.68, d.headY, front + 0.075]} material={c.head}><boxGeometry args={[0.34, 0.13, 0.02]} /></mesh>
        <mesh position={[side * half * 0.76, d.headY + 0.05, rear - 0.075]} material={c.tail}><boxGeometry args={[0.24, 0.2, 0.02]} /></mesh>
        {/* Mirror on its arm, ahead of the front side window. */}
        <mesh position={[side * (half + 0.09), Math.min(...d.windows[0].map(([, y]) => y)) + 0.12, Math.max(...d.windows[0].map(([z]) => z)) - 0.12]} material={c.trim}><boxGeometry args={[0.1, 0.14, 0.2]} /></mesh>
        {/* Livery: stripe along the flank and lettering. */}
        <mesh position={[side * (half + 0.004), d.belt, (front + rear) / 2]} rotation={[0, side * Math.PI / 2, 0]} material={k!.stripe}><planeGeometry args={[(front - rear) * 0.96, 0.13]} /></mesh>
        <mesh position={[side * (half + 0.008), d.text[1], d.text[0]]} rotation={[0, side * Math.PI / 2, 0]} material={k!.text}><planeGeometry args={[d.text[2], d.text[2] * 0.19]} /></mesh>
        {seams.map((z) => <mesh key={z} position={[side * (half + 0.003), (d.sill + d.belt) / 2 + 0.1, z]} rotation={[0, side * Math.PI / 2, 0]} material={c.trim}><planeGeometry args={[0.012, d.belt - d.sill + 0.2]} /></mesh>)}
        {/* Fire engine: roller shutters on the equipment lockers. */}
        {kind === 'fire' && [-2.6, -0.6, 1.2].map((z) => <mesh key={z} position={[side * (half + 0.006), 1.55, z]} rotation={[0, side * Math.PI / 2, 0]} material={c.shutter}><planeGeometry args={[1.7, 1.75]} /></mesh>)}
      </group>)}
      {kind === 'fire' && <group position={[0, 3.12, -0.9]}>
        {[-0.45, 0.45].map((x) => <mesh key={x} position={[x, 0, 0]} material={c.chrome}><boxGeometry args={[0.07, 0.12, 5.4]} /></mesh>)}
        {Array.from({ length: 14 }, (_, i) => <mesh key={i} position={[0, 0, -2.6 + i * 0.4]} material={c.chrome}><boxGeometry args={[0.9, 0.035, 0.045]} /></mesh>)}
      </group>}
      {/* The light bar, its two halves flashing in turn. */}
      <group position={[0, d.bar[1] + 0.04, d.bar[0]]}>
        <mesh material={c.trim}><boxGeometry args={[d.wid * 0.72, 0.06, 0.3]} /></mesh>
        {[-1, 1].map((x, i) => <mesh key={x} position={[x * d.wid * 0.18, 0.07, 0]} material={beacons[i]}><boxGeometry args={[d.wid * 0.32, 0.1, 0.26]} /></mesh>)}
      </group>
    </group>
  )
}

function Vehicle({ v, index }: { v: Vehicle; index: number }) {
  const g = useRef<THREE.Group>(null)
  const beacons = useRef<THREE.MeshStandardMaterial[]>([])
  useFrame(() => {
    const t = rescueTime()
    if (!g.current) return
    g.current.visible = t >= v.from
    if (!g.current.visible) return
    const p = vehiclePose(v, t)
    g.current.position.set(p.x, p.y, p.z)
    g.current.rotation.set(p.pitch, p.yaw, 0, 'YXZ')
    // Two-phase flashing, each vehicle on its own beat.
    const on = Math.floor(t * 4.2 + index * 0.37) % 2
    beacons.current.forEach((m, i) => (m.emissiveIntensity = i === on ? 4 : 0.15))
  })
  return <group ref={g} visible={false} name={`rescue-${v.kind}`}><VehicleModel kind={v.kind} flashRef={(m) => (beacons.current = m)} /></group>
}

/** A light single-rotor helicopter in a broadcaster's colours. */
function NewsHeli({ h }: { h: HeliRoute }) {
  const g = useRef<THREE.Group>(null)
  const rotor = useRef<THREE.Group>(null)
  const mats = useMemo(() => ({
    body: new THREE.MeshStandardMaterial({ color: h.body, roughness: 0.3, metalness: 0.4 }),
    stripe: new THREE.MeshStandardMaterial({ color: h.stripe, roughness: 0.35, metalness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: '#141b22', roughness: 0.05, metalness: 0.7 }),
    dark: new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.5, metalness: 0.6 }),
    text: new THREE.MeshStandardMaterial({ map: livery(h.label, h.stripe, 512, 128, 96), transparent: true }),
    strobe: new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ff3020', emissiveIntensity: 0 }),
  }), [h])
  useEffect(() => () => Object.values(mats).forEach((m) => { m.map?.dispose(); m.dispose() }), [mats])
  useFrame((_, dt) => {
    const t = rescueTime()
    if (!g.current) return
    const p = newsHeliPose(h, t)
    g.current.visible = t >= 0 && p.visible
    if (!g.current.visible) return
    g.current.position.copy(p.pos)
    g.current.rotation.set(0.08, p.yaw, p.bank, 'YXZ')
    if (rotor.current) rotor.current.rotation.y += dt * 40
    mats.strobe.emissiveIntensity = (t * 1.3) % 1 < 0.08 ? 5 : 0
  })
  return (
    <group ref={g} visible={false} name="news-heli">
      <mesh scale={[0.95, 0.9, 1.9]} position={[0, 1.2, 0]} material={mats.body} castShadow><sphereGeometry args={[1, 24, 16]} /></mesh>
      <mesh scale={[0.85, 0.65, 0.95]} position={[0, 1.38, 1.15]} material={mats.glass}><sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 1.7]} /></mesh>
      <mesh position={[0, 1.45, -3.2]} rotation={[Math.PI / 2, 0, 0]} material={mats.body}><cylinderGeometry args={[0.12, 0.3, 4.2, 12]} /></mesh>
      <mesh position={[0, 1.95, -5.15]} material={mats.stripe}><boxGeometry args={[0.08, 1.0, 0.7]} /></mesh>
      {[1, -1].map((s) => <group key={s}>
        <mesh position={[s * 0.96, 1.15, -0.2]} rotation={[0, s * Math.PI / 2, 0]} material={mats.text}><planeGeometry args={[2.2, 0.55]} /></mesh>
        <mesh position={[s * 0.75, 0.15, 0]} material={mats.dark}><boxGeometry args={[0.07, 0.07, 2.6]} /></mesh>
      </group>)}
      {/* The camera turret under the nose: that is what makes it a news helicopter. */}
      <mesh position={[0, 0.45, 1.5]} material={mats.dark}><sphereGeometry args={[0.28, 16, 12]} /></mesh>
      <mesh position={[0, 0.42, 1.78]} material={mats.glass}><circleGeometry args={[0.12, 14]} /></mesh>
      <mesh position={[0, 0.25, -0.1]} material={mats.strobe}><boxGeometry args={[0.15, 0.08, 0.15]} /></mesh>
      <mesh position={[0, 2.25, 0]} material={mats.dark}><cylinderGeometry args={[0.1, 0.1, 0.4, 10]} /></mesh>
      <group ref={rotor} position={[0, 2.48, 0]}>
        {[0, 1].map((k) => <mesh key={k} rotation={[0, (k * Math.PI) / 2, 0]} material={mats.dark}><boxGeometry args={[9.2, 0.04, 0.26]} /></mesh>)}
      </group>
    </group>
  )
}

export function RescueScene() {
  return (
    <group name="rescue-scene">
      {VEHICLES.map((v, i) => <Vehicle key={i} v={v} index={i} />)}
      {NEWS_HELIS.map((h, i) => <NewsHeli key={i} h={h} />)}
    </group>
  )
}
