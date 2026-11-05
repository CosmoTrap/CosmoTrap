import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CEIL } from '../game/maps'
import { HUB, MODULES, ROCKET, localPoint, lunarHub, lunarMap, type LunarModule } from '../game/lunar/map'
import { G, live } from '../game/state'
import { RoomCtx, ceilingMaterial, floorMaterial, hullMaterial, useMats, wallMaterial } from './materials'
import { pbrMaterial } from './assets'
import { roomPowerCut } from './roomPower'
import { RoundHub } from './RoundHub'
import { Door } from './Door'
import { Props } from './props/Props'
import { EntModels } from './props/EntModels'
import { StaticBatch } from './props/StaticBatch'
import { RealModel } from './props/RealModel'
import { Box, Cyl } from './props/models'
import { EmergencyLights } from './EmergencyLights'
import { Stars, MilkyWay, Sun } from './Exterior/Space'
import { Earth } from './Exterior/Earth'
import { drawTexture } from './textures'

function panel(width: number, door: boolean, windows: boolean) {
  const shape = new THREE.Shape(), l = -width / 2, r = width / 2
  shape.moveTo(l, 0)
  if (door) { shape.lineTo(-1, 0); shape.lineTo(-1, 2.3); shape.lineTo(1, 2.3); shape.lineTo(1, 0) }
  shape.lineTo(r, 0); shape.lineTo(r, CEIL); shape.lineTo(l, CEIL); shape.closePath()
  if (windows) for (const x of [-width / 4, width / 4]) {
    const hole = new THREE.Path(); hole.absarc(x, 1.5, 0.56, 0, Math.PI * 2, true); shape.holes.push(hole)
  }
  const geo = new THREE.ShapeGeometry(shape, 24), uv = geo.attributes.uv, p = geo.attributes.position
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2, p.getY(i) / CEIL)
  return geo
}

function RoomShell({ module: m }: { module: LunarModule }) {
  const materials = useMats(), room = lunarMap.rooms.find(r => r.id === m.id)!
  const light = useRef<THREE.PointLight>(null)
  const emit = useMemo(() => new THREE.MeshStandardMaterial({ color: '#192027', emissive: '#e6f3ff', emissiveIntensity: 4 }), [])
  const parts = useMemo(() => {
    const faces = [
      { x: 0, z: -m.depth / 2, r: 0, width: m.width, door: true, windows: false },
      { x: 0, z: m.depth / 2, r: Math.PI, width: m.width, door: m.id === 'airlock', windows: m.id !== 'airlock' },
      { x: -m.width / 2, z: 0, r: Math.PI / 2, width: m.depth, door: false, windows: true },
      { x: m.width / 2, z: 0, r: -Math.PI / 2, width: m.depth, door: false, windows: true },
    ]
    const wallParts = faces.map(f => panel(f.width, f.door, f.windows).rotateY(f.r).translate(f.x, 0, f.z))
    const hullParts = faces.map(f => panel(f.width, f.door, f.windows).translate(0, 0, -0.12).rotateY(f.r).translate(f.x, 0, f.z))
    const wall = mergeGeometries(wallParts)!, hull = mergeGeometries(hullParts)!
    wallParts.forEach(g => g.dispose()); hullParts.forEach(g => g.dispose())
    const floor = new THREE.PlaneGeometry(m.width, m.depth).rotateX(-Math.PI / 2)
    const uv = floor.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * m.width / 2, uv.getY(i) * m.depth / 2)
    const ceiling = floor.clone().rotateZ(Math.PI).translate(0, CEIL, 0)
    return { wall, hull, floor, ceiling, faces }
  }, [m])
  useEffect(() => () => { emit.dispose(); parts.wall.dispose(); parts.hull.dispose(); parts.floor.dispose(); parts.ceiling.dispose() }, [parts, emit])
  useFrame((_, dt) => {
    const on = !roomPowerCut(room)
    if (light.current) light.current.intensity = THREE.MathUtils.damp(light.current.intensity, on ? 26 : 0, 8, Math.min(dt, 0.1))
    emit.emissiveIntensity = on ? 4 : 0
  })
  const entrance = localPoint(m.id, 0, 0, -m.depth / 2)
  return <>
    <group name={`lunar-module:${m.id}`} position={[m.center[0], 0, m.center[1]]} rotation={[0, m.angle, 0]}>
      <mesh name="lunar-inner-wall" geometry={parts.wall} material={wallMaterial(m.theme, false, m.id)} renderOrder={-1} castShadow receiveShadow />
      <mesh name="lunar-outer-wall" geometry={parts.hull} material={hullMaterial('wall', m.theme)} castShadow receiveShadow />
      <mesh geometry={parts.floor} material={floorMaterial(m.id === 'power' ? 'grate' : 'plate', false, m.id)} renderOrder={-1} castShadow receiveShadow />
      <mesh geometry={parts.ceiling} material={ceilingMaterial(false, m.id)} renderOrder={-1} castShadow receiveShadow />
      <pointLight name={`lunar-light:${m.id}`} ref={light} position={[0, 1.9, 0]} intensity={26} distance={17} decay={1.5} color={m.light} />
      <StaticBatch>
        <Box s={[m.width + 0.2, 0.1, m.depth + 0.2]} p={[0, CEIL + 0.09, 0]} m={hullMaterial('roof')} />
        {[-3, 0, 3].map(x => <Box key={x} s={[1.4, 0.05, 0.22]} p={[x, CEIL - 0.06, 0]} m={emit} cast={false} />)}
        {parts.faces.map((f, i) => <group key={i} position={[f.x, 0, f.z]} rotation={[0, f.r, 0]}>
          {f.windows && [-f.width / 4, f.width / 4].map(x => <group key={x} position={[x, 1.5, 0]}>
            <mesh material={materials.glass('#a8cbd9', 0.08)}><circleGeometry args={[0.56, 40]} /></mesh>
            <mesh material={materials.metal('#919da3', 0.3)} castShadow><torusGeometry args={[0.59, 0.04, 10, 40]} /></mesh>
          </group>)}
          <Box s={[f.width, 0.08, 0.08]} p={[0, 2.64, 0.035]} m={materials.metal('#727e83')} />
          {Array.from({ length: Math.ceil(f.width / 2) + 1 }, (_, j) => -f.width / 2 + j * 2).filter(x => !f.door || Math.abs(x) > 1).map(x => <Box key={x} s={[0.035, CEIL, 0.04]} p={[x, CEIL / 2, 0.02]} m={materials.metal('#627078')} />)}
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

function Tunnel({ module: m }: { module: LunarModule }) {
  const length = m.distance - m.depth / 2 - 7, mid = 7 + length / 2
  const materials = useMats()
  return <group name={`lunar-tunnel:${m.id}`} position={[HUB[0] + Math.sin(m.angle) * mid, 0, HUB[1] + Math.cos(m.angle) * mid]} rotation={[0, m.angle, 0]}>
    <StaticBatch>
      <Box s={[2, 0.1, length + 0.15]} p={[0, -0.05, 0]} m={floorMaterial('rubber', false, 'l_hub')} />
      <Box s={[2.25, 0.13, length + 0.15]} p={[0, CEIL + 0.065, 0]} m={ceilingMaterial(false, 'l_hub')} />
      {[-1, 1].map(side => <group key={side}>
        <Box s={[0.14, CEIL, length + 0.1]} p={[side * 1.07, CEIL / 2, 0]} m={wallMaterial('station', false, 'l_hub')} />
        <Box s={[0.02, 0.04, length]} p={[side * 0.987, 0.12, 0]} m={materials.glow('#59b3d1', 0.8)} cast={false} />
      </group>)}
    </StaticBatch>
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider position={[0, -0.1, 0]} args={[1.05, 0.1, length / 2 + 0.1]} />
      <CuboidCollider position={[0, CEIL + 0.1, 0]} args={[1.1, 0.1, length / 2 + 0.1]} />
      {[-1, 1].map(side => <CuboidCollider key={side} position={[side * 1.07, CEIL / 2, 0]} args={[0.07, CEIL / 2, length / 2 + 0.05]} />)}
    </RigidBody>
  </group>
}

function LunarSurface() {
  const material = useMemo(() => pbrMaterial('moon_01', { repeat: [60, 60], rough: 1, metal: 0, normal: 0.8, env: 0.15 }), [])
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(500, 500, 100, 100).rotateX(-Math.PI / 2), p = g.attributes.position
    const craters = [[-70, -80, 27], [95, -40, 18], [-90, 90, 35], [85, 100, 30]]
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i)
      let y = -0.8 + (Math.sin(x * .12) * Math.cos(z * .17) + Math.sin(z * .29) * .3) * .12
      for (const [cx, cz, r] of craters) { const d = Math.hypot(x - cx, z - cz) / r; y += Math.exp(-(((d - 1) / .12) ** 2)) * 1.8 - Math.max(0, 1 - d * d) * 3 }
      p.setY(i, y)
    }
    g.computeVertexNormals(); return g
  }, [])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  const mats = useMats()
  return <>
    <RigidBody type="fixed" colliders="trimesh"><mesh name="lunar-ground" geometry={geometry} material={material} position={[41, 0, 41]} receiveShadow /></RigidBody>
    <StaticBatch>
      {Array.from({ length: 44 }, (_, i) => {
        const a = i * 2.39996, r = 60 + i * 2.7, size = 0.6 + (i * 7 % 13) / 5
        return <RealModel key={i} id={['moon_rock_01', 'moon_rock_02', 'moon_rock_03', 'moon_rock_05'][i % 4]} p={[41 + Math.cos(a) * r, -.8, 41 + Math.sin(a) * r]} height={size} r={i} />
      })}
      {[0, 1, 2].map(row => <group key={row} position={[15, 0.3, 10 + row * 3.5]} rotation={[.32, 0, 0]}>
        <Box s={[12, .12, 2.8]} m={mats.metal('#323f5c', 0.28)} />
        {Array.from({ length: 12 }, (_, i) => <Box key={i} s={[.9, .015, 2.6]} p={[-5.5 + i, .075, 0]} m={mats.painted('#1d4168', .26, .7)} cast={false} />)}
      </group>)}
      {/* Flat, lit evacuation walkway over the rough regolith. */}
      <Box s={[3, .15, 9]} p={[41, -.075, 77.5]} m={floorMaterial('grate', false, 'airlock')} />
      <Box s={[20, .15, 3]} p={[32, -.075, 80.5]} m={floorMaterial('grate', false, 'airlock')} />
    </StaticBatch>
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[1.5, .1, 4.5]} position={[41, -.1, 77.5]} />
      <CuboidCollider args={[10, .1, 1.5]} position={[32, -.1, 80.5]} />
    </RigidBody>
  </>
}

function Rocket() {
  const m = useMats(), body = useRef<THREE.Group>(null), exhaust = useRef<THREE.Group>(null)
  const fire = useRef<THREE.PointLight>(null)
  const label = useMemo(() => {
    const t = drawTexture(512, 128, c => { c.fillStyle = '#131f2a'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#eef4f7'; c.font = 'bold 60px sans-serif'; c.fillText('SELENE · LV-1', 20, 85) })
    return new THREE.MeshStandardMaterial({ map: t, roughness: .6 })
  }, [])
  useEffect(() => () => { label.map?.dispose(); label.dispose() }, [label])
  useFrame(() => {
    const t = G().cine === 'lunarLaunch' ? (performance.now() - G().cineT0) / 1000 : 0
    if (body.current) body.current.position.y = Math.max(0, t - 3) ** 2 * 1.6
    if (exhaust.current) { exhaust.current.visible = t > 2.7; exhaust.current.scale.y = .95 + Math.sin(t * 36) * .05 }
    if (fire.current) fire.current.intensity = t > 2.7 ? 70 : 0
  })
  return <group position={[ROCKET[0], 0, ROCKET[1]]} name="lunar-rocket">
    <Cyl a={[4, 4, .25]} p={[0, -.125, 0]} m={m.metal('#49545c', .7)} seg={48} />
    <group ref={body} name="lunar-rocket-body">
      <Cyl a={[1.35, 1.6, 6]} p={[0, 5, 0]} m={m.painted('#b9c3c7', .4, .6)} seg={48} />
      <Cyl a={[.1, 1.35, 2.5]} p={[0, 9.25, 0]} m={m.painted('#bec8cd', .4, .7)} seg={48} />
      <Cyl a={[1.6, 1.6, .35]} p={[0, 2.15, 0]} m={m.painted('#db713c', .4, .6)} seg={48} />
      <Cyl a={[.6, 1, 1.2]} p={[0, 1.4, 0]} m={m.metal('#42494d')} seg={32} />
      <group ref={exhaust} name="lunar-engine-plume" visible={false} position={[0, .8, 0]}>
        <mesh position={[0, -2.3, 0]}><cylinderGeometry args={[.65, .03, 4.6, 24]} /><meshBasicMaterial color="#ff9e3d" transparent opacity={.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
        <mesh position={[0, -1.5, 0]}><cylinderGeometry args={[.38, .02, 3, 24]} /><meshBasicMaterial color="#c6e6ff" transparent opacity={.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
      </group>
      <pointLight ref={fire} intensity={0} color="#ffb763" distance={15} position={[0, .6, 0]} />
      {[0, 1, 2, 3].map(i => <group key={i} rotation={[0, i * Math.PI / 2, 0]}>
        <Cyl a={[.09, .09, 2.6]} p={[2, 1.2, 0]} r={[0, 0, .5]} m={m.metal('#89949c')} seg={12} />
        <Box s={[1.2, .12, .9]} p={[2.6, .06, 0]} m={m.metal('#65727c')} />
      </group>)}
      <mesh position={[0, 5, -1.57]} rotation={[0, Math.PI, 0]} material={label}><planeGeometry args={[2, .5]} /></mesh>
    </group>
    <RigidBody type="fixed" colliders={false}><CylinderCollider args={[4, 1.65]} position={[0, 5, 0]} /><CylinderCollider args={[.125, 4]} position={[0, -.125, 0]} /></RigidBody>
  </group>
}

export function LunarWorld({ shadows }: { shadows: boolean }) {
  const sun = useMemo(() => new THREE.Vector3(...lunarMap.sun).normalize(), [])
  const hubLight = useRef<THREE.PointLight>(null)
  useFrame((_, dt) => { if (hubLight.current) hubLight.current.intensity = THREE.MathUtils.damp(hubLight.current.intensity, roomPowerCut(lunarHub) ? 0 : 18, 8, Math.min(dt, .1)) })
  return <>
    <MilkyWay /><Stars count={9000} /><Sun dir={sun} />
    <Earth radius={95} position={[-900, 320, -1800]} sun={sun} />
    <LunarSurface />
    <RoundHub room={lunarHub} zone={1} shadows={shadows} />
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[.1, 7.02]} position={[HUB[0], -.1, HUB[1]]} />
      <CylinderCollider args={[.1, 7.02]} position={[HUB[0], CEIL + .1, HUB[1]]} />
    </RigidBody>
    <pointLight name="lunar-light:hub" ref={hubLight} position={[41, 2, 41]} color="#acc9ef" intensity={18} distance={12} />
    {MODULES.map(m => <RoomCtx.Provider key={m.id} value={{ id: m.id, dark: false }}><RoomShell module={m} /><Tunnel module={m} /></RoomCtx.Provider>)}
    <Door id="lunar_exterior" room="airlock" x={41} z={73} alongZ />
    <Props map={lunarMap} /><EntModels zone={1} /><EmergencyLights map={lunarMap} />
    <Rocket />
  </>
}
