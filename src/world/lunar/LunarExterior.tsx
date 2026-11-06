import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CEIL } from '../../game/maps'
import { HUB, MODULES, ROCKET, localPoint } from '../../game/lunar/map'
import { useGame } from '../../game/state'
import { pbrMaterial } from '../assets'
import { floorMaterial, hullMaterial, useMats } from '../materials'
import { RealModel } from '../props/RealModel'
import { StaticBatch } from '../props/StaticBatch'
import { Box, Cyl } from '../props/models'
import { drawTexture } from '../textures'
import { GROUND_Y, distanceToBase, regolithMaterial } from './shared'

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** Regolith all around, levelled flat under the base and its pad, rolling and cratered further out. */
function Ground() {
  const material = useMemo(() => pbrMaterial('moon_01', { repeat: [80, 80], rough: 1, metal: 0, normal: 0.8, env: 0.15 }), [])
  const geometry = useMemo(() => {
    // Finer near the base, where the levelled ground meets the walls.
    const g = new THREE.PlaneGeometry(500, 500, 200, 200).rotateX(-Math.PI / 2), p = g.attributes.position
    const craters = [[-70, -80, 27], [95, -40, 18], [-90, 90, 35], [85, 100, 30], [30, -55, 9], [-48, 22, 7]]
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), wx = x + HUB[0], wz = z + HUB[1]
      let y = -0.8 + (Math.sin(x * .12) * Math.cos(z * .17) + Math.sin(z * .29) * .3) * .12
      for (const [cx, cz, r] of craters) { const d = Math.hypot(x - cx, z - cz) / r; y += Math.exp(-(((d - 1) / .12) ** 2)) * 1.8 * Math.min(1, r / 18) - Math.max(0, 1 - d * d) * 3 * Math.min(1, r / 18) }
      // Bulldozed apron: the base sits on it, then a gentle berm back down to the natural ground.
      const k = smooth(1.5, 14, distanceToBase(wx, wz))
      p.setY(i, GROUND_Y - 0.004 + (y - GROUND_Y) * k + Math.exp(-(((distanceToBase(wx, wz) - 4) / 2.5) ** 2)) * 0.18)
    }
    g.computeVertexNormals(); return g
  }, [])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  return <RigidBody type="fixed" colliders="trimesh"><mesh name="lunar-ground" geometry={geometry} material={material} position={[HUB[0], 0, HUB[1]]} receiveShadow /></RigidBody>
}

/** The round hub's own regolith dome and foundation ring. */
function HubCover() {
  const dome = useMemo(() => new THREE.SphereGeometry(7.9, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.26, 1), [])
  useEffect(() => () => dome.dispose(), [dome])
  const m = useMats()
  return <group position={[HUB[0], 0, HUB[1]]}>
    <mesh geometry={dome} material={regolithMaterial()} position={[0, CEIL + 0.12, 0]} castShadow receiveShadow />
    <Cyl a={[7.7, 7.9, 0.5]} p={[0, GROUND_Y - 0.2, 0]} m={m.metal('#4b545b', 0.5)} seg={48} />
    {/* Airlock-style vent stack on top of the dome. */}
    <Cyl a={[0.5, 0.6, 1.2]} p={[0, CEIL + 2.4, 0]} m={m.metal('#8b949a', 0.35)} seg={20} />
    <mesh position={[0, CEIL + 3.05, 0]} material={m.glow('#ff2a14', 2)}><sphereGeometry args={[0.12, 10, 8]} /></mesh>
  </group>
}

/** Solar field north-west of the power plant, tilted to the low sun, with the feeder cable cut in the middle. */
function SolarField() {
  const m = useMats()
  const repaired = useGame((s) => s.lunar.solved.includes('circuit'))
  const cell = useMemo(() => {
    const t = drawTexture(256, 256, (c) => {
      c.fillStyle = '#132a52'; c.fillRect(0, 0, 256, 256)
      c.strokeStyle = '#5e86c8'; c.lineWidth = 3
      for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, 256); c.stroke(); c.beginPath(); c.moveTo(0, i * 64); c.lineTo(256, i * 64); c.stroke() }
    })
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.22, metalness: 0.4, envMapIntensity: 1.2 })
  }, [])
  useEffect(() => () => { cell.map?.dispose(); cell.dispose() }, [cell])
  const frame = m.metal('#8f989e', 0.3)
  // Cable from the field to the power plant's west wall, laid on the ground.
  const plant = localPoint('power', MODULES.find((x) => x.id === 'power')!.width / 2 + 0.2, 0, 1.5)
  const start: [number, number] = [26, 14], end: [number, number] = [plant[0], plant[2]]
  const len = Math.hypot(end[0] - start[0], end[1] - start[1]), ang = Math.atan2(end[0] - start[0], end[1] - start[1])
  return <group>
    <StaticBatch>
      {[0, 1].flatMap((row) => [0, 1, 2, 3, 4].map((col) => {
        const x = 8 + col * 3.6, z = 6 + row * 4.4
        return <group key={`${row}:${col}`} position={[x, 0, z]}>
          <Cyl a={[0.07, 0.09, 1.6]} p={[0, 0.7, 0]} m={frame} seg={10} />
          <Cyl a={[0.35, 0.4, 0.12]} p={[0, GROUND_Y + 0.06, 0]} m={m.metal('#4b545b', 0.5)} seg={14} />
          <group position={[0, 1.55, 0]} rotation={[-0.55, 0, 0]}>
            <Box s={[3.3, 0.06, 2.3]} m={frame} />
            <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} material={cell}><planeGeometry args={[3.2, 2.2]} /></mesh>
          </group>
        </group>
      }))}
      {/* Junction box at the end of the field. */}
      <Box s={[0.9, 1.0, 0.6]} p={[start[0], 0.45, start[1]]} m={m.painted('#d3d6d8', 0.45, 0.3)} />
    </StaticBatch>
    {/* The feeder: whole once the circuit is repaired, otherwise cut with sparking ends. */}
    <group position={[(start[0] + end[0]) / 2, 0.12, (start[1] + end[1]) / 2]} rotation={[0, ang, 0]}>
      {(repaired ? [[-len / 2, len / 2]] : [[-len / 2, -0.6], [0.6, len / 2]]).map(([a, b]) => <Cyl key={a} a={[0.07, 0.07, b - a]} p={[0, 0, (a + b) / 2]} r={[Math.PI / 2, 0, 0]} m={m.rubber('#2a2b2d')} seg={10} />)}
      {!repaired && <Sparks />}
    </group>
  </group>
}

/** Electric arcs at the cut ends of the solar feeder. */
function Sparks() {
  const ref = useRef<THREE.Group>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    mat.opacity = Math.max(0, Math.sin(t * 23) * Math.sin(t * 7.3)) * 0.9
    ref.current?.children.forEach((c, i) => c.scale.setScalar(0.6 + ((Math.sin(t * 31 + i * 2) + 1) / 2) * 0.8))
  })
  return <group ref={ref}>{[-0.6, 0.6].map((z) => <mesh key={z} position={[0, 0.05, z]} material={mat}><sphereGeometry args={[0.12, 8, 6]} /></mesh>)}</group>
}

/** Floodlight mast: a lattice pole and a lamp head tilted towards what it lights. Light comes from a few shared spots. */
function Mast({ x, z, face, height = 7 }: { x: number; z: number; face: number; height?: number }) {
  const m = useMats()
  return <group position={[x, 0, z]} rotation={[0, face, 0]}>
    <Cyl a={[0.45, 0.55, 0.2]} p={[0, GROUND_Y + 0.1, 0]} m={m.metal('#4b545b', 0.5)} seg={14} />
    <Cyl a={[0.09, 0.12, height]} p={[0, height / 2, 0]} m={m.metal('#8f989e', 0.3)} seg={10} />
    {[-0.45, 0.45].map((dx) => <group key={dx} position={[dx, height, 0.15]} rotation={[0.55, 0, 0]}>
      <Box s={[0.7, 0.42, 0.24]} m={m.metal('#3c4449', 0.4)} />
      <mesh position={[0, 0, 0.125]} material={m.glow('#fff1d8', 6)}><planeGeometry args={[0.6, 0.32]} /></mesh>
    </group>)}
  </group>
}

/** Small marker lights along the walkways and round the pad: one instanced draw. */
function Bollards() {
  const ref = useRef<THREE.InstancedMesh>(null), caps = useRef<THREE.InstancedMesh>(null)
  const points = useMemo(() => {
    const out: [number, number][] = []
    for (let z = 74; z <= 81; z += 2.5) out.push([39.2, z], [42.8, z])
    for (let x = 24 + 7.5; x <= 41; x += 2.5) out.push([x, 78.7], [x, 82.3])
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (Math.abs(Math.sin(a)) > 0.3 || Math.cos(a) < 0) out.push([ROCKET[0] + Math.cos(a) * 8.6, ROCKET[1] + Math.sin(a) * 8.6]) }
    return out
  }, [])
  const m = useMats()
  useEffect(() => {
    const mtx = new THREE.Matrix4()
    points.forEach(([x, z], i) => {
      ref.current!.setMatrixAt(i, mtx.makeTranslation(x, GROUND_Y + 0.22, z))
      caps.current!.setMatrixAt(i, mtx.makeTranslation(x, GROUND_Y + 0.47, z))
    })
    for (const r of [ref, caps]) { r.current!.instanceMatrix.needsUpdate = true; r.current!.computeBoundingSphere() }
  }, [points])
  return <group>
    <instancedMesh ref={ref} args={[undefined, undefined, points.length]} material={m.metal('#5d666c', 0.4)} castShadow>
      <cylinderGeometry args={[0.07, 0.09, 0.44, 10]} />
    </instancedMesh>
    <instancedMesh ref={caps} args={[undefined, undefined, points.length]} material={m.glow('#ffb347', 3.5)}>
      <cylinderGeometry args={[0.08, 0.08, 0.06, 10]} />
    </instancedMesh>
  </group>
}

/** Launch pad: a concrete-like disc with its markings and a fuel farm on the side. */
function Pad() {
  const m = useMats()
  const marks = useMemo(() => {
    const t = drawTexture(512, 512, (c) => {
      c.clearRect(0, 0, 512, 512)
      c.strokeStyle = '#e0a92a'; c.lineWidth = 14
      c.beginPath(); c.arc(256, 256, 236, 0, Math.PI * 2); c.stroke()
      c.setLineDash([30, 22]); c.lineWidth = 8; c.beginPath(); c.arc(256, 256, 150, 0, Math.PI * 2); c.stroke()
      c.setLineDash([]); c.fillStyle = '#f2f4f5'; c.font = '800 64px Inter, Arial, sans-serif'; c.textAlign = 'center'; c.fillText('LV-1', 256, 470)
    })
    return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  }, [])
  useEffect(() => () => { marks.map?.dispose(); marks.dispose() }, [marks])
  return <group position={[ROCKET[0], 0, ROCKET[1]]}>
    <StaticBatch>
      <Cyl a={[8, 8.3, 0.3]} p={[0, GROUND_Y + 0.0, 0]} m={m.painted('#7d7a74', 0.9, 0.05)} seg={64} />
      {/* Blast deflector ring round the engines. */}
      <Cyl a={[3.0, 3.0, 0.12]} p={[0, 0.2, 0]} m={m.metal('#3c4449', 0.6)} seg={48} />
      {/* Fuel farm: two horizontal tanks on cradles, piped to the pad. */}
      {[-1, 1].map((s) => <group key={s} position={[-11.5, 0, s * 2.6]}>
        <Cyl a={[1.0, 1.0, 5.2]} p={[0, 1.35, 0]} r={[0, 0, Math.PI / 2]} m={m.painted('#e8e6e0', 0.4, 0.2)} seg={28} />
        {[-1.6, 1.6].map((x) => <Box key={x} s={[0.3, 0.9, 1.6]} p={[x, 0.42, 0]} m={m.metal('#4b545b', 0.5)} />)}
        <Box s={[5.2, 0.16, 0.05]} p={[0, 1.35, 1.0]} m={m.painted('#e8602a', 0.5, 0.2)} />
      </group>)}
      <Cyl a={[0.1, 0.1, 6]} p={[-7.3, 0.25, 0]} r={[0, 0, Math.PI / 2]} m={m.metal('#a7afb4', 0.3)} seg={10} />
    </StaticBatch>
    <mesh position={[0, GROUND_Y + 0.155, 0]} rotation={[-Math.PI / 2, 0, 0]} material={marks}><planeGeometry args={[16, 16]} /></mesh>
  </group>
}

/** Parked pressurised rover by the evacuation airlock. */
function Rover() {
  const m = useMats()
  const body = m.painted('#e9e7e1', 0.45, 0.2), dark = m.metal('#3c4449', 0.45)
  return <group position={[50, 0, 76]} rotation={[0, -0.4, 0]}>
    <StaticBatch>
      <Box s={[2.4, 0.3, 4.4]} p={[0, 0.75, 0]} m={dark} />
      <Box s={[2.2, 1.3, 3.0]} p={[0, 1.55, -0.3]} m={body} />
      <Box s={[2.0, 0.7, 1.0]} p={[0, 1.25, 1.6]} r={[-0.35, 0, 0]} m={body} />
      <Box s={[1.8, 0.45, 0.04]} p={[0, 1.75, 1.2]} r={[-0.5, 0, 0]} m={m.plastic('#1b2a36', 0.1)} />
      <Box s={[2.3, 0.12, 0.5]} p={[0, 2.25, -0.9]} m={m.painted('#e8602a', 0.5, 0.2)} />
      {[-1.6, 0, 1.6].flatMap((z) => [-1, 1].map((s) => <Cyl key={`${z}${s}`} a={[0.5, 0.5, 0.36]} p={[s * 1.3, 0.5, z]} r={[0, 0, Math.PI / 2]} m={m.rubber('#2c2d2f')} seg={18} />))}
      <Cyl a={[0.04, 0.04, 1.4]} p={[0.7, 2.9, -1.2]} m={m.metal('#a7afb4', 0.3)} seg={8} />
      <Cyl a={[0.35, 0.05, 0.18]} p={[0.7, 3.6, -1.2]} r={[0.6, 0, 0]} m={m.metal('#d3d6d8', 0.3)} seg={16} />
    </StaticBatch>
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[1.5, 1.2, 2.4]} position={[0, 1.2, 0]} /></RigidBody>
  </group>
}

/** Communications mast with its dish, behind the security module. */
function CommsMast() {
  const m = useMats()
  const dish = useMemo(() => new THREE.SphereGeometry(1.6, 28, 10, 0, Math.PI * 2, 0, 0.75), [])
  useEffect(() => () => dish.dispose(), [dish])
  const steel = m.metal('#a7afb4', 0.3)
  return <group position={[78, 0, 18]}>
    <Cyl a={[0.7, 0.8, 0.3]} p={[0, GROUND_Y + 0.12, 0]} m={m.metal('#4b545b', 0.5)} seg={16} />
    <Cyl a={[0.14, 0.2, 6]} p={[0, 3, 0]} m={steel} seg={12} />
    <group position={[0, 6.2, 0]} rotation={[-0.9, 0.6, 0]}>
      <mesh geometry={dish} material={m.painted('#e9e7e1', 0.35, 0.2)} rotation={[Math.PI, 0, 0]} position={[0, 1.2, 0]} castShadow />
      <Cyl a={[0.04, 0.04, 1.2]} p={[0, 0.2, 0]} m={steel} seg={8} />
    </group>
    <mesh position={[0, 6.15, 0]} material={m.glow('#ff2a14', 2)}><sphereGeometry args={[0.1, 10, 8]} /></mesh>
    <RigidBody type="fixed" colliders={false}><CylinderCollider args={[3, 0.3]} position={[0, 3, 0]} /></RigidBody>
  </group>
}

/** Radiator panels standing beside the power plant: thin, white and edge-on to the sun. */
function Radiators() {
  const m = useMats()
  const at = localPoint('power', 0, 0, 7.3)
  return <group position={[at[0], 0, at[2]]} rotation={[0, MODULES.find((x) => x.id === 'power')!.angle, 0]}>
    <StaticBatch>
      {[-4.5, -1.5, 1.5, 4.5].map((x) => <group key={x} position={[x, 0, 0]}>
        <Box s={[2.6, 2.6, 0.08]} p={[0, 1.7, 0]} m={m.painted('#f1f2ee', 0.3, 0.15)} />
        {[-1.2, 1.2].map((dx) => <Box key={dx} s={[0.08, 3.0, 0.08]} p={[dx, 1.5, 0]} m={m.metal('#8f989e', 0.3)} />)}
        {Array.from({ length: 6 }, (_, i) => <Box key={i} s={[0.05, 2.5, 0.1]} p={[-1 + i * 0.4, 1.7, 0.05]} m={m.metal('#c9ced1', 0.25)} />)}
      </group>)}
    </StaticBatch>
  </group>
}

/** Rocks and boulders, scattered away from the base. */
function Rocks() {
  const rocks = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const a = i * 2.39996, r = 46 + i * 2.2
    return { x: HUB[0] + Math.cos(a) * r, z: HUB[1] + Math.sin(a) * r, size: 0.5 + (i * 7 % 13) / 5, id: ['moon_rock_01', 'moon_rock_02', 'moon_rock_03', 'moon_rock_05'][i % 4] }
  }).filter((r) => distanceToBase(r.x, r.z) > 6), [])
  return <StaticBatch>{rocks.map((r, i) => <RealModel key={i} id={r.id} p={[r.x, -.8, r.z]} height={r.size} r={i} />)}</StaticBatch>
}

/** A floodlight's beam: a soft wide spot with its target kept in the scene. */
function Flood({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const light = useMemo(() => {
    const l = new THREE.SpotLight('#fff1d8', 85, 26, 0.9, 0.8, 1.4)
    l.position.set(...from); l.target.position.set(...to)
    return l
  }, [from.join(), to.join()]) // Arrays are rebuilt every render: compare their values.
  useEffect(() => () => light.dispose(), [light])
  return <><primitive object={light} /><primitive object={light.target} /></>
}

export function LunarExterior() {
  const m = useMats()
  return <>
    <Ground />
    <HubCover />
    <SolarField />
    <Pad />
    <Rover />
    <CommsMast />
    <Radiators />
    <Rocks />
    <Bollards />
    {/* Masts: two by the pad, one at the airlock door, one between the hub and the solar field. */}
    <Mast x={ROCKET[0] + 7} z={ROCKET[1] + 7} face={-2.4} />
    <Mast x={ROCKET[0] - 7} z={ROCKET[1] - 7} face={0.8} />
    <Mast x={45} z={74.5} face={-1.2} />
    <Mast x={28} z={26} face={-2.3} height={6} />
    {/* Real light only where the player walks outside: the walkway and the pad. */}
    <Flood from={[45, 7, 74.5]} to={[38, 0, 80]} />
    <Flood from={[ROCKET[0] + 7, 7, ROCKET[1] + 7]} to={[ROCKET[0], 0, ROCKET[1]]} />
    <StaticBatch>
      {/* Flat, lit evacuation walkway over the regolith, on low footings. */}
      <Box s={[3, .15, 9]} p={[41, -.075, 77.5]} m={floorMaterial('grate', false, 'airlock')} />
      <Box s={[17, .15, 3]} p={[32.5 + 1.5, -.075, 80.5]} m={floorMaterial('grate', false, 'airlock')} />
      {[[41, 74], [41, 78], [41, 81.5], [36, 80.5], [31, 80.5], [27, 80.5]].map(([x, z]) => <Box key={`${x}${z}`} s={[3.2, 0.12, 0.3]} p={[x, -0.16, z]} r={[0, x === 41 ? 0 : Math.PI / 2, 0]} m={m.metal('#4b545b', 0.5)} />)}
      {/* A small hull for the airlock's outer door, so it reads as a door in the wall. */}
      <Box s={[2.8, 0.25, 0.6]} p={[41, CEIL + 0.05, 73.3]} m={hullMaterial('roof')} />
    </StaticBatch>
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[1.5, .1, 4.5]} position={[41, -.1, 77.5]} />
      <CuboidCollider args={[8.5, .1, 1.5]} position={[34, -.1, 80.5]} />
      <CylinderCollider args={[.1, 8.2]} position={[ROCKET[0], GROUND_Y + 0.05, ROCKET[1]]} />
    </RigidBody>
  </>
}
