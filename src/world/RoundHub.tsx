import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { CEIL } from '../game/maps'
import type { RoomDef } from '../game/types'
import { ceilingMaterial, floorMaterial, hullMaterial, useMats, wallMaterial } from './materials'
import { Elevator } from './Elevator'
import { Box, Cyl } from './props/models'
import { drawTexture } from './textures'

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
    // Negative: seen from inside the hub, the angle runs right to left, and the wall's lettering would read backwards.
    s.uv.push(-angle * r / 2, y / CEIL)
  }
  s.indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3)
}

/** A flat piece closing the wall's thickness, seen from both sides: from radius r0 to r1, between two angles and two heights. */
function reveal(s: Surface, r0: number, r1: number, a: number, b: number, low: number, high: number) {
  const start = s.p.length / 3
  const corners: [number, number, number][] = [[r0, a, low], [r1, a, low], [r0, b, high], [r1, b, high]]
  // A sill runs along the arc at one height; a jamb stands at one angle.
  const flat = low === high
  for (const [r, angle, y] of corners) s.p.push(Math.sin(angle) * r, y, Math.cos(angle) * r)
  const mid = (a + b) / 2
  for (let i = 0; i < 4; i++) {
    if (flat) s.n.push(0, 1, 0)
    else s.n.push(Math.cos(mid), 0, -Math.sin(mid))
    s.uv.push(i & 1, i >> 1)
  }
  s.indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3, start, start + 2, start + 1, start + 2, start + 3, start + 1)
}

export function buildRoundHub(radius: number) {
  const opening = Math.asin(1 / radius) // Two-metre corridors remain full width.
  const wall = surface(), glass = surface(), trim = surface(), hull = surface()
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
        band(hull, radius + 0.05, a, b, -0.05, 0.85)
        band(hull, radius + 0.05, a, b, 2.15, CEIL + 0.05)
        band(trim, radius - 0.045, a, b, 0.81, 0.9)
        band(trim, radius - 0.045, a, b, 2.1, 2.19)
        // Close the wall's thickness all round the glass: no gap to see through at its edges.
        reveal(trim, radius - 0.06, radius + 0.07, a, b, 0.85, 0.85)
        reveal(trim, radius - 0.06, radius + 0.07, a, b, 2.15, 2.15)
        if (i === 10) reveal(trim, radius - 0.06, radius + 0.07, a, a, 0.85, 2.15)
        if (i === 21) reveal(trim, radius - 0.06, radius + 0.07, b, b, 0.85, 2.15)
      } else {
        band(wall, radius, a, b, 0, CEIL)
        band(hull, radius + 0.05, a, b, -0.05, CEIL + 0.05)
      }
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
  return { floor: disk(0, true), ceiling: disk(CEIL, false), wall: geometry(wall), glass: geometry(glass), trim: geometry(trim), hull: geometry(hull), posts, colliders }
}

const ACCENTS = ['#3fb6e0', '#e8903a', '#62d6b1', '#d96ad0']

/** Backlit corridor sign: a colour bar, the destination in large letters, and an arrow straight ahead. */
function DestinationSign({ text, accent }: { text: string; accent: string }) {
  const m = useMats()
  const material = useMemo(() => {
    const map = drawTexture(1024, 128, (c) => {
      c.fillStyle = '#0c1420'
      c.fillRect(0, 0, 1024, 128)
      c.fillStyle = accent
      c.fillRect(0, 0, 22, 128)
      c.beginPath()
      c.moveTo(946, 34); c.lineTo(984, 92); c.lineTo(908, 92)
      c.closePath()
      c.fill()
      c.fillStyle = '#f2f6f8'
      c.textBaseline = 'middle'
      let size = 74
      do {
        c.font = `700 ${size}px 'Space Grotesk', Inter, system-ui, sans-serif`
        size -= 2
      } while (c.measureText(text).width > 840 && size > 30)
      c.fillText(text, 54, 68)
    })
    return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 1.1, roughness: 0.4 })
  }, [text, accent])
  useEffect(() => () => { material.map?.dispose(); material.dispose() }, [material])
  return <group position={[0, CEIL - 0.17, 0.075]}>
    <Box s={[1.78, 0.25, 0.05]} m={m.painted('#2a3137', 0.4, 0.7)} />
    <mesh position={[0, 0, 0.027]} material={material}><planeGeometry args={[1.68, 0.21]} /></mesh>
  </group>
}

export function RoundHub({ room, shadows, zone }: { room: RoomDef; shadows: boolean; zone: number }) {
  const radius = room.rect[2] - room.rect[0] + 1
  const cx = room.rect[0] + room.rect[2] + 1, cz = room.rect[1] + room.rect[3] + 1
  const built = useMemo(() => buildRoundHub(radius), [radius])
  const roof = useMemo(() => {
    const g = new THREE.CircleGeometry(radius + 0.7, 64)
    const p = g.attributes.position, uv = g.attributes.uv
    // Repeat at the same two-metre scale as the interior ceiling panels.
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2, p.getY(i) / 2)
    return g
  }, [radius])
  useEffect(() => () => roof.dispose(), [roof])
  useEffect(() => () => { for (const g of [built.floor, built.ceiling, built.wall, built.glass, built.trim, built.hull]) g.dispose() }, [built])
  const m = useMats()
  // Clear panes onto space: no opaque tint, no glare from the sun or the lamps.
  const windowGlass = useMemo(() => {
    const c = m.glass('#aac9da', 0.05).clone()
    c.specularIntensity = 0.1
    // Clear glass: reflections of the bright room must not wash out the black of space.
    c.opacity = Math.min(c.opacity, 0.05)
    c.envMapIntensity = 0.04
    return c
  }, [m])
  useEffect(() => () => windowGlass.dispose(), [windowGlass])
  const frame = m.painted('#596168', 0.4, 0.7)
  const destinations = zone === 1 ? ['INFIRMERIE / RESERVE', 'SAS', 'REFECTOIRE', 'DORTOIR']
    : ['MACHINERIE', 'ENERGIE', 'SERRE / LABORATOIRE', 'AMARRAGE']
  return <group name="round-hub" position={[cx, 0, cz]}>
    <mesh renderOrder={-1} name="hub-floor" geometry={built.floor} material={floorMaterial(zone === 2 ? 'grate' : 'rubber', false, room.id)} receiveShadow castShadow />
    <mesh renderOrder={-1} geometry={built.ceiling} material={ceilingMaterial(false, room.id)} receiveShadow castShadow />
    <mesh renderOrder={-1} name="hub-curved-wall" geometry={built.wall} material={wallMaterial(zone === 2 ? 'machine' : 'station', false, room.id)} receiveShadow castShadow />
    <mesh name="hub-observation-windows" geometry={built.glass} material={windowGlass} />
    <mesh geometry={built.trim} material={frame} castShadow={shadows} receiveShadow />
    {/* Opaque shell behind the curved wall, so that no seam can show open space. */}
    <mesh name="hub-hull" geometry={built.hull} material={hullMaterial('wall', zone === 2 ? 'machine' : 'station')} castShadow receiveShadow />
    {/* Roof and underside overhang the wall: the sun enters through the windows only, never at the wall's edges. */}
    {[CEIL + 0.06, -0.06].map((y) => <mesh key={y} name="hub-sun-stop" geometry={roof} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={hullMaterial('roof')} castShadow receiveShadow />)}
    {built.posts.map((a, i) => <group key={i} position={[Math.sin(a) * (radius - 0.04), 0, Math.cos(a) * (radius - 0.04)]} rotation={[0, a, 0]}>
      <Box s={[0.065, CEIL, 0.12]} p={[0, CEIL / 2, 0]} m={frame} />
      {[0.26, 2.5].map((y) => <Cyl key={y} a={[0.02, 0.02, 0.02]} p={[0, y, -0.075]} r={[Math.PI / 2, 0, 0]} m={m.metal('#a9aeb0')} seg={6} />)}
    </group>)}
    {[0, 1, 2, 3].map((i) => {
      const a = i * Math.PI / 2
      return <group key={i} position={[Math.sin(a) * (radius - 0.02), 0, Math.cos(a) * (radius - 0.02)]} rotation={[0, a + Math.PI, 0]}>
        {/* A short bulkhead above each connection, with a readable destination. */}
        <Box s={[2, 0.3, 0.12]} p={[0, CEIL - 0.15, 0]} m={frame} />
        <DestinationSign text={destinations[i]} accent={ACCENTS[i]} />
      </group>
    })}
    <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.metal('#718087', 0.6)}>
      <ringGeometry args={[2.85, 2.91, 96]} />
    </mesh>
    <mesh position={[0, CEIL - 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} material={frame}>
      <torusGeometry args={[3.8, 0.05, 8, 96]} />
    </mesh>
    {/* Where the curved wall meets each corridor: a full post, so no gap can open on space. */}
    {[0, 1, 2, 3].flatMap((i) => [-1, 1].map((side) => {
      const a = i * Math.PI / 2
      return <Box key={`${i}:${side}`} s={[0.16, CEIL, 0.16]} p={[Math.sin(a) * radius + Math.cos(a) * side, CEIL / 2, Math.cos(a) * radius - Math.sin(a) * side]} r={[0, a, 0]} m={frame} />
    }))}
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
