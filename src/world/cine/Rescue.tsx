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

/** Each comes down from the hills to the east and parks around the helipad, leaving the pad clear. */
export const VEHICLES: Vehicle[] = [
  { kind: 'police', route: [[52, -58], [30, -58], [17, -55]], from: 9, to: 15.5 },
  { kind: 'police', route: [[56, -63], [30, -63], [19, -66]], from: 10, to: 16.5 },
  { kind: 'ambulance', route: [[60, -60], [30, -60], [12, -68]], from: 11, to: 18 },
  { kind: 'fire', route: [[64, -62], [34, -62], [25, -61]], from: 12.5, to: 20 },
  { kind: 'cosmotrap', route: [[62, -60], [32, -60], [15, -50.5]], from: 15, to: 22.5 },
  { kind: 'cosmotrapVan', route: [[66, -61], [34, -61], [8, -51], [-5, -50]], from: 16, to: 23.5 },
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

const SPEC: Record<Kind, { len: number; wid: number; hgt: number; body: string; stripe: string; text: string; textColor: string; lights: [string, string]; cab: number }> = {
  police: { len: 4.6, wid: 1.85, hgt: 1.45, body: '#f2f3f5', stripe: '#1d3f8a', text: 'POLICE', textColor: '#1d3f8a', lights: ['#2f6bff', '#2f6bff'], cab: 0.55 },
  ambulance: { len: 5.8, wid: 2.1, hgt: 2.6, body: '#f4f4f0', stripe: '#e8b21d', text: 'SAMU · AMBULANCE', textColor: '#c22a22', lights: ['#2f6bff', '#2f6bff'], cab: 0.3 },
  fire: { len: 8.2, wid: 2.5, hgt: 3.0, body: '#c41f1a', stripe: '#f2f2ee', text: 'SAPEURS-POMPIERS', textColor: '#f2f2ee', lights: ['#2f6bff', '#2f6bff'], cab: 0.27 },
  cosmotrap: { len: 4.9, wid: 1.95, hgt: 1.75, body: '#16181c', stripe: '#e8602a', text: 'COSMOTRAP', textColor: '#e8602a', lights: ['#ffb020', '#ffb020'], cab: 0.6 },
  cosmotrapVan: { len: 5.6, wid: 2.05, hgt: 2.5, body: '#f2f1ec', stripe: '#e8602a', text: 'COSMOTRAP · MISSION CONTROL', textColor: '#16181c', lights: ['#ffb020', '#ffb020'], cab: 0.3 },
}

/** A road vehicle, nose towards +z: body, cab and glass, wheels, livery on both sides, a flashing light bar. */
function VehicleModel({ kind, flashRef }: { kind: Kind; flashRef: (m: THREE.MeshStandardMaterial[]) => void }) {
  const s = SPEC[kind]
  const parts = useMemo(() => {
    const paint = new THREE.MeshStandardMaterial({ color: s.body, roughness: 0.32, metalness: 0.35 })
    const stripe = new THREE.MeshStandardMaterial({ color: s.stripe, roughness: 0.4, metalness: 0.2 })
    const glass = new THREE.MeshStandardMaterial({ color: '#10161d', roughness: 0.08, metalness: 0.6 })
    const tyre = new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.9 })
    const rim = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.3, metalness: 0.9 })
    const head = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4d2', emissiveIntensity: 2.2 })
    const tail = new THREE.MeshStandardMaterial({ color: '#5a0a08', emissive: '#ff2a1a', emissiveIntensity: 1.2 })
    const text = new THREE.MeshStandardMaterial({ map: livery(s.text, s.textColor), transparent: true, roughness: 0.5 })
    const beacons = [0, 1].map((i) => new THREE.MeshStandardMaterial({ color: '#111', emissive: s.lights[i], emissiveIntensity: 0 }))
    return { paint, stripe, glass, tyre, rim, head, tail, text, beacons }
  }, [s])
  useEffect(() => { flashRef(parts.beacons) }, [parts, flashRef])
  useEffect(() => () => Object.values(parts).flat().forEach((m) => { (m as THREE.MeshStandardMaterial).map?.dispose(); (m as THREE.Material).dispose() }), [parts])
  const { len, wid, hgt, cab } = s
  const wheel = kind === 'fire' ? 0.55 : kind === 'police' || kind === 'cosmotrap' ? 0.36 : 0.42
  const floor = wheel * 0.9
  const box = kind === 'police' || kind === 'cosmotrap'
  return (
    <group>
      {/* Lower body; a car tapers into a cabin, the vans and the truck keep a tall box behind the cab. */}
      <mesh position={[0, floor + (box ? hgt * 0.32 : hgt * 0.45), 0]} material={parts.paint} castShadow>
        <boxGeometry args={[wid, box ? hgt * 0.42 : hgt * 0.72, len]} />
      </mesh>
      <mesh position={[0, floor + (box ? hgt * 0.75 : hgt * 0.75), box ? -len * 0.06 : len * (0.5 - cab / 2) - 0.05]} material={parts.paint} castShadow>
        <boxGeometry args={[wid * 0.92, box ? hgt * 0.42 : hgt * 0.5, box ? len * cab : len * cab]} />
      </mesh>
      {/* Windscreen and side windows. */}
      <mesh position={[0, floor + hgt * 0.78, box ? len * (cab / 2 - 0.06) + 0.01 : len / 2 - 0.02]} rotation={[box ? -0.45 : -0.12, 0, 0]} material={parts.glass}>
        <planeGeometry args={[wid * 0.86, hgt * 0.32]} />
      </mesh>
      {[1, -1].map((side) => <mesh key={side} position={[side * (wid * 0.46 + 0.005), floor + hgt * 0.78, box ? -len * 0.06 : len * (0.5 - cab / 2)]} rotation={[0, side * Math.PI / 2, 0]} material={parts.glass}>
        <planeGeometry args={[(box ? len * cab : len * cab) * 0.86, hgt * 0.28]} />
      </mesh>)}
      {/* Livery stripe and lettering on both flanks. */}
      {[1, -1].map((side) => <group key={side}>
        <mesh position={[side * (wid / 2 + 0.006), floor + hgt * 0.3, 0]} rotation={[0, side * Math.PI / 2, 0]} material={parts.stripe}><planeGeometry args={[len * 0.98, hgt * 0.1]} /></mesh>
        <mesh position={[side * (wid / 2 + 0.012), floor + hgt * (box ? 0.42 : 0.55), -len * 0.08]} rotation={[0, side * Math.PI / 2, 0]} material={parts.text}><planeGeometry args={[len * 0.66, len * 0.124]} /></mesh>
      </group>)}
      {kind === 'fire' && <group position={[0, floor + hgt + 0.18, -len * 0.12]}>
        {/* The ladder, folded along the roof. */}
        {[-0.42, 0.42].map((x) => <mesh key={x} position={[x, 0, 0]} material={parts.rim}><boxGeometry args={[0.07, 0.12, len * 0.62]} /></mesh>)}
        {Array.from({ length: 11 }, (_, i) => <mesh key={i} position={[0, 0, -len * 0.3 + (i * len * 0.6) / 10]} material={parts.rim}><boxGeometry args={[0.84, 0.04, 0.05]} /></mesh>)}
      </group>}
      {/* Headlights, tail lights, wheels. */}
      {[1, -1].map((side) => <group key={side}>
        <mesh position={[side * wid * 0.34, floor + 0.32, len / 2 + 0.005]} material={parts.head}><planeGeometry args={[0.32, 0.14]} /></mesh>
        <mesh position={[side * wid * 0.38, floor + 0.38, -len / 2 - 0.005]} rotation={[0, Math.PI, 0]} material={parts.tail}><planeGeometry args={[0.22, 0.2]} /></mesh>
      </group>)}
      {[1, -1].flatMap((side) => [len * 0.33, -len * 0.33].map((z) => <group key={`${side}:${z}`} position={[side * (wid / 2 - 0.06), wheel, z]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={parts.tyre}><cylinderGeometry args={[wheel, wheel, 0.3, 20]} /></mesh>
        <mesh material={parts.rim} position={[0, side * 0.152, 0]}><cylinderGeometry args={[wheel * 0.55, wheel * 0.55, 0.01, 16]} /></mesh>
      </group>))}
      {/* The light bar, its two halves flashing in turn. */}
      <group position={[0, floor + (box ? hgt * 0.98 : hgt + 0.02), box ? -len * 0.06 : len * 0.32]}>
        <mesh material={parts.rim}><boxGeometry args={[wid * 0.7, 0.05, 0.28]} /></mesh>
        {[-1, 1].map((x, i) => <mesh key={x} position={[x * wid * 0.17, 0.07, 0]} material={parts.beacons[i]}><boxGeometry args={[wid * 0.3, 0.1, 0.24]} /></mesh>)}
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
