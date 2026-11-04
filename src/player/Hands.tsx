import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { G, live, useGame } from '../game/state'
import { preloadModels } from '../world/assets'
import { useMats } from '../world/materials'
import { Box, Cyl } from '../world/props/models'
import { textTexture } from '../world/textures'
import { HeldItem } from './HandheldModels'
import { handFabric } from './handMaterials'
import { skinOf } from '../world/skins'
import { TABLET_RAISE_MS } from './tabletMotion'

type V3 = [number, number, number]

function Stitch({ points, radius = 0.001, material }: { points: V3[]; radius?: number; material: THREE.Material }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 24, radius, 8, false), [JSON.stringify(points), radius])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={material} receiveShadow />
}

/** Closed EVA glove, centered on the grip rather than floating below the tool. */
function Glove({ side = 1, sleeve = true }: { side?: 1 | -1; sleeve?: boolean }) {
  const m = useMats()
  const character = useGame((s) => s.character)
  const look = skinOf(character)
  const cloth = handFabric(look.suit)
  const leather = handFabric(look.body, true)
  const rubber = m.rubber('#303a39')
  const seam = m.fabric('#c3c1b0')
  return <group scale={[side, 1, 1]} name="eva-glove">
    {sleeve && <group position={[0.012, -0.20, 0.11]} rotation={[-0.34, 0, -0.06]}>
      <mesh material={cloth} receiveShadow><cylinderGeometry args={[0.048, 0.064, 0.26, 24]} /></mesh>
      {[-0.085, -0.057, -0.025].map((y) => <mesh key={y} position={[0, y, 0]} material={cloth} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.053, 0.004, 8, 32]} />
      </mesh>)}
      <Box s={[0.055, 0.09, 0.005]} p={[0, 0.012, 0.05]} m={leather} />
      <Stitch points={[[-0.028, -0.03, 0.051], [-0.028, 0.055, 0.051], [0.028, 0.055, 0.051], [0.028, -0.03, 0.051]]} material={seam} />
    </group>}
    <group position={[0.006, -0.079, 0.063]} rotation={[-0.25, 0, 0]}>
      <Cyl a={[0.048, 0.05, 0.025]} m={rubber} seg={32} />
      <Cyl a={[0.05, 0.05, 0.005]} p={[0, -0.007, 0]} m={m.painted('#8b5235', 0.65, 0.15)} seg={32} />
      <Box s={[0.032, 0.019, 0.008]} p={[0, 0, 0.05]} m={m.metal('#707976', 0.45)} />
    </group>
    <Box s={[0.08, 0.095, 0.046]} p={[0.009, -0.013, 0.047]} r={[-0.12, 0.08, -0.04]} m={cloth} />
    <mesh position={[0.012, -0.012, 0.071]} rotation={[-0.12, 0.08, -0.04]} scale={[0.033, 0.04, 0.008]} material={leather}>
      <sphereGeometry args={[1, 24, 16]} />
    </mesh>
    <Stitch points={[[-0.018, -0.04, 0.078], [-0.022, 0.015, 0.075], [0.035, 0.02, 0.071], [0.039, -0.038, 0.078]]} material={seam} />
    {[0, 1, 2, 3].map((i) => {
      const y = 0.03 - i * 0.021
      const r = i === 3 ? 0.0085 : 0.0102
      return <group key={i}>
        <Stitch radius={r} points={[[0.038, y - 0.008, 0.047], [0.05, y, 0.023], [0.039, y + 0.004, -0.006], [0.012, y + 0.003, -0.025], [-0.019, y, -0.015]]} material={cloth} />
        <mesh position={[0.045, y + 0.003, 0.016]} rotation={[0, 0.4, 0]} scale={[0.9, 0.7, 1.5]} material={rubber}>
          <sphereGeometry args={[r, 16, 12]} />
        </mesh>
        <mesh position={[-0.016, y, -0.015]} scale={[1.1, 0.8, 1]} material={leather}><sphereGeometry args={[r, 16, 12]} /></mesh>
      </group>
    })}
    <Stitch points={[[-0.026, -0.04, 0.047], [-0.048, -0.012, 0.025], [-0.044, 0.031, -0.002], [-0.012, 0.049, -0.025]]} radius={0.013} material={cloth} />
    <mesh position={[-0.012, 0.049, -0.025]} scale={[1.15, 0.85, 0.75]} material={leather}><sphereGeometry args={[0.014, 16, 12]} /></mesh>
  </group>
}

function TabletModel() {
  const m = useMats()
  const character = useGame((s) => s.character)
  const cloth = handFabric(skinOf(character).suit)
  const screen = useMemo(() => {
    const map = textTexture(['SELENE-7  /  NAV', 'PLAN   JOURNAL   MESSAGES', 'TERMINAL • CONNECTED', 'INVENTORY / CREW SYSTEMS'],
      { w: 1024, h: 640, size: 44, bg: '#10142e', fg: '#9bb3ed', pad: 50 })
    return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#8eb7b9', emissiveIntensity: 0.45, roughness: 0.26, metalness: 0.05 })
  }, [])
  useEffect(() => () => { screen.map?.dispose(); screen.dispose() }, [screen])
  return <group name="left-wrist-tablet">
    <group name="left-forearm" position={[-0.09, -0.04, -0.105]} rotation={[0, 0, -Math.PI / 2]}>
      <mesh material={cloth}><cylinderGeometry args={[0.057, 0.084, 0.60, 32]} /></mesh>
      {[-0.23, -0.20, -0.17].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={cloth}><torusGeometry args={[0.077, 0.004, 8, 32]} /></mesh>)}
    </group>
    {[-0.12, 0.12].map((x) => {
      const radius = 0.084 - (x + 0.39) * 0.045 + 0.003
      return <group key={x}>
        <mesh position={[x, -0.04, -0.105]} rotation={[0, 0, -Math.PI / 2]} material={m.rubber('#1d232b')}>
          <cylinderGeometry args={[radius - 0.001, radius + 0.001, 0.04, 32, 1, true]} />
        </mesh>
        <Box s={[0.044, 0.09, 0.025]} p={[x, -0.04, -0.025]} m={m.rubber('#1d232b')} />
        <Box s={[0.055, 0.025, 0.025]} p={[x, -0.04 - radius, -0.105]} m={m.metal('#828b98', 0.35)} />
      </group>
    })}
    <Box s={[0.425, 0.285, 0.021]} m={m.metal('#474f51', 0.4)} />
    <Box s={[0.409, 0.269, 0.025]} m={m.rubber()} />
    <Box s={[0.365, 0.233, 0.003]} p={[0, 0, 0.013]} m={m.plastic('#111c20')} />
    <mesh position={[0, 0, 0.015]} material={screen}><planeGeometry args={[0.355, 0.223]} /></mesh>
    {[-1, 1].flatMap((x) => [-1, 1].map((y) => <Cyl key={`${x}:${y}`} a={[0.003, 0.003, 0.002]} p={[x * 0.199, y * 0.124, 0.014]} r={[Math.PI / 2, 0, 0]} m={m.metal('#979a92')} seg={12} />))}
    <Cyl a={[0.003, 0.003, 0.002]} p={[0.19, 0.105, 0.015]} r={[Math.PI / 2, 0, 0]} m={m.glow('#89bfb1', 0.6)} seg={12} />
    {/* This glove joins the continuous forearm above; its generic tool sleeve would cross the display. */}
    <group position={[0.30, -0.035, -0.173]} rotation={[0, 0, -Math.PI / 2]}><Glove side={-1} sleeve={false} /></group>
  </group>
}

export function Hands() {
  const g = useRef<THREE.Group>(null)
  const tablet = useRef<THREE.Group>(null)
  const held = useRef<THREE.Group>(null)
  const open = useGame((s) => s.tabletOpen)
  const item = useGame((s) => s.held)
  const k = useRef(0)
  const raise = useRef(0)
  useEffect(() => { preloadModels(['adjustable_wrench']) }, [])
  useEffect(() => { raise.current = 0 }, [item])
  useFrame(({ camera, clock }, rawDt) => {
    if (!g.current) return
    const s = G()
    const dt = Math.min(rawDt, 0.05)
    g.current.position.copy(camera.position)
    g.current.quaternion.copy(camera.quaternion)
    const blocked = s.loading < 1 || !!s.cine || !!live.camOverride
    g.current.visible = !blocked
    if (blocked) k.current = 0
    else if (s.tabletOpen) k.current = Math.min(1, (performance.now() - s.tabletOpenedAt) / TABLET_RAISE_MS)
    else k.current = Math.max(0, k.current - dt * 3.5)
    const e = THREE.MathUtils.smootherstep(k.current, 0, 1)
    if (tablet.current) {
      tablet.current.visible = k.current > 0.01
      tablet.current.position.set(-0.43 + e * 0.39, -0.74 + e * 0.69, -0.48 - e * 0.12)
      tablet.current.rotation.set(-0.75 * (1 - e), -0.5 * (1 - e), 0.8 * (1 - e) + 0.035)
      tablet.current.userData.raiseProgress = k.current
    }
    if (!blocked && s.tabletOpen && !s.tabletReady && k.current === 1) useGame.setState({ tabletReady: true })
    if (held.current) {
      raise.current = THREE.MathUtils.damp(raise.current, 1, 12, dt)
      const wide = item === 'carBattery' || item === 'manual' || item === 'map'
      const motion = Math.min(live.speed / 2.5, 1)
      const sway = Math.sin(clock.elapsedTime * 1.5) * 0.002 + Math.sin(clock.elapsedTime * 7) * 0.003 * motion
      held.current.visible = !!item && !open && k.current < 0.02
      held.current.position.set(wide ? 0.12 : 0.23, -0.20 + sway - (1 - raise.current) * 0.18, wide ? -0.47 : -0.43)
      held.current.rotation.set((1 - raise.current) * 0.25, Math.sin(clock.elapsedTime * 1.1) * 0.009, sway * 1.4)
    }
  })
  const right: V3 = item === 'carBattery' ? [0.115, 0.015, 0] : item === 'badge' ? [0.042, 0.008, 0]
    : item === 'manual' || item === 'map' ? [0.075, 0.03, 0] : [0, 0, 0]
  return <group ref={g} name="first-person-hands">
    <group ref={tablet} name="tablet-arm-animation" visible={false}><TabletModel /></group>
    <group ref={held} visible={false} name="held-item">
      <group position={right}><Glove /></group>
      {(item === 'carBattery' || item === 'manual' || item === 'map') && <group position={[-right[0], right[1], 0]}><Glove side={-1} /></group>}
      {item && <HeldItem item={item} />}
    </group>
  </group>
}
