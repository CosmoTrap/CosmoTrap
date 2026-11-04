import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { CEIL } from '../game/maps'
import type { RoomDef } from '../game/types'
import { ceilingMaterial, floorMaterial, useMats, wallMaterial } from './materials'
import { Elevator } from './Elevator'
import { Box, Cyl, Screen } from './props/models'

type Surface = { p: number[]; n: number[]; uv: number[]; indices: number[] }
const surface = (): Surface => ({ p: [], n: [], uv: [], indices: [] })
function geometry(s: Surface) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(s.p, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(s.n, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(s.uv, 2))
  g.setIndex(s.indices)
  return g
}

/** Smooth cylindrical bands, with genuine gaps for the observation windows. */
function band(s: Surface, r: number, a: number, b: number, low: number, high: number) {
  const start = s.p.length / 3
  for (const [angle, y] of [[a, low], [a, high], [b, low], [b, high]]) {
    s.p.push(Math.sin(angle) * r, y, Math.cos(angle) * r)
    s.n.push(-Math.sin(angle), 0, -Math.cos(angle))
    s.uv.push(angle * r / 2, y / CEIL)
  }
  s.indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3)
}

export function buildRoundHub(radius: number) {
  const opening = Math.asin(1 / radius) // Two-metre corridors remain full width.
  const wall = surface(), glass = surface(), trim = surface()
  const boundary: [number, number][] = []
  const posts: number[] = []
  const colliders: { x: number; z: number; angle: number; half: number }[] = []
  const segments = 32
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const begin = quadrant * Math.PI / 2 + opening
    const end = (quadrant + 1) * Math.PI / 2 - opening
    const step = (end - begin) / segments
    for (let i = 0; i <= segments; i++) {
      const a = begin + i * step
      boundary.push([Math.sin(a) * radius, Math.cos(a) * radius])
      if ([0, 10, 22, 32].includes(i)) posts.push(a)
      if (i === segments) continue
      const b = a + step
      if (i >= 10 && i < 22) {
        band(wall, radius, a, b, 0, 0.85)
        band(wall, radius, a, b, 2.15, CEIL)
        band(glass, radius + 0.015, a, b, 0.85, 2.15)
        band(trim, radius - 0.045, a, b, 0.81, 0.9)
        band(trim, radius - 0.045, a, b, 2.1, 2.19)
      } else band(wall, radius, a, b, 0, CEIL)
      band(trim, radius - 0.035, a, b, 0, 0.11)
      band(trim, radius - 0.035, a, b, CEIL - 0.11, CEIL)
      const mid = (a + b) / 2
      colliders.push({ x: Math.sin(mid) * (radius + 0.02), z: Math.cos(mid) * (radius + 0.02), angle: mid, half: Math.sin(step / 2) * radius + 0.006 })
    }
    // The circle meets the corridor sides just before the grid edge. Include
    // that short throat in the floor/ceiling polygon, without overlapping tiles.
    const direction = (quadrant + 1) * Math.PI / 2
    for (const side of [-1, 1]) boundary.push([
      Math.sin(direction) * radius + Math.cos(direction) * side,
      Math.cos(direction) * radius - Math.sin(direction) * side,
    ])
  }
  const disk = (y: number, up: boolean) => {
    const s = surface()
    for (const [x, z] of [[0, 0], ...boundary]) {
      s.p.push(x, y, z); s.n.push(0, up ? 1 : -1, 0); s.uv.push(x / 2, z / 2)
    }
    boundary.forEach((_, i) => {
      const a = i + 1, b = (i + 1) % boundary.length + 1
      s.indices.push(...(up ? [0, a, b] : [0, b, a]))
    })
    return geometry(s)
  }
  return { floor: disk(0, true), ceiling: disk(CEIL, false), wall: geometry(wall), glass: geometry(glass), trim: geometry(trim), posts, colliders }
}

export function RoundHub({ room, shadows, zone }: { room: RoomDef; shadows: boolean; zone: number }) {
  const radius = room.rect[2] - room.rect[0] + 1
  const cx = room.rect[0] + room.rect[2] + 1, cz = room.rect[1] + room.rect[3] + 1
  const built = useMemo(() => buildRoundHub(radius), [radius])
  useEffect(() => () => { for (const g of [built.floor, built.ceiling, built.wall, built.glass, built.trim]) g.dispose() }, [built])
  const m = useMats()
  const frame = m.painted('#596168', 0.4, 0.7)
  const destinations = zone === 1 ? ['INFIRMERIE / RESERVE', 'SAS', 'REFECTOIRE', 'DORTOIR']
    : ['MACHINERIE', 'ENERGIE', 'SERRE / LABORATOIRE', 'AMARRAGE']
  return <group name="round-hub" position={[cx, 0, cz]}>
    <mesh name="hub-floor" geometry={built.floor} material={floorMaterial('rubber', false, room.id)} receiveShadow castShadow={shadows} />
    <mesh geometry={built.ceiling} material={ceilingMaterial(false, room.id)} receiveShadow castShadow={shadows} />
    <mesh name="hub-curved-wall" geometry={built.wall} material={wallMaterial('station', false, room.id)} receiveShadow castShadow={shadows} />
    <mesh name="hub-observation-windows" geometry={built.glass} material={m.glass('#aac9da', 0.12)} />
    <mesh geometry={built.trim} material={frame} castShadow={shadows} receiveShadow />
    {built.posts.map((a, i) => <group key={i} position={[Math.sin(a) * (radius - 0.04), 0, Math.cos(a) * (radius - 0.04)]} rotation={[0, a, 0]}>
      <Box s={[0.065, CEIL, 0.12]} p={[0, CEIL / 2, 0]} m={frame} />
      {[0.26, 2.5].map((y) => <Cyl key={y} a={[0.02, 0.02, 0.02]} p={[0, y, -0.075]} r={[Math.PI / 2, 0, 0]} m={m.metal('#a9aeb0')} seg={6} />)}
    </group>)}
    {[0, 1, 2, 3].map((i) => {
      const a = i * Math.PI / 2
      return <group key={i} position={[Math.sin(a) * (radius - 0.02), 0, Math.cos(a) * (radius - 0.02)]} rotation={[0, a + Math.PI, 0]}>
        {/* A short bulkhead above each connection, with a readable destination. */}
        <Box s={[2, 0.3, 0.12]} p={[0, CEIL - 0.15, 0]} m={frame} />
        <Screen w={1.65} h={0.17} p={[0, CEIL - 0.15, 0.07]} lines={[destinations[i]]} intensity={0.5} />
      </group>
    })}
    <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.metal('#718087', 0.6)}>
      <ringGeometry args={[2.85, 2.91, 96]} />
    </mesh>
    <mesh position={[0, CEIL - 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} material={frame}>
      <torusGeometry args={[3.8, 0.05, 8, 96]} />
    </mesh>
    <Elevator zone={zone} cx={cx} cz={cz} />
    <RigidBody type="fixed" colliders={false}>
      {built.colliders.map((c, i) => <CuboidCollider key={i} position={[c.x, CEIL / 2, c.z]} rotation={[0, c.angle, 0]} args={[c.half, CEIL / 2, 0.07]} />)}
      {[0, 1, 2, 3].map((i) => {
        const a = i * Math.PI / 2
        return <CuboidCollider key={`header-${i}`} position={[Math.sin(a) * radius, CEIL - 0.15, Math.cos(a) * radius]} rotation={[0, a, 0]} args={[1, 0.15, 0.08]} />
      })}
    </RigidBody>
  </group>
}
