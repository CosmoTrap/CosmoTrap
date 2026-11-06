import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CEIL } from '../../game/maps'
import { HUB, MODULES, localPoint, lunarMap, type Face, type LunarModule } from '../../game/lunar/map'
import { ceilingMaterial, floorMaterial, hullMaterial, useMats, wallMaterial } from '../materials'
import { roomPowerCut } from '../roomPower'
import { Door } from '../Door'
import { StaticBatch } from '../props/StaticBatch'
import { Box } from '../props/models'
import { drawTexture } from '../textures'
import { GROUND_Y, regolithMaterial, vaultGeometry } from './shared'

const WINDOW_R = 0.56, WINDOW_Y = 1.5

/** The four walls of a module, in the same order everywhere: where they stand and which way they face. */
function facesOf(m: LunarModule) {
  const faces: { face: Face; x: number; z: number; r: number; width: number; door: boolean }[] = [
    { face: 'front', x: 0, z: -m.depth / 2, r: 0, width: m.width, door: true },
    { face: 'back', x: 0, z: m.depth / 2, r: Math.PI, width: m.width, door: m.id === 'airlock' },
    { face: 'left', x: -m.width / 2, z: 0, r: Math.PI / 2, width: m.depth, door: false },
    { face: 'right', x: m.width / 2, z: 0, r: -Math.PI / 2, width: m.depth, door: false },
  ]
  // Window positions are given along the module's axes; convert them to each panel's own x.
  const local = (face: Face, along: number) => face === 'back' || face === 'left' ? -along : along
  return faces.map((f) => ({ ...f, windows: m.windows.filter(([face]) => face === f.face).map(([face, along]) => local(face, along)) }))
}

/** One wall panel: a door opening at the bottom centre and round holes for its portholes. */
function panel(width: number, door: boolean, windows: number[]) {
  const shape = new THREE.Shape(), l = -width / 2, r = width / 2
  shape.moveTo(l, 0)
  if (door) { shape.lineTo(-1, 0); shape.lineTo(-1, 2.3); shape.lineTo(1, 2.3); shape.lineTo(1, 0) }
  shape.lineTo(r, 0); shape.lineTo(r, CEIL); shape.lineTo(l, CEIL); shape.closePath()
  for (const x of windows) {
    const hole = new THREE.Path(); hole.absarc(x, WINDOW_Y, WINDOW_R, 0, Math.PI * 2, true); shape.holes.push(hole)
  }
  const geo = new THREE.ShapeGeometry(shape, 24), uv = geo.attributes.uv, p = geo.attributes.position
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2, p.getY(i) / CEIL)
  return geo
}

/** Module number and name, painted on the outer wall. */
function plateMaterial(code: string, name: string) {
  const t = drawTexture(512, 128, (c) => {
    c.fillStyle = '#1b2430'; c.fillRect(0, 0, 512, 128)
    c.fillStyle = '#e8602a'; c.fillRect(0, 0, 14, 128)
    c.fillStyle = '#f2f4f5'; c.font = '800 54px Inter, Arial, sans-serif'; c.fillText(code, 34, 62)
    c.font = '600 30px Inter, Arial, sans-serif'; c.fillStyle = '#b9c4cf'; c.fillText(name.toUpperCase(), 34, 104)
  })
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })
}

export function LunarModuleShell({ module: m }: { module: LunarModule }) {
  const materials = useMats(), room = lunarMap.rooms.find(r => r.id === m.id)!
  const light = useRef<THREE.PointLight>(null)
  const lampRef = useRef<THREE.InstancedMesh>(null), housingRef = useRef<THREE.InstancedMesh>(null)
  const index = MODULES.indexOf(m)
  const lampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9ced1', roughness: 0.42, emissive: m.light, emissiveIntensity: 3.4 }), [m.light])
  const plate = useMemo(() => plateMaterial(`M-0${index + 1}`, m.name), [index, m.name])
  // Two rows of round LED panels, as in the station, clear of the beacons on the middle line.
  const lamps = useMemo(() => [-1, 1].flatMap((row) => [-1, 0, 1].map((k) => [k * m.width / 3, row * m.depth / 4] as [number, number])), [m])
  const parts = useMemo(() => {
    const faces = facesOf(m)
    const wallParts = faces.map(f => panel(f.width, f.door, f.windows).rotateY(f.r).translate(f.x, 0, f.z))
    const hullParts = faces.map(f => panel(f.width, f.door, f.windows).translate(0, 0, -0.12).rotateY(f.r).translate(f.x, 0, f.z))
    const wall = mergeGeometries(wallParts)!, hull = mergeGeometries(hullParts)!
    wallParts.forEach(g => g.dispose()); hullParts.forEach(g => g.dispose())
    const floor = new THREE.PlaneGeometry(m.width, m.depth).rotateX(-Math.PI / 2)
    const uv = floor.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * m.width / 2, uv.getY(i) * m.depth / 2)
    const ceiling = floor.clone().rotateZ(Math.PI).translate(0, CEIL, 0)
    // Packed regolith over the roof: radiation shielding, and what the base looks like from outside.
    const vault = vaultGeometry(m.width + 0.6, m.depth + 0.9, 1.6)
    return { wall, hull, floor, ceiling, faces, vault }
  }, [m])
  useEffect(() => () => {
    lampMat.dispose(); plate.map?.dispose(); plate.dispose()
    ;[parts.wall, parts.hull, parts.floor, parts.ceiling, parts.vault].forEach(g => g.dispose())
  }, [parts, lampMat, plate])
  useEffect(() => {
    const mtx = new THREE.Matrix4()
    lamps.forEach(([x, z], i) => {
      lampRef.current!.setMatrixAt(i, mtx.makeTranslation(x, CEIL - 0.125, z))
      housingRef.current!.setMatrixAt(i, mtx.makeTranslation(x, CEIL - 0.06, z))
    })
    for (const r of [lampRef, housingRef]) { r.current!.instanceMatrix.needsUpdate = true; r.current!.computeBoundingSphere() }
  }, [lamps])
  useFrame((_, dt) => {
    const on = !roomPowerCut(room)
    if (light.current) light.current.intensity = THREE.MathUtils.damp(light.current.intensity, on ? 26 : 0, 8, Math.min(dt, 0.1))
    lampMat.emissiveIntensity = on ? 3.4 : 0
  })
  const entrance = localPoint(m.id, 0, 0, -m.depth / 2)
  const rib = materials.metal('#8b949a', 0.35), skirt = materials.metal('#4b545b', 0.5)
  return <>
    <group name={`lunar-module:${m.id}`} position={[m.center[0], 0, m.center[1]]} rotation={[0, m.angle, 0]}>
      <mesh name="lunar-inner-wall" geometry={parts.wall} material={wallMaterial(m.theme, false, m.id)} renderOrder={-1} castShadow receiveShadow />
      <mesh name="lunar-outer-wall" geometry={parts.hull} material={hullMaterial('wall', m.theme)} castShadow receiveShadow />
      <mesh geometry={parts.floor} material={floorMaterial(m.id === 'power' ? 'grate' : 'plate', false, m.id)} renderOrder={-1} castShadow receiveShadow />
      <mesh geometry={parts.ceiling} material={ceilingMaterial(false, m.id)} renderOrder={-1} castShadow receiveShadow />
      <mesh name="lunar-regolith" geometry={parts.vault} material={regolithMaterial()} position={[0, CEIL + 0.14, 0]} castShadow receiveShadow />
      <pointLight name={`lunar-light:${m.id}`} ref={light} position={[0, 1.9, 0]} intensity={26} distance={m.width + 4} decay={1.5} color={m.light} />
      <instancedMesh ref={housingRef} args={[undefined, undefined, lamps.length]} material={materials.metal('#8d9499', 0.3)} receiveShadow>
        <cylinderGeometry args={[0.36, 0.4, 0.12, 40]} />
      </instancedMesh>
      <instancedMesh name={`ceiling-light:${m.id}`} ref={lampRef} args={[undefined, undefined, lamps.length]} material={lampMat}>
        <cylinderGeometry args={[0.33, 0.33, 0.012, 40]} />
      </instancedMesh>
      <StaticBatch>
        {/* Roof deck under the regolith, and the foundation sill the module rests on. */}
        <Box s={[m.width + 0.3, 0.12, m.depth + 0.3]} p={[0, CEIL + 0.09, 0]} m={hullMaterial('roof')} />
        <Box s={[m.width + 0.5, 0.5, m.depth + 0.5]} p={[0, GROUND_Y - 0.2, 0]} m={skirt} />
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} s={[0.7, 0.24, 0.7]} p={[sx * (m.width / 2 + 0.05), GROUND_Y + 0.04, sz * (m.depth / 2 + 0.05)]} m={rib} />))}
        {parts.faces.map((f, i) => <group key={i} position={[f.x, 0, f.z]} rotation={[0, f.r, 0]}>
          {f.windows.map(x => <group key={x} position={[x, WINDOW_Y, 0]}>
            <mesh material={materials.metal('#919da3', 0.3)} castShadow><torusGeometry args={[WINDOW_R + 0.03, 0.04, 10, 40]} /></mesh>
            {/* Outer frame, on the hull. */}
            <mesh position={[0, 0, -0.13]} material={rib}><torusGeometry args={[WINDOW_R + 0.05, 0.06, 8, 40]} /></mesh>
          </group>)}
          {/* Inside: cornice and the panel ribs; outside: heavier ribs and a dust skirt. */}
          <Box s={[f.width, 0.08, 0.08]} p={[0, 2.64, 0.035]} m={materials.metal('#727e83')} />
          {Array.from({ length: Math.ceil(f.width / 2) + 1 }, (_, j) => -f.width / 2 + j * 2)
            .filter(x => (!f.door || Math.abs(x) > 1.1) && f.windows.every(w => Math.abs(x - w) > WINDOW_R + 0.1))
            .map(x => <group key={x}>
              <Box s={[0.035, CEIL, 0.04]} p={[x, CEIL / 2, 0.02]} m={materials.metal('#627078')} />
              <Box s={[0.1, CEIL, 0.08]} p={[x, CEIL / 2, -0.17]} m={rib} />
            </group>)}
          <Box s={[f.width + 0.1, 0.32, 0.06]} p={[0, 0.16, -0.16]} m={skirt} />
          {f.face === 'back' && !f.door && <mesh position={[0, 2.2, -0.215]} rotation={[0, Math.PI, 0]} material={plate}><planeGeometry args={[2.4, 0.6]} /></mesh>}
        </group>)}
      </StaticBatch>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[0, -0.1, 0]} args={[m.width / 2, 0.1, m.depth / 2]} />
        <CuboidCollider position={[0, CEIL + 0.1, 0]} args={[m.width / 2, 0.1, m.depth / 2]} />
        {parts.faces.flatMap((f, i) => f.door ? [-1, 1].map(side => <CuboidCollider key={`${i}:${side}`} position={[f.x + Math.cos(f.r) * side * (f.width / 2 + 1) / 2, CEIL / 2, f.z - Math.sin(f.r) * side * (f.width / 2 + 1) / 2]} rotation={[0, f.r, 0]} args={[(f.width / 2 - 1) / 2, CEIL / 2, 0.14]} />) : [<CuboidCollider key={i} position={[f.x, CEIL / 2, f.z]} rotation={[0, f.r, 0]} args={[f.width / 2, CEIL / 2, 0.14]} />])}
      </RigidBody>
    </group>
    <Door id={`lunar_${m.id}`} room={m.id} x={entrance[0]} z={entrance[2]} alongZ rotationY={m.angle} />
  </>
}

/** Pressurised corridor from the hub to a module, buried under the same regolith. */
export function LunarTunnel({ module: m }: { module: LunarModule }) {
  const length = m.distance - m.depth / 2 - 7, mid = 7 + length / 2
  const materials = useMats()
  const vault = useMemo(() => vaultGeometry(length + 0.2, 3.4, 1.0).rotateY(Math.PI / 2), [length])
  useEffect(() => () => vault.dispose(), [vault])
  return <group name={`lunar-tunnel:${m.id}`} position={[HUB[0] + Math.sin(m.angle) * mid, 0, HUB[1] + Math.cos(m.angle) * mid]} rotation={[0, m.angle, 0]}>
    <mesh geometry={vault} material={regolithMaterial()} position={[0, CEIL + 0.13, 0]} castShadow receiveShadow />
    <StaticBatch>
      <Box s={[2, 0.1, length + 0.15]} p={[0, -0.05, 0]} m={floorMaterial('rubber', false, 'l_hub')} />
      <Box s={[2.25, 0.13, length + 0.15]} p={[0, CEIL + 0.065, 0]} m={ceilingMaterial(false, 'l_hub')} />
      <Box s={[2.7, 0.4, length]} p={[0, GROUND_Y - 0.16, 0]} m={materials.metal('#4b545b', 0.5)} />
      {[-1, 1].map(side => <group key={side}>
        <Box s={[0.14, CEIL, length + 0.1]} p={[side * 1.07, CEIL / 2, 0]} m={wallMaterial('station', false, 'l_hub')} />
        <Box s={[0.04, CEIL, length + 0.1]} p={[side * 1.17, CEIL / 2, 0]} m={hullMaterial('wall', 'station')} />
        <Box s={[0.02, 0.04, length]} p={[side * 0.987, 0.12, 0]} m={materials.glow('#59b3d1', 0.8)} cast={false} />
        {/* Handrail and a lit strip under the ceiling, as in the station's links. */}
        <Box s={[0.05, 0.05, length]} p={[side * 0.95, 1.0, 0]} m={materials.metal('#a7afb4', 0.25)} />
        <Box s={[0.02, 0.03, length]} p={[side * 0.9, CEIL - 0.08, 0]} m={materials.glow('#e6f3ff', 1.2)} cast={false} />
      </group>)}
      {Array.from({ length: Math.max(1, Math.floor(length / 2.5)) }, (_, i) => -length / 2 + 1.25 + i * 2.5).map(z =>
        <Box key={z} s={[2.2, 0.08, 0.08]} p={[0, CEIL - 0.04, z]} m={materials.metal('#627078')} />)}
    </StaticBatch>
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider position={[0, -0.1, 0]} args={[1.05, 0.1, length / 2 + 0.1]} />
      <CuboidCollider position={[0, CEIL + 0.1, 0]} args={[1.1, 0.1, length / 2 + 0.1]} />
      {[-1, 1].map(side => <CuboidCollider key={side} position={[side * 1.07, CEIL / 2, 0]} args={[0.07, CEIL / 2, length / 2 + 0.05]} />)}
    </RigidBody>
  </group>
}
