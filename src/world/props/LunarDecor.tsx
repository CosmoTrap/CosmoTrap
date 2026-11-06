import { useMemo } from 'react'
import * as THREE from 'three'
import { useMats } from '../materials'
import { textTexture } from '../textures'
import { Box, Cyl, Screen } from './models'

// Equipment of the lunar base, drawn after the base plan: power turbines, breaker row, battery gauge,
// server bays, wall displays, oxygen column and suit-prep bench. Same conventions as every prop:
// metres, origin on the wall at floor level, +z into the room (free-standing ones are centred).

/** A sign or label painted on a plate: cached per text so identical labels share one texture. */
const labels = new Map<string, THREE.MeshStandardMaterial>()
function labelMaterial(text: string, bg: string, fg: string) {
  const key = `${text}|${bg}|${fg}`
  let m = labels.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: textTexture([text], { w: 256, h: 64, bg, fg, size: 30, pad: 10 }), roughness: 0.6 })
    labels.set(key, m)
  }
  return m
}

/** Power turbine: a squat generator drum on a plinth, its rotor housing on top and feed pipes up to the ceiling. */
export function Turbine() {
  const m = useMats()
  const shell = m.painted('#c9ccc8', 0.38, 0.45), dark = m.metal('#3b4247', 0.4), steel = m.metal('#a7afb4', 0.25)
  const stripe = m.painted('#e0a92a', 0.5, 0.2)
  return <group>
    <Cyl a={[1.0, 1.05, 0.16]} p={[0, 0.08, 0]} m={dark} seg={40} />
    <Cyl a={[0.86, 0.86, 1.25]} p={[0, 0.78, 0]} m={shell} seg={40} />
    {[0.32, 1.22].map((y) => <Cyl key={y} a={[0.885, 0.885, 0.06]} p={[0, y, 0]} m={steel} seg={40} />)}
    <Cyl a={[0.875, 0.875, 0.1]} p={[0, 0.58, 0]} m={stripe} seg={40} />
    {/* Rotor housing: a ring of cooling fins round a dark hub with a red centre, as on the plan. */}
    <Cyl a={[0.78, 0.86, 0.2]} p={[0, 1.5, 0]} m={steel} seg={40} />
    <Cyl a={[0.56, 0.56, 0.06]} p={[0, 1.62, 0]} m={dark} seg={40} />
    <Cyl a={[0.2, 0.2, 0.1]} p={[0, 1.66, 0]} m={m.metal('#5d666c', 0.3)} seg={24} />
    <Cyl a={[0.07, 0.07, 0.04]} p={[0, 1.72, 0]} m={m.glow('#ff4632', 1.6)} seg={16} />
    {Array.from({ length: 12 }, (_, i) => <Box key={i} s={[0.04, 0.14, 0.32]} p={[Math.sin(i * Math.PI / 6) * 0.42, 1.68, Math.cos(i * Math.PI / 6) * 0.42]} r={[0, i * Math.PI / 6, 0]} m={dark} />)}
    {/* Feed pipes up into the ceiling, and a small status panel. */}
    {[-1, 1].map((s) => <group key={s}>
      <Cyl a={[0.08, 0.08, 1.1]} p={[s * 0.62, 2.25, -0.2]} m={steel} seg={14} />
      <Cyl a={[0.11, 0.11, 0.08]} p={[s * 0.62, 1.73, -0.2]} m={dark} seg={14} />
    </group>)}
    <Box s={[0.36, 0.26, 0.05]} p={[0, 0.95, 0.86]} m={dark} />
    <mesh position={[0, 0.95, 0.886]} material={m.glow('#62e3a8', 1.3)}><planeGeometry args={[0.28, 0.06]} /></mesh>
  </group>
}

/** The breaker row of the plan: switches with green or red lamps, on a wall plate. Mount it at y ≈ 1.2. */
export function BreakerRow() {
  const m = useMats()
  const dark = m.plastic('#15181c', 0.4)
  const states = [1, 0, 0, 1, 0, 1, 1, 0]
  return <group>
    <Box s={[2.3, 0.9, 0.08]} p={[0, 0, 0.04]} m={m.painted('#2e3640', 0.45, 0.55)} />
    <Box s={[2.16, 0.12, 0.02]} p={[0, 0.32, 0.085]} m={labelMaterial('BUS PRINCIPAL · 8 DISJONCTEURS', '#e0a92a', '#14161a')} cast={false} />
    {states.map((on, i) => <group key={i} position={[-0.9 + i * 0.257, -0.08, 0.09]}>
      <Box s={[0.17, 0.4, 0.04]} m={dark} />
      <Box s={[0.08, 0.14, 0.05]} p={[0, on ? 0.07 : -0.07, 0.03]} m={m.plastic('#d9dde0', 0.3)} />
      <mesh position={[0, 0.25, 0.022]} material={m.glow(on ? '#38ff7a' : '#ff3b2a', 1.8)}><circleGeometry args={[0.026, 12]} /></mesh>
    </group>)}
    {/* Hazard stripes under the row. */}
    <Box s={[2.3, 0.08, 0.02]} p={[0, -0.41, 0.085]} m={labelMaterial('////////////////////', '#e0a92a', '#14161a')} cast={false} />
  </group>
}

/** The tall yellow battery bank with its charge bar, at the end of the power room. */
export function BatteryGauge() {
  const m = useMats()
  const levels = 10
  return <group>
    <Box s={[0.72, 2.1, 0.42]} p={[0, 1.05, 0.21]} m={m.painted('#d8a72c', 0.5, 0.3)} />
    <Box s={[0.5, 1.5, 0.03]} p={[0, 1.2, 0.43]} m={m.plastic('#14171a', 0.3)} />
    {Array.from({ length: levels }, (_, i) => <mesh key={i} position={[0, 0.54 + i * 0.14, 0.447]} material={m.glow(i < 3 ? '#ff6a3a' : i < 6 ? '#ffc23a' : '#3ddc84', i < 4 ? 1.8 : 0.25)}>
      <planeGeometry args={[0.38, 0.1]} />
    </mesh>)}
    <Box s={[0.6, 0.12, 0.02]} p={[0, 2.0, 0.43]} m={labelMaterial('BATTERIES', '#14171a', '#f0c24a')} cast={false} />
    {[-0.24, 0.24].map((x) => <Cyl key={x} a={[0.04, 0.04, 0.6]} p={[x, 2.4, 0.2]} m={m.metal('#8f979c', 0.3)} seg={10} />)}
  </group>
}

/** A server bay: dark cabinet, perforated door and rows of status lamps. */
export function ServerRack() {
  const m = useMats()
  const leds = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ y: 0.35 + Math.floor(i / 3) * 0.26, x: -0.14 + (i % 3) * 0.14, c: ['#38ff7a', '#3ad7ff', '#ffb020'][(i * 7) % 3] })), [])
  const body = m.painted('#1f262d', 0.4, 0.6)
  return <group>
    <Box s={[0.62, 2.05, 0.78]} p={[0, 1.025, 0.39]} m={body} />
    <Box s={[0.54, 1.8, 0.02]} p={[0, 1.05, 0.79]} m={m.metal('#39434b', 0.45)} />
    {Array.from({ length: 12 }, (_, i) => <Box key={i} s={[0.46, 0.02, 0.012]} p={[0, 0.25 + i * 0.14, 0.805]} m={m.plastic('#0d1013', 0.5)} cast={false} />)}
    {leds.map((l, i) => <mesh key={i} position={[l.x, l.y + 0.06, 0.813]} material={m.glow(l.c, 1.6)}><planeGeometry args={[0.04, 0.02]} /></mesh>)}
    <Box s={[0.03, 0.4, 0.04]} p={[0.22, 1.05, 0.82]} m={m.metal('#a7afb4', 0.25)} />
  </group>
}

/** Three wide displays over the security desks, as on the plan: maps and camera feeds. Mount at y ≈ 2.2. */
export function WallDisplays() {
  const m = useMats()
  const feeds = [
    ['CAM 01 · HUB', 'CAM 02 · SAS', 'MOUVEMENT : AUCUN'],
    ['RESEAU SELENE-7', 'M-01 OK   M-02 SECOURS', 'M-03 OK   M-04 VERROU'],
    ['RADIO · BANDE S', 'LIAISON TERRE : PERDUE', 'BALISE LV-1 : ACTIVE'],
  ]
  return <group>
    {feeds.map((lines, i) => <group key={i} position={[(i - 1) * 1.72, 0, 0]}>
      <Box s={[1.6, 0.66, 0.07]} p={[0, 0, 0.035]} m={m.plastic('#15181c', 0.35)} />
      <Screen w={1.5} h={0.56} p={[0, 0, 0.075]} lines={lines} fg="#8fd0ff" bg="#071a33" intensity={1.1} />
    </group>)}
    <Box s={[5.2, 0.05, 0.12]} p={[0, -0.38, 0.06]} m={m.metal('#5d666c', 0.35)} />
  </group>
}

/** The tall blue oxygen column of the suit room, strapped to the wall with its gauge. */
export function O2Column() {
  const m = useMats()
  const blue = m.painted('#3e7fd1', 0.32, 0.35), steel = m.metal('#a7afb4', 0.25)
  return <group position={[0, 0, 0.42]}>
    <Cyl a={[0.38, 0.4, 0.1]} p={[0, 0.05, 0]} m={m.metal('#3b4247', 0.4)} seg={32} />
    <Cyl a={[0.34, 0.34, 2.0]} p={[0, 1.1, 0]} m={blue} seg={32} />
    <mesh position={[0, 2.1, 0]} material={blue}><sphereGeometry args={[0.34, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
    <Cyl a={[0.06, 0.06, 0.2]} p={[0, 2.5, 0]} m={steel} seg={12} />
    {[0.6, 1.7].map((y) => <Cyl key={y} a={[0.355, 0.355, 0.05]} p={[0, y, 0]} m={steel} seg={32} />)}
    <Box s={[0.4, 0.12, 0.02]} p={[0, 1.25, 0.345]} m={labelMaterial('O₂ · 200 BAR', '#f2f4f5', '#1d3f6e')} cast={false} />
    <Cyl a={[0.09, 0.09, 0.04]} p={[0.18, 1.45, 0.33]} r={[Math.PI / 2, 0, 0]} m={m.plastic('#f2f4f5', 0.3)} seg={16} />
  </group>
}

/** Suit-prep bench with two helmets and a pair of gloves waiting. Free-standing, centred, 2.2 m long along x. */
export function SuitBench() {
  const m = useMats()
  const frame = m.metal('#7d878d', 0.35), seat = m.fabric('#2f4e78')
  return <group>
    <Box s={[2.2, 0.08, 0.46]} p={[0, 0.46, 0]} m={seat} />
    {[-0.95, 0.95].map((x) => <Box key={x} s={[0.06, 0.44, 0.4]} p={[x, 0.22, 0]} m={frame} />)}
    <Box s={[2.0, 0.04, 0.04]} p={[0, 0.12, 0]} m={frame} />
    {[-0.55, 0.45].map((x) => <group key={x} position={[x, 0.67, 0]}>
      <mesh material={m.plastic('#eef0f2', 0.3)} castShadow><sphereGeometry args={[0.17, 24, 16]} /></mesh>
      <mesh position={[0, 0.01, 0.1]} rotation={[0, 0, 0]} material={m.glass('#d9a441', 0.75)}><sphereGeometry args={[0.13, 20, 12, -1, 2, 0.9, 1.1]} /></mesh>
    </group>)}
    <Box s={[0.22, 0.05, 0.14]} p={[0.0, 0.525, 0.05]} m={m.fabric('#e7e2d6')} />
  </group>
}

/** Floor markings in front of the exit hatch: hazard border and a stop line. Not solid. */
export function HatchMarking() {
  const m = useMats()
  const stripes = labelMaterial('//////////////////////////', '#e0a92a', '#14161a')
  return <group position={[0, 0.006, 0]}>
    {[0, 1.8].map((z) => <mesh key={z} position={[0, 0, z + 0.06]} rotation={[-Math.PI / 2, 0, 0]} material={stripes}><planeGeometry args={[2.6, 0.12]} /></mesh>)}
    {[-1, 1].map((s) => <mesh key={s} position={[s * 1.24, 0, 0.96]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={stripes}><planeGeometry args={[1.8, 0.12]} /></mesh>)}
    <mesh position={[0, 0, 0.96]} rotation={[-Math.PI / 2, 0, 0]} material={m.painted('#30363d', 0.7, 0.2)}><planeGeometry args={[2.36, 1.66]} /></mesh>
  </group>
}

/** Tall equipment rail along the hatch, as on the plan: a pillar with handholds and a lamp. */
export function HatchRail() {
  const m = useMats()
  const steel = m.metal('#a7afb4', 0.25)
  return <group>
    <Box s={[0.36, 2.5, 0.22]} p={[0, 1.25, 0.11]} m={m.painted('#d3d6d8', 0.45, 0.3)} />
    {[0.7, 1.2, 1.7].map((y) => <Cyl key={y} a={[0.022, 0.022, 0.3]} p={[0, y, 0.29]} r={[0, 0, Math.PI / 2]} m={steel} seg={10} />)}
    <mesh position={[0, 2.25, 0.222]} material={m.glow('#ff8a3a', 1.6)}><planeGeometry args={[0.2, 0.1]} /></mesh>
  </group>
}
